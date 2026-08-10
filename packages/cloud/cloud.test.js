import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reconcile, mergeBySection, stableStringify, createCloudSync, installChunkReloadRecovery, consumeFlushTs, registerLocalTsProvider } from './index.js';

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

// ── Section 級 merge（whole-doc LWW 資料遺失的修正）─────────────────────────

test('mergeBySection：雙裝置並行改不同 section → 各取較新者、needUpload 回傳雲端', () => {
  // 裝置 B 視角：本地 partB 較新（T2），雲端有裝置 A 剛寫的 partA（T1）
  const T1 = 1000;
  const T2 = 2000;
  const r = mergeBySection(
    { partA: 'a-old', partB: 'b-new' },
    { partA: 0, partB: T2 },
    0,
    { data: { partA: 'a-new', partB: 'b-old' }, updatedAt: T1, version: 1, sectionTs: { partA: T1, partB: 0 } }
  );
  assert.deepEqual(r.merged, { partA: 'a-new', partB: 'b-new' }, '兩邊的新編輯都要活下來');
  assert.deepEqual(r.mergedSectionTs, { partA: T1, partB: T2 });
  assert.deepEqual(r.usedCloud.sort(), ['partA']);
  assert.deepEqual(r.keptLocal.sort(), ['partB']);
  assert.equal(r.needUpload, true, '本地較新的 partB 必須回傳雲端，其他裝置才拿得到');
});

test('mergeBySection：舊文件無 sectionTs → 全 section 以 updatedAt 裁決（退回 whole-doc 行為）', () => {
  // 雲端整體較新 → 全蓋（= 舊 LWW）
  const allCloud = mergeBySection(
    { partA: 'a1', partB: 'b1' },
    { partA: 500, partB: 500 },
    0,
    { data: { partA: 'a2', partB: 'b2' }, updatedAt: 900, version: 1, sectionTs: null }
  );
  assert.deepEqual(allCloud.merged, { partA: 'a2', partB: 'b2' });
  assert.equal(allCloud.needUpload, false);
  // 本地整體較新 → 全留＋上傳（= 舊 LWW 的 upload）
  const allLocal = mergeBySection(
    { partA: 'a1', partB: 'b1' },
    { partA: 900, partB: 900 },
    0,
    { data: { partA: 'a2', partB: 'b2' }, updatedAt: 500, version: 1, sectionTs: null }
  );
  assert.deepEqual(allLocal.merged, { partA: 'a1', partB: 'b1' });
  assert.equal(allLocal.usedCloud.length, 0);
  assert.equal(allLocal.needUpload, true);
});

test('mergeBySection：本 session 零編輯 → 雲端全贏且不上傳（cloud-first 不變式）', () => {
  const r = mergeBySection(
    { partA: 'local-default', partB: 'local-default' },
    {},
    0,
    { data: { partA: 'cloud', partB: 'cloud' }, updatedAt: 100, version: 1, sectionTs: { partA: 100, partB: 100 } }
  );
  assert.deepEqual(r.merged, { partA: 'cloud', partB: 'cloud' });
  assert.equal(r.needUpload, false, '零編輯 session 不得寫雲端');
});

test('mergeBySection：單邊 key——雲端多的用雲端；本地多的保留，ts=0 不上傳、ts>0 才上傳', () => {
  // 雲端有新欄位（其他裝置的新版 client 寫入）→ 取雲端
  const cloudExtra = mergeBySection(
    { partA: 'a' },
    { partA: 500 },
    0,
    { data: { partA: 'a', partB: 'new-field' }, updatedAt: 900, version: 1, sectionTs: { partA: 400, partB: 900 } }
  );
  assert.equal(cloudExtra.merged.partB, 'new-field');
  // 本地有 store 新預設欄位但未編輯（ts=0）→ 保留但不觸發上傳
  const localDefault = mergeBySection(
    { partA: 'a', partC: 'schema-default' },
    { partA: 500 },
    0,
    { data: { partA: 'a' }, updatedAt: 400, version: 1, sectionTs: { partA: 400 } }
  );
  assert.equal(localDefault.merged.partC, 'schema-default');
  assert.equal(localDefault.needUpload, false, '未編輯的 schema 預設欄位不得觸發上傳');
  // 本地編輯過、雲端缺該 section → 必須上傳
  const localEdited = mergeBySection(
    { partA: 'a', partC: 'edited' },
    { partA: 500, partC: 800 },
    0,
    { data: { partA: 'a' }, updatedAt: 400, version: 1, sectionTs: { partA: 400 } }
  );
  assert.equal(localEdited.needUpload, true);
});

