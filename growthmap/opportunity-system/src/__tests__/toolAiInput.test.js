import { describe, it, expect } from 'vitest';
import { buildAiInsightInput, hasFieldSchema, NOTES_KEY, NOTES_MIN_CHARS } from '../utils/toolAiInput';

const external = { id: 1, name: '市場地圖', fieldSchema: { fields: [] } };
const internal = { id: 17, name: '核心能力', fieldSchema: { fields: [{ key: 'capabilities' }, { key: 'score' }, { key: 'tags' }] } };

describe('buildAiInsightInput', () => {
  it('外部觀察工具：筆記不足 20 字 → 不可按並給提示；足夠 → 以「觀察資料與研究筆記」餵 AI', () => {
    expect(hasFieldSchema(external)).toBe(false);
    const empty = buildAiInsightInput(external, {});
    expect(empty.ready).toBe(false);
    expect(empty.payload).toBeNull();
    expect(empty.hint).toContain(String(NOTES_MIN_CHARS));
    const short = buildAiInsightInput(external, { [NOTES_KEY]: '  市場很大  ' });
    expect(short.ready).toBe(false);
    const notes = '2025 年台灣機能服飾市場規模約 120 億，前三品牌合計市佔 45%，成長最快區隔為戶外機能。';
    const ok = buildAiInsightInput(external, { [NOTES_KEY]: `  ${notes}  ` });
    expect(ok.ready).toBe(true);
    expect(ok.payload).toEqual({ toolName: '市場地圖', inputs: { 觀察資料與研究筆記: notes } });
  });

  it('內部洞察工具：一個欄位都沒填 → 不可按；只送有填的 schema 欄位（略過空值與非 schema 鍵）', () => {
    expect(hasFieldSchema(internal)).toBe(true);
    expect(buildAiInsightInput(internal, { capabilities: '  ', score: null, tags: [], stray: 'x' }).ready).toBe(false);
    const r = buildAiInsightInput(internal, { capabilities: '通路與供應鏈', score: 0, tags: [], stray: 'x' });
    expect(r.ready).toBe(true);
    expect(r.payload).toEqual({ toolName: '核心能力', inputs: { capabilities: '通路與供應鏈', score: 0 } });
  });

  it('缺工具或缺 fieldSchema 時視為外部工具，不會拋錯', () => {
    expect(buildAiInsightInput(undefined, {}).ready).toBe(false);
    expect(buildAiInsightInput({ name: 'x' }, { notes: 'a'.repeat(NOTES_MIN_CHARS) }).ready).toBe(true);
  });
});

describe('showsNotes／外部工具有欄位時的合併輸入', () => {
  it('外部工具即使有欄位也保留筆記欄；筆記 ≥20 字可單獨讓 AI 可按並併入 payload', async () => {
    const { showsNotes } = await import('../utils/toolAiInput');
    const extWithFields = { id: 2, name: '價值鏈分析', observationType: 'external', fieldSchema: { fields: [{ key: 'stages' }] } };
    expect(showsNotes(extWithFields)).toBe(true);
    expect(showsNotes({ id: 17, name: 'x', observationType: 'internal', fieldSchema: { fields: [{ key: 'a' }] } })).toBe(false);
    const notes = '產業價值鏈利潤集中在品牌與通路兩端，代工環節毛利率不到一成。';
    const r = buildAiInsightInput(extWithFields, { [NOTES_KEY]: notes });
    expect(r.ready).toBe(true);
    expect(r.payload.inputs).toEqual({ 觀察資料與研究筆記: notes });
    const both = buildAiInsightInput(extWithFields, { stages: '原料→製造→品牌→通路', [NOTES_KEY]: notes });
    expect(both.payload.inputs).toEqual({ stages: '原料→製造→品牌→通路', 觀察資料與研究筆記: notes });
    expect(buildAiInsightInput(extWithFields, {}).hint).toContain('觀察資料');
  });
});
