import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  APP_KEYS,
  RECOVERY_KEYS,
  EVAL_PROJECTS_COLLECTION,
  userAppDocSegments,
  extractOrientSnapshot,
  assertOrientProducerShape,
  listOrientContractViolations,
  extractHandoffSnapshot,
  listHandoffVersions,
  listHandoffContractViolations,
  assertHandoffProducerShape,
} from './index.js';

// 與 aspiration-case useAspirationStore 初始形狀對齊的 fixture（生產端契約樣本）
function makeAspirationSnapshot() {
  return {
    companyInfo: {
      name: '測試公司',
      revenue2025: 100,
      naturalGrowth: { targetRevenue2028: 120, cagr: 6 },
      aspirationGrowth: { targetRevenue2028: 180, cagr: 21 },
    },
    partA: [{ segment: '主力產品', revenue: 100 }],
    partB: {},
    partC: {},
  };
}

test('APP_KEYS 三單元鍵值固定且凍結', () => {
  assert.deepEqual({ ...APP_KEYS }, { momentum: 'momentum', aspiration: 'aspiration', opportunity: 'opportunity' });
  assert.ok(Object.isFrozen(APP_KEYS));
});

test('userAppDocSegments 產生 users/{uid}/apps/{appKey} 路徑段', () => {
  assert.deepEqual(userAppDocSegments('u1', APP_KEYS.aspiration), ['users', 'u1', 'apps', 'aspiration']);
});

test('extractOrientSnapshot 依契約萃取成長差距核心值', () => {
  const core = extractOrientSnapshot(makeAspirationSnapshot());
  assert.deepEqual(core, {
    aspiration: 180,
    momentum: 120,
    growthGap: 60,
    revenue2025: 100,
    companyName: '測試公司',
    revenueBreakdown: [{ segment: '主力產品', revenue: 100 }],
    contractOk: true,
    criticalViolations: [],
    minorViolations: [],
    violations: [],
  });
});

test('extractOrientSnapshot：加速 ≤ 自然時 growthGap 鉗在 0', () => {
  const snap = makeAspirationSnapshot();
  snap.companyInfo.aspirationGrowth.targetRevenue2028 = 90;
  assert.equal(extractOrientSnapshot(snap).growthGap, 0);
});

test('extractOrientSnapshot：無資料回 null（非違約）；核心違約 contractOk=false（prod 可觀測）', () => {
  assert.equal(extractOrientSnapshot(null), null);
  const core = extractOrientSnapshot({});
  assert.equal(core.contractOk, false);
  assert.ok(core.criticalViolations.some((v) => v.includes('companyInfo')));
  assert.ok(core.minorViolations.some((v) => v.includes('partA')));
  assert.deepEqual(
    { aspiration: core.aspiration, momentum: core.momentum, growthGap: core.growthGap },
    { aspiration: 0, momentum: 0, growthGap: 0 }
  );
});

test('listOrientContractViolations：完整形狀回空陣列、缺欄逐一列名', () => {
  assert.deepEqual(listOrientContractViolations(makeAspirationSnapshot()), []);
  const snap = makeAspirationSnapshot();
  delete snap.companyInfo.aspirationGrowth;
  const v = listOrientContractViolations(snap);
  assert.equal(v.length, 1);
  assert.ok(v[0].includes('companyInfo.aspirationGrowth.targetRevenue2028'));
});

test('primitive 值不得炸 TypeError：naturalGrowth 為數字時列為違約而非拋出（legacy/損壞文件）', () => {
  const snap = makeAspirationSnapshot();
  snap.companyInfo.naturalGrowth = 42; // 曾使 in 運算子拋 TypeError
  let core;
  assert.doesNotThrow(() => { core = extractOrientSnapshot(snap); });
  assert.equal(core.contractOk, false);
  assert.ok(core.criticalViolations.some((v) => v.includes('naturalGrowth.targetRevenue2028')));
});

