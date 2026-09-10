// Wiwi Hub SSO 交換端點（2026-09-10）：公司中控 wiwi-hub 把使用者 302 到本平台 callback 頁，
// 帶 ?sso_token=<HS256 JWT>；callback 頁 POST 給本端點交換。流程：驗 hub 簽章（HMAC-SHA256，
// 固定 iss/aud，60 秒短命，±30 秒容忍時鐘飄移）→ 以 email 查既有 Firebase 帳號（無 JIT、
// 不建帳號）→ 用既有服務帳號簽 Firebase custom token 回前端，前端再 signInWithCustomToken。
//
// 政策：未設定 HUB_JWT_SECRET 或服務帳號＝端點視同不存在（404）；所有憑證／帳號問題
// （token 驗證失敗、查無帳號、帳號停用）統一回同一個 401、同一錯誤碼與訊息，不洩漏帳號
// 存在性。刻意不用第三方 JWT 套件——與 firebase-auth.js／service-account.js 同一裁定，
// Node 內建 crypto 自簽、自驗（HMAC 驗 hub token、RS256 簽 Firebase custom token）。
import { createHmac, createSign, timingSafeEqual } from 'node:crypto';

export const HUB_ISSUER = 'wiwi-hub';
export const HUB_AUDIENCE = 'growth-map-main';
export const FIREBASE_CUSTOM_TOKEN_AUD =
  'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit';

// hub token 驗證失敗的原因（reason）只用於伺服器端 log，絕不回給 client——
// 回應一律是固定的 IDO_SSO_TOKEN_INVALID／'SSO 憑證無效或已過期'，避免洩漏細節。
export class HubTokenError extends Error {
  constructor(reason) {
    super(reason);
    this.name = 'HubTokenError';
  }
}

const b64url = (s) => Buffer.from(s).toString('base64url');
const isBase64UrlSegment = (s) => /^[A-Za-z0-9_-]+$/.test(s);

// 驗 wiwi-hub 簽發的 SSO token：HS256、固定 iss/aud、短命（payload 帶 exp）。
// alg 只認 'HS256'——'none'／'RS256'／其他一律拒，防 alg confusion 攻擊
// （攻擊者若能讓驗證端誤用其他演算法或不驗簽章，就能偽造任意 token）。
export function verifyHubToken(
  token,
  { secret, audience = HUB_AUDIENCE, issuer = HUB_ISSUER, nowSec, clockToleranceSec = 30 } = {}
) {
  if (typeof token !== 'string' || token.length === 0) throw new HubTokenError('token 不是非空字串');
  const parts = token.split('.');
  if (parts.length !== 3 || parts.some((p) => p.length === 0)) {
    throw new HubTokenError('token 格式錯誤（非 3 段非空）');
  }
  const [h, p, s] = parts;
  if (!isBase64UrlSegment(h) || !isBase64UrlSegment(p) || !isBase64UrlSegment(s)) {
    throw new HubTokenError('token 格式錯誤（非 base64url）');
  }

  let header;
  try {
    header = JSON.parse(Buffer.from(h, 'base64url').toString('utf8'));
  } catch {
    throw new HubTokenError('header 解析失敗（非 JSON）');
  }
  if (!header || typeof header !== 'object' || header.alg !== 'HS256') {
    throw new HubTokenError(`alg 不允許：${header?.alg}`);
  }

  // 簽章：對 header.payload 算 HMAC-SHA256 digest，與 token 附帶的簽章先比長度、
  // 長度相同才進 timingSafeEqual（避免長度不一致直接丟例外，也避免時序側漏）。
  const expectedSig = createHmac('sha256', secret).update(`${h}.${p}`).digest();
  const providedSig = Buffer.from(s, 'base64url');
  if (providedSig.length !== expectedSig.length || !timingSafeEqual(providedSig, expectedSig)) {
    throw new HubTokenError('簽章驗證失敗');
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'));
  } catch {
    throw new HubTokenError('payload 解析失敗（非 JSON）');
  }
  if (!payload || typeof payload !== 'object') throw new HubTokenError('payload 不是物件');
  if (payload.iss !== issuer) throw new HubTokenError(`iss 不符：${payload.iss}`);
  const aud = payload.aud;
  const audOk = aud === audience || (Array.isArray(aud) && aud.includes(audience));
  if (!audOk) throw new HubTokenError(`aud 不符：${JSON.stringify(aud)}`);

  const now = typeof nowSec === 'number' ? nowSec : Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || !(now <= payload.exp + clockToleranceSec)) {
    throw new HubTokenError('token 已過期');
  }
  if (typeof payload.iat !== 'number' || !(payload.iat <= now + clockToleranceSec)) {
    throw new HubTokenError('iat 不合法（未來時間超過容忍）');
  }
  if (typeof payload.email !== 'string' || payload.email.trim().length === 0) {
    throw new HubTokenError('缺少 email');
  }

  return {
    email: payload.email.trim().toLowerCase(),
    sub: typeof payload.sub === 'string' ? payload.sub : '',
    name: typeof payload.name === 'string' ? payload.name : '',
    role: typeof payload.role === 'string' ? payload.role : '',
  };
}

