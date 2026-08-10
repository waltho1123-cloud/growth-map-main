// 工作坊領域邏輯（PRD MOD-05 / P-06）——議程範本、計時、投票彙總、會議紀錄。

// PRD P-06 內建議程範本（預設總長約 3 小時；「內部場加倍」＝所有時段 ×2）
export const AGENDA_TEMPLATES = Object.freeze({
  1: [
    { key: 'w1a1', title: '專案進度更新', minutes: 15, goal: '', needsResolution: false },
    { key: 'w1a2', title: '排序標準', minutes: 15, goal: '統一判斷依據', needsResolution: true },
    { key: 'w1a3', title: '評估機會點與策略方案', minutes: 60, goal: '完成評估', needsResolution: false },
    { key: 'w1a4', title: '優先排序', minutes: 45, goal: '取得排序共識', needsResolution: true },
    { key: 'w1a5', title: '優先排序投票（如需要）', minutes: 30, goal: '透明化優先事項', needsResolution: false },
    { key: 'w1a6', title: '下一步', minutes: 15, goal: '', needsResolution: false },
  ],
  2: [
    { key: 'w2a1', title: '專案進度更新', minutes: 15, goal: '', needsResolution: false },
    { key: 'w2a2', title: '策略方案評估', minutes: 60, goal: '對商業計畫與效益取得共識', needsResolution: true },
    { key: 'w2a3', title: '確認最終策略方案', minutes: 30, goal: '達成最終共識', needsResolution: true },
    { key: 'w2a4', title: '排定執行時序', minutes: 60, goal: '取得時序共識', needsResolution: true },
    { key: 'w2a5', title: '下一步', minutes: 15, goal: '', needsResolution: false },
  ],
});

export function createWorkshopDoc(n, { doubled = false } = {}) {
  const agenda = AGENDA_TEMPLATES[n].map((a) => ({ ...a, minutes: doubled ? a.minutes * 2 : a.minutes }));
  return {
    n,
    status: 'pending', // pending → running → ended
    agenda,
    currentIndex: 0,
    timer: { startedAt: null, durationSec: 0, pausedRemainingSec: null },
    resolutions: {}, // { [agendaKey]: [{ text, by, at }] }
    votes: {},       // { [voteKey]: { title, options: [..], status, tally: {i: n}, voters } }
    minutes: null,
    createdAt: Date.now(),
    endedAt: null,
  };
}

// 目前剩餘秒數（各端本地推算）。startedAt 接受毫秒數或 Firestore Timestamp
// （serverTimestamp 寫入——避免主持人機器時鐘偏差讓各端倒數不一致）。
export function timerRemaining(timer, nowMs = Date.now()) {
  if (!timer) return 0;
  if (timer.pausedRemainingSec != null) return Math.round(timer.pausedRemainingSec);
  const startedAt = timer.startedAt?.toMillis ? timer.startedAt.toMillis() : timer.startedAt;
  if (!startedAt) return timer.durationSec || 0;
  return Math.round((timer.durationSec || 0) - (nowMs - startedAt) / 1000);
}

// 主持人端把原始票（wsVotes 文件）彙總成 tally（參與者只看得到 tally——PD-08 半記名）
export function tallyVotes(voteDocs, voteKey, optionCount) {
  const tally = {};
  for (let i = 0; i < optionCount; i++) tally[i] = 0;
  let voters = 0;
  for (const v of voteDocs) {
    if (v.voteKey !== voteKey) continue;
    const c = Number(v.choice);
    if (Number.isFinite(c) && c >= 0 && c < optionCount) {
      tally[c] += 1;
      voters += 1;
    }
  }
  return { tally, voters };
}

// 會議結束：組會議紀錄（Markdown）
export function buildMinutes(ws, { projectName = '', opinions = [] } = {}) {
  const lines = [];
  lines.push(`# ${projectName}｜第${ws.n === 1 ? '一' : '二'}次評估策略工作坊 會議紀錄`);
  lines.push(`（產出於 ${new Date().toLocaleString('zh-TW')}）`, '');
  for (const item of ws.agenda || []) {
    lines.push(`## ${item.title}（${item.minutes} 分鐘${item.goal ? `｜目標：${item.goal}` : ''}）`);
    const res = ws.resolutions?.[item.key] || [];
    if (res.length) {
      lines.push('決議：');
      res.forEach((r, i) => lines.push(`${i + 1}. ${r.text}（${r.by || ''}）`));
    } else {
      lines.push(item.needsResolution ? '決議：（未記錄）' : '—');
    }
    lines.push('');
  }
  const votes = Object.entries(ws.votes || {});
  if (votes.length) {
    lines.push('## 投票結果');
    for (const [, v] of votes) {
      lines.push(`- ${v.title}（${v.voters || 0} 票）`);
      (v.options || []).forEach((opt, i) => lines.push(`  - ${opt}：${v.tally?.[i] ?? 0} 票`));
    }
    lines.push('');
  }
  if (opinions.length) {
    lines.push('## 意見板（依按讚數）');
    opinions.forEach((o) => lines.push(`- (+${Object.keys(o.likes || {}).length}) ${o.text}`));
  }
  return lines.join('\n');
}

// 結束前檢核：需共識的議程段落至少 1 條決議（P-06 驗證與防呆）
export function missingResolutions(ws) {
  return (ws.agenda || [])
    .filter((a) => a.needsResolution && !(ws.resolutions?.[a.key] || []).length)
    .map((a) => a.title);
}
