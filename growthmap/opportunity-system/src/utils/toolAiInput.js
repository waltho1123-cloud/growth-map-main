// AI-01 洞察生成的輸入組裝（純函式，Vitest 覆蓋）。
// 2026-09-09 裁定：AI 按鈕「永遠可按」——沒填任何欄位或筆記時改走「假說模式」：
// 把公司背景（企業原型、成長差距、其他工具已產出的洞察、機會清單）與本工具的框架欄位
// 一併送給後端，由 AI 依框架提出假說級洞察（後端 prompt 會要求標【假說】、附需驗證資料、
// 信心 ≤ 0.4）；有填資料則走一般分析模式，並把筆記與已填欄位一起送出。
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

const clip = (s, n) => String(s || '').trim().slice(0, n);

// 公司背景摘要（給 AI 的 context；全部截斷，避免 payload 膨脹）
export function buildAiContext(state, { toolNameById = {}, currentToolId } = {}) {
  const meta = state?.projectMeta || {};
  const snap = meta.targetSnapshot || null;
  const otherInsights = Object.entries(state?.toolAnalyses || {})
    .filter(([code, a]) => Number(code) !== Number(currentToolId) && Array.isArray(a?.insights) && a.insights.some((s) => clip(s, 1)))
    .slice(0, 8)
    .map(([code, a]) => ({
      tool: toolNameById[code] || `工具 ${code}`,
      insights: a.insights.filter((s) => clip(s, 1)).slice(0, 3).map((s) => clip(s, 160)),
    }));
  const opportunities = (state?.opportunities || [])
    .map((o) => clip(o?.opportunityName, 60)).filter(Boolean).slice(0, 10);
  return {
    archetype: meta.archetypeSnapshot ?? null,
    growthGap: snap ? { momentum: snap.momentum ?? null, aspiration: snap.aspiration ?? null, growthGap: snap.growthGap ?? null, currency: snap.currency ?? null } : null,
    otherInsights,
    opportunities,
  };
}

/**
 * @returns {{ ready: boolean, hasData: boolean, mode: 'analysis'|'hypothesis', payload: object|null, hint: string }}
 */
export function buildAiInsightInput(tool, inputs = {}, context = null) {
  if (!tool) return { ready: false, hasData: false, mode: 'hypothesis', payload: null, hint: '找不到工具。' };
  const toolName = tool.name || '';
  const keys = hasFieldSchema(tool) ? tool.fieldSchema.fields.map((f) => f.key) : [];
  const picked = Object.fromEntries(keys.filter((k) => filled(inputs?.[k])).map((k) => [k, inputs[k]]));
  const notes = showsNotes(tool) ? String(inputs?.[NOTES_KEY] || '').trim() : '';
  if (notes.length >= NOTES_MIN_CHARS) picked['觀察資料與研究筆記'] = notes;
  const hasData = Object.keys(picked).length > 0;
  const framework = hasFieldSchema(tool) ? tool.fieldSchema.fields.map((f) => f.label) : [];
  return {
    ready: true,
    hasData,
    mode: hasData ? 'analysis' : 'hypothesis',
    payload: {
      toolName,
      toolCategory: tool.category || '',
      observationType: tool.observationType || '',
      framework,
      inputs: picked,
      context: context || null,
      mode: hasData ? 'analysis' : 'hypothesis',
    },
    hint: hasData
      ? ''
      : (showsNotes(tool)
        ? `尚未填寫欄位或筆記：AI 會依公司背景與本工具框架提出「假說級」洞察（信心較低、需驗證）；填寫欄位或貼上至少 ${NOTES_MIN_CHARS} 字的觀察資料可得到更具體的洞察。`
        : '尚未填寫欄位：AI 會依公司背景與本工具框架提出「假說級」洞察（信心較低、需驗證）；填寫欄位可得到更具體的洞察。'),
  };
}

// AI-02 機會方向候選的輸入組裝（2026-09-09）：依該工具的主要洞察；洞察為空走假說模式。
export function buildAiOpportunityInput(tool, insights = [], context = null, existingOpportunities = []) {
  if (!tool) return { ready: false, hasData: false, mode: 'hypothesis', payload: null, hint: '找不到工具。' };
  const cleaned = (Array.isArray(insights) ? insights : []).map((s) => clip(s, 300)).filter(Boolean).slice(0, 12);
  const existing = (Array.isArray(existingOpportunities) ? existingOpportunities : []).map((s) => clip(s, 80)).filter(Boolean).slice(0, 20);
  const hasData = cleaned.length > 0;
  return {
    ready: true,
    hasData,
    mode: hasData ? 'analysis' : 'hypothesis',
    payload: {
      toolName: tool.name || '',
      toolCategory: tool.category || '',
      framework: hasFieldSchema(tool) ? tool.fieldSchema.fields.map((f) => f.label) : [],
      insights: cleaned,
      existingOpportunities: existing,
      context: context || null,
      mode: hasData ? 'analysis' : 'hypothesis',
    },
    hint: hasData ? '' : '主要洞察還是空的：AI 會依公司背景與本工具框架提出「假說級」機會方向（信心較低、需驗證）；先填或採納幾條洞察，機會方向會更具體。',
  };
}
