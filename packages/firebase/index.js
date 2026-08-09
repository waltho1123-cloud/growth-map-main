// @growthmap/firebase — 三單元共用的 Firebase 層唯一正本（Phase 2d）。
//
// 歷史：config／lazy init／auth 曾在三單元各複製一份；2026-08-09 盤點確認三份
// 語意完全相同（差異僅 TS 型別註記），純複製合一、零行為變更。
// AuthWidget（登入按鈕 UI）刻意留在各單元——樣式與版位是單元自主範圍。

import { useEffect, useState } from 'react';

// ── config ────────────────────────────────────────────────────────────────────
// Firebase web config — these values are PUBLIC by design.
// Real security is enforced by Firestore security rules, not by hiding this.
export const firebaseConfig = {
  apiKey: 'AIzaSyANpkc1-X1-1VMiPjZLkw_2CeOhc2BVzfk',
  authDomain: 'growth-map-main.firebaseapp.com',
  projectId: 'growth-map-main',
  storageBucket: 'growth-map-main.firebasestorage.app',
  messagingSenderId: '421192696889',
  appId: '1:421192696889:web:ea0d2b14a63709207c79e8',
};

export const isFirebaseConfigured = firebaseConfig.apiKey !== 'REPLACE_ME';

// ── lazy init ─────────────────────────────────────────────────────────────────
let app = null;
let authInstance = null;
let dbInstance = null;
let initPromise = null;

export async function getFirebase() {
  if (!isFirebaseConfigured) return { app: null, auth: null, db: null };
  if (app) return { app, auth: authInstance, db: dbInstance };
  if (!initPromise) {
    initPromise = (async () => {
      const [{ initializeApp, getApps }, { getAuth }, { getFirestore }] = await Promise.all([
        import('firebase/app'),
        import('firebase/auth'),
        import('firebase/firestore'),
      ]);
      app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
      authInstance = getAuth(app);
      dbInstance = getFirestore(app);
    })();
  }
  await initPromise;
  return { app, auth: authInstance, db: dbInstance };
}

// ── auth ──────────────────────────────────────────────────────────────────────
export async function signInWithGoogle() {
  const { auth } = await getFirebase();
  if (!auth) throw new Error('Firebase not configured');
  const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

export async function signOut() {
  const { auth } = await getFirebase();
  if (!auth) return;
  const { signOut: fbSignOut } = await import('firebase/auth');
  await fbSignOut(auth);
}

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsub;
    (async () => {
      const { auth } = await getFirebase();
      if (!auth) {
        setLoading(false);
        return;
      }
      const { onAuthStateChanged } = await import('firebase/auth');
      unsub = onAuthStateChanged(auth, (u) => {
        setUser(u);
        setLoading(false);
      });
    })();
    return () => { if (unsub) unsub(); };
  }, []);

  return { user, loading };
}
