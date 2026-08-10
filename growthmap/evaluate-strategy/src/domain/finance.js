// 高階商業計劃財務引擎（PRD MOD-07 / P-09）。
// 單一來源原則（§8 資料完整性）：P-09 是唯一輸入處，本模組只衍生與檢查，
// P-10／P-11 一律經由這裡計算，不得另存數字。

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

// 空白財務結構；years 由設定頁決定（PD-04：預設 3，可延至 5）
export function createEmptyFin(years = 3) {
  const zeros = () => Array.from({ length: years }, () => 0);
  return {
    years,
    pnl: { revenue: zeros(), cogs: zeros(), opex: zeros(), interest: zeros() },
    bs: {
      cash: zeros(), ar: zeros(), fixedAssets: zeros(), leaseAssets: zeros(),
      stDebt: zeros(), ltDebt: zeros(), ap: zeros(), paidInCapital: zeros(),
    },
    cf: { cfo: zeros(), cfi: zeros(), cff: zeros() },
    capex: zeros(),
  };
}

// 年期調整（設定頁改 forecastYears 時遷移既有資料：截斷或補 0）
export function resizeFin(fin, years) {
  const fit = (arr) => Array.from({ length: years }, (_, i) => num(arr?.[i]));
  const base = fin || createEmptyFin(years);
  return {
    years,
    pnl: Object.fromEntries(Object.entries(base.pnl || {}).map(([k, v]) => [k, fit(v)])),
    bs: Object.fromEntries(Object.entries(base.bs || {}).map(([k, v]) => [k, fit(v)])),
    cf: Object.fromEntries(Object.entries(base.cf || {}).map(([k, v]) => [k, fit(v)])),
    capex: fit(base.capex),
  };
}

const round1 = (v) => Math.round(v * 10) / 10;

// 損益表衍生列：毛利＝營收−COGS、EBIT＝毛利−OPEX、稅前＝EBIT−利息、
// 所得稅（稅前為正才課，稅率設定頁維護）、本期淨利、毛利率、淨利率
export function derivePnl(fin, { taxRate = 0.2 } = {}) {
  const years = fin?.years || fin?.pnl?.revenue?.length || 3;
  const rows = {
    grossProfit: [], grossMarginPct: [], ebit: [], preTax: [], tax: [], netIncome: [], netMarginPct: [],
  };
  for (let i = 0; i < years; i++) {
    const rev = num(fin?.pnl?.revenue?.[i]);
    const cogs = num(fin?.pnl?.cogs?.[i]);
    const opex = num(fin?.pnl?.opex?.[i]);
    const interest = num(fin?.pnl?.interest?.[i]);
    const gross = rev - cogs;
    const ebit = gross - opex;
    const preTax = ebit - interest;
    const tax = preTax > 0 ? preTax * taxRate : 0;
    const ni = preTax - tax;
    rows.grossProfit.push(gross);
    rows.grossMarginPct.push(rev !== 0 ? round1((gross / rev) * 100) : 0);
    rows.ebit.push(ebit);
    rows.preTax.push(preTax);
    rows.tax.push(round1(tax));
    rows.netIncome.push(round1(ni));
    rows.netMarginPct.push(rev !== 0 ? round1((ni / rev) * 100) : 0);
  }
  return rows;
}

// 現金流量衍生：本期增減＝CFO＋CFI＋CFF；期末現金＝逐年累計
export function deriveCf(fin) {
  const years = fin?.years || fin?.cf?.cfo?.length || 3;
  const netChange = [];
  const endingCash = [];
  let cum = 0;
  for (let i = 0; i < years; i++) {
    const change = num(fin?.cf?.cfo?.[i]) + num(fin?.cf?.cfi?.[i]) + num(fin?.cf?.cff?.[i]);
    cum += change;
    netChange.push(change);
    endingCash.push(cum);
  }
  return { netChange, endingCash };
}

