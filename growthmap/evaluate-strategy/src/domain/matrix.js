// 2×2 優先排序矩陣（PRD MOD-04）。
// PD-02：象限分隔線預設取「當期資料的中位數」而非固定 3.0，且可拖曳；
// 系統永遠不自動依閾值分類機會——quadrantOf 只是顯示標籤，不觸發任何自動動作。

function median(values) {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  const n = sorted.length;
  if (n === 0) return 3; // 無資料時退回量表中點
  const mid = Math.floor(n / 2);
  return n % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// points: [{x, y}]；回傳預設分隔線位置（使用者可再拖曳覆寫）
export function defaultDividers(points) {
  return {
    x: median((points || []).map((p) => p?.x)),
    y: median((points || []).map((p) => p?.y)),
  };
}

export const QUADRANTS = Object.freeze({
  must: Object.freeze({ key: 'must', label: '最高優先事項｜必做', short: '必做', tone: 'ok' }),
  quickwin: Object.freeze({ key: 'quickwin', label: '潛在速贏｜可選', short: '可選・速贏', tone: 'brand' }),
  bigbet: Object.freeze({ key: 'bigbet', label: '大膽投注（高風險）', short: '大膽投注', tone: 'warn' }),
  skip: Object.freeze({ key: 'skip', label: '低優先事項｜不做', short: '不做', tone: 'idle' }),
});

// 橫軸右端＝「易」：x ≥ 分隔線＝執行較易。縱軸上方＝吸引力高。
export function quadrantOf(point, dividers) {
  const easy = point.x >= dividers.x;
  const attractive = point.y >= dividers.y;
  if (attractive && easy) return QUADRANTS.must;
  if (!attractive && easy) return QUADRANTS.quickwin;
  if (attractive && !easy) return QUADRANTS.bigbet;
  return QUADRANTS.skip;
}
