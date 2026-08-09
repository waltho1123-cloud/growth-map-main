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

export const USERS_COLLECTION = 'users';
export const APPS_SUBCOLLECTION = 'apps';

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
      `[@growthmap/contracts] aspiration 上傳的 snapshot 缺少 orient 契約欄位「${violations[0]}」——` +
      '第三堂（opportunity-system）依賴此欄位計算成長差距。若是刻意改名，請同步更新 ' +
      'packages/contracts 與 opportunity-system 的消費端。'
    );
  }
}
