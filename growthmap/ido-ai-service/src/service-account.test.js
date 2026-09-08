import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, createVerify } from 'node:crypto';
import {
  parseServiceAccount, buildJwtAssertion, createAdminTokenProvider, ADMIN_SCOPES, TOKEN_URL,
} from './service-account.js';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
const sa = { client_email: 'svc@demo-proj.iam.gserviceaccount.com', private_key: privateKey, project_id: 'demo-proj' };
const decode = (seg) => JSON.parse(Buffer.from(seg, 'base64url').toString('utf8'));

test('parseServiceAccount：接受 JSON、雙重跳脫的 \\n、base64；壞輸入回 null', () => {
  const plain = parseServiceAccount(JSON.stringify(sa));
  assert.equal(plain.clientEmail, sa.client_email);
  assert.equal(plain.projectId, 'demo-proj');
  assert.ok(plain.privateKey.includes('\n'));

  const doubled = parseServiceAccount(JSON.stringify({ ...sa, private_key: privateKey.replace(/\n/g, '\\n') }));
  assert.equal(doubled.privateKey, plain.privateKey, '字面 \\n 要還原成換行');

  const b64 = parseServiceAccount(Buffer.from(JSON.stringify(sa)).toString('base64'));
  assert.equal(b64.clientEmail, sa.client_email);

  assert.equal(parseServiceAccount(''), null);
  assert.equal(parseServiceAccount('not json'), null);
  assert.equal(parseServiceAccount(JSON.stringify({ client_email: 'x' })), null, '缺 private_key');
  assert.equal(parseServiceAccount(JSON.stringify({ ...sa, private_key: 'nope' })), null, '不是 PEM');
});

test('buildJwtAssertion：RS256 簽章可用公鑰驗證，claims 符合 jwt-bearer 規格', () => {
  const parsed = parseServiceAccount(JSON.stringify(sa));
  const jwt = buildJwtAssertion(parsed, { nowSec: 1_700_000_000 });
  const [h, c, s] = jwt.split('.');
  assert.deepEqual(decode(h), { alg: 'RS256', typ: 'JWT' });
  const claims = decode(c);
  assert.equal(claims.iss, sa.client_email);
  assert.equal(claims.aud, TOKEN_URL);
  assert.equal(claims.scope, ADMIN_SCOPES);
  assert.equal(claims.iat, 1_700_000_000);
  assert.equal(claims.exp, 1_700_003_600);
  const v = createVerify('RSA-SHA256');
  v.update(`${h}.${c}`);
  v.end();
  assert.ok(v.verify(publicKey, Buffer.from(s, 'base64url')));
});

test('createAdminTokenProvider：換 token、快取、到期前重換、並發共用一次請求', async () => {
  const parsed = parseServiceAccount(JSON.stringify(sa));
  let clock = 1_000_000;
  const calls = [];
  let n = 0;
  const fetchImpl = async (url, init) => {
    calls.push({ url, body: init.body });
    n += 1;
    return { ok: true, status: 200, json: async () => ({ access_token: `tok${n}`, expires_in: 3600 }) };
  };
  const p = createAdminTokenProvider(parsed, { fetchImpl, now: () => clock });

  const [a, b] = await Promise.all([p.getAccessToken(), p.getAccessToken()]);
  assert.equal(a, 'tok1');
  assert.equal(b, 'tok1', '並發呼叫共用同一個 in-flight 請求');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, TOKEN_URL);
  const form = calls[0].body;
  assert.equal(form.get('grant_type'), 'urn:ietf:params:oauth:grant-type:jwt-bearer');
  assert.equal(form.get('assertion').split('.').length, 3);

  clock += 30 * 60_000;
  assert.equal(await p.getAccessToken(), 'tok1', '未到期沿用快取');
  clock += 30 * 60_000; // 剩 0 秒 < 60 秒緩衝 → 重換
  assert.equal(await p.getAccessToken(), 'tok2');
  assert.equal(calls.length, 2);
});

test('createAdminTokenProvider：token 端點失敗要丟出含原因的錯誤', async () => {
  const parsed = parseServiceAccount(JSON.stringify(sa));
  const fetchImpl = async () => ({ ok: false, status: 400, json: async () => ({ error: 'invalid_grant', error_description: 'Invalid JWT Signature.' }) });
  const p = createAdminTokenProvider(parsed, { fetchImpl });
  await assert.rejects(p.getAccessToken(), /Invalid JWT Signature/);
});
