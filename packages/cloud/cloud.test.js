import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reconcile, createCloudSync, installChunkReloadRecovery, consumeFlushTs, registerLocalTsProvider } from './index.js';

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
            // 仿真 Firestore：先送樂觀本地快照（hasPendingWrites: true），再送伺服器確認
            fn({ exists: () => true, data: () => value, metadata: { hasPendingWrites: true, fromCache: false } });
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

test('雙分頁模擬：A 寫入 → B 收到 pending→confirmed 序列，metadata 逐筆轉發、writer=A（防迴授兩層的依據）', async () => {
  const fake = makeFakeFirestore();
  const sync = createCloudSync(async () => ({ db: {} }), fake.module);
  const seenByA = [];
  const seenByB = [];
  sync.subscribeCloud('u1', 'momentum', (cloud, meta) => seenByA.push({ cloud, meta }));
  sync.subscribeCloud('u1', 'momentum', (cloud, meta) => seenByB.push({ cloud, meta }));
  await tick();
  assert.equal(seenByB.at(-1).cloud, null); // 文件尚不存在

  await sync.saveCloud('u1', 'momentum', { tree: 'v1' }, 'client-A');
  await tick();
  // metadata 必須逐筆原樣轉發（消費端第一層防迴授 hasPendingWrites 依賴它）——
  // 任何一筆缺 boolean 都代表 subscribeCloud 停止轉發，三單元的防護同時失效
  for (const { meta } of seenByB) {
    assert.equal(typeof meta.hasPendingWrites, 'boolean', 'metadata.hasPendingWrites 必須轉發');
  }
  const events = seenByB.slice(1); // 去掉初始 null
  assert.deepEqual(events.map((e) => e.meta.hasPendingWrites), [true, false], '樂觀快照→伺服器確認的序列');
  const gotB = seenByB.at(-1);
  assert.equal(gotB.cloud.writer, 'client-A');
  assert.deepEqual(gotB.cloud.data, { tree: 'v1' });
  assert.ok(gotB.cloud.updatedAt > 0);
  assert.equal(seenByA.at(-1).cloud.writer, 'client-A'); // A 端據此略過自己的回送（第二層）
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

test('重載恢復語意：flush-ts＝provider 回報的真實編輯時間；未編輯（0）不寫入（雲端優先不被破壞）', async () => {
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
    // 情境 A：本 session 有真實編輯（editTs）→ flush-ts 必須等於 editTs，而非 reload 當下時間
    const editTs = Date.now() - 90 * 1000; // 90 秒前的編輯
    const unregister = registerLocalTsProvider('fk', () => editTs);
    installChunkReloadRecovery({ reloadKey: 'rk', flushTsKey: 'fk' });

    const e1 = new Event('vite:preloadError', { cancelable: true });
    globalThis.window.dispatchEvent(e1);
    assert.equal(e1.defaultPrevented, true);
    assert.equal(reloads, 1);

    const ts = consumeFlushTs('fk');
    assert.equal(ts, editTs, 'flush-ts 必須是真實編輯時間，不是 reload 時間');
    // 較新的雲端（editTs 之後寫入）必須仍判 cloud——沉睡分頁不得反蓋新雲端
    assert.equal(reconcile(ts, { data: {}, updatedAt: editTs + 30 * 1000, version: 1 }), 'cloud');
    // 較舊的雲端才判 upload
    assert.equal(reconcile(ts, { data: {}, updatedAt: editTs - 5000, version: 1 }), 'upload');
    assert.equal(consumeFlushTs('fk'), 0, 'flush-ts 單次有效');

    const e2 = new Event('vite:preloadError', { cancelable: true });
    globalThis.window.dispatchEvent(e2);
    assert.equal(e2.defaultPrevented, false, '冷卻期內第二次失敗應放行預設拋錯');
    assert.equal(reloads, 1, '不得無限重載');
    unregister();

    // 情境 B：本 session 未編輯（provider 回 0）→ 不得寫 flush-ts，重載後維持雲端優先
    store.clear();
    const unregister2 = registerLocalTsProvider('fk2', () => 0);
    installChunkReloadRecovery({ reloadKey: 'rk2', flushTsKey: 'fk2' });
    const e3 = new Event('vite:preloadError', { cancelable: true });
    globalThis.window.dispatchEvent(e3);
    assert.equal(consumeFlushTs('fk2'), 0, '未編輯的 session 不得產生 flush-ts');
    unregister2();
  } finally {
    delete globalThis.window;
    delete globalThis.sessionStorage;
  }
});

test('saveCloudDebounced：onSaved 只在寫入成功後觸發；失敗走 onError（簽章不得先記後存）', async () => {
  const fake = makeFakeFirestore();
  const sync = createCloudSync(async () => ({ db: {} }), fake.module);
  let saved = 0;
  sync.saveCloudDebounced('u1', 'momentum', { tree: 'ok' }, 0, 'w1', { onSaved: () => { saved += 1; } });
  await tick();
  assert.equal(saved, 1, '成功路徑觸發 onSaved');

  const failing = createCloudSync(async () => ({ db: {} }), {
    ...fake.module,
    setDoc: async () => { throw new Error('network down'); },
  });
  let failSaved = 0;
  let failErred = 0;
  failing.saveCloudDebounced('u1', 'momentum', { tree: 'bad' }, 0, 'w1', {
    onSaved: () => { failSaved += 1; },
    onError: () => { failErred += 1; },
  });
  await tick();
  assert.equal(failSaved, 0, '失敗不得觸發 onSaved（否則內容被永久視為已同步）');
  assert.equal(failErred, 1);
});
