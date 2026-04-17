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

export async function saveCloud(uid, appKey, data) {
  const { db } = await getFirebase();
  if (!db) return;
  const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
  await setDoc(doc(db, 'users', uid, 'apps', appKey), {
    data,
    updatedAtMs: Date.now(),
    updatedAt: serverTimestamp(),
    version: 1,
  });
}

const timers = new Map();

export function saveCloudDebounced(uid, appKey, data, delay = 1000) {
  const key = `${uid}:${appKey}`;
  const prev = timers.get(key);
  if (prev) clearTimeout(prev);
  timers.set(
    key,
    setTimeout(() => {
      saveCloud(uid, appKey, data).catch((e) => {
        console.error('[cloud sync] save failed:', e);
      });
      timers.delete(key);
    }, delay)
  );
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
  if (localUpdatedAt > cloud.updatedAt) return 'upload';
  return 'same';
}
