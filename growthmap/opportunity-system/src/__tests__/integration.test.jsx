/* Phase 0–4 整合煙霧測試：核心邏輯正確性 + 新元件 render 不崩潰 */
import { render } from '@testing-library/react';
import {
  createEmptyOpportunity,
  migrateData,
  migrateOpportunity,
  createDefaultProjectMeta,
} from '../utils/schema';
import { effectiveStatus, canShortlist, isShortlisted } from '../utils/opportunityStatus';
import { computeChecks, computeScore, canHandoff } from '../utils/checkEngine';
import { DEFAULT_ENABLED_TOOL_CODES } from '../utils/toolLibrary';
import { OpportunityProvider } from '../contexts/OpportunityContext';
import { NavProvider } from '../contexts/NavContext';
import ToolLibrary from '../components/Tools/ToolLibrary';
import CheckPanel from '../components/Check/CheckPanel';
import GrowthGapDashboard from '../components/Dashboard/GrowthGapDashboard';
import Dashboard from '../components/Dashboard/Dashboard';
import HandoffPanel from '../components/Handoff/HandoffPanel';
import { buildHandoffSnapshot } from '../utils/handoff';

// ── 資料模型與相容 migration
describe('schema & migration', () => {
  test('createEmptyOpportunity 對齊 SDD 結構', () => {
    const o = createEmptyOpportunity();
    expect(o.status).toBe('draft');
    expect(o.estRevenue).toBe(0);
    expect(o.currency).toBe('TWD');
    expect(o.template3.ratings).toEqual({ size: 0, potential: 0, path: 0, rightToWin: 0 });
    expect(o.template2.goToMarket).toHaveProperty('rnd');
  });

  test('migrateData(null) 產生完整結構且預設啟用 17–24', () => {
    const d = migrateData(null);
    expect(d.schemaVersion).toBe(2);
    expect(Array.isArray(d.opportunities)).toBe(true);
    DEFAULT_ENABLED_TOOL_CODES.forEach((code) => expect(d.projectMeta.toolActivation[code]).toBe(true));
  });

  test('migrateOpportunity 保留舊欄位且冪等', () => {
    const legacy = {
      id: 'x', opportunityName: 'A', usedTools: [17],
      template1: { companyType: '堡壘', growthLever: '鞏固核心業務', growthType: ['優勢變現'], insights: 'i', growthDimension: '新產品' },
      template2: { targetCustomer: 'tc', usp: 'u', goToMarketStrategy: 'old gtm', implementationSteps: 'steps' },
      template3: { marketSize: '50B', cagr: '>15%', ebitMargin: '>5%' },
    };
    const m1 = migrateOpportunity(legacy);
    expect(m1.status).toBe('draft');
    expect(m1.template2.goToMarketStrategy).toBe('old gtm');
    expect(m1.template2.steps).toBe('steps');
    expect(m1.template3.marketSize).toBe('50B');
    expect(m1.template3.ratings.size).toBe(0);
    expect(migrateOpportunity(m1)).toEqual(m1); // 冪等
  });
});

// ── 機會狀態機
describe('opportunity status machine', () => {
  test('依內容推導 draft / insight_linked / evaluated', () => {
    const base = createEmptyOpportunity();
    expect(effectiveStatus(base)).toBe('draft');
    const linked = { ...base, usedTools: [17], template1: { ...base.template1, insights: 'x' } };
    expect(effectiveStatus(linked)).toBe('insight_linked');
    const evaluated = { ...linked, estRevenue: 1000, template3: { ...base.template3, ratings: { size: 3, potential: 3, path: 3, rightToWin: 3 } } };
    expect(effectiveStatus(evaluated)).toBe('evaluated');
    expect(canShortlist(evaluated)).toBe(true);
    expect(canShortlist(base)).toBe(false);
  });

  test('shortlisted 旗標在符合資格時被尊重', () => {
    const base = createEmptyOpportunity();
    const eligible = { ...base, status: 'shortlisted', estRevenue: 1000, template3: { ...base.template3, ratings: { size: 3, potential: 3, path: 3, rightToWin: 3 } } };
    expect(isShortlisted(eligible)).toBe(true);
  });

  test('shortlisted 旗標在不符資格時失效（評分/營收不足即降級，避免不合格機會留在長清單）', () => {
    expect(isShortlisted({ ...createEmptyOpportunity(), status: 'shortlisted' })).toBe(false);
  });
});

