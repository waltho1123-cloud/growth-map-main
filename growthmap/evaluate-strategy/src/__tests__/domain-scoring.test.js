import { describe, test, expect } from 'vitest';
import { totalOf, isComplete, axesOf, rationaleRequired, aggregateScores, scoreDocId } from '../domain/scoring';
import { defaultDividers, quadrantOf, QUADRANTS } from '../domain/matrix';
import {
  checkGr1, checkGr3, checkGr7, playCountStatus, longlistCountStatus, computeOpportunityFlags,
} from '../domain/guards';

// ── 評分引擎（MOD-03）─────────────────────────────────────────────────────────
describe('scoring', () => {
  test('totalOf：四維加總滿分 20；未評維度以 0 計；超界值鉗住', () => {
    expect(totalOf({ size: 5, potential: 5, path: 5, rightToWin: 5 })).toBe(20);
    expect(totalOf({ size: 3, potential: 4 })).toBe(7);
    expect(totalOf({ size: 9, potential: -2, path: 3, rightToWin: 'x' })).toBe(5 + 0 + 3 + 0);
    expect(totalOf(null)).toBe(0);
  });

  test('isComplete：四維皆 1–5 才算完成', () => {
    expect(isComplete({ size: 1, potential: 2, path: 3, rightToWin: 4 })).toBe(true);
    expect(isComplete({ size: 1, potential: 2, path: 3 })).toBe(false);
  });

  test('axesOf：縱軸=(①+②)/2、橫軸=(③+④)/2，一位小數（PRD P-04）', () => {
    const { x, y } = axesOf({ size: 5, potential: 4, path: 2, rightToWin: 3 });
    expect(y).toBe(4.5);
    expect(x).toBe(2.5);
  });

  test('axesOf：加權啟用時以權重平均（PD-01 預設關閉）', () => {
    const weighting = { enabled: true, weights: { size: 40, potential: 10, path: 25, rightToWin: 25 } };
    const { y } = axesOf({ size: 5, potential: 1, path: 3, rightToWin: 3 }, weighting);
    expect(y).toBe(4.2); // (5*40+1*10)/50
  });

  test('rationaleRequired：1 或 5 分必填依據', () => {
    expect(rationaleRequired(1)).toBe(true);
    expect(rationaleRequired(5)).toBe(true);
    expect(rationaleRequired(3)).toBe(false);
    expect(rationaleRequired(0)).toBe(false); // 未評不要求
  });

  test('aggregateScores：平均/中位數/極差；極差 ≥ 2 標記複議（US-005）', () => {
    const scores = [
      { submitted: true, dims: { size: 5, potential: 3, path: 3, rightToWin: 4 } },
      { submitted: true, dims: { size: 2, potential: 3, path: 4, rightToWin: 4 } },
      { submitted: false, dims: { size: 1, potential: 1, path: 1, rightToWin: 1 } }, // 未提交不計
    ];
    const agg = aggregateScores(scores, { dispersionThreshold: 2 });
    expect(agg.scorerCount).toBe(2);
    expect(agg.perDim.size.mean).toBe(3.5);
    expect(agg.perDim.size.median).toBe(3.5);
    expect(agg.perDim.size.range).toBe(3);
    expect(agg.perDim.size.flagged).toBe(true);
    expect(agg.perDim.potential.flagged).toBe(false);
    expect(agg.needsReview).toBe(true);
    expect(agg.axes.y).toBe(3.3); // (3.5+3)/2 = 3.25 → round1=3.3
  });

  test('aggregateScores：單一評分者不觸發複議（極差需 ≥2 人）', () => {
    const agg = aggregateScores([{ submitted: true, dims: { size: 5, potential: 5, path: 5, rightToWin: 5 } }]);
    expect(agg.needsReview).toBe(false);
    expect(agg.total).toBe(20);
  });

  test('scoreDocId：機會×輪次×評分者 唯一', () => {
    expect(scoreDocId('opp1', 2, 'u9')).toBe('opp1__r2__u9');
  });
});

// ── 2×2 矩陣（MOD-04 / PD-02）────────────────────────────────────────────────
describe('matrix', () => {
  test('defaultDividers：取當期資料中位數，非固定 3.0（PD-02）', () => {
    const points = [{ x: 1, y: 5 }, { x: 2, y: 4 }, { x: 4, y: 1 }];
    expect(defaultDividers(points)).toEqual({ x: 2, y: 4 });
  });

  test('defaultDividers：無資料退回量表中點 3', () => {
    expect(defaultDividers([])).toEqual({ x: 3, y: 3 });
  });

  test('quadrantOf：四象限標籤（右上必做/右下速贏/左上大膽投注/左下不做）', () => {
    const d = { x: 3, y: 3 };
    expect(quadrantOf({ x: 4, y: 4 }, d)).toBe(QUADRANTS.must);
    expect(quadrantOf({ x: 4, y: 2 }, d)).toBe(QUADRANTS.quickwin);
    expect(quadrantOf({ x: 2, y: 4 }, d)).toBe(QUADRANTS.bigbet);
    expect(quadrantOf({ x: 2, y: 2 }, d)).toBe(QUADRANTS.skip);
  });
});

// ── 防呆規則（GR-1/3/4/7）─────────────────────────────────────────────────────
describe('guards', () => {
  test('GR-1：純目標句（提升品牌指名度）標黃；含市場+商模不標', () => {
    expect(checkGr1('提升消費者對品牌的指名度').flagged).toBe(true);
    expect(checkGr1('跨足通路端：透過入股通路商建立自有通路，以提升品牌指名度').flagged).toBe(false);
    expect(checkGr1('').flagged).toBe(false);
  });

  test('GR-3：空名稱/純編號/工具名樣式 → 無效泡泡標籤', () => {
    expect(checkGr3('').flagged).toBe(true);
    expect(checkGr3('#6').flagged).toBe(true);
    expect(checkGr3('工具17 內部盤點').flagged).toBe(true);
    expect(checkGr3('東南亞視覺解決方案市場').flagged).toBe(false);
  });

  test('GR-4：1–3 正常、4–5 黃燈、>5 硬阻擋（PD-03）', () => {
    expect(playCountStatus(2).level).toBe('ok');
    expect(playCountStatus(4).level).toBe('warn');
    expect(playCountStatus(6).level).toBe('block');
    expect(playCountStatus(0).level).toBe('empty');
  });

  test('GR-7：泛用詞（AI 應用/大數據分析）標黃；具體項目不標', () => {
    expect(checkGr7('AI 應用').flagged).toBe(true);
    expect(checkGr7('大數據分析').flagged).toBe(true);
    expect(checkGr7('取得 ISO 14644 無塵室驗證').flagged).toBe(false);
  });

  test('longlistCountStatus：<7 警示、7–10 綠、>15 警示', () => {
    expect(longlistCountStatus(5).level).toBe('warn');
    expect(longlistCountStatus(8).level).toBe('ok');
    expect(longlistCountStatus(16).level).toBe('warn');
  });

  test('computeOpportunityFlags：TAM/SAM 皆缺標記 tamMissing；GR-1 帶理由', () => {
    const flags = computeOpportunityFlags({ opportunityName: '強化研發能力', tam: null, sam: null });
    expect(flags.gr1).toBe(true);
    expect(flags.gr1Reason).toContain('方法');
    expect(flags.tamMissing).toBe(true);
    const ok = computeOpportunityFlags({ opportunityName: '寵物鮮食市場', tam: 500, sam: null });
    expect(ok.tamMissing).toBe(false);
  });
});
