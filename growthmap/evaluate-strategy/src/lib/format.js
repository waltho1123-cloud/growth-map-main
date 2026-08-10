// 顯示格式共用（純函式）

export function fmtAmount(v, { dash = '—' } = {}) {
  const n = Number(v);
  if (!Number.isFinite(n)) return dash;
  return n.toLocaleString('zh-TW', { maximumFractionDigits: 1 });
}

export function fmtPct(v, { dash = '—' } = {}) {
  const n = Number(v);
  if (!Number.isFinite(n)) return dash;
  return `${Math.round(n * 10) / 10}%`;
}

export function fmtTime(ms) {
  if (!ms) return '—';
  const d = new Date(ms);
  const pad = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const CN_YEAR = ['一', '二', '三', '四', '五'];
export function yearLabel(i) {
  return `第${CN_YEAR[i] || i + 1}年`;
}

export function yearLabels(years) {
  return Array.from({ length: years }, (_, i) => yearLabel(i));
}
