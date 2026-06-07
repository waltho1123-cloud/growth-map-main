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

function reducer(state, action) {
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
          dispatch({ type: 'REPLACE_DATA', payload: migrateData(cloud.data) });
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