test('mergeBySection：tie 偏本地；內容相同的 tie 不上傳（防雙裝置 ping-pong 震盪）', () => {
  // tie 且內容不同（真同毫秒碰撞）→ 本地贏且上傳
  const conflict = mergeBySection(
    { partA: 'mine' },
    { partA: 700 },
    0,
    { data: { partA: 'theirs' }, updatedAt: 700, version: 1, sectionTs: { partA: 700 } }
  );
  assert.equal(conflict.merged.partA, 'mine', '同毫秒偏本地（沿用 reconcile tie 裁定）');
  assert.equal(conflict.needUpload, true);
  // tie 且內容相同（對方文件已含我方寫入的回送）→ 不得再上傳
  const settled = mergeBySection(
    { partA: 'same' },
    { partA: 700 },
    0,
    { data: { partA: 'same' }, updatedAt: 700, version: 1, sectionTs: { partA: 700 } }
  );
  assert.equal(settled.needUpload, false, '內容已收斂仍上傳會讓兩台裝置無限 ping-pong');
});

test('stableStringify：key 順序不同的等值物件序列化相同（Firestore 排序回讀 vs 本地插入順序）', () => {
  const local = { naturalGrowth: { targetRevenue2028: 100 }, aspirationGrowth: { targetRevenue2028: 200 } };
  const fromFirestore = { aspirationGrowth: { targetRevenue2028: 200 }, naturalGrowth: { targetRevenue2028: 100 } };
  assert.notEqual(JSON.stringify(local), JSON.stringify(fromFirestore), '前提：原生 stringify 因順序不等');
  assert.equal(stableStringify(local), stableStringify(fromFirestore), '穩定序列化必須相等');
  assert.notEqual(stableStringify({ a: 1 }), stableStringify({ a: 2 }));
  assert.equal(stableStringify([{ b: 1, a: 2 }]), stableStringify([{ a: 2, b: 1 }]), '陣列內物件也要排序');
  // 與 JSON/Firestore 回讀語意一致：undefined key 略過、Date 走 toJSON、陣列洞=null
  assert.equal(stableStringify({ a: 1, b: undefined }), stableStringify({ a: 1 }), 'undefined key 必須略過');
  assert.equal(stableStringify(new Date(0)), JSON.stringify(new Date(0)), 'Date 不得退化成 {}');
  assert.equal(stableStringify([undefined]), '[null]');
});

test('mergeBySection：tie 破對稱只 +1ms——晚送達的 tie 快照不得蓋掉 tie 之後的真編輯', () => {
  const T = 1000;
  // A 在 tie 裁決時 bump；B 已在 T+50 真編輯過同 section
  const a = mergeBySection(
    { k: 'A-content' }, { k: T }, 0,
    { data: { k: 'B-old' }, updatedAt: T, version: 1, sectionTs: { k: T } }
  );
  assert.equal(a.mergedSectionTs.k, T + 1, 'bump 必須是最小擾動 +1，不得跳到 Date.now()');
  // B 的 T+50 編輯收到 A 的 bump(T+1) → B 較新 → B 贏（曾用 Date.now() bump 時 B 會被回滾）
  const b = mergeBySection(
    { k: 'B-new' }, { k: T + 50 }, 0,
    { data: { k: 'A-content' }, updatedAt: T + 1, version: 1, sectionTs: { k: T + 1 } }
  );
  assert.equal(b.merged.k, 'B-new', 'tie 裁決不得贏過毫秒級之後的真編輯');
});

