import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createKeyProbe } from './anthropic-probe.js';

const mk = (status, opts = {}) => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (status === 'throw') throw new Error('network down');
    return { status };
  };
  return { probe: createKeyProbe({ apiKey: 'sk-ant-test', fetchImpl, ...opts }), calls };
};

test('200 → valid true；401/403 → false；其他狀態或網路錯誤 → null（不誤判成壞）', async () => {
  assert.equal((await mk(200).probe.check()).valid, true);
  assert.equal((await mk(401).probe.check()).valid, false);
  assert.equal((await mk(403).probe.check()).valid, false);
  assert.equal((await mk(500).probe.check()).valid, null);
  assert.equal((await mk('throw').probe.check()).valid, null);
});

test('請求打 GET {base}/v1/models 帶 x-api-key；baseURL 可自訂；TTL 內快取、force 可重探', async () => {
  let clock = 0;
  const { probe, calls } = mk(200, { baseURL: 'https://proxy.example/', now: () => clock, ttlMs: 1000 });
  await probe.check();
  assert.equal(calls[0].url, 'https://proxy.example/v1/models');
  assert.equal(calls[0].init.headers['x-api-key'], 'sk-ant-test');
  await probe.check();
  assert.equal(calls.length, 1, 'TTL 內不重打');
  clock = 2000;
  await probe.check();
  assert.equal(calls.length, 2, 'TTL 過後重探');
  await probe.check({ force: true });
  assert.equal(calls.length, 3);
});

test('沒有金鑰 → valid false 且不發請求', async () => {
  const calls = [];
  const probe = createKeyProbe({ apiKey: '', fetchImpl: async (u) => { calls.push(u); return { status: 200 }; } });
  assert.deepEqual((await probe.check()).valid, false);
  assert.equal(calls.length, 0);
});
