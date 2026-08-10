import { describe, test, expect } from 'vitest';
import {
  createEmptyFin, resizeFin, derivePnl, deriveCf, deriveBs, crossChecks,
  finCellRef, keyFinCells, assumptionCoverage,
} from '../domain/finance';
import { computeRollup, waterfallSegments } from '../domain/rollup';
import { detectCycles, orderConflicts, yearlyTotals, hardChecks } from '../domain/sequencing';
import { runChecks } from '../domain/checks';
import { createPlayDoc } from '../domain/model';

// 建一個「填好財務」的方案 fixture
function makePlay(id, name, { revenue = [100, 200, 300], cogs = [40, 80, 120], opex = [30, 40, 50], capex = [10, 10, 0], startYear = 1, endYear = 1, dependsOn = [] } = {}) {
  const play = createPlayDoc({ name, formation: 'merge', mergeCriteria: ['共同的價值主張或主題'], sourceOppIds: [], ownerUid: 'u1' }, [], { forecastYears: 3 });
  play.id = id;
  play.bizplan.fin.pnl.revenue = [...revenue];
  play.bizplan.fin.pnl.cogs = [...cogs];
  play.bizplan.fin.pnl.opex = [...opex];
  play.bizplan.fin.capex = [...capex];
  play.sequencing = { startYear, endYear, dependsOn };
  for (const k of ['t1', 't2', 't3']) {
    play.templates[k].confirmed = true;
    play.templates[k].content = { ...play.templates[k].content, edited: true };
  }
  play.bizplan.feasibility = {
    resources: { answer: 'yes', note: '' }, regulation: { answer: 'no', note: '' },
    culture: { answer: 'partial', note: '' }, time: { answer: 'yes', note: '' },
  };
  return play;
}

// ── 財務引擎（MOD-07）────────────────────────────────────────────────────────
describe('finance', () => {
  test('derivePnl：毛利=營收−COGS、EBIT=毛利−OPEX、稅後淨利（稅率 20%）', () => {
    const fin = createEmptyFin(3);
    fin.pnl.revenue = [100, 0, 0];
    fin.pnl.cogs = [40, 0, 0];
    fin.pnl.opex = [30, 0, 0];
    const rows = derivePnl(fin, { taxRate: 0.2 });
    expect(rows.grossProfit[0]).toBe(60);
    expect(rows.grossMarginPct[0]).toBe(60);
    expect(rows.ebit[0]).toBe(30);
    expect(rows.tax[0]).toBe(6);
    expect(rows.netIncome[0]).toBe(24);
  });

  test('derivePnl：稅前為負不課稅', () => {
    const fin = createEmptyFin(3);
    fin.pnl.revenue = [10, 0, 0];
    fin.pnl.cogs = [40, 0, 0];
    const rows = derivePnl(fin, { taxRate: 0.2 });
    expect(rows.tax[0]).toBe(0);
    expect(rows.netIncome[0]).toBe(-30);
  });

  test('deriveCf：期末現金逐年累計；crossChecks 對負現金提出 ERR-05 提示', () => {
    const fin = createEmptyFin(3);
    fin.cf.cfo = [10, 10, 10];
    fin.cf.cfi = [-30, 0, 0];
    const cf = deriveCf(fin);
    expect(cf.endingCash).toEqual([-20, -10, 0]);
    const warnings = crossChecks(fin);
    expect(warnings.some((w) => w.code === 'CASH_NEGATIVE' && w.year === 1)).toBe(true);
    expect(warnings.some((w) => w.code === 'CASH_NEGATIVE' && w.year === 3)).toBe(false);
  });

  test('deriveBs：保留盈餘＝歷年淨利累計', () => {
    const fin = createEmptyFin(2 + 1);
    fin.pnl.revenue = [100, 100, 100];
    fin.pnl.cogs = [50, 50, 50];
    const pnl = derivePnl(fin, { taxRate: 0 });
    const bs = deriveBs(fin, pnl);
    expect(bs.retainedEarnings).toEqual([50, 100, 150]);
  });

  test('resizeFin：年期 3→5 補零、5→3 截斷（PD-04）', () => {
    const fin = createEmptyFin(3);
    fin.pnl.revenue = [1, 2, 3];
    const up = resizeFin(fin, 5);
    expect(up.pnl.revenue).toEqual([1, 2, 3, 0, 0]);
    const down = resizeFin(up, 3);
    expect(down.pnl.revenue).toEqual([1, 2, 3]);
  });

  test('GR-5 覆蓋率：只計已填數字的關鍵欄位；掛假設後比率上升', () => {
    const play = makePlay('p1', '方案一', { revenue: [100, 0, 0], cogs: [0, 0, 0], capex: [0, 0, 0] });
    let cov = assumptionCoverage([play], [], { years: 3 });
    expect(cov.filled).toBe(1);
    expect(cov.ratio).toBe(0);
    const assumption = { target: { ref: finCellRef('p1', 'pnl.revenue', 0) } };
    cov = assumptionCoverage([play], [assumption], { years: 3 });
    expect(cov.ratio).toBe(1);
    expect(keyFinCells('p1', 3)).toHaveLength(9);
  });
});

