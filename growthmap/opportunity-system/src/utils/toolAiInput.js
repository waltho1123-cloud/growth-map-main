// AI-01 洞察生成的輸入組裝與「可不可以按」判定（純函式，Vitest 覆蓋）。
// 1–16 號外部觀察工具沒有 fieldSchema：改用自由欄 inputs.notes（觀察資料／研究筆記）餵 AI；
// 17–24 號內部洞察工具沿用欄位輸入。兩者都要求「至少有一點資料」，否則 AI 只會回
// 「資料為空、請補資料」的低信心建議稿（2026-09-09 使用者回報的市場地圖案例）。
export const NOTES_KEY = 'notes';
export const NOTES_MIN_CHARS = 20;

const filled = (v) => {
  if (v == null) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (typeof v === 'number') return Number.isFinite(v);
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.values(v).some(filled);
  return Boolean(v);
};

export function hasFieldSchema(tool) {
  return Array.isArray(tool?.fieldSchema?.fields) && tool.fieldSchema.fields.length > 0;
}

// 外部觀察工具（1–16）不論有無正式欄位都保留「觀察資料／研究筆記」自由欄（欄位是草案，筆記是萬用出口）
export function showsNotes(tool) {
  return !hasFieldSchema(tool) || tool?.observationType === 'external';
}

/**
 * @returns {{ ready: boolean, payload: null | { toolName: string, inputs: object }, hint: string }}
 */
export function buildAiInsightInput(tool, inputs = {}) {
  const toolName = tool?.name || '';
  if (!hasFieldSchema(tool)) {
    const notes = String(inputs?.[NOTES_KEY] || '').trim();
    if (notes.length < NOTES_MIN_CHARS) {
      return {
        ready: false,
        payload: null,
        hint: `請先在上方「觀察資料／研究筆記」貼上至少 ${NOTES_MIN_CHARS} 字的資料（市場數據、研究摘要、訪談紀錄），AI 才有東西可分析。`,
      };
    }
    return { ready: true, payload: { toolName, inputs: { 觀察資料與研究筆記: notes } }, hint: '' };
  }
  const keys = tool.fieldSchema.fields.map((f) => f.key);
  const picked = Object.fromEntries(keys.filter((k) => filled(inputs?.[k])).map((k) => [k, inputs[k]]));
  const notes = showsNotes(tool) ? String(inputs?.[NOTES_KEY] || '').trim() : '';
  if (notes.length >= NOTES_MIN_CHARS) picked['觀察資料與研究筆記'] = notes;
  if (Object.keys(picked).length === 0) {
    return {
      ready: false,
      payload: null,
      hint: showsNotes(tool)
        ? `請先填寫至少一個分析欄位，或在「觀察資料／研究筆記」貼上至少 ${NOTES_MIN_CHARS} 字，AI 才有東西可分析。`
        : '請先填寫至少一個分析欄位，AI 才有東西可分析。',
    };
  }
  return { ready: true, payload: { toolName, inputs: picked }, hint: '' };
}
