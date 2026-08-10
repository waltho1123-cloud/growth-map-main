// 綜合檢查引擎（PRD P-13 / MOD-11）：CHK-1～6 判定與逐項理由。
// CHK-1～4 未全綠 → 交付停用（FR-11-02）。

import { computeRollup } from './rollup';
import { hardChecks } from './sequencing';
import { assumptionCoverage } from './finance';
import { checkGr1, checkGr3, checkGr7, playCountStatus } from './guards';

const LAMP = Object.freeze({ pass: 'pass', warn: 'warn', fail: 'fail' });

function playComplete(play) {
  const t = play?.templates || {};
  const templatesConfirmed = ['t1', 't2', 't3'].every((k) => t[k]?.confirmed);
  const fin = play?.bizplan?.fin;
  const years = fin?.years || 3;
  const finComplete = !!fin && Number(fin?.pnl?.revenue?.[years - 1]) > 0;
  const fz = play?.bizplan?.feasibility || {};
  const feasibilityAnswered = ['resources', 'regulation', 'culture', 'time'].every((k) => (fz[k]?.answer || '') !== '');
  return { templatesConfirmed, finComplete, feasibilityAnswered, ok: templatesConfirmed && finComplete && feasibilityAnswered };
}

// 執行全部檢查。輸入為專案彙整後的記憶體狀態（stores 提供）。
export function runChecks({
  momentum = 0,
  aspiration = 0,
  opportunities = [],
  plays = [],
  synergies = null,
  assumptions = [],
  settings = {},
}) {
  const years = Number(settings.forecastYears) || 3;
  const taxRate = Number.isFinite(Number(settings.taxRate)) ? Number(settings.taxRate) : 0.2;
  const results = [];

  // CHK-1 疊加效益達成加速增長目標（阻擋）
  const rollup = computeRollup({ momentum, aspiration, plays, synergies, yearIndex: years - 1, metric: 'revenue', taxRate });
  results.push({
    code: 'CHK-1',
    title: '疊加效益達成加速增長目標',
    lamp: rollup.attainmentPct != null && rollup.attainmentPct >= 100 ? LAMP.pass : LAMP.fail,
    blocking: true,
    reason: rollup.attainmentPct == null
      ? '尚未取得第二堂加速增長目標，無法判定。'
      : `疊加效益 ÷ 目標 ＝ ${rollup.attainmentPct}%（缺口 ${Math.max(rollup.gapAmount, 0)}）。`,
    goto: 'rollup',
  });

  // CHK-2 策略方案數收斂（1–3 綠；4–5 黃；>5 或 0 紅阻擋）
  const n = (plays || []).length;
  const countStatus = playCountStatus(n, { warnAt: Number(settings.playWarn) || 3, max: Number(settings.playMax) || 5 });
  results.push({
    code: 'CHK-2',
    title: '策略方案數收斂（1–3）',
    lamp: countStatus.level === 'ok' ? LAMP.pass : countStatus.level === 'warn' ? LAMP.warn : LAMP.fail,
    blocking: true,
    reason: n === 0 ? '尚未建立任何策略方案。' : `目前 ${n} 個策略方案。${countStatus.message}`,
    goto: 'plays',
  });

  // CHK-3 每個方案具備完整高階商業計劃（阻擋）
  const incompletes = (plays || [])
    .map((p) => ({ p, detail: playComplete(p) }))
    .filter((x) => !x.detail.ok);
  results.push({
    code: 'CHK-3',
    title: '每個方案具備完整高階商業計劃',
    lamp: n > 0 && incompletes.length === 0 ? LAMP.pass : LAMP.fail,
    blocking: true,
    reason: n === 0
      ? '尚無方案可檢查。'
      : incompletes.length === 0
        ? '三模板已確認、財務表完成、可行性四問已答。'
        : incompletes.map(({ p, detail }) => {
            const missing = [];
            if (!detail.templatesConfirmed) missing.push('三模板未全數確認');
            if (!detail.finComplete) missing.push(`財務表 Y${years} 營收未填`);
            if (!detail.feasibilityAnswered) missing.push('可行性四問未答完');
            return `「${p.name || '未命名方案'}」：${missing.join('、')}`;
          }).join('；'),
    goto: 'plays',
  });

  // CHK-4 時序三項硬檢查（阻擋）
  const hard = hardChecks({
    plays, synergies, momentum, aspiration, years, taxRate,
    availableCapital: settings.availableCapital ?? null,
  });
  results.push({
    code: 'CHK-4',
    title: '時序三項硬檢查（相依／達標／現金流）',
    lamp: hard.allPass ? LAMP.pass : LAMP.fail,
    blocking: true,
    reason: hard.allPass
      ? '相依性無環、第三年總收入達標、資本支出在可用資金內。'
      : [hard.dependency, hard.attainment, hard.cashflow]
          .filter((c) => !c.pass)
          .map((c) => `${c.label}：${c.reasons.join('；') || '未通過'}`)
          .join('｜'),
    goto: 'sequencing',
  });

  // CHK-5 財務關鍵欄位掛假設比率（黃燈，不阻擋）
  const coverage = assumptionCoverage(plays, assumptions, { years });
  const targetRatio = Number(settings.assumptionTargetRatio) || 0.8;
  results.push({
    code: 'CHK-5',
    title: `財務關鍵欄位掛假設 ≥ ${Math.round(targetRatio * 100)}%`,
    lamp: coverage.ratio >= targetRatio ? LAMP.pass : LAMP.warn,
    blocking: false,
    reason: coverage.filled === 0
      ? '尚無已填數字的關鍵欄位。'
      : `已掛 ${coverage.linked}／${coverage.filled}（${Math.round(coverage.ratio * 100)}%）。未掛假設的數字無法被檢驗。`,
    goto: 'plays',
  });

  // CHK-6 評估對象正確性與具體性（黃燈；GR-2 由資料模型層杜絕，恆過）
  const gr1Hits = (opportunities || []).filter((o) => !o.excluded?.flag && checkGr1(o.opportunityName).flagged);
  const gr3Hits = (opportunities || []).filter((o) => o.shortlist?.included && checkGr3(o.opportunityName).flagged);
  const gr7Hits = [];
  for (const p of plays || []) {
    const t3 = p?.templates?.t3?.content || {};
    for (const field of ['successFactors', 'coreCapabilities', 'requiredInvestment']) {
      for (const item of Array.isArray(t3[field]) ? t3[field] : []) {
        if (checkGr7(item).flagged) gr7Hits.push({ play: p.name, field, item });
      }
    }
  }
  const chk6Issues = [];
  if (gr1Hits.length) chk6Issues.push(`GR-1 疑似方法/目標：${gr1Hits.length} 筆`);
  if (gr3Hits.length) chk6Issues.push(`GR-3 短名單含無效名稱：${gr3Hits.length} 筆`);
  if (gr7Hits.length) chk6Issues.push(`GR-7 泛用詞：${gr7Hits.length} 筆`);
  results.push({
    code: 'CHK-6',
    title: '評估對象正確性與具體性（GR-1/2/3/7）',
    lamp: chk6Issues.length === 0 ? LAMP.pass : LAMP.warn,
    blocking: false,
    reason: chk6Issues.length === 0
      ? '無未處理的品質紅黃標；評分對象由資料模型限定為機會點/方案（GR-2 結構性成立）。'
      : chk6Issues.join('；'),
    goto: 'longlist',
  });

  // 阻擋語意：blocking 項只有紅燈（fail）才擋交付；黃燈（如 CHK-2 的 4–5 個）警示不阻擋
  const blockingFails = results.filter((r) => r.blocking && r.lamp === LAMP.fail);
  return {
    ranAt: Date.now(),
    results,
    canDeliver: blockingFails.length === 0,
    blockingFails: blockingFails.map((r) => r.code),
  };
}
