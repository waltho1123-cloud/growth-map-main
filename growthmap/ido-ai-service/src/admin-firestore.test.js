import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFirestoreAdminClient, FirestoreAdminError } from './admin-firestore.js';

const DOCS = 'https://firestore.googleapis.com/v1/projects/demo/databases/(default)/documents';
const name = (p) => `projects/demo/databases/(default)/documents/${p}`;

// 模擬一棵樹：users/u1 底下 apps 集合有 momentum／aspiration，momentum 再有一層子集合 notes/n1
function mockTree() {
  const tree = {
    'users/u1': ['apps'],
    'users/u1/apps/momentum': ['notes'],
    'users/u1/apps/aspiration': [],
    'users/u1/apps/momentum/notes/n1': [],
  };
  const docsIn = {
    'users/u1/apps': ['users/u1/apps/momentum', 'users/u1/apps/aspiration'],
    'users/u1/apps/momentum/notes': ['users/u1/apps/momentum/notes/n1'],
  };
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ method: init.method, url });
    const rel = url.slice(DOCS.length + 1);
    if (init.method === 'POST' && rel.endsWith(':listCollectionIds')) {
      return { ok: true, status: 200, json: async () => ({ collectionIds: tree[rel.replace(':listCollectionIds', '')] || [] }) };
    }
    if (init.method === 'GET') {
      const coll = rel.split('?')[0];
      return { ok: true, status: 200, json: async () => ({ documents: (docsIn[coll] || []).map((p) => ({ name: name(p) })) }) };
    }
    if (init.method === 'DELETE') return { ok: true, status: 200, json: async () => ({}) };
    return { ok: false, status: 500, json: async () => ({ error: { message: 'unexpected' } }) };
  };
  return { fetchImpl, calls };
}

test('purgeUserData：遞迴刪子集合，先刪子孫再刪父文件，回傳刪除數', async () => {
  const { fetchImpl, calls } = mockTree();
  const fs = createFirestoreAdminClient({ projectId: 'demo', getAccessToken: async () => 'tok', fetchImpl });
  const n = await fs.purgeUserData('u1');
  assert.equal(n, 4, 'n1 + momentum + aspiration + users/u1');
  const deletes = calls.filter((c) => c.method === 'DELETE').map((c) => c.url.slice(DOCS.length + 1));
  assert.deepEqual(deletes, ['users/u1/apps/momentum/notes/n1', 'users/u1/apps/momentum', 'users/u1/apps/aspiration', 'users/u1']);
});

test('purgeUserData：文件數安全閥與 uid 格式檢查', async () => {
  const { fetchImpl } = mockTree();
  const fs = createFirestoreAdminClient({ projectId: 'demo', getAccessToken: async () => 'tok', fetchImpl });
  await assert.rejects(fs.purgeUserData('u1', { maxDocs: 2 }), (e) => e instanceof FirestoreAdminError && /安全上限/.test(e.message));
  await assert.rejects(fs.purgeUserData('../x'), FirestoreAdminError);
});

test('deleteDocument：DELETE 對應路徑並帶 Bearer；上游錯誤 → FirestoreAdminError', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return url.endsWith('/platformUsers/bad')
      ? { ok: false, status: 403, json: async () => ({ error: { message: 'Missing or insufficient permissions.' } }) }
      : { ok: true, status: 200, json: async () => ({}) };
  };
  const fs = createFirestoreAdminClient({ projectId: 'demo', getAccessToken: async () => 'tok', fetchImpl });
  assert.equal(await fs.deleteDocument('platformUsers/u1'), true);
  assert.equal(calls[0].url, `${DOCS}/platformUsers/u1`);
  assert.equal(calls[0].init.method, 'DELETE');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer tok');
  await assert.rejects(fs.deleteDocument('platformUsers/bad'), (e) => e instanceof FirestoreAdminError && e.status === 403);
});