// ── 疊加效益（MOD-08 / P-10）─────────────────────────────────────────────────
describe('rollup', () => {
  test('computeRollup：自然增長+方案+收入綜效 vs 目標；達成率與缺口', () => {
    const plays = [makePlay('p1', 'A', { revenue: [0, 0, 500] }), makePlay('p2', 'B', { revenue: [0, 0, 300] })];
    const r = computeRollup({
      momentum: 1000, aspiration: 2000, plays,
      synergies: { revenue: [0, 0, 100], cost: [0, 0, 50] },
      yearIndex: 2, metric: 'revenue',
    });
    expect(r.total).toBe(1900); // 1000+500+300+100（成本綜效不進營收口徑）
    expect(r.attainmentPct).toBe(95);
    expect(r.status).toBe('below');
    expect(r.gapAmount).toBe(100);
  });

  test('computeRollup：利潤口徑計 EBIT＋收入綜效＋成本綜效；>120% 標 overshoot', () => {
    const plays = [makePlay('p1', 'A', { revenue: [0, 0, 1000], cogs: [0, 0, 200], opex: [0, 0, 300] })];
    const r = computeRollup({
      momentum: 100, aspiration: 500, plays,
      synergies: { revenue: [0, 0, 40], cost: [0, 0, 10] },
      yearIndex: 2, metric: 'profit',
    });
    expect(r.total).toBe(100 + 500 + 50);
    expect(r.overshoot).toBe(true);
    expect(r.status).toBe('ok');
  });

  test('waterfallSegments：起始柱→方案增量→綜效→總計柱', () => {
    const r = computeRollup({ momentum: 100, aspiration: 300, plays: [makePlay('p1', 'A', { revenue: [0, 0, 80] })], synergies: { revenue: [0, 0, 20], cost: [0, 0, 0] }, yearIndex: 2 });
    const segs = waterfallSegments(r);
    expect(segs[0]).toMatchObject({ kind: 'base', to: 100 });
    expect(segs[1]).toMatchObject({ kind: 'play', from: 100, to: 180 });
    expect(segs.at(-1)).toMatchObject({ kind: 'total', value: 200 });
  });
});

// ── 時序與三項硬檢查（MOD-08 / P-11）──────────────────────────────────────────
describe('sequencing', () => {
  test('detectCycles：A→B→A 成環；已刪除方案殘留引用不算環', () => {
    const a = makePlay('a', 'A', { dependsOn: ['b'] });
    const b = makePlay('b', 'B', { dependsOn: ['a'] });
    expect(detectCycles([a, b]).length).toBeGreaterThan(0);
    const c = makePlay('c', 'C', { dependsOn: ['ghost'] });
    expect(detectCycles([c])).toHaveLength(0);
  });

  test('orderConflicts：相依方案起始年早於被依方案結束年 → 衝突', () => {
    const a = makePlay('a', 'A', { startYear: 1, endYear: 2 });
    const b = makePlay('b', 'B', { startYear: 1, endYear: 1, dependsOn: ['a'] });
    const conflicts = orderConflicts([a, b]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].playId).toBe('b');
    b.sequencing.startYear = 2; // 起始=結束年即可（「早於」才算衝突）
    expect(orderConflicts([a, b])).toHaveLength(0);
  });

  test('yearlyTotals：成本綜效降總成本、增總利潤（PD-06 分列）', () => {
    const play = makePlay('p1', 'A', { revenue: [100, 100, 100], cogs: [40, 40, 40], opex: [10, 10, 10] });
    const { totals, rows } = yearlyTotals([play], { revenue: [0, 0, 20], cost: [0, 0, 5] }, { years: 3 });
    expect(rows[0].profit[0]).toBe(50); // EBIT
    expect(totals.revenue[2]).toBe(120);
    expect(totals.cost[2]).toBe(45); // 50 − 5 成本綜效
    expect(totals.profit[2]).toBe(50 + 20 + 5);
  });

  test('hardChecks：未填可用資金上限 → 現金流檢查不過並說明原因', () => {
    const play = makePlay('p1', 'A', { revenue: [0, 0, 1000], capex: [100, 0, 0] });
    const r = hardChecks({ plays: [play], synergies: null, momentum: 500, aspiration: 1200, years: 3, availableCapital: null });
    expect(r.attainment.pass).toBe(true); // 500+1000 ≥ 1200
    expect(r.cashflow.pass).toBe(false);
    expect(r.cashflow.reasons[0]).toContain('可用資金上限');
    const r2 = hardChecks({ plays: [play], synergies: null, momentum: 500, aspiration: 1200, years: 3, availableCapital: 100 });
    expect(r2.cashflow.pass).toBe(true);
    const r3 = hardChecks({ plays: [play], synergies: null, momentum: 500, aspiration: 1200, years: 3, availableCapital: 50 });
    expect(r3.cashflow.pass).toBe(false);
  });
});

