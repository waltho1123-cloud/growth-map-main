import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import { loadAppData, saveAppData } from '../utils/storage';
import { createEmptyOpportunity, migrateData } from '../utils/schema';
import { SCHEMA_VERSION } from '../utils/constants';
import { useAuth } from '../lib/cloud/auth';
import { subscribeCloud, saveCloudDebounced, reconcile } from '../lib/cloud/sync';
import { APP_KEYS } from '@growthmap/contracts';
import { isFirebaseConfigured } from '../lib/cloud/firebase-config';

const OpportunityContext = createContext();

// index.jsx 的 vite:preloadError 自動重載前，flush 存檔時寫入的時間戳 key（per-tab）。
const FLUSH_TS_KEY = 'bw-ceo-flush-ts';

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
  const localTsRef = useRef(0);
  // Gate the save effect until the initial cloud reconcile has finished,
  // otherwise a freshly-signed-in user can overwrite cloud with local data
  // before we've had a chance to load it.
  const reconciledRef = useRef(false);
  // 最後一次與雲端同步（寫入或收到）的內容簽章，用來分辨使用者編輯與套用雲端快照。
  const lastCloudSigRef = useRef('');
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

  // 重載恢復：若本分頁剛因 chunk 失敗自動重載（index.jsx 會先觸發 bw:flush-save），
  // 以 flush 時間戳作為本 session 的 localTs——否則 localTs=0 會被 reconcile 視為
  // 「本 session 未動」，讓雲端較舊的資料蓋回剛救下來的編輯。
  const flushTsInitRef = useRef(false);
  if (!flushTsInitRef.current) {
    flushTsInitRef.current = true;
    try {
      const t = Number(sessionStorage.getItem(FLUSH_TS_KEY) || 0);
      sessionStorage.removeItem(FLUSH_TS_KEY);
      if (t && Date.now() - t < 5 * 60 * 1000) localTsRef.current = t;
    } catch { /* storage 不可用：維持雲端優先的預設 */ }
  }

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
      // 若這次變更其實是「剛套用雲端快照」，簽章會與 lastCloudSig 相同 →
      // 不更新 localTs、也不回寫雲端（否則多裝置間會無限回授）。
      const sig = (isFirebaseConfigured && user) ? dataSig(data) : null;
      if (sig !== null && sig === lastCloudSigRef.current) return;
      localTsRef.current = Date.now();
      if (isFirebaseConfigured && user && reconciledRef.current) {
        lastCloudSigRef.current = sig;
        saveCloudDebounced(user.uid, APP_KEYS.opportunity, data, 1000, clientIdRef.current);
      }
    }, 300);
    return () => clearTimeout(saveTimer.current);
  }, [state.opportunities, state.projectMeta, state.toolAnalyses, state.lastCheckRun, state.longlistSnapshots, user]);

  // 部署切換自動重載前的同步存檔（index.jsx 於 vite:preloadError 時觸發）：
  // 立即以最新 state 寫入 localStorage（跳過 300ms debounce），並留下 flush 時間戳
  // 供重載後的 localTs 初始化使用；雲端由重載後的 reconcile 依 localTs 補上傳。
  useEffect(() => {
    const flush = () => {
      clearTimeout(saveTimer.current);
      saveAppData(extractData(stateRef.current));
      try { sessionStorage.setItem(FLUSH_TS_KEY, String(Date.now())); } catch { /* storage 不可用則重載後回到雲端優先 */ }
    };
    window.addEventListener('bw:flush-save', flush);
    return () => window.removeEventListener('bw:flush-save', flush);
  }, []);

  // 登入時：即時訂閱雲端文件（onSnapshot）。第一筆快照等同原本的一次性 reconcile；
  // 之後其他裝置的變更會「即時」套用，無需重新整理或登出登入。
  useEffect(() => {
    reconciledRef.current = false;
    if (!isFirebaseConfigured || !user) return;

    const applyCloud = (cloud) => {
      const merged = migrateData(cloud.data);
      // 保留本地已有的不可變交付快照（GD-09）：以 version 做 union，避免多裝置間遺失交付記錄。
      // 註：projectMeta/toolAnalyses 仍為 last-write-wins（雲端較新者勝），屬已知同步取捨。
      const seen = new Set(merged.longlistSnapshots.map((s) => s.version));
      merged.longlistSnapshots = [
        ...merged.longlistSnapshots,
        ...(stateRef.current.longlistSnapshots || []).filter((s) => !seen.has(s.version)),
      ].sort((a, b) => a.version - b.version);
      lastCloudSigRef.current = dataSig(merged); // 標記為已同步，避免 save effect 回寫
      localTsRef.current = cloud.updatedAt;
      dispatch({ type: 'REPLACE_DATA', payload: merged });
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
        const data = extractData(stateRef.current);
        lastCloudSigRef.current = dataSig(data);
        saveCloudDebounced(user.uid, APP_KEYS.opportunity, data, 0, clientIdRef.current);
      }
      reconciledRef.current = true;
    });

    return () => unsub();
  }, [user]);

  return (
    <OpportunityContext.Provider value={{ state, dispatch }}>
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
