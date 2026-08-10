// @growthmap/contracts — 跨單元 Firestore 資料契約的唯一正本。
//
// 三個課程單元（momentum 第一堂 / aspiration 第二堂 / opportunity 第三堂）共用
// `users/{uid}/apps/{appKey}` 文件，且 opportunity 會「跨單元讀取」aspiration 的文件
// 計算成長差距（見 extractOrientSnapshot）。這條契約以前散落在各單元的字面字串裡，
// 改欄位名會靜默弄壞下游——現在生產端與消費端都必須 import 這裡的定義。

export const APP_KEYS = Object.freeze({
  momentum: 'momentum',
  aspiration: 'aspiration',
  opportunity: 'opportunity',
});

// 部署切換恢復機制的 sessionStorage keys（@growthmap/cloud 的 installChunkReloadRecovery／
// consumeFlushTs 使用）。字串值不可改——線上使用者的進行中 session 依賴既有 key。
export const RECOVERY_KEYS = Object.freeze({
  momentum: Object.freeze({ reload: 'mom_chunk_reload_at', flushTs: 'mom-flush-ts' }),
  aspiration: Object.freeze({ reload: 'asp_chunk_reload_at', flushTs: 'asp-flush-ts' }),
  opportunity: Object.freeze({ reload: 'bw_chunk_reload_at', flushTs: 'bw-ceo-flush-ts' }),
  evaluate: Object.freeze({ reload: 'eva_chunk_reload_at', flushTs: 'eva-flush-ts' }),
});

export const USERS_COLLECTION = 'users';
export const APPS_SUBCOLLECTION = 'apps';

// 第四堂（evaluate-strategy）的多人共享專案集合。與單人 users/{uid}/apps/* 模型
// 刻意分離：evalProjects 文件以 memberUids 控管成員存取（見 firestore.rules）。
export const EVAL_PROJECTS_COLLECTION = 'evalProjects';

// Firestore 文件路徑段：doc(db, ...userAppDocSegments(uid, appKey))
export function userAppDocSegments(uid, appKey) {
  return [USERS_COLLECTION, uid, APPS_SUBCOLLECTION, appKey];
}

// ── Orient 契約：第三堂讀取第二堂（apps/aspiration）文件的欄位形狀 ──────────────
// 生產端：aspiration-case 的 useAspirationStore（companyInfo / partA）
// 消費端：opportunity-system 的 lib/cloud/orient.js → GrowthGapDashboard 與 CHK-1

// ── orient 契約檢查 ─────────────────────────────────────────────────────────────
// 生產端與消費端共用同一份檢查，確保「dev 炸錯」與「prod 標記」判的是同一件事。
// 分級：critical＝成長差距計算依賴的數值欄位（缺了數值不可信）；
//       minor＝裝飾/輔助欄位（名稱、營收拆解等），缺了仍可同步核心數值（GD-06 精神）。
// 一律「值型別」驗證而非只驗 key 存在——targetRevenue2028: undefined 曾能靜默過關。

function checkFiniteNumber(parent, key, path, out) {
  // parent 為 primitive 時（legacy/損壞文件）不得用 in 運算子（會拋 TypeError）
  if (!parent || typeof parent !== 'object' || !(key in parent)) {
    out.push(`${path}（缺欄位）`);
  } else if (typeof parent[key] !== 'number' || !Number.isFinite(parent[key])) {
    out.push(`${path}（需為有限數字，實得 ${parent[key] === null ? 'null' : typeof parent[key]}）`);
  }
}

