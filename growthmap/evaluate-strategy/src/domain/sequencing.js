// 時序與資源彙總（PRD MOD-08 / P-11）：分年彙總表＋三項硬檢查。
// 數字自 P-09 財務表帶入（單一來源），僅綜效列為 P-11／P-10 輸入。

import { derivePnl } from './finance';
import { computeRollup } from './rollup';

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

// 相依成環偵測（DFS）；回傳所有偵測到的環（以方案 id 陣列表示）
export function detectCycles(plays) {
  const byId = new Map((plays || []).map((p) => [p.id, p]));
  const state = new Map(); // id -> 0 未訪 / 1 訪問中 / 2 完成
  const cycles = [];
  const stack = [];

  function dfs(id) {
    state.set(id, 1);
    stack.push(id);
    const deps = byId.get(id)?.sequencing?.dependsOn || [];
    for (const dep of deps) {
      if (!byId.has(dep)) continue; // 已刪除的方案殘留引用：不算環
      if (state.get(dep) === 1) {
        cycles.push([...stack.slice(stack.indexOf(dep)), dep]);
      } else if (!state.get(dep)) {
        dfs(dep);
      }
    }
    stack.pop();
    state.set(id, 2);
  }

  for (const p of plays || []) if (!state.get(p.id)) dfs(p.id);
  return cycles;
}

// 順序衝突：p 相依於 d，但 p 的起始年早於 d 的結束年（PRD P-11 驗證）
export function orderConflicts(plays) {
  const byId = new Map((plays || []).map((p) => [p.id, p]));
  const conflicts = [];
  for (const p of plays || []) {
    for (const depId of p?.sequencing?.dependsOn || []) {
      const d = byId.get(depId);
      if (!d) continue;
      const pStart = num(p?.sequencing?.startYear) || 1;
      const dEnd = num(d?.sequencing?.endYear) || 1;
      if (pStart < dEnd) {
        conflicts.push({
          playId: p.id, playName: p.name,
          dependsOnId: d.id, dependsOnName: d.name,
          message: `「${p.name}」須待「${d.name}」完成，但起始年（第 ${pStart} 年）早於其結束年（第 ${dEnd} 年）。`,
        });
      }
    }
  }
  return conflicts;
}

// 分年彙總表（BCG 原表結構）：各方案 收入/成本/利潤/資本支出 ＋ 綜效兩列 ＋ 總計
export function yearlyTotals(plays, synergies, { years = 3, taxRate = 0.2 } = {}) {
  const zeros = () => Array.from({ length: years }, () => 0);
  const rows = (plays || []).map((p) => {
    const fin = p?.bizplan?.fin;
    const pnl = fin ? derivePnl(fin, { taxRate }) : null;
    const pick = (arr) => Array.from({ length: years }, (_, i) => num(arr?.[i]));
    return {
      playId: p.id,
      playName: p.name || '未命名方案',
      revenue: pick(fin?.pnl?.revenue),
      cost: Array.from({ length: years }, (_, i) => num(fin?.pnl?.cogs?.[i]) + num(fin?.pnl?.opex?.[i])),
      profit: pick(pnl?.ebit),
      capex: pick(fin?.capex),
    };
  });
  const synergyRevenue = Array.from({ length: years }, (_, i) => num(synergies?.revenue?.[i]));
  const synergyCost = Array.from({ length: years }, (_, i) => num(synergies?.cost?.[i]));
  const totals = { revenue: zeros(), cost: zeros(), profit: zeros(), capex: zeros() };
  for (let i = 0; i < years; i++) {
    for (const r of rows) {
      totals.revenue[i] += r.revenue[i];
      totals.cost[i] += r.cost[i];
      totals.profit[i] += r.profit[i];
      totals.capex[i] += r.capex[i];
    }
    totals.revenue[i] += synergyRevenue[i];
    // 成本綜效＝省下的成本 → 降總成本、增總利潤
    totals.cost[i] -= synergyCost[i];
    totals.profit[i] += synergyRevenue[i] + synergyCost[i];
  }
  return { rows, synergyRevenue, synergyCost, totals };
}

// 三項硬檢查（P-11 右側面板；CHK-4 直接取用）
export function hardChecks({ plays, synergies, momentum = 0, aspiration = 0, years = 3, taxRate = 0.2, availableCapital = null }) {
  const cycles = detectCycles(plays);
  const conflicts = orderConflicts(plays);
  const dependency = {
    key: 'dependency',
    label: '相依性與順序',
    pass: cycles.length === 0 && conflicts.length === 0,
    reasons: [
      ...cycles.map((c) => `相依關係成環：${c.join(' → ')}`),
      ...conflicts.map((c) => c.message),
    ],
  };

  const rollup = computeRollup({ momentum, aspiration, plays, synergies, yearIndex: years - 1, metric: 'revenue', taxRate });
  const attainment = {
    key: 'attainment',
    label: `第 ${years} 年總收入達加速增長目標`,
    pass: rollup.attainmentPct != null && rollup.attainmentPct >= 100,
    reasons: rollup.attainmentPct == null
      ? ['尚未取得第二堂加速增長目標（Aspiration）。']
      : rollup.attainmentPct >= 100 ? [] : [`疊加效益 ${rollup.total} 未達目標 ${rollup.aspiration}（達成率 ${rollup.attainmentPct}%）。`],
  };

  const { totals } = yearlyTotals(plays, synergies, { years, taxRate });
  const capexReasons = [];
  let capexPass = true;
  if (availableCapital == null || availableCapital === '') {
    capexPass = false;
    capexReasons.push('設定頁尚未填「可用資金上限」，無法判定現金流是否撐得住資本支出。');
  } else {
    for (let i = 0; i < years; i++) {
      if (totals.capex[i] > num(availableCapital)) {
        capexPass = false;
        capexReasons.push(`第 ${i + 1} 年總資本支出 ${totals.capex[i]} 超過可用資金上限 ${num(availableCapital)}。`);
      }
    }
  }
  const cashflow = { key: 'cashflow', label: '現金流足以支撐 CAPEX', pass: capexPass, reasons: capexReasons };

  return { dependency, attainment, cashflow, allPass: dependency.pass && attainment.pass && cashflow.pass };
}
