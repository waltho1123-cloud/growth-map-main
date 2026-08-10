// 疊加效益（PRD MOD-08 / P-10）：自然增長 → 各策略方案 → 綜效 → 疊加效益，
// 對比加速增長目標。數字唯一來源是各方案 P-09 財務表與專案綜效欄，本模組只計算。

import { derivePnl } from './finance';

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

// metric：'revenue'（營收）或 'profit'（EBIT）；yearIndex：0-based（預設 Y3）
export function computeRollup({
  momentum = 0,
  aspiration = 0,
  plays = [],
  synergies = null,
  yearIndex = 2,
  metric = 'revenue',
  taxRate = 0.2,
} = {}) {
  const playBars = (plays || []).map((p) => {
    const fin = p?.bizplan?.fin;
    let value = 0;
    if (fin) {
      value = metric === 'profit'
        ? num(derivePnl(fin, { taxRate }).ebit?.[yearIndex])
        : num(fin?.pnl?.revenue?.[yearIndex]);
    }
    return { id: p.id, name: p.name || '未命名方案', value };
  });
  // 綜效：營收口徑只計收入綜效；利潤口徑＝收入綜效−成本綜效變動…
  // 方法論的成本綜效是「省下的成本」，對利潤為正貢獻，對營收無貢獻。
  const synergyRevenue = num(synergies?.revenue?.[yearIndex]);
  const synergyCost = num(synergies?.cost?.[yearIndex]);
  const synergyValue = metric === 'profit' ? synergyRevenue + synergyCost : synergyRevenue;

  const playsTotal = playBars.reduce((s, b) => s + b.value, 0);
  const total = num(momentum) + playsTotal + synergyValue;
  const attainmentPct = aspiration > 0 ? Math.round((total / aspiration) * 1000) / 10 : null;
  const gapAmount = num(aspiration) - total;

  // 判定（P-10 區 2）：≥100 綠、<100 紅（回頭路徑）、>120 另加超標黃提示（目標可能訂太低）
  let status = 'unknown';
  if (attainmentPct != null) status = attainmentPct >= 100 ? 'ok' : 'below';
  const overshoot = attainmentPct != null && attainmentPct > 120;

  return {
    metric,
    yearIndex,
    momentum: num(momentum),
    aspiration: num(aspiration),
    playBars,
    synergyValue,
    synergyRevenue,
    synergyCost,
    total,
    attainmentPct,
    gapAmount,
    status,
    overshoot,
  };
}

// Waterfall 圖用的分段（起始柱＋增量柱＋總計柱）
export function waterfallSegments(rollup) {
  const segments = [];
  let cursor = 0;
  segments.push({ kind: 'base', label: '自然增長', from: 0, to: rollup.momentum, value: rollup.momentum });
  cursor = rollup.momentum;
  for (const bar of rollup.playBars) {
    segments.push({ kind: 'play', label: bar.name, from: cursor, to: cursor + bar.value, value: bar.value, id: bar.id });
    cursor += bar.value;
  }
  segments.push({ kind: 'synergy', label: '綜效', from: cursor, to: cursor + rollup.synergyValue, value: rollup.synergyValue });
  cursor += rollup.synergyValue;
  segments.push({ kind: 'total', label: '疊加效益', from: 0, to: cursor, value: cursor });
  return segments;
}

// 未達標時的三條回頭路徑（P-10 區 4；fallback 決策記錄在專案文件）
export const FALLBACK_PATHS = Object.freeze([
  Object.freeze({ key: 'longlist', label: '從長清單補機會', detail: '回矩陣，篩出「大膽投注／可選」象限中尚未納入者。' }),
  Object.freeze({ key: 'unit3', label: '回第三堂再發想', detail: '回識別機會單元擴充長清單（不直接修改其資料）。' }),
  Object.freeze({ key: 'unit2', label: '重檢第二堂加速增長目標', detail: '目標複檢需事業單位負責人簽核，回第二堂調整。' }),
]);
