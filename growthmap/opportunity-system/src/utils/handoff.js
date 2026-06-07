import { computeScore, resolveArchetype, recommendedModesOf } from './checkEngine';
import { isShortlisted } from './opportunityStatus';
import { TOOL_NAME_BY_ID } from './toolLibrary';

// 建立不可變交付快照（含三模版 + 分數 + 來源工具 + 差距），供第四堂（MOD-08）。
export function buildHandoffSnapshot(state, version) {
  const archetype = resolveArchetype(state);
  const recommendedModes = recommendedModesOf(archetype);
  const shortlisted = state.opportunities.filter(isShortlisted);
  return {
    version,
    frozenAt: Date.now(),
    archetype: archetype || null,
    targetSnapshot: state.projectMeta.targetSnapshot || null,
    checkRun: state.lastCheckRun || null,
    opportunities: shortlisted
      .map((o) => ({
        id: o.id,
        opportunityName: o.opportunityName,
        estRevenue: o.estRevenue,
        currency: o.currency,
        sourceToolCodes: o.usedTools || [],
        sourceToolNames: (o.usedTools || []).map((c) => TOOL_NAME_BY_ID[c] || String(c)),
        aiScore: computeScore(o, recommendedModes),
        template1: o.template1,
        template2: o.template2,
        template3: o.template3,
      }))
      .sort((a, b) => b.aiScore - a.aiScore),
  };
}

// 觸發瀏覽器下載 JSON 檔
export function downloadJson(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