export function listOrientContractViolationsDetailed(shape) {
  const critical = [];
  const minor = [];
  if (!shape || typeof shape !== 'object') return { critical: ['(root)'], minor: [] };
  const ci = shape.companyInfo;
  if (!ci || typeof ci !== 'object') {
    critical.push('companyInfo');
  } else {
    checkFiniteNumber(ci.naturalGrowth, 'targetRevenue2028', 'companyInfo.naturalGrowth.targetRevenue2028', critical);
    checkFiniteNumber(ci.aspirationGrowth, 'targetRevenue2028', 'companyInfo.aspirationGrowth.targetRevenue2028', critical);
    if (typeof ci.name !== 'string') minor.push('companyInfo.name');
    checkFiniteNumber(ci, 'revenue2025', 'companyInfo.revenue2025', minor);
  }
  if (!Array.isArray(shape.partA)) minor.push('partA');
  return { critical, minor };
}

// 扁平清單（critical 在前）；空陣列＝形狀完整。
export function listOrientContractViolations(shape) {
  const d = listOrientContractViolationsDetailed(shape);
  return [...d.critical, ...d.minor];
}

// 從 apps/aspiration 的 data 萃取成長差距核心值。
// - 「無資料」（data 為 null/非物件）回 null——那是使用者尚未做第二堂，不是違約。
// - 「有資料但形狀違約」仍以 0/空值計算（不讓下游崩潰），但 contractOk=false ＋
//   violations 列表 ＋ console.error——prod 不再靜默，消費端（第三堂儀表）須顯示違約狀態。
export function extractOrientSnapshot(data) {
  if (!data || typeof data !== 'object') return null;
  const { critical, minor } = listOrientContractViolationsDetailed(data);
  if (critical.length > 0) {
    console.error(
      `[@growthmap/contracts] apps/aspiration 文件違反 orient 契約（核心欄位）：${critical.join('、')}。` +
      '成長差距數值不可信，請檢查 aspiration-case 寫入端與 packages/contracts 是否同步。'
    );
  } else if (minor.length > 0) {
    console.warn(
      `[@growthmap/contracts] apps/aspiration 文件缺輔助欄位：${minor.join('、')}（核心數值仍可同步）。`
    );
  }
  const ci = (data.companyInfo && typeof data.companyInfo === 'object') ? data.companyInfo : {};
  const ng = (ci.naturalGrowth && typeof ci.naturalGrowth === 'object') ? ci.naturalGrowth : {};
  const ag = (ci.aspirationGrowth && typeof ci.aspirationGrowth === 'object') ? ci.aspirationGrowth : {};
  const momentum = Number(ng.targetRevenue2028) || 0;
  const aspiration = Number(ag.targetRevenue2028) || 0;
  return {
    aspiration,
    momentum,
    growthGap: Math.max(aspiration - momentum, 0),
    revenue2025: Number(ci.revenue2025) || 0,
    companyName: typeof ci.name === 'string' ? ci.name : '',
    revenueBreakdown: Array.isArray(data.partA) ? data.partA : [],
    // contractOk＝核心欄位完整（消費端可信任數值）；minor 缺失不阻擋同步（GD-06）
    contractOk: critical.length === 0,
    criticalViolations: critical,
    minorViolations: minor,
    violations: [...critical, ...minor],
  };
}

// 生產端形狀守衛：aspiration-case 於 dev 模式對每次要上傳的 snapshot 呼叫。
// 任何人改掉 store 的契約欄位名，開發時立即炸出明確錯誤，而不是等第三堂儀表靜默歸零。
export function assertOrientProducerShape(snapshot) {
  const violations = listOrientContractViolations(snapshot);
  if (violations.length > 0) {
    throw new Error(
      `[@growthmap/contracts] aspiration 上傳的 snapshot 違反 orient 契約（${violations.length} 項）：` +
      `${violations.join('、')}——第三堂（opportunity-system）依賴這些欄位計算成長差距。` +
      '若是刻意改名，請同步更新 packages/contracts 與 opportunity-system 的消費端。'
    );
  }
}

// ── Handoff 契約：第四堂讀取第三堂（apps/opportunity）交付快照的欄位形狀 ────────
// 生產端：opportunity-system 的 utils/handoff.js（buildHandoffSnapshot →
//         state.longlistSnapshots 陣列，隨 apps/opportunity 文件上雲）
// 消費端：evaluate-strategy 建立評估專案時匯入（lib/import.js → P-02 長清單承接）

