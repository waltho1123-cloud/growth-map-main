import { describe, it, expect } from 'vitest';
import { buildAiInsightInput, buildAiContext, hasFieldSchema, showsNotes, NOTES_KEY, NOTES_MIN_CHARS } from '../utils/toolAiInput';

const external = { id: 1, name: '市場地圖', category: '產業面', observationType: 'external', fieldSchema: { draft: true, fields: [{ key: 'segments', label: '市場區隔與規模' }, { key: 'players', label: '主要參與者與市佔' }] } };
const internal = { id: 17, name: '核心能力', category: '成長槓桿診斷', observationType: 'internal', fieldSchema: { fields: [{ key: 'capabilities', label: '能力' }, { key: 'score', label: '分數' }] } };

describe('buildAiInsightInput（AI 永遠可按；無資料走假說模式）', () => {
  it('什麼都沒填 → ready 仍為 true、mode=hypothesis、payload 帶框架欄位與提示', () => {
    const r = buildAiInsightInput(external, {}, { archetype: 'A' });
    expect(r.ready).toBe(true);
    expect(r.hasData).toBe(false);
    expect(r.mode).toBe('hypothesis');
    expect(r.payload.framework).toEqual(['市場區隔與規模', '主要參與者與市佔']);
    expect(r.payload.inputs).toEqual({});
    expect(r.payload.context).toEqual({ archetype: 'A' });
    expect(r.hint).toContain('假說');
    expect(r.hint).toContain(String(NOTES_MIN_CHARS));
  });

  it('有填欄位或筆記 → mode=analysis，只送有值欄位＋筆記；短筆記不算', () => {
    const notes = '2025 年台灣機能服飾市場規模約 120 億，前三品牌合計市佔 45%。';
    const r = buildAiInsightInput(external, { segments: '戶外／運動／日常', players: '', [NOTES_KEY]: notes });
    expect(r.mode).toBe('analysis');
    expect(r.hint).toBe('');
    expect(r.payload.inputs).toEqual({ segments: '戶外／運動／日常', 觀察資料與研究筆記: notes });
    expect(buildAiInsightInput(external, { [NOTES_KEY]: '太短' }).mode).toBe('hypothesis');
  });

  it('內部工具不顯示筆記欄；欄位全空同樣走假說模式且提示不提筆記', () => {
    expect(showsNotes(internal)).toBe(false);
    expect(showsNotes(external)).toBe(true);
    expect(hasFieldSchema(internal)).toBe(true);
    const r = buildAiInsightInput(internal, { capabilities: ' ', score: null, [NOTES_KEY]: 'x'.repeat(50) });
    expect(r.mode).toBe('hypothesis');
    expect(r.payload.inputs).toEqual({});
    expect(r.hint).not.toContain('筆記');
    expect(buildAiInsightInput(internal, { score: 0 }).payload.inputs).toEqual({ score: 0 });
  });

  it('缺工具 → ready=false', () => {
    expect(buildAiInsightInput(undefined, {}).ready).toBe(false);
  });
});

describe('buildAiContext（公司背景摘要，全部截斷）', () => {
  it('取企業原型、成長差距、其他工具洞察（排除目前工具、最多 8 個工具×3 條×160 字）、機會名稱', () => {
    const state = {
      projectMeta: { archetypeSnapshot: { archetype: '穩健型' }, targetSnapshot: { momentum: 100, aspiration: 150, growthGap: 50, currency: 'TWD', syncedAt: 1 } },
      toolAnalyses: {
        1: { insights: ['本工具的洞察不該出現'] },
        17: { insights: ['A', '', 'B', 'C', 'D'] },
        18: { insights: ['  '] },
        19: { insights: ['x'.repeat(500)] },
      },
      opportunities: [{ opportunityName: '機會一' }, { opportunityName: '' }, { opportunityName: '機會三' }],
    };
    const ctx = buildAiContext(state, { toolNameById: { 17: '行銷診斷', 19: '通路' }, currentToolId: 1 });
    expect(ctx.archetype).toEqual({ archetype: '穩健型' });
    expect(ctx.growthGap).toEqual({ momentum: 100, aspiration: 150, growthGap: 50, currency: 'TWD' });
    expect(ctx.otherInsights).toEqual([
      { tool: '行銷診斷', insights: ['A', 'B', 'C'] },
      { tool: '通路', insights: ['x'.repeat(160)] },
    ]);
    expect(ctx.opportunities).toEqual(['機會一', '機會三']);
    expect(buildAiContext({}).growthGap).toBeNull();
  });
});

describe('buildAiOpportunityInput（AI-02 機會方向）', () => {
  it('有洞察 → analysis，洞察去空白截斷、既有機會帶入避免重複；無洞察 → hypothesis 並提示', async () => {
    const { buildAiOpportunityInput } = await import('../utils/toolAiInput');
    const tool = { id: 1, name: '市場地圖', category: '產業面', observationType: 'external', fieldSchema: { fields: [{ key: 'a', label: '市場區隔與規模' }] } };
    const r = buildAiOpportunityInput(tool, ['  電商區隔成長最快  ', '', 'x'.repeat(400)], { archetype: 'A' }, ['企業團購', '']);
    expect(r.ready).toBe(true);
    expect(r.mode).toBe('analysis');
    expect(r.payload.insights).toEqual(['電商區隔成長最快', 'x'.repeat(300)]);
    expect(r.payload.existingOpportunities).toEqual(['企業團購']);
    expect(r.payload.framework).toEqual(['市場區隔與規模']);
    expect(r.payload.context).toEqual({ archetype: 'A' });
    const h = buildAiOpportunityInput(tool, [' ', ''], null, []);
    expect(h.mode).toBe('hypothesis');
    expect(h.hint).toContain('假說');
    expect(buildAiOpportunityInput(undefined, []).ready).toBe(false);
  });
});