// 簽 Firebase custom token（RS256，前端 signInWithCustomToken 用）：iss=sub=服務帳號 client_email，
// aud 固定為 Identity Toolkit 服務 aud；短命（預設 300 秒；Firebase 規定 custom token 效期 ≤3600 秒）。
// 簽法照抄 service-account.js 的 buildJwtAssertion（Node 內建 crypto createSign('RSA-SHA256')）。
export function buildFirebaseCustomToken({ clientEmail, privateKey }, { uid, nowSec, ttlSec = 300 } = {}) {
  if (typeof uid !== 'string' || uid.length === 0) throw new Error('uid 不可為空字串');
  if (ttlSec > 3600) throw new Error('ttlSec 不可超過 3600（Firebase custom token 上限）');
  const now = typeof nowSec === 'number' ? nowSec : Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(
    JSON.stringify({ iss: clientEmail, sub: clientEmail, aud: FIREBASE_CUSTOM_TOKEN_AUD, iat: now, exp: now + ttlSec, uid })
  );
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claims}`);
  signer.end();
  const sig = signer.sign(privateKey).toString('base64url');
  return `${header}.${claims}.${sig}`;
}

// POST /api/auth/sso/exchange 的 Hono handler。順序：
// (a) 密鑰／adminClient／服務帳號任一未設定 → 端點視同不存在（404 IDO_SSO_NOT_CONFIGURED）
// (b) body 解析、sso_token 型別與長度檢查 → 400 IDO_VALIDATION
// (c) verifyHubToken 失敗 → log.warn，401 IDO_SSO_TOKEN_INVALID
// (d) 查無帳號或帳號停用 → log.warn（註明 no-account／disabled 與 email），
//     回應與 (c) 逐字相同的 401（不洩漏帳號是否存在／是否停用）
// (e) 簽 Firebase custom token 成功 → 200 { customToken, expiresIn }
// (f) (d)(e) 過程中其他例外（含 AdminUpstreamError）→ log.error，502 IDO_ADMIN_UPSTREAM
export function createSsoExchangeHandler({ getSecret, getAdminClient, serviceAccount, now = Date.now, log = console }) {
  return async (c) => {
    const secret = getSecret();
    const adminClient = getAdminClient();
    if (!secret || !adminClient || !serviceAccount) {
      return c.json({ error: { code: 'IDO_SSO_NOT_CONFIGURED', message: '找不到資源' } }, 404);
    }

    const body = await c.req.json().catch(() => null);
    const ssoToken = body?.sso_token;
    if (typeof ssoToken !== 'string' || ssoToken.length === 0 || ssoToken.length > 4096) {
      return c.json({ error: { code: 'IDO_VALIDATION', message: '缺少 sso_token' } }, 400);
    }

    let claims;
    try {
      claims = verifyHubToken(ssoToken, { secret, nowSec: Math.floor(now() / 1000) });
    } catch (e) {
      log.warn('[sso] hub token 拒絕：', e?.message || e);
      return c.json({ error: { code: 'IDO_SSO_TOKEN_INVALID', message: 'SSO 憑證無效或已過期' } }, 401);
    }

    try {
      const account = await adminClient.lookupByEmail(claims.email);
      if (!account || account.disabled === true) {
        log.warn(`[sso] 帳號無法登入（${!account ? 'no-account' : 'disabled'}）：`, claims.email);
        return c.json({ error: { code: 'IDO_SSO_TOKEN_INVALID', message: 'SSO 憑證無效或已過期' } }, 401);
      }
      const customToken = buildFirebaseCustomToken(serviceAccount, {
        uid: account.uid,
        nowSec: Math.floor(now() / 1000),
        ttlSec: 300,
      });
      return c.json({ customToken, expiresIn: 300 });
    } catch (e) {
      log.error('[sso]', e?.message || e);
      return c.json({ error: { code: 'IDO_ADMIN_UPSTREAM', message: 'Firebase 管理 API 錯誤' } }, 502);
    }
  };
}
