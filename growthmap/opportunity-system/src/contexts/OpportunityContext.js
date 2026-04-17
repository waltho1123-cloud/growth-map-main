import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import { loadOpportunities, saveOpportunities } from '../utils/storage';
import { useAuth } from '../lib/cloud/auth';
import { loadCloud, saveCloudDebounced, reconcile } from '../lib/cloud/sync';
import { isFirebaseConfigured } from '../lib/cloud/firebase-config';

const OpportunityContext = createContext();

function createEmptyOpportunity() {
  return {
    id: crypto.randomUUID(),
    opportunityName: '',
    usedTools: [],
    template1: {
      companyType: '',
      growthDimension: '',
      growthLever: '',
      growthType: [],
      insights: '',
    },
    template2: {
      targetCustomer: '',
      usp: '',
      goToMarketStrategy: '',
      implementationSteps: '',
    },
    template3: {
      marketSize: '',
      unitPrice: '',
      competitiveEnvironment: '',
      topBrandsShare: '',
      currentScale: '',
      cagr: '',
      ebitMargin: '',
      requiredInvestment: '',
      potentialHurdles: '',
      successFactors: '',
      coreCapabilities: '',
    },
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
    case 'REPLACE_ALL': {
      return { ...state, opportunities: action.payload };
    }
    default:
      return state;
  }
}

export function OpportunityProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, {
    opportunities: loadOpportunities(),
    editingId: null,
  });
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
      saveOpportunities(state.opportunities);
      if (applyingRef.current) return;
      localTsRef.current = Date.now();
      if (isFirebaseConfigured && user && reconciledRef.current) {
        saveCloudDebounced(user.uid, 'opportunity', { opportunities: state.opportunities });
      }
    }, 300);
    return () => clearTimeout(saveTimer.current);
  }, [state.opportunities, user]);

  // 登入時：從雲端拉資料 + reconcile
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
          dispatch({ type: 'REPLACE_ALL', payload: cloud.data.opportunities || [] });
          localTsRef.current = cloud.updatedAt;
          setTimeout(() => { applyingRef.current = false; }, 0);
        } else if (decision === 'upload') {
          saveCloudDebounced(user.uid, 'opportunity', { opportunities: state.opportunities }, 0);
        }
        reconciledRef.current = true;
      } catch (e) {
        console.error('[opportunity cloud sync] reconcile failed:', e);
      }
    })();
    return () => { cancelled = true; };
    // state.opportunities intentionally omitted — we only reconcile on user change
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