// ── 綜合檢查引擎
describe('check engine', () => {
  const shortlistedOpp = (rev, lever = '鞏固核心業務') => ({
    ...createEmptyOpportunity(),
    status: 'shortlisted',
    estRevenue: rev,
    usedTools: [17],
    template1: { companyType: '堡壘', growthLever: lever, growthType: [], insights: 'i', growthDimension: '新產品' },
    template3: { ...createEmptyOpportunity().template3, ratings: { size: 4, potential: 4, path: 4, rightToWin: 4 } },
  });
  const makeState = (opps, gap = 1000) => ({
    opportunities: opps,
    projectMeta: { ...createDefaultProjectMeta(), targetSnapshot: { aspiration: gap * 2, momentum: gap, growthGap: gap, currency: 'TWD' } },
    toolAnalyses: {},
  });

  test('CHK-1 營收充足度：ratio≥1.2 pass', () => {
    const run = computeChecks(makeState([shortlistedOpp(1300)], 1000));
    expect(run.results.find((r) => r.code === 'CHK-1').status).toBe('pass');
  });

  test('CHK-1 營收不足 fail', () => {
    const run = computeChecks(makeState([shortlistedOpp(500)], 1000));
    expect(run.results.find((r) => r.code === 'CHK-1').status).toBe('fail');
  });

  test('CHK-4 長清單數量過少 fail', () => {
    const run = computeChecks(makeState([shortlistedOpp(1300)]));
    expect(run.results.find((r) => r.code === 'CHK-4').status).toBe('fail');
  });

  test('computeScore 隨評分提高', () => {
    const low = computeScore(shortlistedOpp(100), ['鞏固核心業務']);
    const hiOpp = shortlistedOpp(100);
    hiOpp.template3.ratings = { size: 5, potential: 5, path: 5, rightToWin: 5 };
    expect(computeScore(hiOpp, ['鞏固核心業務'])).toBeGreaterThan(low);
  });

  test('canHandoff 需 P0(CHK-1~3) 全 pass', () => {
    expect(canHandoff({ results: [{ code: 'CHK-1', status: 'pass' }, { code: 'CHK-2', status: 'pass' }, { code: 'CHK-3', status: 'pass' }] })).toBe(true);
    expect(canHandoff({ results: [{ code: 'CHK-1', status: 'fail' }, { code: 'CHK-2', status: 'pass' }, { code: 'CHK-3', status: 'pass' }] })).toBe(false);
  });
});

// ── 交付快照（MOD-08，GD-09）
describe('handoff snapshot', () => {
  test('buildHandoffSnapshot 含 shortlisted 機會、分數與來源工具名', () => {
    const opp = {
      ...createEmptyOpportunity(), status: 'shortlisted', estRevenue: 1000, usedTools: [17],
      template1: { companyType: '堡壘', growthLever: '鞏固核心業務', growthType: [], insights: 'i', growthDimension: '新產品' },
      template3: { ...createEmptyOpportunity().template3, ratings: { size: 4, potential: 4, path: 4, rightToWin: 4 } },
    };
    const state = { opportunities: [opp], projectMeta: { ...createDefaultProjectMeta(), targetSnapshot: { aspiration: 2000, momentum: 1000, growthGap: 1000 } }, lastCheckRun: null };
    const snap = buildHandoffSnapshot(state, 1);
    expect(snap.version).toBe(1);
    expect(snap.opportunities).toHaveLength(1);
    expect(snap.opportunities[0].sourceToolNames).toContain('行銷、銷售與訂價診斷');
    expect(snap.opportunities[0].aiScore).toBeGreaterThan(0);
    expect(snap.opportunities[0].template1).toBeDefined();
  });
});

// ── 新元件 render 煙霧測試（Firebase 未配置下不應崩潰）
describe('component render smoke', () => {
  const wrap = (ui) => render(<OpportunityProvider><NavProvider>{ui}</NavProvider></OpportunityProvider>);

  test('Dashboard renders', () => { expect(() => wrap(<Dashboard />)).not.toThrow(); });
  test('ToolLibrary renders', () => { expect(() => wrap(<ToolLibrary />)).not.toThrow(); });
  test('CheckPanel renders', () => { expect(() => wrap(<CheckPanel />)).not.toThrow(); });
  test('GrowthGapDashboard renders', () => { expect(() => wrap(<GrowthGapDashboard />)).not.toThrow(); });
  test('HandoffPanel renders', () => { expect(() => wrap(<HandoffPanel />)).not.toThrow(); });
});
