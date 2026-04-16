import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getFirebase } from './firebase';

export async function loadCloud(uid, appKey) {
  const { db } = getFirebase();
  if (!db) return null;
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
  const { db } = getFirebase();
  if (!db) return;
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
  if (!cloud) return 'upload';
  if (cloud.updatedAt > localUpdatedAt) return 'cloud';
  if (localUpdatedAt > cloud.updatedAt) return 'upload';
  return 'same';
}
