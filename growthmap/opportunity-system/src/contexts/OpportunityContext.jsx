import React, { createContext, useContext, useReducer, useEffect, useRef, useState, useCallback } from 'react';
import { loadAppData, saveAppData } from '../utils/storage';
import { createEmptyOpportunity, migrateData } from '../utils/schema';
import { carryOverAdditiveFields } from '../utils/additiveFields';
import { SCHEMA_VERSION } from '../utils/constants';
import { useAuth } from '../lib/cloud/auth';
import { subscribeCloud, saveCloudDebounced, reconcile } from '../lib/cloud/sync';
import { APP_KEYS, RECOVERY_KEYS } from '@growthmap/contracts';
import { consumeFlushTs, registerLocalTsProvider } from '@growthmap/cloud';
import { isFirebaseConfigured } from '../lib/cloud/firebase-config';

const OpportunityContext = createContext();

// index.jsx 的 vite:preloadError 自動重載前，flush 存檔時寫入的時間戳 key（per-tab）。
const FLUSH_TS_KEY = RECOVERY_KEYS.opportunity.flushTs;

// 模組層一次性消耗（非 render 期）：React 併發模式可能丟棄並重播首次 render，
// render 期的消耗性讀取會在重播時拿到 0 而遺失 priming。模組載入只執行一次。
const INITIAL_FLUSH_TS = consumeFlushTs(FLUSH_TS_KEY);

// 從 state 萃取要持久化的完整 data（localStorage + 雲端共用）
function extractData(state) {
  return {
    schemaVersion: SCHEMA_VERSION,
    opportunities: state.opportunities,
    projectMeta: state.projectMeta,
    toolAnalyses: state.toolAnalyses,
    lastCheckRun: state.lastCheckRun,
    longlistSnapshots: state.longlistSnapshots,
  };
}

// 內容簽章：用來分辨某次 state 變更是「使用者編輯」還是「套用雲端快照」，
// 避免即時同步在多裝置間把收到的快照又回寫雲端而成迴圈。
function dataSig(d) {
  return JSON.stringify([d.opportunities, d.projectMeta, d.toolAnalyses, d.lastCheckRun, d.longlistSnapshots]);
}

// 這些 action 會改動被綜合檢查（CHK-1~5）評估的資料：機會、營收、shortlist、
// 目標快照、緩衝係數、工具啟用/分析。任一變動都應讓上次檢查結果失效（見下方 reducer）。
const CHECK_INVALIDATING = new Set([
  'ADD_OPPORTUNITY', 'UPDATE_OPPORTUNITY', 'DELETE_OPPORTUNITY',
  'UPDATE_PROJECT_META', 'SET_TOOL_ACTIVATION', 'SET_TOOL_ANALYSIS',
]);

