import { describe, test, expect } from 'vitest';
import {
  AGENDA_TEMPLATES, createWorkshopDoc, timerRemaining, tallyVotes, buildMinutes, missingResolutions,
} from '../domain/workshop';

describe('workshop', () => {
  test('createWorkshopDoc：兩場議程對齊 PRD 範本；內部場所有時段 ×2', () => {
    const w1 = createWorkshopDoc(1);
    expect(w1.agenda).toHaveLength(6);
    expect(w1.agenda.map((a) => a.minutes)).toEqual([15, 15, 60, 45, 30, 15]); // 約 3 小時
    const w2 = createWorkshopDoc(2, { doubled: true });
    expect(w2.agenda).toHaveLength(5);
    expect(w2.agenda.map((a) => a.minutes)).toEqual(AGENDA_TEMPLATES[2].map((a) => a.minutes * 2));
    expect(w1.status).toBe('pending');
  });

  test('timerRemaining：未開始回滿額；進行中依 now 推算；暫停回凍結值；支援 Timestamp', () => {
    expect(timerRemaining({ startedAt: null, durationSec: 300, pausedRemainingSec: null })).toBe(300);
    expect(timerRemaining({ startedAt: 1000, durationSec: 300, pausedRemainingSec: null }, 61000)).toBe(240);
    expect(timerRemaining({ startedAt: 1000, durationSec: 60, pausedRemainingSec: null }, 91000)).toBe(-30); // 超時為負
    expect(timerRemaining({ startedAt: null, durationSec: 300, pausedRemainingSec: 123 })).toBe(123);
    // Firestore Timestamp 形（serverTimestamp 落地後 onSnapshot 回傳）
    expect(timerRemaining({ startedAt: { toMillis: () => 1000 }, durationSec: 300, pausedRemainingSec: null }, 61000)).toBe(240);
    expect(timerRemaining(null)).toBe(0);
  });

  test('tallyVotes：只計指定題、無效選項不計、票數與人數正確', () => {
    const docs = [
      { voteKey: 'v1', choice: 0 }, { voteKey: 'v1', choice: 1 }, { voteKey: 'v1', choice: 1 },
      { voteKey: 'v1', choice: 9 },   // 超出選項數 → 不計
      { voteKey: 'v2', choice: 0 },   // 別題 → 不計
      { voteKey: 'v1', choice: 'x' }, // 非數字 → 不計
    ];
    const { tally, voters } = tallyVotes(docs, 'v1', 2);
    expect(tally).toEqual({ 0: 1, 1: 2 });
    expect(voters).toBe(3);
  });

  test('missingResolutions：只點名「需共識」且沒有決議的議程', () => {
    const ws = createWorkshopDoc(2); // w2a2/w2a3/w2a4 需共識
    ws.resolutions = { w2a2: [{ text: 'ok' }] };
    const missing = missingResolutions(ws);
    expect(missing).toContain('確認最終策略方案');
    expect(missing).toContain('排定執行時序');
    expect(missing).not.toContain('策略方案評估');
  });

  test('buildMinutes：含議程/決議/投票結果/意見排序', () => {
    const ws = createWorkshopDoc(1);
    ws.resolutions = { w1a2: [{ text: '採用 BCG 預設錨點', by: 'Walt' }] };
    ws.votes = { v1: { title: '第三席給誰', options: ['A 案', 'B 案'], tally: { 0: 3, 1: 1 }, voters: 4 } };
    const md = buildMinutes(ws, { projectName: '測試專案', opinions: [{ text: '通路資料太舊', likes: { a: true, b: true } }] });
    expect(md).toContain('第一次評估策略工作坊');
    expect(md).toContain('採用 BCG 預設錨點');
    expect(md).toContain('A 案：3 票');
    expect(md).toContain('(+2) 通路資料太舊');
    expect(md).toContain('決議：（未記錄）'); // 需共識而未記錄的段落要顯性標出
  });
});
