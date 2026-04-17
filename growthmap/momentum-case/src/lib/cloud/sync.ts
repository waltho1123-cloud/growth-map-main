'use client';

import { getFirebase } from './firebase';

export type CloudDoc<T> = {
  data: T;
  updatedAt: number; // client ms timestamp for easy compare
  version: number;
};

export type AppKey = 'momentum' | 'aspiration' | 'opportunity';

export async function loadCloud<T>(uid: string, appKey: AppKey): Promise<CloudDoc<T> | null> {
  const { db } = await getFirebase();
  if (!db) return null;
  const { doc, getDoc } = await import('firebase/firestore');
  const snap = await getDoc(doc(db, 'users', uid, 'apps', appKey));
  if (!snap.exists()) return null;
  const raw = snap.data();
  return {
    data: raw.data as T,
    updatedAt: raw.updatedAtMs ?? 0,
    version: raw.version ?? 1,
  };
}

export async function saveCloud<T>(uid: string, appKey: AppKey, data: T): Promise<void> {
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

// Simple debouncer keyed by (uid, appKey)
const timers = new Map<string, ReturnType<typeof setTimeout>>();

export function saveCloudDebounced<T>(uid: string, appKey: AppKey, data: T, delay = 1000): void {
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

// Reconcile decision: "cloud" = download cloud to local; "upload" = upload local to cloud; "same" = no-op
export function reconcile(localUpdatedAt: number, cloud: CloudDoc<unknown> | null): 'cloud' | 'upload' | 'same' {
  if (!cloud) return 'upload';
  if (cloud.updatedAt > localUpdatedAt) return 'cloud';
  if (localUpdatedAt > cloud.updatedAt) return 'upload';
  return 'same';
}
