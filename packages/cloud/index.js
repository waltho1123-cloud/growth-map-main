// @growthmap/cloud — 三單元共用的 Firestore 同步協定唯一正本。
//
// 歷史：momentum / aspiration / opportunity 各自複製演化出三份 lib/cloud/sync，
// 文件形狀相同但修 bug 互不同步（例：reconcile 的同毫秒 tie 修正只進了 opportunity）。
// 本包收斂為單一實作；各單元的 sync 檔只剩「綁定自家 firebase 實例」的薄轉接層。
//
// 雲端文件形狀（與三單元既有線上資料完全相容，勿改欄位名）：
//   users/{uid}/apps/{appKey} = { data, updatedAtMs, updatedAt: serverTimestamp, version: 1, writer,
//                                 sectionTs?, sectionTombstones? }
//   writer = 寫入者的裝置 session 識別碼（可為 null），供即時訂閱端略過「自己寫入的回送」。
//   sectionTs = data 各 top-level key 的最後編輯毫秒（additive：舊 client 不讀不寫此欄位，
//   缺席時 merge 端以 updatedAtMs 作為全部 section 的時間 → 退回 whole-doc 行為）。
//   sectionTombstones = { key: 刪除毫秒 }——運維從雲端刪 section 時同時寫入
//   （data.{key} 刪除＋sectionTs.{key} 刪除＋sectionTombstones.{key}=Date.now()），
//   否則開著的 client 會把本地殘值回寫復活。本地 ts > 墓碑時間的「刪除後新編輯」
//   合法復活該 section（上傳時自動清墓碑）；雲端同時有資料與墓碑時資料優先。

import { useEffect, useRef } from 'react';
import { userAppDocSegments } from '@growthmap/contracts';

// firestoreOverride：測試注入用的 firestore 模組替身（{doc,getDoc,setDoc,onSnapshot,serverTimestamp}）；
// 生產一律省略、走動態 import。
export function createCloudSync(getFirebase, firestoreOverride = null) {
  const fs = () => firestoreOverride ?? import('firebase/firestore');
  async function loadCloud(uid, appKey) {
    const { db } = await getFirebase();
    if (!db) return null;
    const { doc, getDoc } = await fs();
    const snap = await getDoc(doc(db, ...userAppDocSegments(uid, appKey)));
    if (!snap.exists()) return null;
    const raw = snap.data();
    return {
      data: raw.data,
      updatedAt: raw.updatedAtMs ?? 0,
      version: raw.version ?? 1,
      writer: raw.writer ?? null,
      sectionTs: raw.sectionTs ?? null,
      sectionTombstones: raw.sectionTombstones ?? null,
    };
  }

  // extra = { sectionTs, sectionTombstones }：選配的 section 級中繼資料（見檔頭文件形狀）。
  // sectionTombstones 為空物件時不寫欄位（setDoc 全量覆蓋下「不寫」＝清除，正確表達「無墓碑」）。
  async function saveCloud(uid, appKey, data, writer = null, extra = null) {
    const { db } = await getFirebase();
    if (!db) return;
    const { doc, setDoc, serverTimestamp } = await fs();
    await setDoc(doc(db, ...userAppDocSegments(uid, appKey)), {
      data,
      updatedAtMs: Date.now(),
      updatedAt: serverTimestamp(),
      version: 1,
      writer,
      ...(extra && extra.sectionTs ? { sectionTs: extra.sectionTs } : {}),
      ...(extra && extra.sectionTombstones && Object.keys(extra.sectionTombstones).length > 0
        ? { sectionTombstones: extra.sectionTombstones }
        : {}),
    });
  }

  const timers = new Map();

  // callbacks = { onSaved, onError }：onSaved 只在寫入確實成功後觸發——
  // 消費端的內容簽章（lastCloudSig）必須在 onSaved 才記錄，否則存檔失敗會被永久視為已同步。
  function saveCloudDebounced(uid, appKey, data, delay = 1000, writer = null, callbacks = null, extra = null) {
    const key = `${uid}:${appKey}`;
    const prev = timers.get(key);
    if (prev) clearTimeout(prev);
    timers.set(
      key,
      setTimeout(() => {
        saveCloud(uid, appKey, data, writer, extra)
          .then(() => { callbacks?.onSaved?.(); })
          .catch((e) => {
            console.error('[cloud sync] save failed:', e);
            callbacks?.onError?.(e);
          });
        timers.delete(key);
      }, delay)
    );
  }

  // 即時訂閱雲端文件變更（多裝置即時同步）。回傳 unsubscribe 函式。
  // onChange(cloud, metadata)：cloud = { data, updatedAt, version, writer } 或 null（文件不存在）。
  // 消費端防迴授三層：(1) metadata.hasPendingWrites 略過自己未確認的樂觀寫入；
  // (2) cloud.writer === 自己的 clientId 略過回送；(3) 套用快照時以 applying 旗標擋住回寫。
  function subscribeCloud(uid, appKey, onChange) {
    let unsub = () => {};
    let cancelled = false;
    (async () => {
      const { db } = await getFirebase();
      if (!db || cancelled) return;
      const { doc, onSnapshot } = await fs();
      const ref = doc(db, ...userAppDocSegments(uid, appKey));
      const stop = onSnapshot(
        ref,
        (snap) => {
          if (!snap.exists()) { onChange(null, snap.metadata); return; }
          const raw = snap.data();
          onChange(
            {
              data: raw.data,
              updatedAt: raw.updatedAtMs ?? 0,
              version: raw.version ?? 1,
              writer: raw.writer ?? null,
              sectionTs: raw.sectionTs ?? null,
              sectionTombstones: raw.sectionTombstones ?? null,
            },
            snap.metadata
          );
        },
        (err) => { console.error('[cloud sync] subscribe failed:', err); }
      );
      if (cancelled) { stop(); return; }
      unsub = stop;
    })();
    return () => { cancelled = true; unsub(); };
  }

  return { loadCloud, saveCloud, saveCloudDebounced, subscribeCloud };
}

