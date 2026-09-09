import { describe, it, expect } from 'vitest';
import { computeChecks } from '../utils/checkEngine';
import { createEmptyOpportunity, createDefaultProjectMeta } from '../utils/schema';

// CHK-1 單位契約：estRevenue 為「元」、成長差距為「億」，比對前必須換算（見 utils/amount.js）。
function stateWith(estRevenues, growthGap, bufferRatio = 1.2) {
  return {
    opportunities: estRevenues.map((estRevenue, i) => {
      const base = createEmptyOpportunity();
      return {
        ...base, id: `o${i}`, opportunityName: `機會 ${i}`, status: 'shortlisted', estRevenue, currency: 'TWD',
        template3: { ...base.template3, ratings: { size: 3, potential: 3, path: 3, rightToWin: 3 } },
      };
    }),
    projectMeta: { ...createDefaultProjectMeta(), targetSnapshot: { aspiration: growthGap + 3, momentum: 3, growthGap, currency: 'TWD' }, bufferRatio },
    toolAnalyses: {},
    lastCheckRun: null,
    longlistSnapshots: [],
  };
}
const chk1Of = (state) => computeChecks(state).results.find((r) => r.code === 'CHK-1');

describe('CHK-1 機會營收充足度（元 → 億 換算）', () => {
  it('2.98 億元總和 vs 1.5 億差距 → 1.99 倍 pass', () => {
    const r = chk1Of(stateWith([200000000, 98000000], 1.5));
    expect(r.status).toBe('pass');
    expect(r.detail.sum).toBe(298000000);
    expect(r.detail.sumYi).toBeCloseTo(2.98);
    expect(r.detail.ratio).toBeCloseTo(1.9867, 3);
    expect(r.detail.message).toContain('2.98 億');
    expect(r.detail.message).toContain('1.5 億');
  });
  it('1 億元總和 vs 1.5 億差距 → 0.67 倍 fail（修正前會因單位不一致誤判 pass）', () => {
    const r = chk1Of(stateWith([100000000], 1.5));
    expect(r.status).toBe('fail');
    expect(r.detail.ratio).toBeCloseTo(0.6667, 3);
  });
  it('介於 1 倍與緩衝之間 → warn', () => {
    const r = chk1Of(stateWith([165000000], 1.5));
    expect(r.status).toBe('warn');
  });
  it('未同步成長差距 → warn 並保留元／億兩種總和', () => {
    const state = stateWith([100000000], 1.5);
    state.projectMeta.targetSnapshot = null;
    const r = chk1Of(state);
    expect(r.status).toBe('warn');
    expect(r.detail.sum).toBe(100000000);
    expect(r.detail.sumYi).toBe(1);
  });
});
