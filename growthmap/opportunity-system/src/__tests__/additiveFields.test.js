import { describe, it, expect } from 'vitest';
import { carryOverAdditiveFields, ADDITIVE_OPPORTUNITY_FIELDS } from '../utils/additiveFields';
import { migrateData, migrateOpportunity, createEmptyOpportunity } from '../utils/schema';
import { SCHEMA_VERSION } from '../utils/constants';

// 模擬 a9a532a 之前的舊版客戶端：migrateOpportunity 逐欄列舉 template3、不認得 synergies → 整個丟掉，
// schemaVersion 寫 2。這就是 Codex 對抗式審查重現資料遺失時用的路徑。
function oldClientRoundTrip(data) {
  const clone = JSON.parse(JSON.stringify(data));
  clone.schemaVersion = 2;
  for (const o of clone.opportunities) {
    if (o.template3) delete o.template3.synergies;
  }
  return clone;
}

function oppWithSynergies(id, synergies) {
  const base = createEmptyOpportunity();
  return { ...base, id, opportunityName: id, template3: { ...base.template3, synergies } };
}

function oppWithoutKey(id) {
  const base = createEmptyOpportunity();
  const t3 = { ...base.template3 };
  delete t3.synergies;
  return { ...base, id, opportunityName: id, template3: t3 };
}

describe('附加欄位協定：migration 的缺鍵語意', () => {
  it('缺鍵要保持缺鍵（不得補成空字串），有值原樣保留，未知鍵也保留', () => {
    const missing = migrateOpportunity({ id: 'x', template3: {} });
    expect('synergies' in missing.template3).toBe(false);
    const kept = migrateOpportunity({ id: 'x', template3: { synergies: 's', futureField: 'f' }, futureRoot: 1 });
    expect(kept.template3.synergies).toBe('s');
    expect(kept.template3.futureField).toBe('f');
    expect(kept.futureRoot).toBe(1);
    expect(migrateOpportunity(kept)).toEqual(kept); // 冪等
  });
  it('新建機會帶已知的空字串；migrateData 寫入目前 schemaVersion', () => {
    expect(createEmptyOpportunity().template3.synergies).toBe('');
    expect(migrateData(null).schemaVersion).toBe(SCHEMA_VERSION);
    expect(SCHEMA_VERSION).toBeGreaterThanOrEqual(3); // rules 的最低寫入版本
  });
  it('附加欄位清單包含 template3.synergies', () => {
    expect(ADDITIVE_OPPORTUNITY_FIELDS).toEqual([['template3', 'synergies']]);
  });
});

describe('附加欄位協定：carryOverAdditiveFields', () => {
  it('雲端缺鍵、本地有值 → 保留本地值（舊分頁寫入不會清掉綜效）', () => {
    const local = { opportunities: [oppWithSynergies('a', 'cross-selling')] };
    const cloud = { opportunities: [oppWithoutKey('a')] };
    const r = carryOverAdditiveFields(cloud, local);
    expect(r.carried).toBe(1);
    expect(r.data.opportunities[0].template3.synergies).toBe('cross-selling');
    expect(cloud.opportunities[0].template3.synergies).toBeUndefined(); // 不可變：原物件未被改動
  });
  it('本地缺鍵、雲端有值 → 從雲端補回（舊分頁 localStorage 被新版載入後上傳不會清掉）', () => {
    const local = { opportunities: [oppWithoutKey('a')] };
    const cloud = { opportunities: [oppWithSynergies('a', '產品綜效')] };
    const r = carryOverAdditiveFields(local, cloud);
    expect(r.carried).toBe(1);
    expect(r.data.opportunities[0].template3.synergies).toBe('產品綜效');
  });
  it('空字串是使用者清空，不是缺鍵：不覆寫', () => {
    const target = { opportunities: [oppWithSynergies('a', '')] };
    const source = { opportunities: [oppWithSynergies('a', '舊值')] };
    const r = carryOverAdditiveFields(target, source);
    expect(r.carried).toBe(0);
    expect(r.data).toBe(target);
    expect(r.data.opportunities[0].template3.synergies).toBe('');
  });
  it('id 不同不互補；source 非字串不補；沒有可補的欄位時回傳原物件', () => {
    const target = { opportunities: [oppWithoutKey('a'), oppWithoutKey('b')] };
    const source = { opportunities: [oppWithSynergies('c', 'x'), { ...oppWithoutKey('b'), template3: { synergies: 42 } }] };
    const r = carryOverAdditiveFields(target, source);
    expect(r.carried).toBe(0);
    expect(r.data).toBe(target);
    expect(carryOverAdditiveFields(null, source).data).toBeNull();
    expect(carryOverAdditiveFields(target, null).data).toBe(target);
  });
  it('端到端：新版寫入 → 舊版套用並回存 → 新版讀回，綜效仍在且版本回到新版', () => {
    const newLocal = migrateData({ opportunities: [oppWithSynergies('a', 'cross-selling'), oppWithSynergies('b', '')] });
    const oldCloud = oldClientRoundTrip(newLocal); // 舊分頁 applyCloud＋自動儲存後的雲端文件
    expect(oldCloud.schemaVersion).toBe(2);
    expect(oldCloud.opportunities[0].template3.synergies).toBeUndefined();
    // 新分頁 applyCloud：migrateData(cloud) 後以本地 state 補回
    const applied = carryOverAdditiveFields(migrateData(oldCloud), newLocal);
    expect(applied.carried).toBe(2); // a 補回 'cross-selling'，b 補回已知空字串 ''
    expect(applied.data.opportunities[0].template3.synergies).toBe('cross-selling');
    expect(applied.data.opportunities[1].template3.synergies).toBe('');
    expect(applied.data.schemaVersion).toBe(SCHEMA_VERSION); // 修復回寫會帶新版本，通過 rules 門檻
  });
  it('反向：舊分頁的 localStorage 被新版載入且判為較新 → 上傳前自雲端補回', () => {
    const cloudNew = migrateData({ opportunities: [oppWithSynergies('a', '跨國綜效')] });
    const staleLocal = migrateData(oldClientRoundTrip(cloudNew)); // 新版 migrate 舊資料：缺鍵保持缺鍵
    expect('synergies' in staleLocal.opportunities[0].template3).toBe(false);
    const r = carryOverAdditiveFields(staleLocal, cloudNew);
    expect(r.carried).toBe(1);
    expect(r.data.opportunities[0].template3.synergies).toBe('跨國綜效');
  });
});
