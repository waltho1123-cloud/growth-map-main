import { getFirebase } from './firebase';

export async function loadCloud(uid, appKey) {
  const { db } = await getFirebase();
  if (!db) return null;
  const { doc, getDoc } = await import('firebase/firestore');
  const snap = await getDoc(doc(db, 'users', uid, 'apps', appKey));
  if (!snap.exists()) return null;
  const raw = snap.data();
  return {
    data: raw.data,
    updatedAt: raw.updatedAtMs ?? 0,
    version: raw.version ?? 1,
  };
}

// writer = 寫入者的裝置 session 識別碼，供即時訂閱端辨識並略過「自己寫入回送」的快照。
export async function saveCloud(uid, appKey, data, writer = null) {
  const { db } = await getFirebase();
  if (!db) return;
  const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
  await setDoc(doc(db, 'users', uid, 'apps', appKey), {
    data,
    updatedAtMs: Date.now(),
    updatedAt: serverTimestamp(),
    version: 1,
    writer,
  });
}

const timers = new Map();

export function saveCloudDebounced(uid, appKey, data, delay = 1000, writer = null) {
  const key = `${uid}:${appKey}`;
  const prev = timers.get(key);
  if (prev) clearTimeout(prev);
  timers.set(
    key,
    setTimeout(() => {
      saveCloud(uid, appKey, data, writer).catch((e) => {
        console.error('[cloud sync] save failed:', e);
      });
      timers.delete(key);
    }, delay)
  );
}

// 即時訂閱雲端文件變更（多裝置即時同步）。回傳 unsubscribe 函式。
// onChange(cloud, metadata)：cloud = { data, updatedAt, version, writer } 或 null（文件不存在）。
export function subscribeCloud(uid, appKey, onChange) {
  let unsub = () => {};
  let cancelled = false;
  (async () => {
    const { db } = await getFirebase();
    if (!db || cancelled) return;
    const { doc, onSnapshot } = await import('firebase/firestore');
    const ref = doc(db, 'users', uid, 'apps', appKey);
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

export function reconcile(localUpdatedAt, cloud) {
  // localUpdatedAt === 0 表示「本地這次 session 從未被使用者改動過」。
  // 在這種情況下絕對不能上傳 — 否則剛登入還沒載入雲端資料時，
  // 會把空的 local state 覆蓋雲端真實資料（歷史踩過的 bug）。
  if (localUpdatedAt === 0) {
    return cloud ? 'cloud' : 'same';
  }
  if (!cloud) return 'upload';
  if (cloud.updatedAt > localUpdatedAt) return 'cloud';
  // 同毫秒碰撞時偏向保留本地（此處 localUpdatedAt>0 表示本地這次 session 確實有改動），
  // 避免一筆與雲端寫入同毫秒的本地變更被當成 'same' 而靜默丟棄。
  return 'upload';
}