// ── 綜合檢查（P-13）───────────────────────────────────────────────────────────
describe('checks', () => {
  const greenInput = () => ({
    momentum: 1000,
    aspiration: 1800,
    opportunities: [
      { id: 'o1', opportunityName: '寵物鮮食市場：訂閱制鮮食商模', shortlist: { included: true }, excluded: { flag: false } },
    ],
    plays: [makePlay('p1', '寵物鮮食平台', { revenue: [100, 400, 900] })],
    synergies: { revenue: [0, 0, 0], cost: [0, 0, 0] },
    assumptions: [
      // 掛滿 p1 的已填關鍵欄位（revenue 3 年、cogs 3 年、capex 2 年有值）
      ...['pnl.revenue', 'pnl.cogs'].flatMap((path) => [0, 1, 2].map((i) => ({ target: { ref: finCellRef('p1', path, i) } }))),
      ...[0, 1].map((i) => ({ target: { ref: finCellRef('p1', 'capex', i) } })),
    ],
    settings: { forecastYears: 3, taxRate: 0.2, playWarn: 3, playMax: 5, availableCapital: 999, assumptionTargetRatio: 0.8 },
  });

  test('全綠路徑：CHK-1~6 全 pass、canDeliver=true', () => {
    const run = runChecks(greenInput());
    const lamps = Object.fromEntries(run.results.map((r) => [r.code, r.lamp]));
    expect(lamps).toEqual({ 'CHK-1': 'pass', 'CHK-2': 'pass', 'CHK-3': 'pass', 'CHK-4': 'pass', 'CHK-5': 'pass', 'CHK-6': 'pass' });
    expect(run.canDeliver).toBe(true);
  });

  test('CHK-1 未達標 → fail 且 canDeliver=false；CHK-5 未掛假設 → 黃燈不阻擋', () => {
    const input = greenInput();
    input.aspiration = 99999;
    input.assumptions = [];
    const run = runChecks(input);
    const byCode = Object.fromEntries(run.results.map((r) => [r.code, r]));
    expect(byCode['CHK-1'].lamp).toBe('fail');
    expect(byCode['CHK-5'].lamp).toBe('warn');
    expect(byCode['CHK-5'].blocking).toBe(false);
    expect(run.canDeliver).toBe(false);
    expect(run.blockingFails).toContain('CHK-1');
    expect(run.blockingFails).not.toContain('CHK-5');
  });

  test('CHK-2：0 個方案 fail；4 個方案 warn（不阻擋交付判定沿 PRD：4–5 黃燈）', () => {
    const input = greenInput();
    input.plays = [];
    let run = runChecks(input);
    expect(run.results.find((r) => r.code === 'CHK-2').lamp).toBe('fail');
    input.plays = ['p1', 'p2', 'p3', 'p4'].map((id) => makePlay(id, id, { revenue: [100, 400, 900] }));
    input.assumptions = [];
    run = runChecks(input);
    expect(run.results.find((r) => r.code === 'CHK-2').lamp).toBe('warn');
    // PRD CHK-2 阻擋條件是 >5：4–5 個黃燈警示但不擋交付
    expect(run.canDeliver).toBe(true);
    input.plays = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'].map((id) => makePlay(id, id, { revenue: [100, 400, 900] }));
    run = runChecks(input);
    expect(run.results.find((r) => r.code === 'CHK-2').lamp).toBe('fail');
    expect(run.canDeliver).toBe(false);
  });

  test('CHK-3：模板未確認 → fail 並點名缺項', () => {
    const input = greenInput();
    input.plays[0].templates.t2.confirmed = false;
    const run = runChecks(input);
    const chk3 = run.results.find((r) => r.code === 'CHK-3');
    expect(chk3.lamp).toBe('fail');
    expect(chk3.reason).toContain('三模板');
  });
});