// ── 部署切換恢復（三單元共用；Vite SPA 專用）──────────────────────────────────
// 部署後停留在舊版頁面的分頁載入 lazy chunk 會 404（雜湊已換、舊檔不保留）。
// Vite 在 preload 失敗時發 vite:preloadError：自動整頁重載一次換取新版。
// 重載前寫入 flushTsKey 時間戳，開機端以 consumeFlushTs() 讀取並作為 localTs——
// 否則 localTs=0 會被 reconcile 視為「本 session 未動」，讓較舊的雲端資料蓋回本地。
// sessionStorage 被封鎖時改用 URL 參數當防迴圈標記，恢復機制在無 storage 環境仍運作。

// localTs provider 註冊表：bootstrap 註冊「回報本 session 真實最後編輯時間」的函式。
// 恢復機制不得自行發明時間戳——曾因寫入 reload 當下時間，讓沉睡分頁的過期資料
// 在重載後被判「較新」而蓋掉他裝置的新編輯（2026-08-09 max 審查 finding）。
const localTsProviders = new Map();

export function registerLocalTsProvider(flushTsKey, provider) {
  localTsProviders.set(flushTsKey, provider);
  return () => { localTsProviders.delete(flushTsKey); };
}

export function installChunkReloadRecovery({
  reloadKey,
  flushTsKey,
  cooldownMs = 60000,
  onBeforeReload = null, // 本地持久化非同步的單元（如 debounced localStorage）在此 flush；zustand persist 單元可省略
} = {}) {
  const readLast = () => {
    let ss = 0;
    try { ss = Number(sessionStorage.getItem(reloadKey) || 0); } catch { /* 讀不到就靠 URL */ }
    const url = Number(new URLSearchParams(window.location.search).get('bwreload') || 0);
    return Math.max(ss, url);
  };
  window.addEventListener('vite:preloadError', (event) => {
    const now = Date.now();
    if (now - readLast() < cooldownMs) return; // 冷卻期內第二次失敗：放行預設拋錯（交給 ErrorBoundary）
    event.preventDefault();
    if (onBeforeReload) {
      try { onBeforeReload(); } catch (e) { console.error('[chunk recovery] onBeforeReload failed:', e); }
    }
    // 防迴圈標記必須「確認寫入成功」才可用無標記的 reload()；
    // setItem 失敗（配額滿/受限模式）就改走 URL 參數路徑，標記隨網址存活。
    let markerPersisted = false;
    try {
      sessionStorage.setItem(reloadKey, String(now));
      markerPersisted = true;
    } catch { /* 走 URL 參數 */ }
    // flush 時間戳＝bootstrap 回報的真實最後編輯時間；沒編輯過（0）就不寫，
    // 重載後維持「雲端優先」的預設，避免過期本地資料反蓋較新雲端。
    if (flushTsKey) {
      const provider = localTsProviders.get(flushTsKey);
      let ts = 0;
      try { ts = provider ? Number(provider()) || 0 : 0; } catch { ts = 0; }
      if (ts > 0) {
        try { sessionStorage.setItem(flushTsKey, String(ts)); } catch { /* 缺席時開機端回到雲端優先 */ }
      }
    }
    if (markerPersisted) {
      window.location.reload();
    } else {
      const url = new URL(window.location.href);
      url.searchParams.set('bwreload', String(now));
      window.location.replace(url.toString());
    }
  });
}

