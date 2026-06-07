// 綜合檢查引擎 CHK-1~5（SDD §4.3）與機會排序分數（§4.4）。純前端、規則驅動。
import { SCORING_WEIGHTS } from './constants';
import { ARCHETYPE_GUIDANCE, BCG_TOOL_LIBRARY } from './toolLibrary';
import { isShortlisted } from './opportunityStatus';

const P0_CODES = ['CHK-1', 'CHK-2', 'CHK-3'];

function worst(statuses) {
  if (statuses.includes('fail')) return 'fail';
  if (statuses.includes('warn')) return 'warn';
  return 'pass';
}

// 解析專案企業原型：優先第二堂快照，否則取機會中最常見的 companyType
export function resolveArchetype(state) {
  const snap = state.projectMeta.archetypeSnapshot;
  if (snap && snap.archetype) return snap.archetype;
  const counts = {};
  state.opportunities.forEach((o) => {
    const c = o.template1 && o.template1.companyType;
    if (c) counts[c] = (counts[c] || 0) + 1;
  });
  let best = null;
  let bestN = 0;
  Object.entries(counts).forEach(([k, v]) => {
    if (v > bestN) { best = k; bestN = v; }
  });
  return best;
}

function recommendedModesOf(archetype) {
  return archetype && ARCHETYPE_GUIDANCE[archetype] ? ARCHETYPE_GUIDANCE[archetype].recommendedModes : null;
}

// CHK-1 機會營收充足度（P0）
function chk1(shortlisted, projectMeta) {
  const sum = shortlisted.reduce((a, o) => a + (Number(o.estRevenue) || 0), 0);
  const snap = projectMeta.targetSnapshot;
  const buffer = projectMeta.bufferRatio || 1.2;
  if (!snap || !snap.growthGap) {
    return { code: 'CHK-1', title: '機會營收充足度', status: 'warn', detail: { sum, message: '尚未同步第二堂成長差距，無法判定。請先於工作台「從第二堂同步」。' } };
  }
  const gap = snap.growthGap;
  const ratio = gap > 0 ? sum / gap : 0;
  let status = 'fail';
  if (ratio >= buffer) status = 'pass';
  else if (ratio >= 1.0) status = 'warn';
  const message =
    status === 'pass'
      ? `長清單預估營收總和為成長差距的 ${ratio.toFixed(2)} 倍（≥ 緩衝 ${buffer}）。`
      : `長清單營收總和為成長差距的 ${ratio.toFixed(2)} 倍，建議補強機會或提高預估，使其 ≥ ${buffer} 倍。`;
  return { code: 'CHK-1', title: '機會營收充足度', status, detail: { sum, gap, ratio, buffer, message } };
}

// CHK-2 定位對齊度（P0）
function chk2(shortlisted, recommendedModes) {
  if (!recommendedModes) {
    return { code: 'CHK-2', title: '定位對齊度', status: 'warn', detail: { message: '未設定企業原型（起點評估），無法比對建議成長模式。' } };
  }
  if (shortlisted.length === 0) {
    return { code: 'CHK-2', title: '定位對齊度', status: 'warn', detail: { message: '尚無長清單機會可比對。' } };
  }
  const deviations = shortlisted.filter((o) => !recommendedModes.includes(o.template1.growthLever));
  const ratio = deviations.length / shortlisted.length;
  let status = 'pass';
  if (ratio > 0.2) status = 'fail';
  else if (deviations.length > 0) status = 'warn';
  return {
    code: 'CHK-2',
    title: '定位對齊度',
    status,
    detail: {
      recommendedModes,
      deviations: deviations.map((o) => o.opportunityName || '未命名'),
      message: deviations.length === 0 ? '所有長清單機會的成長模式皆落在原型建議範圍內。' : `有 ${deviations.length} 個機會偏離原型建議成長模式。`,
    },
  };
}

