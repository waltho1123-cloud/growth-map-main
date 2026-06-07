// 機會 / 專案 meta 的 schema 工廠與向後相容 migration（SDD §2.5、ADR-008）。
//
// 相容原則：migration 為「純增量補欄位」，冪等、不刪既有資料、不破壞現有 UI。
// 模版二/三同時保留舊扁平欄位（TabTwo/TabThree 仍可運作）並新增 SDD 結構，
// 待 Phase 2 重構 UI 時逐步切換。

import {
  SCHEMA_VERSION,
  DEFAULT_CURRENCY,
  DEFAULT_BUFFER_RATIO,
  OPPORTUNITY_STATUS,
  TOOL_ANALYSIS_STATUS,
} from './constants';
import { DEFAULT_ENABLED_TOOL_CODES } from './toolLibrary';

function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'opp-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// 預設工具啟用表（17–24 = true）
function defaultToolActivation() {
  return DEFAULT_ENABLED_TOOL_CODES.reduce((acc, code) => {
    acc[code] = true;
    return acc;
  }, {});
}

export function createDefaultProjectMeta() {
  return {
    bufferRatio: DEFAULT_BUFFER_RATIO,
    toolActivation: defaultToolActivation(),
    targetSnapshot: null, // { aspiration, momentum, growthGap, currency, syncedAt }
    archetypeSnapshot: null, // { archetype, recommendedModes, syncedAt }
    lastHandoff: null, // { version, frozenAt }，由 ADD_SNAPSHOT 寫入
  };
}

export function createEmptyToolAnalysis() {
  return {
    inputs: {},
    insights: [],
    opportunitiesNote: [],
    status: TOOL_ANALYSIS_STATUS.EMPTY,
    updatedAt: 0,
  };
}

export function createEmptyOpportunity() {
  return {
    id: uuid(),
    opportunityName: '',
    status: OPPORTUNITY_STATUS.DRAFT,
    estRevenue: 0,
    currency: DEFAULT_CURRENCY,
    usedTools: [],
    aiScore: null,
    rank: null,
    template1: {
      companyType: '',
      growthDimension: '',
      growthLever: '',
      growthType: [],
      insights: '',
    },
    template2: {
      concept: '',
      method: '',
      // 舊欄位保留（TabTwo 現讀）
      targetCustomer: '',
      usp: '',
      goToMarketStrategy: '',
      implementationSteps: '',
      // SDD 新增：進入策略七面向 + 步驟
      goToMarket: {
        rnd: '', production: '', pricing: '', marketing: '',
        channel: '', logistics: '', afterSales: '',
      },
      steps: '',
    },
    template3: {
      // 舊扁平欄位保留（TabThree 現讀）
      marketSize: '', unitPrice: '', competitiveEnvironment: '', topBrandsShare: '',
      currentScale: '', cagr: '', ebitMargin: '',
      requiredInvestment: '', potentialHurdles: '', successFactors: '', coreCapabilities: '',
      // SDD 新增：四象限 1–5 評分 + 要點 + 分級
      ratings: { size: 0, potential: 0, path: 0, rightToWin: 0 },
      points: '',
      ebitBand: '',
      cagrBand: '',
    },
  };
}

// 單一機會 migration（冪等補欄位）
export function migrateOpportunity(opp) {
  if (!opp || typeof opp !== 'object') return createEmptyOpportunity();
  const t1 = opp.template1 || {};
  const t2 = opp.template2 || {};
  const t3 = opp.template3 || {};
  const gtm = t2.goToMarket || {};
  const ratings = t3.ratings || {};
  return {
    id: opp.id || uuid(),
    opportunityName: opp.opportunityName || '',
    status: opp.status || OPPORTUNITY_STATUS.DRAFT,
    estRevenue: typeof opp.estRevenue === 'number' ? opp.estRevenue : 0,
    currency: opp.currency || DEFAULT_CURRENCY,
    usedTools: Array.isArray(opp.usedTools) ? opp.usedTools : [],
    aiScore: opp.aiScore ?? null,
    rank: opp.rank ?? null,
    template1: {
      companyType: t1.companyType || '',
      growthDimension: t1.growthDimension || '',
      growthLever: t1.growthLever || '',
      growthType: Array.isArray(t1.growthType) ? t1.growthType : [],
      insights: t1.insights || '',
    },
    template2: {
      concept: t2.concept || '',
      method: t2.method || '',
      targetCustomer: t2.targetCustomer || '',
      usp: t2.usp || '',
      goToMarketStrategy: t2.goToMarketStrategy || '',
      implementationSteps: t2.implementationSteps || '',
      goToMarket: {
        rnd: gtm.rnd || '',
        production: gtm.production || '',
        pricing: gtm.pricing || '',
        marketing: gtm.marketing || '',
        channel: gtm.channel || '',
        logistics: gtm.logistics || '',
        afterSales: gtm.afterSales || '',
      },
      steps: t2.steps || t2.implementationSteps || '',
    },
    template3: {
      marketSize: t3.marketSize || '',
      unitPrice: t3.unitPrice || '',
      competitiveEnvironment: t3.competitiveEnvironment || '',
      topBrandsShare: t3.topBrandsShare || '',
      currentScale: t3.currentScale || '',
      cagr: t3.cagr || '',
      ebitMargin: t3.ebitMargin || '',
      requiredInvestment: t3.requiredInvestment || '',
      potentialHurdles: t3.potentialHurdles || '',
      successFactors: t3.successFactors || '',
      coreCapabilities: t3.coreCapabilities || '',
      points: t3.points || '',
      ratings: {
        size: ratings.size ?? 0,
        potential: ratings.potential ?? 0,
        path: ratings.path ?? 0,
        rightToWin: ratings.rightToWin ?? 0,
      },
      ebitBand: t3.ebitBand || '',
      cagrBand: t3.cagrBand || '',
    },
  };
}

// 整個 app data 的 migration（舊格式 {opportunities:[]} → v2 完整結構）
export function migrateData(data) {
  if (!data || typeof data !== 'object') {
    return {
      schemaVersion: SCHEMA_VERSION,
      opportunities: [],
      projectMeta: createDefaultProjectMeta(),
      toolAnalyses: {},
      lastCheckRun: null,
      longlistSnapshots: [],
    };
  }
  const base = createDefaultProjectMeta();
  const savedMeta = data.projectMeta || {};
  return {
    schemaVersion: SCHEMA_VERSION,
    opportunities: Array.isArray(data.opportunities)
      ? data.opportunities.map(migrateOpportunity)
      : [],
    projectMeta: {
      bufferRatio: typeof savedMeta.bufferRatio === 'number' ? savedMeta.bufferRatio : base.bufferRatio,
      // 預設啟用表打底，再覆蓋使用者已存設定（保留使用者的停用/啟用）
      toolActivation: { ...base.toolActivation, ...(savedMeta.toolActivation || {}) },
      targetSnapshot: savedMeta.targetSnapshot || null,
      archetypeSnapshot: savedMeta.archetypeSnapshot || null,
      lastHandoff: savedMeta.lastHandoff || null, // 保留交付記錄，勿在每次 migrate/reconcile 丟失
    },
    toolAnalyses: data.toolAnalyses && typeof data.toolAnalyses === 'object' ? data.toolAnalyses : {},
    lastCheckRun: data.lastCheckRun || null,
    longlistSnapshots: Array.isArray(data.longlistSnapshots) ? data.longlistSnapshots : [],
  };
}