test('mergeBySection：Firestore 排序回讀的等值內容在 tie 時不得觸發上傳（防 ping-pong 對原生 stringify 的迴歸）', () => {
  // 本地插入順序 {n, a}、雲端回讀排序 {a, n}——內容相同、ts tie
  const r = mergeBySection(
    { companyInfo: { naturalGrowth: 1, aspirationGrowth: 2 } },
    { companyInfo: 700 },
    0,
    { data: { companyInfo: { aspirationGrowth: 2, naturalGrowth: 1 } }, updatedAt: 700, version: 1, sectionTs: { companyInfo: 700 } }
  );
  assert.equal(r.needUpload, false, 'key 順序差異不是內容差異');
});

test('mergeBySection：tie 且內容真的不同 → 破對稱（上傳 ts 必須大於凍結的 tie ts，讓對方下一輪判雲端較新）', () => {
  const TIE = 700;
  const r = mergeBySection(
    { partA: 'mine' },
    { partA: TIE },
    0,
    { data: { partA: 'theirs' }, updatedAt: TIE, version: 1, sectionTs: { partA: TIE } }
  );
  assert.equal(r.needUpload, true);
  assert.ok(r.mergedSectionTs.partA > TIE, '凍結 ts 原樣互傳會讓雙方永不收斂（審查模擬 12 hops 不收斂）');
  // 收斂驗證：對方以提升後的 ts 收到 → 判雲端較新 → 套用，迴圈終止
  const other = mergeBySection(
    { partA: 'theirs' },
    { partA: TIE },
    0,
    { data: { partA: 'mine' }, updatedAt: r.mergedSectionTs.partA, version: 1, sectionTs: { partA: r.mergedSectionTs.partA } }
  );
  assert.deepEqual(other.usedCloud, ['partA'], '對方必須套用提升後的版本');
  assert.equal(other.needUpload, false);
});

test('mergeBySection：墓碑壓制——雲端刪除的 section 不得由本地殘值復活', () => {
  const DEL = 5000;
  const r = mergeBySection(
    { partA: 'stale-residue', partB: 'b' },
    { partA: 3000, partB: 4000 },
    0,
    { data: { partB: 'b' }, updatedAt: DEL, version: 1, sectionTs: { partB: 4000 }, sectionTombstones: { partA: DEL } }
  );
  assert.deepEqual(r.suppressed, ['partA'], '殘值 ts(3000) <= 墓碑(5000) → 壓制');
  assert.ok(!('partA' in r.merged), '壓制的 section 不進 merged');
  assert.equal(r.needUpload, false, '壓制不得觸發上傳（復活的根源）');
  assert.deepEqual(r.survivingTombstones, { partA: DEL }, '墓碑必須轉發，否則全量 setDoc 洗掉後其他裝置復活');
});

test('mergeBySection：墓碑之後的新編輯合法復活並自動清墓碑', () => {
  const DEL = 5000;
  const r = mergeBySection(
    { partA: 'new-after-delete' },
    { partA: 6000 },
    0,
    { data: {}, updatedAt: DEL, version: 1, sectionTs: {}, sectionTombstones: { partA: DEL } }
  );
  assert.equal(r.suppressed.length, 0);
  assert.deepEqual(r.keptLocal, ['partA'], '刪除後的新編輯（ts>墓碑）是有效資料');
  assert.equal(r.needUpload, true);
  assert.deepEqual(r.survivingTombstones, {}, '復活的 key 墓碑不再轉發（自動清除）');
});

test('mergeBySection：雲端同時有資料與墓碑（異常態）→ 資料優先、墓碑視為過期', () => {
  const r = mergeBySection(
    { partA: 'local' },
    { partA: 100 },
    0,
    { data: { partA: 'cloud' }, updatedAt: 900, version: 1, sectionTs: { partA: 900 }, sectionTombstones: { partA: 500 } }
  );
  assert.equal(r.merged.partA, 'cloud', '有資料就正常裁決');
  assert.deepEqual(r.survivingTombstones, {}, '資料存在的 key 墓碑清除');
});