// CHK-3 原型成長模式相符 + 破框（P0）
function chk3(shortlisted, archetype, recommendedModes) {
  if (shortlisted.length === 0) {
    return { code: 'CHK-3', title: '原型成長模式相符 + 破框', status: 'warn', detail: { message: '尚無長清單機會。' } };
  }
  const dist = { '鞏固核心業務': 0, '拓展鄰近機會': 0, '探索新興市場': 0 };
  shortlisted.forEach((o) => {
    const l = o.template1.growthLever;
    if (dist[l] !== undefined) dist[l]++;
  });
  const total = shortlisted.length;
  const coreOnly = dist['鞏固核心業務'] === total;
  let status = 'pass';
  let message = '成長模式分布合理，並有適度破框。';
  if (recommendedModes) {
    const offCount = shortlisted.filter((o) => !recommendedModes.includes(o.template1.growthLever)).length;
    if (offCount / total > 0.5) {
      status = 'fail';
      message = '多數機會偏離原型建議成長模式，與企業原型嚴重背離。';
    }
  }
  if (status === 'pass' && coreOnly) {
    status = 'warn';
    message = '長清單全部集中於「鞏固核心」，缺乏破框；建議加入拓展鄰近／探索新興的機會。';
  }
  return { code: 'CHK-3', title: '原型成長模式相符 + 破框', status, detail: { dist, archetype, message } };
}

// CHK-4 長清單數量（P1，7–12）
function chk4(shortlisted) {
  const n = shortlisted.length;
  let status = 'fail';
  if (n >= 7 && n <= 12) status = 'pass';
  else if ((n >= 5 && n < 7) || (n > 12 && n <= 15)) status = 'warn';
  const message = status === 'pass' ? `長清單共 ${n} 個，落在建議區間 7–12。` : `長清單共 ${n} 個，建議調整至 7–12 個。`;
  return { code: 'CHK-4', title: '長清單數量（7–12）', status, detail: { n, message } };
}

// CHK-5 工具覆蓋度（P1）
function chk5(opportunities, projectMeta, toolAnalyses) {
  const enabled = BCG_TOOL_LIBRARY.filter((t) => projectMeta.toolActivation[t.id]).map((t) => t.id);
  if (enabled.length === 0) {
    return { code: 'CHK-5', title: '工具覆蓋度', status: 'warn', detail: { message: '尚未啟用任何工具。' } };
  }
  const usedByOpp = new Set(opportunities.flatMap((o) => o.usedTools || []));
  const covered = enabled.filter((code) => {
    if (usedByOpp.has(code)) return true;
    const a = toolAnalyses[code];
    return a && Array.isArray(a.opportunitiesNote) && a.opportunitiesNote.some((s) => (s || '').trim());
  });
  const c = covered.length / enabled.length;
  let status = 'fail';
  if (c >= 0.8) status = 'pass';
  else if (c >= 0.6) status = 'warn';
  return {
    code: 'CHK-5',
    title: '工具覆蓋度',
    status,
    detail: { coveredCount: covered.length, enabledCount: enabled.length, ratio: c, message: `已啟用 ${enabled.length} 個工具，其中 ${covered.length} 個已產出機會（覆蓋率 ${(c * 100).toFixed(0)}%）。` },
  };
}

// 執行綜合檢查
export function computeChecks(state) {
  const { opportunities, projectMeta, toolAnalyses } = state;
  const shortlisted = opportunities.filter(isShortlisted);
  const archetype = resolveArchetype(state);
  const recommendedModes = recommendedModesOf(archetype);

  const results = [
    chk1(shortlisted, projectMeta),
    chk2(shortlisted, recommendedModes),
    chk3(shortlisted, archetype, recommendedModes),
    chk4(shortlisted),
    chk5(opportunities, projectMeta, toolAnalyses),
  ];
  return { overallStatus: worst(results.map((r) => r.status)), results, ranAt: Date.now(), archetype };
}

// CHK-1~3（P0）皆 pass 才可交付
export function canHandoff(checkRun) {
  if (!checkRun || !Array.isArray(checkRun.results)) return false;
  return checkRun.results.filter((r) => P0_CODES.includes(r.code)).every((r) => r.status === 'pass');
}

// 機會排序分數（§4.4，0–100）
export function computeScore(opp, recommendedModes) {
  const r = (opp.template3 && opp.template3.ratings) || {};
  const n = (x) => (x > 0 ? (x - 1) / 4 : 0); // 未評分（0）視為 0 貢獻
  let alignment = 0.75; // 無原型時中性
  if (recommendedModes) alignment = recommendedModes.includes(opp.template1.growthLever) ? 1 : 0.4;
  const W = SCORING_WEIGHTS;
  const score =
    100 *
    (W.size * n(r.size) +
      W.potential * n(r.potential) +
      W.path * n(r.path) +
      W.right * n(r.rightToWin) +
      W.alignment * alignment);
  return Math.round(score);
}

export { recommendedModesOf };