test('值型別驗證：key 存在但值為 undefined/字串 → 核心違約（不再靜默歸零過關）', () => {
  const snap = makeAspirationSnapshot();
  snap.companyInfo.aspirationGrowth.targetRevenue2028 = undefined;
  let core = extractOrientSnapshot(snap);
  assert.equal(core.contractOk, false);

  const snap2 = makeAspirationSnapshot();
  snap2.companyInfo.naturalGrowth.targetRevenue2028 = 'abc';
  core = extractOrientSnapshot(snap2);
  assert.equal(core.contractOk, false);
  assert.ok(core.criticalViolations.some((v) => v.includes('需為有限數字')));
});

test('critical/minor 分級：只缺 name（裝飾欄位）→ contractOk 仍為 true，核心數值可同步（GD-06）', () => {
  const snap = makeAspirationSnapshot();
  delete snap.companyInfo.name;
  const core = extractOrientSnapshot(snap);
  assert.equal(core.contractOk, true);
  assert.equal(core.criticalViolations.length, 0);
  assert.ok(core.minorViolations.some((v) => v.includes('companyInfo.name')));
  assert.equal(core.growthGap, 60);
});

test('assertOrientProducerShape：完整形狀通過', () => {
  assert.doesNotThrow(() => assertOrientProducerShape(makeAspirationSnapshot()));
});

test('RECOVERY_KEYS：三單元 key 值凍結不可漂移（線上 session 依賴既有字串）', () => {
  assert.deepEqual(RECOVERY_KEYS.momentum, { reload: 'mom_chunk_reload_at', flushTs: 'mom-flush-ts' });
  assert.deepEqual(RECOVERY_KEYS.aspiration, { reload: 'asp_chunk_reload_at', flushTs: 'asp-flush-ts' });
  assert.deepEqual(RECOVERY_KEYS.opportunity, { reload: 'bw_chunk_reload_at', flushTs: 'bw-ceo-flush-ts' });
  assert.ok(Object.isFrozen(RECOVERY_KEYS) && Object.isFrozen(RECOVERY_KEYS.momentum));
});

test('assertOrientProducerShape：錯誤訊息列出全部違約而非只有第一項', () => {
  const snap = makeAspirationSnapshot();
  delete snap.companyInfo.naturalGrowth;
  snap.partA = undefined;
  try {
    assertOrientProducerShape(snap);
    assert.fail('應拋出');
  } catch (e) {
    assert.match(e.message, /naturalGrowth\.targetRevenue2028/);
    assert.match(e.message, /partA/);
    assert.match(e.message, /2 項/);
  }
});

test('assertOrientProducerShape：契約欄位改名即炸出明確錯誤', () => {
  const snap = makeAspirationSnapshot();
  delete snap.companyInfo.naturalGrowth;
  assert.throws(() => assertOrientProducerShape(snap), /naturalGrowth\.targetRevenue2028/);

  const snap2 = makeAspirationSnapshot();
  snap2.partA = undefined;
  assert.throws(() => assertOrientProducerShape(snap2), /partA/);
});

// ── Handoff 契約（第三堂 → 第四堂）────────────────────────────────────────────

// 與 opportunity-system buildHandoffSnapshot 輸出對齊的 fixture（生產端契約樣本）
function makeHandoffSnapshot(version = 1) {
  return {
    version,
    frozenAt: 1754700000000 + version,
    archetype: 'fortress',
    targetSnapshot: { aspiration: 2000, momentum: 1200, growthGap: 800, currency: 'TWD', syncedAt: 1754700000000 },
    checkRun: null,
    opportunities: [
      {
        id: 'opp-1',
        opportunityName: '跨足通路端：入股通路商建立自有通路',
        estRevenue: 300,
        currency: 'TWD',
        sourceToolCodes: [17, 21],
        sourceToolNames: ['工具17', '工具21'],
        aiScore: 12,
        template1: { companyType: 'fortress', growthDimension: '', growthLever: '', growthType: [], insights: '' },
        template2: { concept: '', method: '' },
        template3: { marketSize: '', ratings: { size: 0, potential: 0, path: 0, rightToWin: 0 } },
      },
    ],
  };
}

function makeOpportunityData(snapshots) {
  return { opportunities: [], projectMeta: {}, longlistSnapshots: snapshots };
}