// 開機時讀取並清除 flush 時間戳（單次有效、預設 5 分鐘內）；供 bootstrap 初始化 localTs。
export function consumeFlushTs(flushTsKey, maxAgeMs = 5 * 60 * 1000) {
  try {
    const t = Number(sessionStorage.getItem(flushTsKey) || 0);
    sessionStorage.removeItem(flushTsKey);
    return t && Date.now() - t < maxAgeMs ? t : 0;
  } catch {
    return 0;
  }
}

// 純函式，不需 firebase 實例。採 opportunity 的修正版：
// localUpdatedAt === 0 表示「本地這次 session 從未被使用者改動過」——
// 此時絕不上傳，否則剛登入還沒載入雲端資料時會把空 state 蓋掉雲端真實資料（歷史踩過的 bug）。
// 同毫秒碰撞偏向保留本地（localUpdatedAt>0 代表本 session 確實有改動），
// 避免與雲端寫入同毫秒的本地變更被當 'same' 靜默丟棄。
export function reconcile(localUpdatedAt, cloud) {
  if (localUpdatedAt === 0) {
    return cloud ? 'cloud' : 'same';
  }
  if (!cloud) return 'upload';
  if (cloud.updatedAt > localUpdatedAt) return 'cloud';
  return 'upload';
}

// 穩定序列化：遞迴按 key 排序。Firestore 讀回的 map 欄位是 key 排序、
// 本地物件是插入順序——直接 JSON.stringify 會把「內容相同」判成不同，
// 讓 needUpload 的防 ping-pong 短路永遠不生效（2026-08-10 max 審查 finding）。
export function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (typeof value.toJSON === 'function') return JSON.stringify(value); // Date 等：與 JSON 一致（不可退化成 '{}'）
  if (Array.isArray(value)) return `[${value.map((v) => (v === undefined ? 'null' : stableStringify(v))).join(',')}]`;
  // undefined 值的 key 略過——與 JSON.stringify／Firestore 回讀一致；否則
  // 本地 {a:undefined} 與雲端 {} 永遠比不相等，tie 防 ping-pong 短路失效。
  const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}

