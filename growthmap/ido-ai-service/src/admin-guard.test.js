import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { checkPlatformAdmin, resetAdminCache } from './admin-guard.js';

beforeEach(() => resetAdminCache());

const mk = (status) => {
  const calls = [];
  const fetchImpl = async (url, init) => { calls.push({ url, auth: init.headers.Authorization }); return { status }; };
  return { fetchImpl, calls };
};

test('200／404 ＝ 管理員（規則放行）；403／401 ＝ 非管理員；探測用呼叫者自己的 token', async () => {
  for (const [status, expected] of [[200, 'admin'], [404, 'admin'], [403, 'denied'], [401, 'denied']]) {
    resetAdminCache();
    const { fetchImpl, calls } = mk(status);
    assert.equal(await checkPlatformAdmin({ uid: 'u1', idToken: 'idt' }, 'proj', fetchImpl), expected, `status ${status}`);
    assert.match(calls[0].url, /\/projects\/proj\/databases\/\(default\)\/documents\/platform\/meta$/);
    assert.equal(calls[0].auth, 'Bearer idt');
  }
});

test('判定快取 60 秒（同 uid 不重打）；暫時失敗不快取', async () => {
  let clock = 0;
  const { fetchImpl, calls } = mk(200);
  const now = () => clock;
  assert.equal(await checkPlatformAdmin({ uid: 'u1', idToken: 't' }, 'proj', fetchImpl, now), 'admin');
  assert.equal(await checkPlatformAdmin({ uid: 'u1', idToken: 't' }, 'proj', fetchImpl, now), 'admin');
  assert.equal(calls.length, 1);
  clock = 61_000;
  await checkPlatformAdmin({ uid: 'u1', idToken: 't' }, 'proj', fetchImpl, now);
  assert.equal(calls.length, 2, 'TTL 過後重探');

  resetAdminCache();
  let n = 0;
  const flaky = async () => { n += 1; if (n === 1) throw new Error('network'); return { status: 200 }; };
  assert.equal(await checkPlatformAdmin({ uid: 'u2', idToken: 't' }, 'proj', flaky), 'error');
  assert.equal(await checkPlatformAdmin({ uid: 'u2', idToken: 't' }, 'proj', flaky), 'admin', '錯誤不快取，下一次重探');
});

test('缺 uid／token／projectId 一律 denied（fail-closed）', async () => {
  const { fetchImpl, calls } = mk(200);
  assert.equal(await checkPlatformAdmin({ uid: '', idToken: 't' }, 'proj', fetchImpl), 'denied');
  assert.equal(await checkPlatformAdmin({ uid: 'u', idToken: '' }, 'proj', fetchImpl), 'denied');
  assert.equal(await checkPlatformAdmin({ uid: 'u', idToken: 't' }, '', fetchImpl), 'denied');
  assert.equal(calls.length, 0);
});
