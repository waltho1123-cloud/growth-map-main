// 平台管理員判定的唯一正本是 firestore.rules 的 isPlatformAdmin()
//（root 常數＋platform/meta.adminEmails＋email_verified）。後端不複製名單：
// 用「呼叫者自己的 ID token 能不能讀 platform/meta」探測——200 或 404（文件不存在但規則放行）
// ＝管理員；403／401＝不是；其他＝暫時失敗（不快取，回 502 讓呼叫端重試）。每個 uid 快取 60 秒。
const cache = new Map(); // uid → { verdict, at }
const TTL_MS = 60_000;

export async function checkPlatformAdmin({ uid, idToken }, projectId, fetchImpl = fetch, now = Date.now) {
  if (!uid || !idToken || !projectId) return 'denied';
  const hit = cache.get(uid);
  if (hit && now() - hit.at < TTL_MS) return hit.verdict;
  let verdict = 'error';
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetchImpl(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/platform/meta`,
      { headers: { Authorization: `Bearer ${idToken}` }, signal: ctrl.signal }
    );
    if (res.status === 200 || res.status === 404) verdict = 'admin';
    else if (res.status === 403 || res.status === 401) verdict = 'denied';
  } catch {
    verdict = 'error';
  } finally {
    clearTimeout(timer);
  }
  if (verdict !== 'error') cache.set(uid, { verdict, at: now() });
  return verdict;
}

export function resetAdminCache() {
  cache.clear();
}