function checkNonEmptyString(parent, key, path, out) {
  if (!parent || typeof parent !== 'object' || !(key in parent)) {
    out.push(`${path}（缺欄位）`);
  } else if (typeof parent[key] !== 'string' || parent[key].length === 0) {
    out.push(`${path}（需為非空字串，實得 ${parent[key] === null ? 'null' : typeof parent[key]}）`);
  }
}

// 分級同 orient 契約：critical＝第四堂承接依賴的識別欄位（缺了無法建立評估列）；
// minor＝輔助欄位（模板內容、分數、目標快照），缺了仍可承接但功能降級。
export function listHandoffContractViolationsDetailed(snapshot) {
  const critical = [];
  const minor = [];
  if (!snapshot || typeof snapshot !== 'object') return { critical: ['(root)'], minor: [] };
  checkFiniteNumber(snapshot, 'version', 'version', critical);
  checkFiniteNumber(snapshot, 'frozenAt', 'frozenAt', critical);
  if (!Array.isArray(snapshot.opportunities)) {
    critical.push('opportunities（需為陣列）');
  } else {
    snapshot.opportunities.forEach((o, i) => {
      checkNonEmptyString(o, 'id', `opportunities[${i}].id`, critical);
      // 名稱：型別錯＝critical；空字串＝minor——單元三允許未命名機會進快照，
      // 空名稱的處置屬第四堂 GR-3（矩陣紅色徽章、不得入短名單），不在生產端阻擋。
      if (!o || typeof o !== 'object' || typeof o.opportunityName !== 'string') {
        critical.push(`opportunities[${i}].opportunityName（需為字串）`);
      } else if (o.opportunityName.length === 0) {
        minor.push(`opportunities[${i}].opportunityName（空字串，GR-3 由消費端處置）`);
      }
      if (!o || typeof o !== 'object') return;
      if (!Array.isArray(o.sourceToolCodes)) minor.push(`opportunities[${i}].sourceToolCodes`);
      for (const t of ['template1', 'template2', 'template3']) {
        if (!o[t] || typeof o[t] !== 'object') minor.push(`opportunities[${i}].${t}`);
      }
    });
  }
  if (snapshot.targetSnapshot != null) {
    checkFiniteNumber(snapshot.targetSnapshot, 'aspiration', 'targetSnapshot.aspiration', minor);
    checkFiniteNumber(snapshot.targetSnapshot, 'momentum', 'targetSnapshot.momentum', minor);
    checkFiniteNumber(snapshot.targetSnapshot, 'growthGap', 'targetSnapshot.growthGap', minor);
  }
  return { critical, minor };
}

export function listHandoffContractViolations(snapshot) {
  const d = listHandoffContractViolationsDetailed(snapshot);
  return [...d.critical, ...d.minor];
}

// 列出 apps/opportunity 文件內可承接的交付快照版本（供第四堂匯入時挑選）。
// 無資料或從未交付 → 空陣列。
export function listHandoffVersions(data) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.longlistSnapshots)) return [];
  return data.longlistSnapshots
    .filter((s) => s && typeof s === 'object')
    .map((s) => ({
      version: Number(s.version) || 0,
      frozenAt: Number(s.frozenAt) || 0,
      opportunityCount: Array.isArray(s.opportunities) ? s.opportunities.length : 0,
    }))
    .sort((a, b) => b.version - a.version);
}

