import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateEmail, validatePassword, validateDisplayName, validateUid, toAdminView, summarizeAuthConfig,
  createIdentityToolkitClient, ValidationError, AdminUpstreamError, describeUpstream,
} from './admin-accounts.js';

test('驗證器：email 正規化小寫；密碼 8–128 且首尾無空白；uid 只准安全字元', () => {
  assert.equal(validateEmail('  CEO@Corp.TW '), 'ceo@corp.tw');
  assert.throws(() => validateEmail('nope'), ValidationError);
  assert.throws(() => validateEmail(''), ValidationError);
  assert.equal(validatePassword('abcdefgh'), 'abcdefgh');
  assert.throws(() => validatePassword('short'), ValidationError);
  assert.throws(() => validatePassword(' padded1 '), ValidationError);
  assert.throws(() => validatePassword('x'.repeat(129)), ValidationError);
  assert.equal(validateDisplayName('  王小明 '), '王小明');
  assert.equal(validateDisplayName(undefined), '');
  assert.throws(() => validateDisplayName('x'.repeat(101)), ValidationError);
  assert.equal(validateUid('04RrTVF5H2QzwjV726GYPjQ5EHF3'), '04RrTVF5H2QzwjV726GYPjQ5EHF3');
  assert.throws(() => validateUid('../x'), ValidationError);
  assert.throws(() => validateUid(''), ValidationError);
});

test('toAdminView／summarizeAuthConfig：只露出管理需要的欄位，缺值有預設', () => {
  const v = toAdminView({
    localId: 'u1', email: 'a@b.c', displayName: '甲', emailVerified: true, disabled: true,
    providerUserInfo: [{ providerId: 'google.com' }, { providerId: 'password' }],
    createdAt: '1776389417371', lastLoginAt: '1788876907300',
  });
  assert.deepEqual(v, {
    uid: 'u1', email: 'a@b.c', displayName: '甲', emailVerified: true, disabled: true,
    providers: ['google.com', 'password'], createdAt: 1776389417371, lastLoginAt: 1788876907300,
  });
  assert.deepEqual(toAdminView({ localId: 'u2' }), {
    uid: 'u2', email: '', displayName: '', emailVerified: false, disabled: false, providers: [], createdAt: null, lastLoginAt: null,
  });
  assert.deepEqual(summarizeAuthConfig({ signIn: { email: { enabled: true } }, client: { permissions: { disabledUserSignup: true } }, authorizedDomains: ['localhost'] }),
    { emailPasswordEnabled: true, signUpDisabled: true, authorizedDomains: ['localhost'] });
  assert.deepEqual(summarizeAuthConfig({}), { emailPasswordEnabled: false, signUpDisabled: false, authorizedDomains: [] });
});

test('describeUpstream：已知碼翻繁中並保留原碼，未知碼原樣帶出', () => {
  assert.match(describeUpstream('EMAIL_EXISTS'), /已有帳號.*EMAIL_EXISTS/);
  assert.match(describeUpstream('WEAK_PASSWORD : Password should be at least 6 characters'), /WEAK_PASSWORD/);
  assert.match(describeUpstream('SOMETHING_ELSE'), /SOMETHING_ELSE/);
});

function mockClient(handler) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, method: init.method, body, auth: init.headers.Authorization });
    const r = handler({ url, method: init.method, body, n: calls.length });
    return { ok: r.status ? r.status < 400 : true, status: r.status || 200, json: async () => r.json ?? {} };
  };
  const client = createIdentityToolkitClient({ projectId: 'demo', getAccessToken: async () => 'tok', fetchImpl });
  return { client, calls };
}

test('listAccounts：分頁跟到底、帶 Bearer、走 v1 batchGet', async () => {
  const { client, calls } = mockClient(({ url }) => (
    url.includes('nextPageToken=p2')
      ? { json: { users: [{ localId: 'u3', email: 'c@x.y' }] } }
      : { json: { users: [{ localId: 'u1', email: 'a@x.y' }, { localId: 'u2', email: 'b@x.y' }], nextPageToken: 'p2' } }
  ));
  const list = await client.listAccounts();
  assert.deepEqual(list.map((u) => u.uid), ['u1', 'u2', 'u3']);
  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /\/v1\/projects\/demo\/accounts:batchGet\?maxResults=500$/);
  assert.equal(calls[0].method, 'GET');
  assert.equal(calls[0].auth, 'Bearer tok');
  assert.match(calls[1].url, /nextPageToken=p2/);
});

test('createAccount／setPassword／setDisabled：請求體正確，管理員背書的帳號 emailVerified=true', async () => {
  const { client, calls } = mockClient(() => ({ json: { localId: 'new1', email: 'ceo@corp.tw' } }));
  const created = await client.createAccount({ email: 'ceo@corp.tw', password: 'Passw0rd!', displayName: '' });
  assert.deepEqual(created, { uid: 'new1', email: 'ceo@corp.tw' });
  assert.match(calls[0].url, /\/v1\/projects\/demo\/accounts$/);
  assert.deepEqual(calls[0].body, { email: 'ceo@corp.tw', password: 'Passw0rd!', emailVerified: true });

  await client.setPassword('u9', 'NewPassw0rd');
  assert.match(calls[1].url, /accounts:update$/);
  assert.deepEqual(calls[1].body, { localId: 'u9', password: 'NewPassw0rd', emailVerified: true });

  await client.setDisabled('u9', true);
  assert.deepEqual(calls[2].body, { localId: 'u9', disableUser: true });
});

test('applyAuthConfig：先讀現值合併 permissions，再 PATCH 帶 updateMask（admin v2）', async () => {
  const { client, calls } = mockClient(({ method }) => (
    method === 'GET'
      ? { json: { signIn: { email: { enabled: false } }, client: { permissions: { disabledUserDeletion: true } } } }
      : { json: { signIn: { email: { enabled: true, passwordRequired: true } }, client: { permissions: { disabledUserSignup: true, disabledUserDeletion: true } }, authorizedDomains: ['localhost'] } }
  ));
  const after = await client.applyAuthConfig({ emailPassword: true, disableSignup: true });
  assert.deepEqual(after, { emailPasswordEnabled: true, signUpDisabled: true, authorizedDomains: ['localhost'] });
  assert.equal(calls[1].method, 'PATCH');
  assert.match(calls[1].url, /\/admin\/v2\/projects\/demo\/config\?updateMask=signIn\.email,client\.permissions$/);
  assert.deepEqual(calls[1].body, {
    signIn: { email: { enabled: true, passwordRequired: true } },
    client: { permissions: { disabledUserDeletion: true, disabledUserSignup: true } },
  });
});

test('上游錯誤 → AdminUpstreamError（繁中訊息＋原始碼＋HTTP 狀態）', async () => {
  const { client } = mockClient(() => ({ status: 400, json: { error: { message: 'EMAIL_EXISTS' } } }));
  await assert.rejects(client.createAccount({ email: 'a@b.c', password: 'Passw0rd!' }), (e) => (
    e instanceof AdminUpstreamError && e.status === 400 && e.upstream === 'EMAIL_EXISTS' && /已有帳號/.test(e.message)
  ));
});
