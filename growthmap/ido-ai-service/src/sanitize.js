// 送 LLM 前去識別化（GD-07）：移除明顯 PII。營收等量化資料保留（已是統計性質），
// 但客戶 email/電話/身分證等個資遮蔽。使用者輸入視為不可信資料。
const PATTERNS = [
  [/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]'],
  [/\b09\d{2}[-\s]?\d{3}[-\s]?\d{3}\b/g, '[phone]'],
  [/\b[A-Z][12]\d{8}\b/g, '[id]'],
];

export function sanitizeText(s) {
  if (typeof s !== 'string') return s;
  let out = s;
  for (const [re, rep] of PATTERNS) out = out.replace(re, rep);
  return out;
}

export function sanitizeObject(obj) {
  try {
    return JSON.parse(JSON.stringify(obj), (k, v) => (typeof v === 'string' ? sanitizeText(v) : v));
  } catch {
    return obj;
  }
}
