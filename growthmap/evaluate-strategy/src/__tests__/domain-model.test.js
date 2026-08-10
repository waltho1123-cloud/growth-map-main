import { describe, test, expect } from 'vitest';
import {
  createProjectDoc, opportunityDocFromHandoff, createManualOpportunity,
  buildTemplateDrafts, contentFingerprint, createPlayDoc, buildEvalHandoffSnapshot,
  normalizeUpstreamFields, upstreamFingerprintOf, approxJsonBytes,
  ROLES, canEdit, SANITY_QUESTIONS,
} from '../domain/model';
import { createDefaultCriteria, DIMENSIONS, DEFAULT_ANCHORS } from '../domain/criteria';

describe('model factories', () => {
  test('createProjectDoc：建立者為唯一成員＋owner（與 firestore.rules create 條件對齊）', () => {
    const doc = createProjectDoc({ name: '2026 評估', uid: 'u1', email: 'a@b.c', displayName: 'Walt' });
    expect(doc.memberUids).toEqual(['u1']);
    expect(doc.members.u1.role).toBe('owner');
    expect(doc.settings.playMax).toBe(5); // PD-03 上限
    expect(doc.settings.taxRate).toBe(0.2);
    expect(doc.consensus.sanity).toHaveLength(SANITY_QUESTIONS.length);
    expect(doc.criteria.weighting.enabled).toBe(false); // PD-01
  });

  test('coach 角色不可編輯（canEdit）', () => {
    expect(canEdit('owner')).toBe(true);
    expect(canEdit('coach')).toBe(false);
    expect(canEdit('ghost-role')).toBe(false);
    expect(Object.keys(ROLES)).toEqual(['owner', 'facilitator', 'member', 'coach']);
  });

  test('createDefaultCriteria：四維各有 1–5 錨點且沿用 BCG 預設', () => {
    const c = createDefaultCriteria();
    for (const d of DIMENSIONS) {
      expect(c.anchors[d.key][5]).toBe(DEFAULT_ANCHORS[5]);
      expect(c.anchors[d.key][1]).toBe(DEFAULT_ANCHORS[1]);
    }
  });

  test('opportunityDocFromHandoff：帶入三模板與工具、算品質旗標；manual 後援標 origin', () => {
    const doc = opportunityDocFromHandoff({
      id: 'src-1', opportunityName: '提升品牌知名度', estRevenue: 100, currency: 'TWD',
      sourceToolCodes: [17], sourceToolNames: ['行銷診斷'], aiScore: 10,
      template1: { growthType: ['拓展鄰近'] }, template2: null, template3: null,
    }, 0);
    expect(doc.no).toBe(1);
    expect(doc.sourceId).toBe('src-1');
    expect(doc.qualityFlags.gr1).toBe(true); // 目標句型
    expect(doc.qualityFlags.tamMissing).toBe(true);
    expect(doc.growthType).toBe('拓展鄰近');
    expect(doc.excluded.flag).toBe(false);

    const manual = createManualOpportunity('新市場機會', 3);
    expect(manual.origin).toBe('manual');
    expect(manual.no).toBe(4);
  });

  test('buildTemplateDrafts：多來源機會彙整並標示來源（GR-6 底稿）', () => {
    const drafts = buildTemplateDrafts([
      {
        opportunityName: '手機殼', sourceToolCodes: [1], sourceToolNames: ['A'],
        template1: { insights: '洞察一\n洞察二', growthType: ['鞏固核心'] },
        template2: { concept: '概念甲', targetCustomer: '客群1', usp: '賣點1', steps: '步驟1' },
        template3: { successFactors: '快速供應鏈', coreCapabilities: '模具開發' },
      },
      {
        opportunityName: '行動電源', sourceToolCodes: [1, 2], sourceToolNames: ['A', 'B'],
        template1: { insights: '洞察三', growthType: ['拓展鄰近'] },
        template2: { concept: '概念乙', targetCustomer: '客群2', usp: '', steps: '' },
        template3: { successFactors: '', coreCapabilities: '' },
      },
    ]);
    expect(drafts.t1.insights).toEqual(['【手機殼】洞察一', '【手機殼】洞察二', '【行動電源】洞察三']);
    expect(drafts.t1.usedToolCodes).toEqual([1, 2]);
    expect(drafts.t1.growthType).toEqual(['鞏固核心', '拓展鄰近']);
    expect(drafts.t2.concept).toBe('概念甲\n概念乙');
    expect(drafts.t2.targetCustomers).toEqual(['【手機殼】客群1', '【行動電源】客群2']);
    expect(drafts.t3.successFactors).toEqual(['【手機殼】快速供應鏈']);
  });

  test('createPlayDoc：底稿指紋可偵測「未編輯即確認」（GR-6）', () => {
    const play = createPlayDoc({ name: '手機周邊', formation: 'merge', mergeCriteria: ['共同的價值主張或主題'], sourceOppIds: ['a'], ownerUid: 'u1' }, [], { forecastYears: 3 });
    const t1 = play.templates.t1;
    expect(contentFingerprint(t1.content)).toBe(t1.draftFingerprint); // 未編輯
    const edited = { ...t1.content, insights: ['自己重寫的洞察'] };
    expect(contentFingerprint(edited)).not.toBe(t1.draftFingerprint); // 已編輯
    expect(play.bizplan.fin.pnl.revenue).toHaveLength(3);
    expect(play.sequencing).toEqual({ startYear: 1, endYear: 1, dependsOn: [] });
  });

  test('上游修正偵測：正規化形穩定；名稱/模板變動 → 指紋改變（重同步 stale 標記依據）', () => {
    const opp = {
      id: 'o1', opportunityName: '寵物鮮食市場', estRevenue: 100, currency: 'TWD',
      sourceToolCodes: [17], sourceToolNames: ['A'], aiScore: 10,
      template1: { insights: 'x' }, template2: null, template3: null,
    };
    const fp1 = upstreamFingerprintOf(opp);
    // 相同上游內容（即使物件順序/多餘欄位不同）→ 同指紋
    expect(upstreamFingerprintOf({ ...opp, somethingLocal: 'ignored' })).toBe(fp1);
    // 上游改名 → 指紋不同
    expect(upstreamFingerprintOf({ ...opp, opportunityName: '寵物鮮食市場（修正版）' })).not.toBe(fp1);
    // 上游改模板 → 指紋不同
    expect(upstreamFingerprintOf({ ...opp, template1: { insights: 'y' } })).not.toBe(fp1);
    // normalize 只留上游欄位
    expect(Object.keys(normalizeUpstreamFields(opp))).not.toContain('somethingLocal');
    // 承接文件帶初始指紋
    const doc = opportunityDocFromHandoff(opp, 0);
    expect(doc.upstreamFingerprint).toBe(fp1);
    expect(doc.staleUpstream).toBe(null);
  });

  test('approxJsonBytes：以 UTF-8 位元組計（中文 3 bytes/字），供 1MiB 護欄用', () => {
    expect(approxJsonBytes({ a: 1 })).toBe(JSON.stringify({ a: 1 }).length);
    const cn = { t: '中文' };
    expect(approxJsonBytes(cn)).toBeGreaterThan(JSON.stringify(cn).length); // 多位元組比 length 大
  });

  test('buildEvalHandoffSnapshot：凍結方案模板內容與檢查結果（交付第五堂）', () => {
    const project = createProjectDoc({ name: 'X', uid: 'u1', email: '', displayName: '' });
    project.targetSnapshot = { aspiration: 100, momentum: 60, growthGap: 40, currency: 'TWD' };
    const play = createPlayDoc({ name: 'P', formation: 'extend', extendTheme: '更廣的主題', sourceOppIds: ['o1'], ownerUid: 'u1' }, [], {});
    play.id = 'p1';
    const snap = buildEvalHandoffSnapshot({
      project,
      opportunities: [{ id: 'o1', opportunityName: 'O', shortlist: { included: true }, tam: 1, sam: 2, som: null }],
      plays: [play],
      rollup: { total: 90 },
      totalsTable: { totals: {} },
      checkRun: { canDeliver: false },
    }, 2);
    expect(snap.version).toBe(2);
    expect(snap.plays[0].templates.t1).toBe(play.templates.t1.content);
    expect(snap.shortlist).toHaveLength(1);
    expect(snap.targetSnapshot.growthGap).toBe(40);
  });
});