test('sectionTombstones 傳輸：extra 寫入讀回；空物件不寫欄位（=清除）', async () => {
  const fake = makeFakeFirestore();
  const sync = createCloudSync(async () => ({ db: {} }), fake.module);
  await sync.saveCloud('u1', 'momentum', { tree: 't' }, 'w1', { sectionTs: { tree: 1 }, sectionTombstones: { drivers: 999 } });
  const doc = await sync.loadCloud('u1', 'momentum');
  assert.deepEqual(doc.sectionTombstones, { drivers: 999 });
  await sync.saveCloud('u1', 'momentum', { tree: 't2', drivers: 'revived' }, 'w1', { sectionTs: { tree: 2, drivers: 1000 }, sectionTombstones: {} });
  const doc2 = await sync.loadCloud('u1', 'momentum');
  assert.equal(doc2.sectionTombstones, null, '空墓碑不寫欄位＝全量覆蓋下清除');
});

test('mergeBySection：雙裝置收斂模擬——交替 merge 至多兩輪後 needUpload 必須歸零', () => {
  const T1 = 1000;
  const T2 = 2000;
  // A 先上傳（partA 編輯 @T1）
  let cloudDoc = { data: { partA: 'A1', partB: 'B0' }, updatedAt: T1, version: 1, sectionTs: { partA: T1, partB: 0 } };
  // B（partB 編輯 @T2）收到 → merge → 上傳 merged
  const b1 = mergeBySection({ partA: 'A0', partB: 'B1' }, { partB: T2 }, 0, cloudDoc);
  assert.equal(b1.needUpload, true);
  cloudDoc = { data: b1.merged, updatedAt: T2 + 1, version: 1, sectionTs: b1.mergedSectionTs };
  // A 收到 B 的 merged（A 端 sectionTs 已具體化為上傳時的值）→ 內容相同 → 收斂停止
  const a2 = mergeBySection({ partA: 'A1', partB: 'B0' }, { partA: T1, partB: 0 }, 0, cloudDoc);
  assert.deepEqual(a2.merged, { partA: 'A1', partB: 'B1' }, '雙方編輯都存活');
  assert.equal(a2.needUpload, false, 'A 的 partA 與雲端相同（tie）→ 不得再回傳，鏈到此收斂');
  // B 若再收到自己寫入以外的回放，也必須穩定
  const b2 = mergeBySection(b1.merged, b1.mergedSectionTs, 0, cloudDoc);
  assert.equal(b2.needUpload, false);
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
  assert.equal(doc.sectionTs, null, '未帶 extra 時 sectionTs 缺席 → 讀回 null（舊文件相容）');
});

test('sectionTs 隨 extra 寫入並在 loadCloud / subscribeCloud 讀回；不帶 extra 不寫該欄位', async () => {
  const fake = makeFakeFirestore();
  const sync = createCloudSync(async () => ({ db: {} }), fake.module);
  await sync.saveCloud('u1', 'momentum', { tree: 't1', drivers: 'd1' }, 'wA', { sectionTs: { tree: 111, drivers: 222 } });
  const doc = await sync.loadCloud('u1', 'momentum');
  assert.deepEqual(doc.sectionTs, { tree: 111, drivers: 222 });

  const seen = [];
  sync.subscribeCloud('u1', 'momentum', (cloud) => seen.push(cloud));
  await tick();
  assert.deepEqual(seen.at(-1).sectionTs, { tree: 111, drivers: 222 }, 'subscribe 端也要轉發 sectionTs');

  // debounced 版轉發 extra
  let saved = 0;
  sync.saveCloudDebounced('u1', 'momentum', { tree: 't2', drivers: 'd1' }, 0, 'wA', { onSaved: () => { saved += 1; } }, { sectionTs: { tree: 333, drivers: 222 } });
  await tick();
  assert.equal(saved, 1);
  const doc2 = await sync.loadCloud('u1', 'momentum');
  assert.deepEqual(doc2.sectionTs, { tree: 333, drivers: 222 });
  // 舊 client 行為模擬：不帶 extra 的寫入 → 文件不再有 sectionTs（新 client 讀到 null → 退回 whole-doc）
  await sync.saveCloud('u1', 'momentum', { tree: 't3', drivers: 'd1' }, 'wOld');
  const doc3 = await sync.loadCloud('u1', 'momentum');
  assert.equal(doc3.sectionTs, null);
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
