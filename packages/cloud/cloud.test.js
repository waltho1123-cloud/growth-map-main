import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reconcile, createCloudSync, installChunkReloadRecovery, consumeFlushTs } from './index.js';

test('reconcile：本 session 未動（localTs=0）→ 有雲端取雲端、無雲端不動', () => {
  assert.equal(reconcile(0, { data: {}, updatedAt: 100, version: 1 }), 'cloud');
  assert.equal(reconcile(0, null), 'same');
});

test('reconcile：本地有改動且無雲端 → 上傳', () => {
  assert.equal(reconcile(500, null), 'upload');
});

test('reconcile：雲端較新 → 取雲端', () => {
  assert.equal(reconcile(500, { data: {}, updatedAt: 900, version: 1 }), 'cloud');
});

test('reconcile：本地較新 → 上傳', () => {
  assert.equal(reconcile(900, { data: {}, updatedAt: 500, version: 1 }), 'upload');
});

test('reconcile：同毫秒碰撞偏向保留本地（opportunity 修正版，非舊版 same）', () => {
  assert.equal(reconcile(700, { data: {}, updatedAt: 700, version: 1 }), 'upload');
});

test('createCloudSync：db 不可用時 load 回 null、save 靜默略過', async () => {
  const sync = createCloudSync(async () => ({ db: null }));
  assert.equal(await sync.loadCloud('u1', 'momentum'), null);
  await assert.doesNotReject(sync.saveCloud('u1', 'momentum', { x: 1 }));
});

// ── 模擬測試：對抗式審查點名的情境（雙分頁回送、重載掉資料、防迴圈）──────────

function makeFakeFirestore() {
  const docs = new Map();
  const listeners = new Map();
  const pathOf = (segs) => segs.join('/');
  return {
    docs,
    module: {
      doc: (_db, ...segs) => ({ __path: pathOf(segs) }),
      getDoc: async (ref) => {
        const raw = docs.get(ref.__path);
        return { exists: () => raw !== undefined, data: () => raw };
      },
      setDoc: async (ref, value) => {
        docs.set(ref.__path, value);
        const subs = listeners.get(ref.__path);
        if (subs) {
          for (const fn of subs) {
            fn({ exists: () => true, data: () => value, metadata: { hasPendingWrites: false, fromCache: false } });
          }
        }
      },
      serverTimestamp: () => ({ __server: true }),
      onSnapshot: (ref, next) => {
        const set = listeners.get(ref.__path) ?? new Set();
        set.add(next);
        listeners.set(ref.__path, set);
        const raw = docs.get(ref.__path);
        next({ exists: () => raw !== undefined, data: () => raw, metadata: { hasPendingWrites: false, fromCache: false } });
        return () => set.delete(next);
      },
    },
  };
}

const tick = () => new Promise((r) => setTimeout(r, 10));

test('雙分頁模擬：A 寫入 → B 即時收到快照且 writer=A（回送識別依據）；A 自己也收到 writer=A 可略過', async () => {
  const fake = makeFakeFirestore();
  const sync = createCloudSync(async () => ({ db: {} }), fake.module);
  const seenByA = [];
  const seenByB = [];
  sync.subscribeCloud('u1', 'momentum', (cloud) => seenByA.push(cloud));
  sync.subscribeCloud('u1', 'momentum', (cloud) => seenByB.push(cloud));
  await tick();
  assert.equal(seenByB.at(-1), null); // 文件尚不存在

  await sync.saveCloud('u1', 'momentum', { tree: 'v1' }, 'client-A');
  await tick();
  const gotB = seenByB.at(-1);
  assert.equal(gotB.writer, 'client-A');
  assert.deepEqual(gotB.data, { tree: 'v1' });
  assert.ok(gotB.updatedAt > 0);
  const gotA = seenByA.at(-1);
  assert.equal(gotA.writer, 'client-A'); // A 端據此略過自己的回送
});

test('loadCloud 讀回 saveCloud 寫入的形狀（updatedAtMs→updatedAt 映射、writer 保留）', async () => {
  const fake = makeFakeFirestore();
  const sync = createCloudSync(async () => ({ db: {} }), fake.module);
  await sync.saveCloud('u1', 'aspiration', { partA: [] }, 'w9');
  const doc = await sync.loadCloud('u1', 'aspiration');
  assert.deepEqual(doc.data, { partA: [] });
  assert.equal(doc.writer, 'w9');
  assert.equal(doc.version, 1);
});

test('重載掉資料情境：preloadError → flush-ts 寫入 → consumeFlushTs 單次取得（reconcile 因此判本地較新）', async () => {
  let reloads = 0;
  globalThis.window = new EventTarget();
  globalThis.window.location = { reload: () => { reloads += 1; }, href: 'http://localhost/', search: '' };
  const store = new Map();
  globalThis.sessionStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  try {
    installChunkReloadRecovery({ reloadKey: 'rk', flushTsKey: 'fk' });

    const e1 = new Event('vite:preloadError', { cancelable: true });
    globalThis.window.dispatchEvent(e1);
    assert.equal(e1.defaultPrevented, true);
    assert.equal(reloads, 1);

    const ts = consumeFlushTs('fk');
    assert.ok(ts > 0, 'flush-ts 應在重載前寫入');
    assert.ok(reconcile(ts, { data: {}, updatedAt: ts - 5000, version: 1 }) === 'upload', '重載後應判本地較新而上傳');
    assert.equal(consumeFlushTs('fk'), 0, 'flush-ts 單次有效');

    const e2 = new Event('vite:preloadError', { cancelable: true });
    globalThis.window.dispatchEvent(e2);
    assert.equal(e2.defaultPrevented, false, '冷卻期內第二次失敗應放行預設拋錯');
    assert.equal(reloads, 1, '不得無限重載');
  } finally {
    delete globalThis.window;
    delete globalThis.sessionStorage;
  }
});
