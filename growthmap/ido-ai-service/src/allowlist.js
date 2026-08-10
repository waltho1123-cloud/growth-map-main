// AI 端點 email 白名單（堵「任何有效 Firebase 登入都能燒 Anthropic 額度」的成本洞）。
// 兩個來源「聯集」生效：
// 1. 環境變數 ALLOWED_EMAILS／ALLOWED_EMAIL_DOMAINS——保底名單（改動需重啟）。
// 2. Firestore `platform/aiAllowlist` 文件——管理頁（pages/admin.html）即時編輯，
//    後端以「呼叫者自己的 ID token」走 Firestore REST 讀取（不引入 firebase-admin，
//    維持既有裁定），60 秒記憶體快取；讀取失敗沿用舊快取（無快取＝僅環境變數生效）。
// 語意：
// - 聯集為空 → 不啟用（維持只驗 token；啟動時 console.warn 提醒——fail-open
//   是部署順序安全的刻意選擇）。建議環境變數至少保留管理員 email 當保底，
//   避免管理頁誤清空名單後整個限制失效。
// - 聯集非空 → 強制：email 精確符合（不分大小寫）或網域符合才放行，否則 403。

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

export function mergeAllowlists(a, b) {
  return {
    emails: [...new Set([...(a?.emails || []), ...(b?.emails || [])])],
    domains: [...new Set([...(a?.domains || []), ...(b?.domains || [])])],
  };
}

// Firestore REST 文件（typed value 格式）→ 名單。缺欄位/型別錯一律回空清單。
export function parseFirestoreAllowlistDoc(json) {
  const arr = (f) => (f?.arrayValue?.values || [])
    .map((v) => String(v?.stringValue || '').trim().toLowerCase())
    .filter(Boolean);
  const fields = json?.fields || {};
  return {
    emails: arr(fields.emails),
    domains: arr(fields.domains).map((d) => d.replace(/^@/, '')),
  };
}

// 遠端名單快取（全域文件，跨使用者共用；TTL 內不重打）
const remoteCache = { data: null, at: 0 };
const REMOTE_TTL_MS = 60_000;

export async function getRemoteAllowlist(idToken, projectId, fetchImpl = fetch) {
  const now = Date.now();
  if (remoteCache.data && now - remoteCache.at < REMOTE_TTL_MS) return remoteCache.data;
  if (!projectId) return remoteCache.data || { emails: [], domains: [] };
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3000);
    const res = await fetchImpl(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/platform/aiAllowlist`,
      { headers: { Authorization: `Bearer ${idToken}` }, signal: ctrl.signal }
    );
    clearTimeout(timer);
    if (res.status === 404) {
      remoteCache.data = { emails: [], domains: [] }; // 文件尚未建立＝遠端名單為空
      remoteCache.at = now;
      return remoteCache.data;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    remoteCache.data = parseFirestoreAllowlistDoc(await res.json());
    remoteCache.at = now;
    return remoteCache.data;
  } catch (e) {
    console.warn('[allowlist] 遠端名單讀取失敗，沿用快取/環境變數：', e?.message || e);
    return remoteCache.data || { emails: [], domains: [] };
  }
}
