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

// 列出 orient 契約的違約欄位（空陣列＝形狀完整）。生產端與消費端共用同一份檢查，
// 確保「dev 炸錯」與「prod 標記」判的是同一件事。
export function listOrientContractViolations(shape) {
  const missing = [];
  if (!shape || typeof shape !== 'object') return ['(root)'];
  const ci = shape.companyInfo;
  if (!ci || typeof ci !== 'object') {
    missing.push('companyInfo');
  } else {
    if (!('name' in ci)) missing.push('companyInfo.name');
    if (!('revenue2025' in ci)) missing.push('companyInfo.revenue2025');
    if (!ci.naturalGrowth || !('targetRevenue2028' in ci.naturalGrowth)) missing.push('companyInfo.naturalGrowth.targetRevenue2028');
    if (!ci.aspirationGrowth || !('targetRevenue2028' in ci.aspirationGrowth)) missing.push('companyInfo.aspirationGrowth.targetRevenue2028');
  }
  if (!Array.isArray(shape.partA)) missing.push('partA');
  return missing;
}

// 從 apps/aspiration 的 data 萃取成長差距核心值。
// - 「無資料」（data 為 null/非物件）回 null——那是使用者尚未做第二堂，不是違約。
// - 「有資料但形狀違約」仍以 0/空值計算（不讓下游崩潰），但 contractOk=false ＋
//   violations 列表 ＋ console.error——prod 不再靜默，消費端（第三堂儀表）須顯示違約狀態。
export function extractOrientSnapshot(data) {
  if (!data || typeof data !== 'object') return null;
  const violations = listOrientContractViolations(data);
  if (violations.length > 0) {
    console.error(
      `[@growthmap/contracts] apps/aspiration 文件違反 orient 契約，缺欄位：${violations.join('、')}。` +
      '成長差距數值不可信，請檢查 aspiration-case 寫入端與 packages/contracts 是否同步。'
    );
  }
  const ci = data.companyInfo || {};
  const momentum = Number(ci.naturalGrowth?.targetRevenue2028) || 0;
  const aspiration = Number(ci.aspirationGrowth?.targetRevenue2028) || 0;
  return {
    aspiration,
    momentum,
    growthGap: Math.max(aspiration - momentum, 0),
    revenue2025: Number(ci.revenue2025) || 0,
    companyName: ci.name || '',
    revenueBreakdown: Array.isArray(data.partA) ? data.partA : [],
    contractOk: violations.length === 0,
    violations,
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
