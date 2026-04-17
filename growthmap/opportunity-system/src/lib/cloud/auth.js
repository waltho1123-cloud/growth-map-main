import { useEffect, useState } from 'react';
import { getFirebase } from './firebase';

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
