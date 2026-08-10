// AI 端點 email 白名單（堵「任何有效 Firebase 登入都能燒 Anthropic 額度」的成本洞）。
// 語意：
// - ALLOWED_EMAILS／ALLOWED_EMAIL_DOMAINS 皆未設 → 不啟用（維持只驗 token；
//   啟動時 console.warn 提醒——與 CORS 的 fail-closed 不同，這裡選 fail-open
//   是為了部署順序安全：先上程式、再設環境變數即生效，不會瞬斷既有使用者）。
// - 任一有設 → 強制：email 精確符合（不分大小寫）或網域符合才放行，否則 403。

export function parseAllowlist(env = process.env) {
  const csv = (v) => String(v || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  return {
    emails: csv(env.ALLOWED_EMAILS),
    domains: csv(env.ALLOWED_EMAIL_DOMAINS).map((d) => d.replace(/^@/, '')),
  };
}

export function allowlistEnabled({ emails, domains }) {
  return emails.length > 0 || domains.length > 0;
}

export function isEmailAllowed(email, { emails, domains }) {
  if (!allowlistEnabled({ emails, domains })) return true; // 未啟用＝不限制
  const norm = String(email || '').trim().toLowerCase();
  if (!norm || !norm.includes('@')) return false; // 啟用後，token 沒有 email 一律拒絕
  if (emails.includes(norm)) return true;
  const domain = norm.slice(norm.lastIndexOf('@') + 1);
  return domains.includes(domain);
}
