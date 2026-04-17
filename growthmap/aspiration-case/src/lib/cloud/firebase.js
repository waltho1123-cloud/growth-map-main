import { firebaseConfig, isFirebaseConfigured } from './firebase-config';

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
