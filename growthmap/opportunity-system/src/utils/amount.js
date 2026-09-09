// 金額單位契約（2026-09-09 立）：
// - 第二堂（aspiration-case）所有營收欄位以「億」填寫 → targetSnapshot.aspiration／momentum／growthGap 皆為億。
// - 第三堂機會的 estRevenue 以「元」填寫（既有資料全為元，例：20000000 ＝ 0.2 億；placeholder 自始即為元），
//   顯示與 CHK-1 比對時一律先以 toYi() 換算成億，再與成長差距同單位比對。
// - 顯示保留小數：4.5 億四捨五入成 5 會把差距誇大三分之一。
export const AMOUNT_SCALE_LABEL = '億';
export const YI = 1e8;

// 整數顯示整數，否則最多 maxFractionDigits 位小數（例：4.5 → "4.5"、3 → "3"、1.25 → "1.3"、1234.5 → "1,234.5"）
export function fmtAmount(n, maxFractionDigits = 1) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return new Intl.NumberFormat('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: maxFractionDigits }).format(v);
}

// 元 → 億（非數字視為 0）
export function toYi(twd) {
  const v = Number(twd);
  return Number.isFinite(v) ? v / YI : 0;
}

// 元金額以億顯示，最多兩位小數（15,000,000 元 → "0.15"）
export function fmtYi(twd) {
  return fmtAmount(toYi(twd), 2);
}

export function amountUnit(currency) {
  return `${AMOUNT_SCALE_LABEL} ${currency || 'TWD'}`;
}
