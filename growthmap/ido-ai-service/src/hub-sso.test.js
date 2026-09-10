import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, generateKeyPairSync, createVerify } from 'node:crypto';
import { Hono } from 'hono';
import {
  HUB_ISSUER, HUB_AUDIENCE, FIREBASE_CUSTOM_TOKEN_AUD,
  HubTokenError, verifyHubToken, buildFirebaseCustomToken, createSsoExchangeHandler,
} from './hub-sso.js';
import { AdminUpstreamError } from './admin-accounts.js';

const SECRET = 'hub-shared-secret';
const b64url = (s) => Buffer.from(s).toString('base64url');
const decodeSeg = (seg) => JSON.parse(Buffer.from(seg, 'base64url').toString('utf8'));
const silentLog = { warn: () => {}, error: () => {} };

// 測試用：產 hub 簽的 HS256 token；alg 可覆寫成非 HS256（signature 仍用 HMAC 算，
// 用來測試「header 宣稱別的 alg 但實際用 HMAC 簽」也要被拒絕）；sigOverride 可整段換成錯簽章。
function signHubToken({
  secret = SECRET,
  email = '  User@Example.com  ',
  aud = HUB_AUDIENCE,
  iss = HUB_ISSUER,
  iat,
  exp,
  alg = 'HS256',
  sub = 'hub-user-1',
  name = '測試使用者',
  role = 'member',
  sigOverride,
} = {}) {
  const now = Math.floor(Date.now() / 1000);
  const iatVal = iat ?? now;
  const expVal = exp ?? iatVal + 60;
  const header = b64url(JSON.stringify({ alg }));
  const payload = b64url(JSON.stringify({ iss, aud, sub, email, name, role, iat: iatVal, exp: expVal }));
  const sig = sigOverride ?? createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${sig}`;
}

test('verifyHubToken：正路——email 轉小寫去空白，回傳 sub/name/role', () => {
  const token = signHubToken();
  const claims = verifyHubToken(token, { secret: SECRET });
  assert.equal(claims.email, 'user@example.com');
  assert.equal(claims.sub, 'hub-user-1');
  assert.equal(claims.name, '測試使用者');
  assert.equal(claims.role, 'member');
});

test('verifyHubToken：錯密鑰拒絕', () => {
  const token = signHubToken();
  assert.throws(() => verifyHubToken(token, { secret: 'wrong-secret' }), HubTokenError);
});

test('verifyHubToken：alg=none 拒絕', () => {
  const token = signHubToken({ alg: 'none' });
  assert.throws(() => verifyHubToken(token, { secret: SECRET }), HubTokenError);
});

test('verifyHubToken：header 標 RS256 但實際用 HMAC 簽也拒絕（防 alg confusion）', () => {
  const token = signHubToken({ alg: 'RS256' });
  assert.throws(() => verifyHubToken(token, { secret: SECRET }), HubTokenError);
});

test('verifyHubToken：iss 不符拒絕', () => {
  const token = signHubToken({ iss: 'not-wiwi-hub' });
  assert.throws(() => verifyHubToken(token, { secret: SECRET }), HubTokenError);
});

test('verifyHubToken：aud 不符拒絕', () => {
  const token = signHubToken({ aud: 'someone-else' });
  assert.throws(() => verifyHubToken(token, { secret: SECRET }), HubTokenError);
});

test('verifyHubToken：aud 為陣列且包含正確值可通過', () => {
  const token = signHubToken({ aud: ['other-app', HUB_AUDIENCE] });
  const claims = verifyHubToken(token, { secret: SECRET });
  assert.equal(claims.email, 'user@example.com');
});

test('verifyHubToken：過期超過容忍拒絕，容忍範圍內（含邊界）通過', () => {
  const iat = 1_700_000_000;
  const exp = iat + 60;
  const token = signHubToken({ iat, exp });
  assert.throws(() => verifyHubToken(token, { secret: SECRET, nowSec: exp + 31 }), HubTokenError, '過期 31 秒，超過容忍');
  const claims = verifyHubToken(token, { secret: SECRET, nowSec: exp + 30 });
  assert.equal(claims.email, 'user@example.com', '過期剛好 30 秒＝容忍邊界，應通過');
});

test('verifyHubToken：iat 未來時間超過容忍拒絕', () => {
  const now = 1_700_000_000;
  const token = signHubToken({ iat: now + 100, exp: now + 160 });
  assert.throws(() => verifyHubToken(token, { secret: SECRET, nowSec: now }), HubTokenError);
});

test('verifyHubToken：缺 email 拒絕', () => {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'HS256' }));
  const payload = b64url(JSON.stringify({ iss: HUB_ISSUER, aud: HUB_AUDIENCE, iat: now, exp: now + 60 }));
  const sig = createHmac('sha256', SECRET).update(`${header}.${payload}`).digest('base64url');
  assert.throws(() => verifyHubToken(`${header}.${payload}.${sig}`, { secret: SECRET }), HubTokenError);
});

test('verifyHubToken：格式壞——非字串、非 3 段、非 base64url、非 JSON 皆拒絕', () => {
  assert.throws(() => verifyHubToken(undefined, { secret: SECRET }), HubTokenError, '非字串');
  assert.throws(() => verifyHubToken(123, { secret: SECRET }), HubTokenError, '非字串');
  assert.throws(() => verifyHubToken('', { secret: SECRET }), HubTokenError, '空字串');
  assert.throws(() => verifyHubToken('a.b', { secret: SECRET }), HubTokenError, '只有 2 段');
  assert.throws(() => verifyHubToken('a.b.c.d', { secret: SECRET }), HubTokenError, '4 段');
  assert.throws(() => verifyHubToken('a b.c d.e f', { secret: SECRET }), HubTokenError, '含非 base64url 字元（空白）');
  assert.throws(
    () => verifyHubToken(`${b64url('not json')}.${b64url('not json')}.${b64url('sig')}`, { secret: SECRET }),
    HubTokenError,
    'header 非 JSON'
  );
});

const { privateKey: saPrivateKey, publicKey: saPublicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
const FAKE_SA = { clientEmail: 'svc@demo-proj.iam.gserviceaccount.com', privateKey: saPrivateKey };

test('buildFirebaseCustomToken：RS256 簽章可用公鑰驗證，payload 符合 Firebase custom token 規格', () => {
  const nowSec = 1_700_000_000;
  const token = buildFirebaseCustomToken(FAKE_SA, { uid: 'uid-123', nowSec });
  const [h, p, s] = token.split('.');
  assert.deepEqual(decodeSeg(h), { alg: 'RS256', typ: 'JWT' });
  const claims = decodeSeg(p);
  assert.equal(claims.iss, FAKE_SA.clientEmail);
  assert.equal(claims.sub, FAKE_SA.clientEmail);
  assert.equal(claims.aud, FIREBASE_CUSTOM_TOKEN_AUD);
  assert.equal(claims.uid, 'uid-123');
  assert.equal(claims.iat, nowSec);
  assert.equal(claims.exp - claims.iat, 300);
  const v = createVerify('RSA-SHA256');
  v.update(`${h}.${p}`);
  v.end();
  assert.ok(v.verify(saPublicKey, Buffer.from(s, 'base64url')));
});

test('buildFirebaseCustomToken：ttlSec 超過 3600 或 uid 空字串要 throw', () => {
  assert.throws(() => buildFirebaseCustomToken(FAKE_SA, { uid: 'uid-123', ttlSec: 3601 }));
  assert.throws(() => buildFirebaseCustomToken(FAKE_SA, { uid: '' }));
});

// ── handler（createSsoExchangeHandler）─────────────────────────────────────────
function mount(opts) {
  const app = new Hono();
  app.post('/api/auth/sso/exchange', createSsoExchangeHandler(opts));
  return app;
}
function makeFakeAdminClient(accounts = {}) {
  const calls = [];
  return {
    calls,
    async lookupByEmail(email) {
      calls.push(email);
      return accounts[email] || null;
    },
  };
}
async function postExchange(app, jsonBody) {
  const init = { method: 'POST' };
  if (jsonBody !== undefined) {
    init.headers = { 'content-type': 'application/json' };
    init.body = JSON.stringify(jsonBody);
  }
  return app.request('/api/auth/sso/exchange', init);
}

const EXPECTED_401_BODY = { error: { code: 'IDO_SSO_TOKEN_INVALID', message: 'SSO 憑證無效或已過期' } };

test('handler：未設密鑰 → 404 IDO_SSO_NOT_CONFIGURED', async () => {
  const app = mount({ getSecret: () => '', getAdminClient: () => null, serviceAccount: null, log: silentLog });
  const res = await postExchange(app, { sso_token: 'x' });
  assert.equal(res.status, 404);
  assert.equal((await res.json()).error.code, 'IDO_SSO_NOT_CONFIGURED');
});

test('handler：有密鑰但無 adminClient → 404 IDO_SSO_NOT_CONFIGURED', async () => {
  const app = mount({ getSecret: () => SECRET, getAdminClient: () => null, serviceAccount: FAKE_SA, log: silentLog });
  const res = await postExchange(app, { sso_token: 'x' });
  assert.equal(res.status, 404);
  assert.equal((await res.json()).error.code, 'IDO_SSO_NOT_CONFIGURED');
});

test('handler：無 body 或缺 sso_token → 400 IDO_VALIDATION', async () => {
  const opts = { getSecret: () => SECRET, getAdminClient: () => makeFakeAdminClient(), serviceAccount: FAKE_SA, log: silentLog };
  const res1 = await postExchange(mount(opts)); // 無 body
  assert.equal(res1.status, 400);
  assert.equal((await res1.json()).error.code, 'IDO_VALIDATION');

  const res2 = await postExchange(mount(opts), {}); // 缺 sso_token
  assert.equal(res2.status, 400);
  assert.equal((await res2.json()).error.code, 'IDO_VALIDATION');
});

test('handler：sso_token 簽章錯誤 → 401（與查無帳號逐字相同的 body）', async () => {
  const opts = { getSecret: () => SECRET, getAdminClient: () => makeFakeAdminClient(), serviceAccount: FAKE_SA, log: silentLog };
  const badToken = signHubToken({ secret: 'wrong-secret' });
  const res = await postExchange(mount(opts), { sso_token: badToken });
  assert.equal(res.status, 401);
  assert.deepEqual(await res.json(), EXPECTED_401_BODY);
});

test('handler：查無帳號 → 401，回應 body 與錯簽章那個逐字相同（不洩漏帳號存在性）', async () => {
  const adminClient = makeFakeAdminClient({}); // 空名單，任何 email 都查無帳號
  const opts = { getSecret: () => SECRET, getAdminClient: () => adminClient, serviceAccount: FAKE_SA, log: silentLog };
  const token = signHubToken({ email: 'nobody@example.com' });
  const res = await postExchange(mount(opts), { sso_token: token });
  assert.equal(res.status, 401);
  assert.deepEqual(await res.json(), EXPECTED_401_BODY);
  assert.equal(adminClient.calls.at(-1), 'nobody@example.com');
});

test('handler：帳號 disabled:true → 401，body 與同一組逐字相同', async () => {
  const adminClient = makeFakeAdminClient({ 'user@example.com': { uid: 'uid-disabled', disabled: true } });
  const opts = { getSecret: () => SECRET, getAdminClient: () => adminClient, serviceAccount: FAKE_SA, log: silentLog };
  const token = signHubToken({ email: 'user@example.com' });
  const res = await postExchange(mount(opts), { sso_token: token });
  assert.equal(res.status, 401);
  assert.deepEqual(await res.json(), EXPECTED_401_BODY);
});

test('handler：正路 → 200，customToken 解出 uid、expiresIn=300，email 已正規化傳給 adminClient', async () => {
  const adminClient = makeFakeAdminClient({ 'user@example.com': { uid: 'hub-account-uid-1', disabled: false } });
  const opts = { getSecret: () => SECRET, getAdminClient: () => adminClient, serviceAccount: FAKE_SA, log: silentLog };
  const token = signHubToken(); // 預設 email 帶大小寫與前後空白
  const res = await postExchange(mount(opts), { sso_token: token });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.expiresIn, 300);
  const [, p] = json.customToken.split('.');
  assert.equal(decodeSeg(p).uid, 'hub-account-uid-1');
  assert.equal(adminClient.calls.at(-1), 'user@example.com', 'adminClient 收到的 email 應已 trim + toLowerCase');
});

test('handler：lookupByEmail 丟出 AdminUpstreamError → 502 IDO_ADMIN_UPSTREAM', async () => {
  const adminClient = {
    calls: [],
    async lookupByEmail(email) {
      this.calls.push(email);
      throw new AdminUpstreamError('上游炸了', 500, 'INTERNAL');
    },
  };
  const opts = { getSecret: () => SECRET, getAdminClient: () => adminClient, serviceAccount: FAKE_SA, log: silentLog };
  const token = signHubToken();
  const res = await postExchange(mount(opts), { sso_token: token });
  assert.equal(res.status, 502);
  assert.equal((await res.json()).error.code, 'IDO_ADMIN_UPSTREAM');
});
