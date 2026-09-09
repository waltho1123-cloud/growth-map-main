import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TASKS, buildInsightUser } from './prompts.js';

test('AI-01 有資料 → analysis：帶框架、背景、分析輸入，不出現假說指令', () => {
  const u = buildInsightUser({ toolName: '市場地圖', toolCategory: '產業面', framework: ['市場區隔與規模', '主要參與者'], inputs: { segments: '戶外／運動' }, context: { archetype: '穩健型' }, mode: 'analysis' });
  assert.match(u, /工具：市場地圖（產業面）/);
  assert.match(u, /市場區隔與規模、主要參與者/);
  assert.match(u, /"archetype": "穩健型"/);
  assert.match(u, /"segments": "戶外／運動"/);
  assert.doesNotMatch(u, /假說模式/);
  assert.match(u, /請輸出 JSON/);
});

test('AI-01 無資料 → hypothesis：要求【假說】開頭、需驗證、confidence ≤ 0.4；mode 未給也依 inputs 判定', () => {
  for (const input of [
    { toolName: '市場地圖', framework: ['市場區隔與規模'], inputs: {}, context: { growthGap: { growthGap: 50 } }, mode: 'hypothesis' },
    { toolName: '市場地圖', inputs: {} },
  ]) {
    const u = buildInsightUser(input);
    assert.match(u, /假說模式/);
    assert.match(u, /【假說】/);
    assert.match(u, /需驗證/);
    assert.match(u, /不得高於 0\.4/);
    assert.match(u, /不得臆造/);
    assert.match(u, /尚未填寫任何欄位/);
  }
  assert.equal(TASKS['AI-01'].buildUser, buildInsightUser);
});

test('AI-02 有洞察 → analysis：帶洞察、既有機會清單、要求標明來源；normalize 統一成字串陣列', () => {
  const { buildOpportunityUser } = TASKS['AI-02'].buildUser === undefined ? {} : { buildOpportunityUser: TASKS['AI-02'].buildUser };
  const u = buildOpportunityUser({ toolName: '市場地圖', insights: ['電商區隔成長最快', ''], existingOpportunities: ['企業團購'], context: { archetype: 'x' }, mode: 'analysis' });
  assert.match(u, /"電商區隔成長最快"/);
  assert.match(u, /\["企業團購"\]/);
  assert.match(u, /來自：洞察 N/);
  assert.doesNotMatch(u, /假說模式/);
  assert.equal(TASKS['AI-02'].model, 'sonnet');
  assert.equal(TASKS['AI-02'].json, true);
  const n = TASKS['AI-02'].normalize({ opportunities: ['a', { text: 'b' }, { opportunity: 'c' }, '', null] });
  assert.deepEqual(n.opportunities, ['a', 'b', 'c']);
});

test('AI-02 無洞察 → hypothesis：【假說】＋需驗證＋confidence ≤ 0.4；mode 未給也依 insights 判定', () => {
  const build = TASKS['AI-02'].buildUser;
  for (const input of [{ toolName: '市場地圖', insights: [], mode: 'hypothesis' }, { toolName: '市場地圖' }]) {
    const u = build(input);
    assert.match(u, /假說模式/);
    assert.match(u, /【假說】/);
    assert.match(u, /需驗證/);
    assert.match(u, /不得高於 0\.4/);
    assert.match(u, /尚未填寫/);
  }
});
