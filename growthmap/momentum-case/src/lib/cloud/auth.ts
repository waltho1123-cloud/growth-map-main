'use client';

import type { User } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { getFirebase } from './firebase';

export async function signInWithGoogle(): Promise<User | null> {
  const { auth } = await getFirebase();
  if (!auth) throw new Error('Firebase not configured');
  const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

export async function signOut(): Promise<void> {
  const { auth } = await getFirebase();
  if (!auth) return;
  const { signOut: fbSignOut } = await import('firebase/auth');
  await fbSignOut(auth);
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsub: (() => void) | undefined;
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
    return () => unsub?.();
  }, []);

  return { user, loading };
}
