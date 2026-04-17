import { useEffect, useRef } from 'react';
import { useAuth } from './auth';
import { loadCloud, saveCloudDebounced, reconcile } from './sync';
import { useAspirationStore } from '../../store/useAspirationStore';
import { isFirebaseConfigured } from './firebase-config';

function snapshot() {
  const s = useAspirationStore.getState();
  return {
    companyInfo: s.companyInfo,
    partA: s.partA,
    partB: s.partB,
    partC: s.partC,
  };
}

export function CloudSyncBootstrap() {
  const { user } = useAuth();
  const localTsRef = useRef(0);
  const applyingRef = useRef(false);
  const reconciledRef = useRef(false);

  useEffect(() => {
    const unsub = useAspirationStore.subscribe(() => {
      if (applyingRef.current) return;
      localTsRef.current = Date.now();
    });
    return unsub;
  }, []);

  useEffect(() => {
    reconciledRef.current = false;
    if (!isFirebaseConfigured || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const cloud = await loadCloud(user.uid, 'aspiration');
        if (cancelled) return;
        const decision = reconcile(localTsRef.current, cloud);
        if (decision === 'cloud' && cloud) {
          applyingRef.current = true;
          useAspirationStore.getState().applySnapshot(cloud.data);
          localTsRef.current = cloud.updatedAt;
          applyingRef.current = false;
        } else if (decision === 'upload') {
          saveCloudDebounced(user.uid, 'aspiration', snapshot(), 0);
        }
        reconciledRef.current = true;
      } catch (e) {
        console.error('[aspiration cloud sync] reconcile failed:', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!isFirebaseConfigured || !user) return;
    const unsub = useAspirationStore.subscribe(() => {
      if (applyingRef.current) return;
      if (!reconciledRef.current) return;
      saveCloudDebounced(user.uid, 'aspiration', snapshot());
    });
    return unsub;
  }, [user]);

  return null;
}
