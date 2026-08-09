// @growthmap/cloud — 三單元共用的 Firestore 同步協定唯一正本。
//
// 歷史：momentum / aspiration / opportunity 各自複製演化出三份 lib/cloud/sync，
// 文件形狀相同但修 bug 互不同步（例：reconcile 的同毫秒 tie 修正只進了 opportunity）。
// 本包收斂為單一實作；各單元的 sync 檔只剩「綁定自家 firebase 實例」的薄轉接層。
//
// 雲端文件形狀（與三單元既有線上資料完全相容，勿改欄位名）：
//   users/{uid}/apps/{appKey} = { data, updatedAtMs, updatedAt: serverTimestamp, version: 1, writer }
//   writer = 寫入者的裝置 session 識別碼（可為 null），供即時訂閱端略過「自己寫入的回送」。

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
    };
  }

  async function saveCloud(uid, appKey, data, writer = null) {
    const { db } = await getFirebase();
    if (!db) return;
    const { doc, setDoc, serverTimestamp } = await fs();
    await setDoc(doc(db, ...userAppDocSegments(uid, appKey)), {
      data,
      updatedAtMs: Date.now(),
      updatedAt: serverTimestamp(),
      version: 1,
      writer,
    });
  }

  const timers = new Map();

  // callbacks = { onSaved, onError }：onSaved 只在寫入確實成功後觸發——
  // 消費端的內容簽章（lastCloudSig）必須在 onSaved 才記錄，否則存檔失敗會被永久視為已同步。
  function saveCloudDebounced(uid, appKey, data, delay = 1000, writer = null, callbacks = null) {
    const key = `${uid}:${appKey}`;
    const prev = timers.get(key);
    if (prev) clearTimeout(prev);
    timers.set(
      key,
      setTimeout(() => {
        saveCloud(uid, appKey, data, writer)
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
            { data: raw.data, updatedAt: raw.updatedAtMs ?? 0, version: raw.version ?? 1, writer: raw.writer ?? null },
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
