'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from './auth';
import { loadCloud, saveCloudDebounced, reconcile } from './sync';
import { useAssignmentStore } from '@/store/useAssignmentStore';
import { isFirebaseConfigured } from './firebase-config';

type SyncedSnapshot = {
  tree: unknown;
  drivers: unknown;
  wickedChallenges: unknown;
  currentStep: unknown;
};

function snapshot(): SyncedSnapshot {
  const s = useAssignmentStore.getState();
  return {
    tree: s.tree,
    drivers: s.drivers,
    wickedChallenges: s.wickedChallenges,
    currentStep: s.currentStep,
  };
}

// Mounted once in the root layout. Handles load-on-login and push-on-change.
export function CloudSyncBootstrap() {
  const { user } = useAuth();
  const localTsRef = useRef<number>(Date.now());
  const applyingRef = useRef(false);
  // Gate push-on-change until the initial reconcile finishes, otherwise a
  // freshly-signed-in user can overwrite cloud with local before we've loaded it.
  const reconciledRef = useRef(false);

  // Track local state "last modified" timestamp.
  useEffect(() => {
    const unsub = useAssignmentStore.subscribe(() => {
      if (applyingRef.current) return;
      localTsRef.current = Date.now();
    });
    return unsub;
  }, []);

  // On sign-in: reconcile.
  useEffect(() => {
    reconciledRef.current = false;
    if (!isFirebaseConfigured || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const cloud = await loadCloud<SyncedSnapshot>(user.uid, 'momentum');
        if (cancelled) return;
        const decision = reconcile(localTsRef.current, cloud);
        if (decision === 'cloud' && cloud) {
          applyingRef.current = true;
          useAssignmentStore.setState(cloud.data as Partial<ReturnType<typeof useAssignmentStore.getState>>);
          localTsRef.current = cloud.updatedAt;
          applyingRef.current = false;
        } else if (decision === 'upload') {
          saveCloudDebounced(user.uid, 'momentum', snapshot(), 0);
        }
        reconciledRef.current = true;
      } catch (e) {
        console.error('[momentum cloud sync] reconcile failed:', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Push on changes while signed in AND after reconcile has finished.
  useEffect(() => {
    if (!isFirebaseConfigured || !user) return;
    const unsub = useAssignmentStore.subscribe(() => {
      if (applyingRef.current) return;
      if (!reconciledRef.current) return;
      saveCloudDebounced(user.uid, 'momentum', snapshot());
    });
    return unsub;
  }, [user]);

  return null;
}
