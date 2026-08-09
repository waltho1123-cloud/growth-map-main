import { useEffect, useRef } from 'react';
import { useAuth } from './auth';
import { subscribeCloud, saveCloudDebounced, reconcile } from './sync';
import { useAssignmentStore } from '@/store/useAssignmentStore';
import { isFirebaseConfigured } from './firebase-config';
import { APP_KEYS } from '@growthmap/contracts';

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

// 2026-08（Phase 2b-ii）：由一次性 loadCloud+reconcile 升級為 onSnapshot 即時訂閱，
// 行為對齊 opportunity-system——其他裝置的變更約 1 秒自動套用，無需重整。
export function CloudSyncBootstrap() {
  const { user } = useAuth();
  const localTsRef = useRef<number>(0);
  const applyingRef = useRef(false);
  const reconciledRef = useRef(false);
  // 本裝置 session 識別碼：供訂閱端略過「自己寫入後由伺服器回送」的快照（防迴授）。
  const clientIdRef = useRef<string | null>(null);
  if (clientIdRef.current === null) {
    clientIdRef.current = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `c-${Math.random().toString(36).slice(2)}`;
  }

  // 追蹤本地最後改動時間（套用雲端快照時不算改動）
  useEffect(() => {
    const unsub = useAssignmentStore.subscribe(() => {
      if (applyingRef.current) return;
      localTsRef.current = Date.now();
    });
    return unsub;
  }, []);

  // 登入時：即時訂閱雲端文件。第一筆快照等同原本的一次性 reconcile；
  // 防迴授三層：hasPendingWrites（自己未確認的樂觀寫入）、writer===自己（伺服器回送）、
  // applyingRef（套用快照期間擋住回寫）。
  useEffect(() => {
    reconciledRef.current = false;
    if (!isFirebaseConfigured || !user) return;
    const unsub = subscribeCloud<SyncedSnapshot>(user.uid, APP_KEYS.momentum, (cloud, meta) => {
      if (meta && meta.hasPendingWrites) return;
      if (cloud && cloud.writer === clientIdRef.current) {
        if (cloud.updatedAt > localTsRef.current) localTsRef.current = cloud.updatedAt;
        reconciledRef.current = true;
        return;
      }
      const decision = reconcile(localTsRef.current, cloud);
      if (decision === 'cloud' && cloud && cloud.data) {
        applyingRef.current = true;
        useAssignmentStore.setState(cloud.data as Partial<ReturnType<typeof useAssignmentStore.getState>>);
        localTsRef.current = cloud.updatedAt;
        applyingRef.current = false;
      } else if (decision === 'upload') {
        saveCloudDebounced(user.uid, APP_KEYS.momentum, snapshot(), 0, clientIdRef.current);
      }
      reconciledRef.current = true;
    });
    return () => unsub();
  }, [user]);

  // 變更即推送（登入且完成首次 reconcile 後），帶 writer 識別碼供他端略過回送
  useEffect(() => {
    if (!isFirebaseConfigured || !user) return;
    const unsub = useAssignmentStore.subscribe(() => {
      if (applyingRef.current) return;
      if (!reconciledRef.current) return;
      saveCloudDebounced(user.uid, APP_KEYS.momentum, snapshot(), 1000, clientIdRef.current);
    });
    return unsub;
  }, [user]);

  return null;
}