// ── Section 級 merge（純函式）───────────────────────────────────────────────
// whole-doc LWW 的資料遺失情境：裝置 A 改 partA、裝置 B 同時改 partB，後寫者的
// 全量快照把先寫者的另一個 section 蓋掉。本函式以 per-section 時間戳逐 key 裁決。
//
// localData / cloud.data 的 top-level key 即 section；per-key 規則：
//   1. 只在雲端存在 → 用雲端（本地沒東西可保留）
//   2. 只在本地存在 → 留本地（雲端是舊版 client 寫的缺欄位文件，不得清掉本地欄位)
//   3. 兩邊都有：localTs===0（本 session 未編輯該 section）→ 用雲端（cloud-first 不變式）；
//      否則 cloudTs > localTs 才用雲端，同毫秒偏本地（沿用 reconcile 的 tie 裁定）。
// 時間戳來源：cloudTs = cloud.sectionTs?.[key] ?? cloud.updatedAt（舊文件無 sectionTs
// → 全部 section 視為 updatedAtMs → 行為退回 whole-doc LWW，向後相容）；
// localTs = localSectionTs[key] ?? localFallbackTs（部署恢復時 flush-ts 作為底線）。
//
// 回傳 { merged, mergedSectionTs, usedCloud, keptLocal, needUpload }：
//   usedCloud.length > 0 → 呼叫端 applySnapshot(merged)（有雲端內容要套進本地）；
//   needUpload → 把 merged 回傳雲端（讓其他裝置拿到本地新 section）。
//   needUpload 的條件：keptLocal 中存在「ts>0 且內容確實與雲端不同」的項目。
//   兩個否決都不可少——ts=0 的單邊本地 key（如新版 schema 的 store 預設欄位）
//   不觸發上傳（零編輯 session 不寫雲端的既有不變式）；tie 偏本地但內容相同
//   （對方剛套用過我方寫入的回送）也不觸發，否則兩台裝置在內容已收斂後
//   會 tie→上傳→對方 tie→上傳……無限 ping-pong。內容比較只對 keptLocal 且
//   ts>0 的 section 做（收到遠端寫入時的低頻路徑，不在鍵擊路徑）。
export function mergeBySection(localData, localSectionTs, localFallbackTs, cloud) {
  const cloudData = (cloud && cloud.data) || {};
  const cloudSectionTs = (cloud && cloud.sectionTs) || null;
  const tombstones = (cloud && cloud.sectionTombstones) || {};
  const merged = {};
  const mergedSectionTs = {};
  const usedCloud = [];
  const keptLocal = [];
  const suppressed = []; // 被墓碑壓制的 keys：不套用、不上傳（雲端刻意刪除的 section 不得復活）
  const keys = new Set([...Object.keys(localData || {}), ...Object.keys(cloudData)]);
  for (const key of keys) {
    const inLocal = localData != null && Object.prototype.hasOwnProperty.call(localData, key);
    const inCloud = Object.prototype.hasOwnProperty.call(cloudData, key);
    const cloudTs = cloudSectionTs && cloudSectionTs[key] != null ? cloudSectionTs[key] : (cloud ? cloud.updatedAt : 0);
    const localTs = localSectionTs && localSectionTs[key] != null ? localSectionTs[key] : localFallbackTs;
    // 墓碑裁決（優先於本地保留規則）：雲端沒有該 section 且墓碑時間 >= 本地編輯時間
    // → 雲端的刪除是權威，本地殘值壓制。localTs > 墓碑 = 刪除之後的新編輯 → 走正常
    // 規則合法復活；雲端同時有資料與墓碑（異常態）→ 資料優先，墓碑視為過期。
    if (!inCloud && tombstones[key] != null && localTs <= tombstones[key]) {
      suppressed.push(key);
      continue;
    }
    if (!inLocal) {
      merged[key] = cloudData[key];
      mergedSectionTs[key] = cloudTs;
      usedCloud.push(key);
    } else if (!inCloud) {
      merged[key] = localData[key];
      mergedSectionTs[key] = localTs;
      keptLocal.push(key);
    } else if (localTs === 0 || cloudTs > localTs) {
      merged[key] = cloudData[key];
      mergedSectionTs[key] = cloudTs;
      usedCloud.push(key);
    } else {
      merged[key] = localData[key];
      mergedSectionTs[key] = localTs;
      keptLocal.push(key);
    }
  }
  // 內容比較一律用 stableStringify（Firestore 讀回 key 排序 vs 本地插入順序）。
  const differsFromCloud = (key) => {
    if (!Object.prototype.hasOwnProperty.call(cloudData, key)) return true; // 雲端缺此 section
    try {
      return stableStringify(localData[key]) !== stableStringify(cloudData[key]);
    } catch {
      return true; // 序列化失敗保守視為不同（寧多傳一次，不靜默丟）
    }
  };
  let needUpload = false;
  for (const key of keptLocal) {
    if (!(mergedSectionTs[key] > 0)) continue;
    if (!differsFromCloud(key)) continue;
    needUpload = true;
    // tie 破對稱：同毫秒且內容真的不同時，凍結的 ts 會讓兩台裝置各自
    // 保留己方版本並以相同 ts 無限互傳（審查 finder 模擬 12 hops 不收斂）。
    // 只 +1ms（最小擾動）：曾用 Date.now() 提升，但快照晚送達時 bump 值會
    // 大於「tie 之後的真編輯」的 ts，把較新編輯回滾到全網（審查 finding）；
    // +1 讓 tie 裁決永遠輸給任何毫秒級之後的真編輯。若雙方同輪對稱 +1，
    // 下一輪由「內容相同不上傳」或再 +1 收斂（機率逐輪遞減，非死鎖）。
    const cloudTs = (cloud && cloud.sectionTs && cloud.sectionTs[key] != null)
      ? cloud.sectionTs[key]
      : (cloud ? cloud.updatedAt : 0);
    if (mergedSectionTs[key] === cloudTs) {
      mergedSectionTs[key] = mergedSectionTs[key] + 1;
    }
  }
  // 上傳時應轉發的墓碑＝雲端現有墓碑（壓制中或無關的）減去本輪合法復活的 keys
  //（keptLocal 中 ts > 墓碑者）。全量 setDoc 下漏轉發＝墓碑被洗掉、其他裝置復活。
  const survivingTombstones = {};
  for (const key of Object.keys(tombstones)) {
    const resurrected = keptLocal.includes(key) || usedCloud.includes(key);
    if (!resurrected) survivingTombstones[key] = tombstones[key];
  }
  return { merged, mergedSectionTs, usedCloud, keptLocal, suppressed, survivingTombstones, needUpload };
}