function baseReducer(state, action) {
  switch (action.type) {
    case 'ADD_OPPORTUNITY': {
      const newOpp = createEmptyOpportunity();
      return { ...state, opportunities: [...state.opportunities, newOpp], editingId: newOpp.id };
    }
    case 'UPDATE_OPPORTUNITY': {
      const updated = state.opportunities.map((opp) =>
        opp.id === action.payload.id ? { ...opp, ...action.payload.data } : opp
      );
      return { ...state, opportunities: updated };
    }
    case 'DELETE_OPPORTUNITY': {
      return {
        ...state,
        opportunities: state.opportunities.filter((opp) => opp.id !== action.payload),
        editingId: state.editingId === action.payload ? null : state.editingId,
      };
    }
    case 'SET_EDITING': {
      return { ...state, editingId: action.payload };
    }
    case 'CLOSE_EDITOR': {
      return { ...state, editingId: null };
    }
    // 套用完整 data（雲端 reconcile 用；取代舊 REPLACE_ALL）
    case 'REPLACE_DATA': {
      const d = action.payload;
      return {
        ...state,
        opportunities: d.opportunities || [],
        projectMeta: d.projectMeta,
        toolAnalyses: d.toolAnalyses || {},
        lastCheckRun: d.lastCheckRun || null,
        longlistSnapshots: d.longlistSnapshots || [],
      };
    }
    // 專案 meta（緩衝係數 / 快照 等）
    case 'UPDATE_PROJECT_META': {
      return { ...state, projectMeta: { ...state.projectMeta, ...action.payload } };
    }
    // 工具啟用切換（MOD-02）
    case 'SET_TOOL_ACTIVATION': {
      const { code, enabled } = action.payload;
      return {
        ...state,
        projectMeta: {
          ...state.projectMeta,
          toolActivation: { ...state.projectMeta.toolActivation, [code]: enabled },
        },
      };
    }
    // 工具分析（MOD-02）
    case 'SET_TOOL_ANALYSIS': {
      const { code, analysis } = action.payload;
      return { ...state, toolAnalyses: { ...state.toolAnalyses, [code]: analysis } };
    }
    // 綜合檢查結果（MOD-05）
    case 'SET_CHECK_RUN': {
      return { ...state, lastCheckRun: action.payload };
    }
    // 採納 AI 排序（AI-04）：批次寫入 rank，未列入者清掉舊 rank（避免殘留衝突）。
    // rank 不影響任何 CHK 規則，故刻意不納入 CHECK_INVALIDATING、不使檢查失效。
    case 'SET_RANKS': {
      const rankById = action.payload;
      return {
        ...state,
        opportunities: state.opportunities.map((o) =>
          o.id in rankById ? { ...o, rank: rankById[o.id] } : o.rank != null ? { ...o, rank: null } : o
        ),
      };
    }
    // 交付：附加不可變快照（MOD-04/08，GD-09），記錄最近交付
    case 'ADD_SNAPSHOT': {
      const snap = action.payload;
      return {
        ...state,
        longlistSnapshots: [...state.longlistSnapshots, snap],
        projectMeta: { ...state.projectMeta, lastHandoff: { version: snap.version, frozenAt: snap.frozenAt } },
      };
    }
    default:
      return state;
  }
}

// 資料一旦變動即令上次檢查失效（lastCheckRun → null），避免「檢查通過後又改資料」
// 仍以過期的 pass 通過 canHandoff 而交付到不一致的快照（review ②）。
function reducer(state, action) {
  const next = baseReducer(state, action);
  if (CHECK_INVALIDATING.has(action.type) && next.lastCheckRun) {
    return { ...next, lastCheckRun: null };
  }
  return next;
}

function initState() {
  const data = loadAppData();
  return {
    opportunities: data.opportunities,
    projectMeta: data.projectMeta,
    toolAnalyses: data.toolAnalyses,
    lastCheckRun: data.lastCheckRun,
    longlistSnapshots: data.longlistSnapshots,
    editingId: null,
  };
}