test('EVAL_PROJECTS_COLLECTION 與 RECOVERY_KEYS.evaluate 已定義（第四堂平台常數）', () => {
  assert.equal(EVAL_PROJECTS_COLLECTION, 'evalProjects');
  assert.deepEqual(RECOVERY_KEYS.evaluate, { reload: 'eva_chunk_reload_at', flushTs: 'eva-flush-ts' });
});

test('extractHandoffSnapshot：預設取最新版本並正規化', () => {
  const data = makeOpportunityData([makeHandoffSnapshot(1), makeHandoffSnapshot(3), makeHandoffSnapshot(2)]);
  const core = extractHandoffSnapshot(data);
  assert.equal(core.version, 3);
  assert.equal(core.contractOk, true);
  assert.equal(core.opportunities.length, 1);
  assert.equal(core.opportunities[0].opportunityName, '跨足通路端：入股通路商建立自有通路');
  assert.deepEqual(core.targetSnapshot, { aspiration: 2000, momentum: 1200, growthGap: 800, currency: 'TWD' });
});

test('extractHandoffSnapshot：指定版本取該版；版本不存在回 null', () => {
  const data = makeOpportunityData([makeHandoffSnapshot(1), makeHandoffSnapshot(2)]);
  assert.equal(extractHandoffSnapshot(data, 1).version, 1);
  assert.equal(extractHandoffSnapshot(data, 9), null);
});

test('extractHandoffSnapshot：無資料/從未交付回 null（非違約）', () => {
  assert.equal(extractHandoffSnapshot(null), null);
  assert.equal(extractHandoffSnapshot({}), null);
  assert.equal(extractHandoffSnapshot(makeOpportunityData([])), null);
});

test('extractHandoffSnapshot：核心違約（機會缺 id/名稱）contractOk=false，仍正規化不炸', () => {
  const snap = makeHandoffSnapshot(1);
  snap.opportunities.push({ estRevenue: 50 }); // 缺 id 與 opportunityName
  const core = extractHandoffSnapshot(makeOpportunityData([snap]));
  assert.equal(core.contractOk, false);
  assert.ok(core.criticalViolations.some((v) => v.includes('opportunities[1].id')));
  assert.ok(core.criticalViolations.some((v) => v.includes('opportunities[1].opportunityName')));
  assert.equal(core.opportunities.length, 2); // 不砍列，讓消費端呈現違約狀態
});

test('extractHandoffSnapshot：缺 targetSnapshot/模板 屬 minor，contractOk 仍 true（可承接、功能降級）', () => {
  const snap = makeHandoffSnapshot(1);
  snap.targetSnapshot = null;
  delete snap.opportunities[0].template3;
  const core = extractHandoffSnapshot(makeOpportunityData([snap]));
  assert.equal(core.contractOk, true);
  assert.equal(core.targetSnapshot, null);
  assert.ok(core.minorViolations.some((v) => v.includes('template3')));
});

test('listHandoffVersions：由新到舊列出版本；損壞項目過濾', () => {
  const data = makeOpportunityData([makeHandoffSnapshot(1), null, makeHandoffSnapshot(2), 'junk']);
  const versions = listHandoffVersions(data);
  assert.deepEqual(versions.map((v) => v.version), [2, 1]);
  assert.equal(versions[0].opportunityCount, 1);
  assert.deepEqual(listHandoffVersions(null), []);
});

test('assertHandoffProducerShape：完整形狀通過；欄位改名炸出明確錯誤', () => {
  assert.doesNotThrow(() => assertHandoffProducerShape(makeHandoffSnapshot(1)));
  const snap = makeHandoffSnapshot(1);
  delete snap.opportunities[0].opportunityName;
  assert.throws(() => assertHandoffProducerShape(snap), /opportunityName/);
});

test('listHandoffContractViolations：primitive 機會項不炸 TypeError（損壞文件防護）', () => {
  const snap = makeHandoffSnapshot(1);
  snap.opportunities.push(42);
  let v;
  assert.doesNotThrow(() => { v = listHandoffContractViolations(snap); });
  assert.ok(v.some((s) => s.includes('opportunities[1].id')));
});