// 從 apps/opportunity 的 data 萃取一份交付快照（預設取最新版本）。
// - 「無資料」或「從未交付」回 null——那是第三堂還沒做完，不是違約。
// - 「有快照但形狀違約」比照 orient：正規化後仍回傳（不讓下游崩潰），
//   contractOk=false ＋ violations 列表 ＋ console.error。
export function extractHandoffSnapshot(data, version = null) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.longlistSnapshots)) return null;
  const snaps = data.longlistSnapshots.filter((s) => s && typeof s === 'object');
  if (snaps.length === 0) return null;
  const snap = version == null
    ? snaps.reduce((a, b) => ((Number(b.version) || 0) > (Number(a.version) || 0) ? b : a))
    : snaps.find((s) => Number(s.version) === Number(version));
  if (!snap) return null;
  const { critical, minor } = listHandoffContractViolationsDetailed(snap);
  if (critical.length > 0) {
    console.error(
      `[@growthmap/contracts] apps/opportunity 交付快照違反 handoff 契約（核心欄位）：${critical.join('、')}。` +
      '第四堂承接結果不可信，請檢查 opportunity-system 的 buildHandoffSnapshot 與 packages/contracts 是否同步。'
    );
  } else if (minor.length > 0) {
    console.warn(
      `[@growthmap/contracts] apps/opportunity 交付快照缺輔助欄位：${minor.join('、')}（仍可承接，功能降級）。`
    );
  }
  const ts = (snap.targetSnapshot && typeof snap.targetSnapshot === 'object') ? snap.targetSnapshot : null;
  return {
    version: Number(snap.version) || 0,
    frozenAt: Number(snap.frozenAt) || 0,
    archetype: typeof snap.archetype === 'string' ? snap.archetype : null,
    targetSnapshot: ts ? {
      aspiration: Number(ts.aspiration) || 0,
      momentum: Number(ts.momentum) || 0,
      growthGap: Number(ts.growthGap) || 0,
      currency: typeof ts.currency === 'string' ? ts.currency : 'TWD',
    } : null,
    opportunities: (Array.isArray(snap.opportunities) ? snap.opportunities : [])
      .filter((o) => o && typeof o === 'object')
      .map((o) => ({
        id: typeof o.id === 'string' ? o.id : String(o.id ?? ''),
        opportunityName: typeof o.opportunityName === 'string' ? o.opportunityName : '',
        estRevenue: Number(o.estRevenue) || 0,
        currency: typeof o.currency === 'string' ? o.currency : 'TWD',
        sourceToolCodes: Array.isArray(o.sourceToolCodes) ? o.sourceToolCodes : [],
        sourceToolNames: Array.isArray(o.sourceToolNames) ? o.sourceToolNames : [],
        aiScore: Number.isFinite(o.aiScore) ? o.aiScore : null,
        template1: (o.template1 && typeof o.template1 === 'object') ? o.template1 : null,
        template2: (o.template2 && typeof o.template2 === 'object') ? o.template2 : null,
        template3: (o.template3 && typeof o.template3 === 'object') ? o.template3 : null,
      })),
    contractOk: critical.length === 0,
    criticalViolations: critical,
    minorViolations: minor,
    violations: [...critical, ...minor],
  };
}

// 生產端形狀守衛：opportunity-system 於 dev 模式建立交付快照時呼叫。
// 任何人改掉 buildHandoffSnapshot 的契約欄位名，開發時立即炸錯，而不是等第四堂承接靜默壞掉。
// 只擋 critical（識別欄位）；minor（空名稱、缺模板）屬合法降級，僅 console.warn。
export function assertHandoffProducerShape(snapshot) {
  const { critical, minor } = listHandoffContractViolationsDetailed(snapshot);
  if (critical.length > 0) {
    throw new Error(
      `[@growthmap/contracts] opportunity 交付快照違反 handoff 契約（${critical.length} 項核心）：` +
      `${critical.join('、')}——第四堂（evaluate-strategy）依賴這些欄位承接長清單。` +
      '若是刻意改名，請同步更新 packages/contracts 與 evaluate-strategy 的消費端。'
    );
  }
  if (minor.length > 0) {
    console.warn(`[@growthmap/contracts] 交付快照缺輔助欄位：${minor.join('、')}（仍可交付，第四堂功能降級）。`);
  }
}
