// AI 輸出型別不可控（同一任務可能回字串或物件）。渲染前一律轉成安全的可顯示內容，
// 避免把物件直接交給 React（會拋 "Objects are not valid as a React child" → 白屏）。

// 正規化為「可逐行顯示的字串陣列」。
// 字串 → [字串]；物件 → 取其字串型 values（如 AI 把分面理由拆成 {size,potential,...}）；
// 陣列 → 各元素轉字串；其他/空 → []。
export function aiLines(v) {
  if (v == null) return [];
  if (typeof v === 'string') return v.trim() ? [v] : [];
  if (Array.isArray(v)) return v.map(aiText).filter(Boolean);
  if (typeof v === 'object') return Object.values(v).map(aiText).filter(Boolean);
  return [String(v)];
}

// 將單一值轉成安全字串（清單元素用）。
// primitive → String；物件 → 取常見文字欄位，否則 JSON 字串。
export function aiText(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (typeof v === 'object') {
    // 只在挑出的欄位本身是字串時才回傳它，否則退回整體 JSON，
    // 確保永遠回字串（候選欄位的值可能又是巢狀物件，不可直接回傳）。
    const pick = v.text || v.insight || v.content || v.title || v.label || v.reason || v.message || v.note || v.detail;
    return typeof pick === 'string' ? pick : JSON.stringify(v);
  }
  return String(v);
}
