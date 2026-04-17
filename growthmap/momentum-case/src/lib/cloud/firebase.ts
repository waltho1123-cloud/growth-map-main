'use client';

import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import { firebaseConfig, isFirebaseConfigured } from './firebase-config';

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;
let initPromise: Promise<{ app: FirebaseApp; auth: Auth; db: Firestore }> | null = null;

export async function getFirebase(): Promise<{ app: FirebaseApp | null; auth: Auth | null; db: Firestore | null }> {
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
      return { app, auth: authInstance, db: dbInstance };
    })();
  }
  return initPromise;
}
