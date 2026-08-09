import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  APP_KEYS,
  userAppDocSegments,
  extractOrientSnapshot,
  assertOrientProducerShape,
  listOrientContractViolations,
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
    violations: [],
  });
});

test('extractOrientSnapshot：加速 ≤ 自然時 growthGap 鉗在 0', () => {
  const snap = makeAspirationSnapshot();
  snap.companyInfo.aspirationGrowth.targetRevenue2028 = 90;
  assert.equal(extractOrientSnapshot(snap).growthGap, 0);
});

test('extractOrientSnapshot：無資料回 null（非違約）；形狀違約標記 contractOk=false（prod 可觀測）', () => {
  assert.equal(extractOrientSnapshot(null), null);
  const core = extractOrientSnapshot({});
  assert.equal(core.contractOk, false);
  assert.ok(core.violations.includes('companyInfo'));
  assert.ok(core.violations.includes('partA'));
  assert.deepEqual(
    { aspiration: core.aspiration, momentum: core.momentum, growthGap: core.growthGap },
    { aspiration: 0, momentum: 0, growthGap: 0 }
  );
});

test('listOrientContractViolations：完整形狀回空陣列、缺欄逐一列名', () => {
  assert.deepEqual(listOrientContractViolations(makeAspirationSnapshot()), []);
  const snap = makeAspirationSnapshot();
  delete snap.companyInfo.aspirationGrowth;
  assert.deepEqual(listOrientContractViolations(snap), ['companyInfo.aspirationGrowth.targetRevenue2028']);
});

test('assertOrientProducerShape：完整形狀通過', () => {
  assert.doesNotThrow(() => assertOrientProducerShape(makeAspirationSnapshot()));
});

test('assertOrientProducerShape：契約欄位改名即炸出明確錯誤', () => {
  const snap = makeAspirationSnapshot();
  delete snap.companyInfo.naturalGrowth;
  assert.throws(() => assertOrientProducerShape(snap), /naturalGrowth\.targetRevenue2028/);

  const snap2 = makeAspirationSnapshot();
  snap2.partA = undefined;
  assert.throws(() => assertOrientProducerShape(snap2), /partA/);
});
