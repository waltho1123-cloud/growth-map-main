import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { firebaseConfig, isFirebaseConfigured } from './firebase-config';

let app = null;
let authInstance = null;
let dbInstance = null;

export function getFirebase() {
  if (!isFirebaseConfigured) return { app: null, auth: null, db: null };
  if (!app) {
    app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    authInstance = getAuth(app);
    dbInstance = getFirestore(app);
  }
  return { app, auth: authInstance, db: dbInstance };
}