// ── zustand 單元的同步控制器（單一正本）─────────────────────────────────────────
// aspiration 與 momentum 的 CloudSyncBootstrap 曾是 ~95% 相同的兩份複製（第四層
// dataSig 簽章也各一份）——收斂為此 factory，單元端只剩宣告式 config。
// opportunity 的 OpportunityContext 因有 migrate／交付快照 union 等獨有層，刻意不併入。
//
// 防迴授四層：(1) metadata.hasPendingWrites (2) writer===clientId (3) applying 旗標
// (4) 內容簽章（只在 onSaved 寫入成功後記錄）。
// 效能：簽章比對在自有 debounce 視窗內做（每次鍵擊只做 O(section 數) 的引用比較
// 記時間戳，不做全量序列化）。
//
// Section 級 merge：以 sectionTsRef 追蹤各 top-level section 的本地最後編輯時間
// （zustand immutable 更新 → 引用比較即可偵測哪個 section 變了），收到雲端快照時
// 走 mergeBySection 逐 section 裁決，取代 whole-doc LWW——兩台裝置並行編輯不同
// section 不再互相覆蓋。上傳一律附 sectionTs 供對方裁決。


export function createCloudSyncBootstrap({
  appKey,
  flushTsKey,
  initialLocalTs = 0,   // 單元模組層以 consumeFlushTs(key) 取得後傳入（模組層一次性，免 render 重播問題）
  useAuth,              // @growthmap/firebase 的 useAuth（由單元傳入，維持本包對 firebase 的 DI 邊界）
  isConfigured,
  sync,                 // 單元綁定後的 { subscribeCloud, saveCloudDebounced }
  subscribe,            // (listener) => unsubscribe —— zustand store.subscribe
  getSnapshot,          // () => 要同步的純物件（純組裝，不做檢查）
  applySnapshot,        // (data) => void —— 套用雲端快照到 store
  guardSnapshot = null, // 選配：上傳前守衛（如 aspiration 的 dev 契約 assert）
  clearSnapshot = null, // 選配：把 store 重置為空白初始態——同分頁換帳號時呼叫，
                        // 不提供則前一位使用者的資料會留在畫面上（時間戳歸零仍擋住自動上傳，
                        // 但新帳號的第一次編輯會把整份殘留快照上傳——強烈建議提供）
  pushDelayMs = 1000,
}) {
  return function CloudSyncBootstrap() {
    const { user } = useAuth();
    const localTsRef = useRef(initialLocalTs);
    const initialTsRef = useRef(initialLocalTs); // flush-ts fallback；換帳號時必須可歸零（模組常數摸不到）
    const sectionTsRef = useRef({}); // 各 section 的本地最後編輯毫秒；缺席 key 以 initialTsRef 為底線
    const cloudOnlyRef = useRef({ data: {}, ts: {} }); // 雲端有、單元 getSnapshot 沒有的 sections（新舊版本並存時保住新版欄位）
    const tombstonesRef = useRef({}); // 雲端墓碑現值——上傳時轉發（漏轉發＝墓碑被全量 setDoc 洗掉）並壓制殘值回寫
    const prevSnapRef = useRef(null); // 引用比較基準（偵測哪個 section 變了）
    const applyingRef = useRef(false);
    const reconciledRef = useRef(false);
    const lastCloudSigRef = useRef('');
    const pushTimerRef = useRef(null);
    const prevUidRef = useRef(null); // 偵測同分頁換帳號（跨帳號汙染防線）
    const clientIdRef = useRef(null);
    if (clientIdRef.current === null) {
      clientIdRef.current = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : `c-${Math.random().toString(36).slice(2)}`;
    }

    // 部署恢復（flush-ts）語意：重載前不知道哪個 section 改過（粒度遺失），
    // 全部 section 以 initialTsRef（= flush-ts，正常開機為 0）為底線——
    // 與重載前的 whole-doc 行為一致，不更差。
    const localSectionTsOf = (key) =>
      sectionTsRef.current[key] != null ? sectionTsRef.current[key] : initialTsRef.current;

    // 上傳用：對 snap 的每個 key 取本地 section 時間
    const sectionTsViewOf = (snap) => {
      const view = {};
      for (const key of Object.keys(snap || {})) view[key] = localSectionTsOf(key);
      return view;
    };

    // guard 拋出（dev 契約 assert）只擋掉該次上傳並 console.error 可見，不炸整個
    // onSnapshot callback——否則會跳過 reconciledRef 設定，push 路徑整個 session 停用
    //（文件對 guard 的承諾同步改為「dev console 立即報錯並擋上傳」）。
    // 上傳前把 sectionTs cap 在「現在」：時鐘偏快裝置寫出的未來 ts 若被原樣轉發，
    // 會讓真正較新的編輯永遠判輸（審查 finding：偏移 ts 被無辜裝置永久再斷言）。
    // 兩條上傳路徑都自動帶上 cloudOnlyRef（雲端獨有 sections）——單元 getSnapshot
    // 只組固定 keys，直接上傳會把新版 client 寫入的額外 section 整份蓋掉。
    const uploadSnapshot = (snap, sectionTs, precomputedSig = null) => {
      const fullSnap = { ...cloudOnlyRef.current.data, ...snap };
      const fullTs = { ...cloudOnlyRef.current.ts, ...sectionTs };
      // 墓碑壓制：ts <= 墓碑時間的 section 不上傳（雲端刻意刪除不得由殘值復活）；
      // ts > 墓碑（刪除後的新編輯）＝合法復活——照常上傳且墓碑不再轉發（自動清除）。
      const tombs = tombstonesRef.current;
      const liveTombstones = {};
      for (const key of Object.keys(tombs)) {
        if ((fullTs[key] ?? 0) <= tombs[key]) {
          delete fullSnap[key];
          delete fullTs[key];
          liveTombstones[key] = tombs[key];
        }
      }
      try {
        if (guardSnapshot) guardSnapshot(fullSnap);
      } catch (e) {
        console.error('[cloud sync] guardSnapshot rejected upload:', e);
        return;
      }
      const now = Date.now();
      const cappedTs = {};
      for (const key of Object.keys(fullTs)) cappedTs[key] = Math.min(fullTs[key], now);
      const sig = precomputedSig ?? JSON.stringify(snap);
      sync.saveCloudDebounced(user.uid, appKey, fullSnap, 0, clientIdRef.current, {
        onSaved: () => { lastCloudSigRef.current = sig; },
      }, { sectionTs: cappedTs, sectionTombstones: liveTombstones });
    };

    // 恢復機制的時間戳來源＝真實最後編輯時間；未編輯（0）不寫（雲端優先不被破壞）
    useEffect(() => registerLocalTsProvider(flushTsKey, () => localTsRef.current), []);

    // 本地最後改動時間＋改動的 section（套用雲端快照時不算改動）——
    // 每次變更僅 O(section 數) 的引用比較（zustand immutable 更新保證未變 section 引用相同）
    useEffect(() => {
      prevSnapRef.current = getSnapshot();
      return subscribe(() => {
        if (applyingRef.current) return;
        const now = Date.now();
        localTsRef.current = now;
        const snap = getSnapshot();
        const prev = prevSnapRef.current;
        for (const key of Object.keys(snap)) {
          if (!prev || snap[key] !== prev[key]) sectionTsRef.current[key] = now;
        }
        prevSnapRef.current = snap;
      });
    }, []);

    // 登入時：即時訂閱雲端文件；第一筆快照等同一次性 reconcile。
    // 收到遠端寫入一律走 section 級 merge：雲端較新的 section 套進本地、
    // 本地較新的 section 保留並把 merged 回傳雲端（其他裝置才拿得到）。
    useEffect(() => {
      reconciledRef.current = false;
      if (!isConfigured || !user) return;
      // 同分頁換帳號：前一位使用者的殘留資料與編輯時間若不清除，會被寫進
      // 新帳號的雲端文件（跨帳號汙染——工作坊共用電腦情境）。四件事缺一不可：
      // (1) clearSnapshot 清空 store（不清的話殘留資料還在畫面上，新帳號一編輯
      //     整份就上傳）；(2) initialTsRef 歸零（flush-ts fallback 是模組常數傳入，
      //     不歸零則部署恢復後換帳號，前一位的 flush-ts 讓全部殘留 section 判
      //     「本地較新」→ 零編輯也整份蓋掉新帳號雲端——審查以真 mergeBySection 證實）；
      // (3) 各時間戳/簽章歸零；(4) 清空以 applyingRef 包住（不算編輯）。
      // 歸零後 cloud-first 不變式接手：新帳號雲端有資料→全套用；沒資料→零編輯不上傳。
      // 同帳號登出再登入不重置（本地編輯仍有效）。
      if (prevUidRef.current !== null && prevUidRef.current !== user.uid) {
        if (clearSnapshot) {
          applyingRef.current = true;
          try { clearSnapshot(); } catch (e) { console.error('[cloud sync] clearSnapshot failed:', e); }
          finally { applyingRef.current = false; }
        }
        localTsRef.current = 0;
        initialTsRef.current = 0;
        sectionTsRef.current = {};
        cloudOnlyRef.current = { data: {}, ts: {} };
        tombstonesRef.current = {};
        lastCloudSigRef.current = '';
        prevSnapRef.current = getSnapshot();
      }
      prevUidRef.current = user.uid;
      const unsub = sync.subscribeCloud(user.uid, appKey, (cloud, meta) => {
        if (meta && meta.hasPendingWrites) return;
        // 收到第一筆確認快照即視為 reconciled——放在裁決之前，
        // 裁決/守衛拋出才不會讓 push 路徑整個 session 停用。
        reconciledRef.current = true;
        if (cloud && cloud.writer === clientIdRef.current) {
          if (cloud.updatedAt > localTsRef.current) localTsRef.current = cloud.updatedAt;
          tombstonesRef.current = (cloud && cloud.sectionTombstones) || {};
          return;
        }
        if (cloud && cloud.data) {
          const localSnap = getSnapshot();
          const { merged, mergedSectionTs, usedCloud, needUpload, survivingTombstones } = mergeBySection(
            localSnap, sectionTsViewOf(localSnap), localTsRef.current, cloud
          );
          tombstonesRef.current = survivingTombstones; // 上傳路徑據此壓制殘值並轉發墓碑
          // 記下雲端獨有 sections（單元固定 keys 之外的）——上傳路徑會 spread 回去，
          // 舊版 client 才不會把新版寫入的欄位整份蓋掉。每輪以雲端現況重算（不累積），
          // 雲端刪掉的 key 自然消失。
          const nextCloudOnly = { data: {}, ts: {} };
          for (const key of Object.keys(merged)) {
            if (!Object.prototype.hasOwnProperty.call(localSnap, key)) {
              nextCloudOnly.data[key] = merged[key];
              nextCloudOnly.ts[key] = mergedSectionTs[key];
            }
          }
          let applied = !(usedCloud.length > 0); // 無雲端內容要套時視為「已就緒」
          if (usedCloud.length > 0) {
            applyingRef.current = true;
            try {
              applySnapshot(merged);
              applied = true;
            } catch (e) {
              // zustand subscriber（如 persist 配額滿）拋出時 state 可能已半套用——
              // 不 rethrow（會炸 onSnapshot callback），bookkeeping 以實況為準（見下）。
              console.error('[cloud sync] applySnapshot failed:', e);
            } finally {
              // 引用基準無條件跟上實況（getSnapshot 讀的是 store 現狀，套用成功
              // 與否都正確）——否則下一鍵擊會把所有 section 誤標為「現在編輯過」。
              prevSnapRef.current = getSnapshot();
              applyingRef.current = false; // 拋出也不得讓旗標卡死
            }
          }
          if (applied) {
            cloudOnlyRef.current = nextCloudOnly;
            if (usedCloud.length > 0) {
              // 簽章只在「不需回傳」時記（此時本地內容=雲端已知內容）。
              // needUpload 時交給 onSaved——先記會讓上傳失敗被誤判已同步（onSaved-gate 不變式）。
              if (!needUpload) lastCloudSigRef.current = JSON.stringify(getSnapshot());
              // 具體化各 section 的權威時間（含 usedCloud 的 cloudTs），後續裁決不再依賴
              // fallback。逐 key cap 在「現在」：偏快時鐘寫出的未來 ts 一旦被採納為本地
              // 權威時間，之後所有誠實時鐘裝置的真編輯都會被本裝置回蓋（審查 finding）。
              const now = Date.now();
              const materialized = {};
              for (const key of Object.keys(mergedSectionTs)) {
                materialized[key] = Math.min(mergedSectionTs[key], now);
              }
              sectionTsRef.current = materialized;
              if (cloud.updatedAt > localTsRef.current) localTsRef.current = cloud.updatedAt;
            }
            if (needUpload) {
              // 上傳套用後的實況（store 可能 normalize）；sectionTs 用 merge 裁決結果。
              // apply 失敗時不上傳（本地實況≠merge 意圖，蓋上 mergedSectionTs 會以
              // 舊內容配新時間戳汙染雲端），留待下一筆快照重試。
              uploadSnapshot(getSnapshot(), mergedSectionTs);
            }
          }
        } else if (reconcile(localTsRef.current, cloud) === 'upload') {
          // 雲端文件不存在（＝也無墓碑）：本 session 有編輯才上傳（零編輯不寫雲端）
          tombstonesRef.current = {};
          const snap = getSnapshot();
          uploadSnapshot(snap, sectionTsViewOf(snap));
        }
      });
      return () => unsub();
    }, [user]);

    // 變更推送：訂閱端只排程；快照組裝＋簽章比對延後到 debounce 觸發時做一次
    useEffect(() => {
      if (!isConfigured || !user) return;
      const unsub = subscribe(() => {
        if (applyingRef.current) return;
        if (!reconciledRef.current) return;
        clearTimeout(pushTimerRef.current);
        pushTimerRef.current = setTimeout(() => {
          const snap = getSnapshot();
          const sig = JSON.stringify(snap);
          if (sig === lastCloudSigRef.current) return; // 快照回放而非新編輯
          uploadSnapshot(snap, sectionTsViewOf(snap), sig);
        }, pushDelayMs);
      });
      return () => {
        clearTimeout(pushTimerRef.current);
        unsub();
      };
    }, [user]);

    return null;
  };
}
