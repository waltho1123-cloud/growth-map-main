// 後端的 Firebase 特權層（做法 A，2026-09-08）：以服務帳號金鑰換 Google OAuth access token，
// 供 Identity Toolkit（Firebase Auth 管理 API）使用。刻意不引入 firebase-admin——
// 與 firebase-auth.js 同一裁定：Node 內建 crypto 簽 RS256 JWT（jwt-bearer 授權流程）。
//
// 金鑰來源：環境變數 FIREBASE_SERVICE_ACCOUNT_JSON（Firebase Console → 專案設定 → 服務帳號 →
// 產生新的私密金鑰；整份 JSON 單行貼入，也接受 base64）。只存在 Zeabur 環境變數，
// 不進 git、不進對話。未設定＝管理端點回 503，AI 等其餘功能不受影響。
import { createSign } from 'node:crypto';

export const TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const ADMIN_SCOPES = [
  'https://www.googleapis.com/auth/identitytoolkit',
  'https://www.googleapis.com/auth/cloud-platform',
].join(' ');

export function parseServiceAccount(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let text = raw.trim();
  if (!text.startsWith('{')) {
    try {
      text = Buffer.from(text, 'base64').toString('utf8').trim();
    } catch {
      return null;
    }
  }
  let obj;
  try {
    obj = JSON.parse(text);
  } catch {
    return null;
  }
  const clientEmail = typeof obj?.client_email === 'string' ? obj.client_email : '';
  const privateKey = typeof obj?.private_key === 'string' ? obj.private_key.replace(/\\n/g, '\n') : '';
  if (!clientEmail || !privateKey.includes('PRIVATE KEY')) return null;
  return { clientEmail, privateKey, projectId: typeof obj.project_id === 'string' ? obj.project_id : '' };
}

const b64url = (s) => Buffer.from(s).toString('base64url');

// jwt-bearer 授權用的 assertion：iss=服務帳號、scope、aud=token 端點、iat/exp（≤1 小時）
export function buildJwtAssertion(
  { clientEmail, privateKey },
  { scope = ADMIN_SCOPES, nowSec = Math.floor(Date.now() / 1000), aud = TOKEN_URL, ttlSec = 3600 } = {}
) {
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({ iss: clientEmail, scope, aud, iat: nowSec, exp: nowSec + ttlSec }));
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claims}`);
  signer.end();
  const sig = signer.sign(privateKey).toString('base64url');
  return `${header}.${claims}.${sig}`;
}

// access token 供應者：到期前 60 秒內重換；並發呼叫共用同一個 in-flight Promise。
export function createAdminTokenProvider(sa, { fetchImpl = fetch, now = Date.now } = {}) {
  let cached = { token: null, expiresAt: 0 };
  let inflight = null;

  async function refresh() {
    const assertion = buildJwtAssertion(sa, { nowSec: Math.floor(now() / 1000) });
    const res = await fetchImpl(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.access_token) {
      throw new Error(`服務帳號換 token 失敗（HTTP ${res.status}）：${json.error_description || json.error || '未知'}`);
    }
    cached = { token: json.access_token, expiresAt: now() + (Number(json.expires_in) || 3600) * 1000 };
    return cached.token;
  }

  return {
    async getAccessToken() {
      if (cached.token && now() < cached.expiresAt - 60_000) return cached.token;
      if (!inflight) inflight = refresh().finally(() => { inflight = null; });
      return inflight;
    },
  };
}