// 資產負債衍生：資產總計／負債總計／保留盈餘（歷年淨利累計）／權益總計／平衡差
export function deriveBs(fin, pnlRows) {
  const years = fin?.years || fin?.bs?.cash?.length || 3;
  const rows = { totalAssets: [], totalLiabilities: [], retainedEarnings: [], totalEquity: [], balanceGap: [] };
  let cumNi = 0;
  for (let i = 0; i < years; i++) {
    const assets = num(fin?.bs?.cash?.[i]) + num(fin?.bs?.ar?.[i]) + num(fin?.bs?.fixedAssets?.[i]) + num(fin?.bs?.leaseAssets?.[i]);
    const liab = num(fin?.bs?.stDebt?.[i]) + num(fin?.bs?.ltDebt?.[i]) + num(fin?.bs?.ap?.[i]);
    cumNi += num(pnlRows?.netIncome?.[i]);
    const equity = num(fin?.bs?.paidInCapital?.[i]) + cumNi;
    rows.totalAssets.push(assets);
    rows.totalLiabilities.push(liab);
    rows.retainedEarnings.push(Math.round(cumNi * 10) / 10);
    rows.totalEquity.push(Math.round(equity * 10) / 10);
    rows.balanceGap.push(Math.round((assets - liab - equity) * 10) / 10);
  }
  return rows;
}

// 三表勾稽提示（ERR-05 等，非強制阻擋、僅提示）
export function crossChecks(fin, { taxRate = 0.2 } = {}) {
  const warnings = [];
  const pnl = derivePnl(fin, { taxRate });
  const cf = deriveCf(fin);
  const bs = deriveBs(fin, pnl);
  cf.endingCash.forEach((v, i) => {
    if (v < 0) warnings.push({ code: 'CASH_NEGATIVE', year: i + 1, message: `第 ${i + 1} 年期末現金餘額為負（${v}），請確認融資或母公司挹注。` });
  });
  bs.balanceGap.forEach((v, i) => {
    if (Math.abs(v) > 0.5) warnings.push({ code: 'BS_IMBALANCE', year: i + 1, message: `第 ${i + 1} 年資產與負債＋權益不平衡（差 ${v}），請檢查各科目。` });
  });
  return warnings;
}

// ── GR-5：關鍵欄位掛假設 ─────────────────────────────────────────────────────
// 關鍵欄位＝營業收入、營業成本、資本支出（各年）。期末現金為衍生值不列入。
export function finCellRef(playId, path, yearIndex) {
  return `fin:${playId}:${path}:${yearIndex}`;
}

export function keyFinCells(playId, years = 3) {
  const cells = [];
  for (const path of ['pnl.revenue', 'pnl.cogs', 'capex']) {
    for (let i = 0; i < years; i++) cells.push({ ref: finCellRef(playId, path, i), path, yearIndex: i });
  }
  return cells;
}

// 假設掛載覆蓋率（CHK-5 用）。assumptions：專案全部假設文件。
// 只把「已填數字（≠0）」的關鍵欄位算進分母——方法論要求「沒有假設就沒有數字」，
// 尚未填數字的欄位不倒扣覆蓋率。
export function assumptionCoverage(plays, assumptions, { years = 3 } = {}) {
  const linkedRefs = new Set((assumptions || []).map((a) => a?.target?.ref).filter(Boolean));
  let filled = 0;
  let linked = 0;
  const unlinked = [];
  for (const play of plays || []) {
    const fin = play?.bizplan?.fin;
    if (!fin) continue;
    for (const cell of keyFinCells(play.id, years)) {
      const [group, field] = cell.path.split('.');
      const value = field ? num(fin?.[group]?.[field]?.[cell.yearIndex]) : num(fin?.[group]?.[cell.yearIndex]);
      if (value === 0) continue;
      filled += 1;
      if (linkedRefs.has(cell.ref)) linked += 1;
      else unlinked.push({ playId: play.id, playName: play.name, ...cell });
    }
  }
  return {
    filled,
    linked,
    ratio: filled > 0 ? linked / filled : 1, // 沒有任何數字時視為 100%（無數字可違規）
    unlinked,
  };
}
