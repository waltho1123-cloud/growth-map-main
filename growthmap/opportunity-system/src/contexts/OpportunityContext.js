import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { loadOpportunities, saveOpportunities } from '../utils/storage';

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
    default:
      return state;
  }
}

export function OpportunityProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, {
    opportunities: loadOpportunities(),
    editingId: null,
  });

  // 自動儲存至 LocalStorage
  useEffect(() => {
    saveOpportunities(state.opportunities);
  }, [state.opportunities]);

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
