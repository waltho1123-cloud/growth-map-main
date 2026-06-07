import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import { loadAppData, saveAppData } from '../utils/storage';
import { createEmptyOpportunity, migrateData } from '../utils/schema';
import { SCHEMA_VERSION } from '../utils/constants';
import { useAuth } from '../lib/cloud/auth';
import { loadCloud, saveCloudDebounced, reconcile } from '../lib/cloud/sync';
import { isFirebaseConfigured } from '../lib/cloud/firebase-config';

const OpportunityContext = createContext();

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
  const applyingRef = useRef(false);
  // Gate the save effect until the initial cloud reconcile has finished,
  // otherwise a freshly-signed-in user can overwrite cloud with local data
  // before we've had a chance to load it.
  const reconciledRef = useRef(false);

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
      if (applyingRef.current) return;
      localTsRef.current = Date.now();
      if (isFirebaseConfigured && user && reconciledRef.current) {
        saveCloudDebounced(user.uid, 'opportunity', data);
      }
    }, 300);
    return () => clearTimeout(saveTimer.current);
  }, [state.opportunities, state.projectMeta, state.toolAnalyses, state.lastCheckRun, state.longlistSnapshots, user]);

  // 登入時：從雲端拉資料 + reconcile（雲端舊資料經 migrateData 升級）
  useEffect(() => {
    reconciledRef.current = false;
    if (!isFirebaseConfigured || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const cloud = await loadCloud(user.uid, 'opportunity');
        if (cancelled) return;
        const decision = reconcile(localTsRef.current, cloud);
        if (decision === 'cloud' && cloud && cloud.data) {
          applyingRef.current = true;
          const merged = migrateData(cloud.data);
          // 保留本地已有的不可變交付快照（GD-09）：以 version 做 union，避免多裝置間遺失交付記錄。
          // 註：projectMeta/toolAnalyses 仍為 last-write-wins（雲端較新者勝），屬已知同步取捨。
          const seen = new Set(merged.longlistSnapshots.map((s) => s.version));
          merged.longlistSnapshots = [
            ...merged.longlistSnapshots,
            ...(state.longlistSnapshots || []).filter((s) => !seen.has(s.version)),
          ].sort((a, b) => a.version - b.version);
          dispatch({ type: 'REPLACE_DATA', payload: merged });
          localTsRef.current = cloud.updatedAt;
          setTimeout(() => { applyingRef.current = false; }, 0);
        } else if (decision === 'upload') {
          saveCloudDebounced(user.uid, 'opportunity', extractData(state), 0);
        }
        reconciledRef.current = true;
      } catch (e) {
        console.error('[opportunity cloud sync] reconcile failed:', e);
      }
    })();
    return () => { cancelled = true; };
    // state intentionally omitted — we only reconcile on user change
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