export function OpportunityProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, initState);
  const { user } = useAuth();
  const localTsRef = useRef(INITIAL_FLUSH_TS);
  // Gate the save effect until the initial cloud reconcile has finished,
  // otherwise a freshly-signed-in user can overwrite cloud with local data
  // before we've had a chance to load it.
  const reconciledRef = useRef(false);
  // 最後一次與雲端同步（寫入或收到）的內容簽章，用來分辨使用者編輯與套用雲端快照。
  const lastCloudSigRef = useRef('');
  // 上次落地 localStorage 的內容簽章；null＝儲存效果尚未跑過（初始掛載）。
  // 用來分辨「真的有人改了東西」與「掛載／重繪」——只有前者可以把 localTs 推到現在。
  const lastSavedSigRef = useRef(null);
  // 本裝置 session 識別碼：辨識並略過「自己寫入後由伺服器回送」的快照，避免回授。
  const clientIdRef = useRef(null);
  if (clientIdRef.current === null) {
    clientIdRef.current = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `c-${Math.random().toString(36).slice(2)}`;
  }
  // 永遠指向最新 state，供 onSnapshot 回呼（訂閱建立於登入當下、之後才觸發）讀取。
  const stateRef = useRef(state);
  stateRef.current = state;

  // 雲端寫入失敗狀態：'stale'＝rules 拒寫（此分頁 schemaVersion 低於最低寫入版本，須重新整理）；'error'＝其他失敗。
  const [syncError, setSyncError] = useState(null);
  const handleSaveError = useCallback((e) => {
    setSyncError(e && e.code === 'permission-denied' ? 'stale' : 'error');
  }, []);

  // 自動儲存至 LocalStorage + 雲端 (debounced)
  const saveTimer = useRef(null);
  useEffect(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      // 內聯具名屬性建構（讓 exhaustive-deps 精確比對，避免傳整個 state）
      const data = {
        schemaVersion: SCHEMA_VERSION,
        opportunities: state.opportunities,
        projectMeta: state.projectMeta,
        toolAnalyses: state.toolAnalyses,
        lastCheckRun: state.lastCheckRun,
        longlistSnapshots: state.longlistSnapshots,
      };
      saveAppData(data);
      const sig = dataSig(data);
      const isInitialMount = lastSavedSigRef.current === null;
      const unchanged = sig === lastSavedSigRef.current;
      lastSavedSigRef.current = sig;
      // 初始掛載（只是把 localStorage 載入的內容原樣落地）與內容未變的重繪都不是使用者編輯：
      // 絕不能因此更新 localTs——否則一台從沒編輯過的裝置（本機狀態過期甚至全空）登入後，
      // reconcile 會把它判成「比雲端新」而整份上傳，蓋掉雲端資料
      //（2026-09-09 事故：staging 瀏覽器登入後以空狀態覆寫 19 個機會，靠 1 小時版本保留還原）。
      if (isInitialMount || unchanged) return;
      // 若這次變更其實是「剛套用雲端快照」，簽章會與 lastCloudSig 相同 →
      // 不更新 localTs、也不回寫雲端（否則多裝置間會無限回授）。
      if (isFirebaseConfigured && user && sig === lastCloudSigRef.current) return;
      localTsRef.current = Date.now();
      if (isFirebaseConfigured && user && reconciledRef.current) {
        // 簽章只能在寫入確實成功（onSaved）後記錄——先記後存會讓存檔失敗被永久視為已同步
        saveCloudDebounced(user.uid, APP_KEYS.opportunity, data, 1000, clientIdRef.current, {
          onSaved: () => { lastCloudSigRef.current = sig; setSyncError(null); },
          onError: handleSaveError,
        });
      }
    }, 300);
    return () => clearTimeout(saveTimer.current);
  }, [state.opportunities, state.projectMeta, state.toolAnalyses, state.lastCheckRun, state.longlistSnapshots, user, handleSaveError]);

  // 部署切換自動重載前的同步存檔（index.jsx 於 vite:preloadError 時觸發）：
  // 立即以最新 state 寫入 localStorage（跳過 300ms debounce），並留下 flush 時間戳
  // 供重載後的 localTs 初始化使用；雲端由重載後的 reconcile 依 localTs 補上傳。
  useEffect(() => {
    const flush = () => {
      clearTimeout(saveTimer.current);
      saveAppData(extractData(stateRef.current));
      // flush 時間戳由 installChunkReloadRecovery（@growthmap/cloud）依 provider 寫入
    };
    window.addEventListener('bw:flush-save', flush);
    // 恢復機制的時間戳來源＝本 session 真實最後編輯時間；沒編輯過（0）就不寫，
    // 重載後維持雲端優先——沉睡分頁的過期資料不得反蓋較新雲端。
    const unregister = registerLocalTsProvider(FLUSH_TS_KEY, () => localTsRef.current);
    return () => {
      window.removeEventListener('bw:flush-save', flush);
      unregister();
    };
  }, []);

  // 登入時：即時訂閱雲端文件（onSnapshot）。第一筆快照等同原本的一次性 reconcile；
  // 之後其他裝置的變更會「即時」套用，無需重新整理或登出登入。
  useEffect(() => {
    reconciledRef.current = false;
    if (!isFirebaseConfigured || !user) return;

    const applyCloud = (cloud) => {
      // 附加欄位協定：雲端文件若由舊版客戶端寫入，會缺新欄位（鍵不存在）——以本地值補回，
      // 並回寫一次修復雲端文件；沒有可補的就照常套用（utils/additiveFields.js）。
      const { data: merged, carried } = carryOverAdditiveFields(migrateData(cloud.data), stateRef.current);
      // 保留本地已有的不可變交付快照（GD-09）：以 version 做 union，避免多裝置間遺失交付記錄。
      // 註：projectMeta/toolAnalyses 仍為 last-write-wins（雲端較新者勝），屬已知同步取捨。
      const seen = new Set(merged.longlistSnapshots.map((s) => s.version));
      merged.longlistSnapshots = [
        ...merged.longlistSnapshots,
        ...(stateRef.current.longlistSnapshots || []).filter((s) => !seen.has(s.version)),
      ].sort((a, b) => a.version - b.version);
      const sig = dataSig(merged);
      lastCloudSigRef.current = sig; // 標記為已同步，避免 save effect 回寫
      localTsRef.current = cloud.updatedAt;
      dispatch({ type: 'REPLACE_DATA', payload: merged });
      if (carried > 0) {
        console.warn(`[cloud sync] 雲端文件缺 ${carried} 個附加欄位（舊版客戶端寫入），已以本地值補回並回寫修復`);
        saveCloudDebounced(user.uid, APP_KEYS.opportunity, merged, 1500, clientIdRef.current, {
          onSaved: () => { lastCloudSigRef.current = sig; setSyncError(null); },
          onError: handleSaveError,
        });
      }
    };

    const unsub = subscribeCloud(user.uid, APP_KEYS.opportunity, (cloud, meta) => {
      // 略過自己尚未被伺服器確認的樂觀寫入
      if (meta && meta.hasPendingWrites) return;
      // 略過自己寫入後由伺服器回送的快照（避免回授）
      if (cloud && cloud.writer === clientIdRef.current) {
        if (cloud.updatedAt > localTsRef.current) localTsRef.current = cloud.updatedAt;
        reconciledRef.current = true;
        return;
      }
      const decision = reconcile(localTsRef.current, cloud);
      if (decision === 'cloud' && cloud && cloud.data) {
        applyCloud(cloud);
      } else if (decision === 'upload') {
        // 本地較新：若本地缺附加欄位而雲端有（舊版分頁的 localStorage 被新版載入後上傳），先從雲端補回再上傳，
        // 否則整份上傳會把雲端已有的欄位值清掉。
        const local = extractData(stateRef.current);
        const { data, carried } = cloud && cloud.data
          ? carryOverAdditiveFields(local, migrateData(cloud.data))
          : { data: local, carried: 0 };
        if (carried > 0) {
          console.warn(`[cloud sync] 本地缺 ${carried} 個附加欄位，已自雲端補回後再上傳`);
          dispatch({ type: 'REPLACE_DATA', payload: data });
        }
        const sig = dataSig(data);
        saveCloudDebounced(user.uid, APP_KEYS.opportunity, data, 0, clientIdRef.current, {
          onSaved: () => { lastCloudSigRef.current = sig; setSyncError(null); },
          onError: handleSaveError,
        });
      }
      reconciledRef.current = true;
    });

    return () => unsub();
  }, [user, handleSaveError]);

  return (
    <OpportunityContext.Provider value={{ state, dispatch, syncError }}>
      {syncError && (
        <div role="alert" className="fixed top-16 right-4 z-50 max-w-sm rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 shadow">
          {syncError === 'stale' ? (
            <>
              ⚠ 這個分頁的程式版本已過期，雲端已拒絕儲存。請
              <button type="button" className="mx-1 font-semibold underline" onClick={() => window.location.reload()}>重新整理</button>
              後再編輯；過期期間的修改不會同步，重新整理後以雲端版本為準。
            </>
          ) : (
            <>⚠ 雲端儲存失敗（下次編輯時會再嘗試）。若持續出現，請檢查網路或重新整理。</>
          )}
        </div>
      )}
      {children}
    </OpportunityContext.Provider>
  );
}

export function useOpportunity() {
  const context = useContext(OpportunityContext);
  if (!context) {
    throw new Error('useOpportunity must be used within OpportunityProvider');
  }
  return context;
}
