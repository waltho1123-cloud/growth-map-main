// 附加欄位（additive fields）協定（2026-09-10，Codex 對抗式審查後立）。
//
// 背景：opportunity 文件是 whole-doc 覆寫。新版客戶端新增的純量欄位（例：template3.synergies），
// 舊版客戶端的 migration（逐欄列舉重建）會把它整個丟掉；舊分頁只要再存一次，就會用缺欄位的整份文件
// 覆寫雲端，新分頁收到後把欄位補成空字串＝靜默資料遺失。
//
// 兩層防護：
//   1. firestore.rules 對 users/{uid}/apps/opportunity 要求 data.schemaVersion ≥ 最低版本——舊版客戶端的寫入
//      被伺服器端硬擋（permission-denied），新版客戶端顯示「版本已過期，請重新整理」。
//   2. 本檔：語意上區分「鍵不存在」（寫入者不認得此欄位）與「空字串」（使用者清空）。
//      - 套用雲端快照時：雲端缺鍵而本地有值 → 保留本地值，並回寫一次修復雲端文件。
//      - 本地較新要上傳時：本地缺鍵而雲端有值（舊分頁的 localStorage 被新版載入）→ 先從雲端補回再上傳。
//
// 新增純量附加欄位時：把路徑加進 ADDITIVE_OPPORTUNITY_FIELDS、migrate 不得對它補預設值（保持缺鍵）、
// 並依 CLAUDE.md「附加欄位協定」提升 SCHEMA_VERSION 與 rules 的最低版本（先部署前端、再部署 rules）。

export const ADDITIVE_OPPORTUNITY_FIELDS = Object.freeze([
  Object.freeze(['template3', 'synergies']),
]);

function getPath(obj, path) {
  let cur = obj;
  for (const key of path) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = cur[key];
  }
  return cur;
}

// 不可變寫入：只複製沿途的物件，其餘引用照舊
function setPath(obj, path, value) {
  if (path.length === 0) return value;
  const [key, ...rest] = path;
  const base = obj && typeof obj === 'object' ? obj : {};
  return { ...base, [key]: setPath(base[key], rest, value) };
}

// target：即將成為本地 state／即將上傳的 data；source：另一份可能持有附加欄位值的 data（本地 state 或雲端）。
// 只補「target 缺鍵（undefined）且 source 同 id 機會的值為字串」的欄位，其餘一律不動。
// 回傳 { data, carried }：carried＝補回的欄位數；為 0 時 data 就是原 target（同一個物件）。
export function carryOverAdditiveFields(target, source, fields = ADDITIVE_OPPORTUNITY_FIELDS) {
  if (!target || !Array.isArray(target.opportunities) || !source || !Array.isArray(source.opportunities)) {
    return { data: target, carried: 0 };
  }
  const byId = new Map();
  for (const o of source.opportunities) {
    if (o && o.id != null) byId.set(o.id, o);
  }
  let carried = 0;
  const opportunities = target.opportunities.map((opp) => {
    if (!opp || !byId.has(opp.id)) return opp;
    const src = byId.get(opp.id);
    let next = opp;
    for (const path of fields) {
      if (getPath(opp, path) !== undefined) continue;
      const value = getPath(src, path);
      if (typeof value !== 'string') continue;
      next = setPath(next, path, value);
      carried += 1;
    }
    return next;
  });
  if (carried === 0) return { data: target, carried: 0 };
  return { data: { ...target, opportunities }, carried };
}
