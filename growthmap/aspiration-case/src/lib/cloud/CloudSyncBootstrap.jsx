import { useEffect, useRef } from 'react';
import { useAuth } from './auth';
import { subscribeCloud, saveCloudDebounced, reconcile } from './sync';
import { consumeFlushTs } from '@growthmap/cloud';
import { useAspirationStore } from '../../store/useAspirationStore';
import { isFirebaseConfigured } from './firebase-config';
import { APP_KEYS, assertOrientProducerShape } from '@growthmap/contracts';

const FLUSH_TS_KEY = 'asp-flush-ts';

function snapshot() {
  const s = useAspirationStore.getState();
  const snap = {
    companyInfo: s.companyInfo,
    partA: s.partA,
    partB: s.partB,
    partC: s.partC,
  };
  // dev 守衛：第三堂（opportunity-system）跨單元讀這份文件的 orient 契約欄位。
  // store 改掉契約欄位名時在開發期立即炸出明確錯誤，而非等下游儀表靜默歸零。
  if (import.meta.env.DEV) assertOrientProducerShape(snap);
  return snap;
}

// 內容簽章：分辨「使用者編輯」與「套用/回送的雲端快照」，防止多裝置間把
// 收到的快照又回寫雲端而成迴圈（與 opportunity-system 的 dataSig 同一機制）。
const dataSig = (snap) => JSON.stringify(snap);

// 2026-08（Phase 2b-ii）：onSnapshot 即時訂閱，行為對齊 opportunity-system——
// 其他裝置的變更約 1 秒自動套用。防迴授四層：hasPendingWrites／writer=clientId／
// applying 旗標／內容簽章。
export function CloudSyncBootstrap() {
  const { user } = useAuth();
  const localTsRef = useRef(0);
  const applyingRef = useRef(false);
  const reconciledRef = useRef(false);
  const lastCloudSigRef = useRef('');
  // 本裝置 session 識別碼：供訂閱端略過「自己寫入後由伺服器回送」的快照（防迴授）。
  const clientIdRef = useRef(null);
  if (clientIdRef.current === null) {
    clientIdRef.current = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `c-${Math.random().toString(36).slice(2)}`;
  }
  // 部署切換自動重載後：以 flush 時間戳作為 localTs（本地 zustand persist 是同步寫入、
  // 資料必定最新），否則 localTs=0 會讓 reconcile 用較舊的雲端資料蓋回本地。
  const flushInitRef = useRef(false);
  if (!flushInitRef.current) {
    flushInitRef.current = true;
    const t = consumeFlushTs(FLUSH_TS_KEY);
    if (t) localTsRef.current = t;
  }

  // 追蹤本地最後改動時間（套用雲端快照時不算改動）
  useEffect(() => {
    const unsub = useAspirationStore.subscribe(() => {
      if (applyingRef.current) return;
      localTsRef.current = Date.now();
    });
    return unsub;
  }, []);

  // 登入時：即時訂閱雲端文件。第一筆快照等同原本的一次性 reconcile。
  useEffect(() => {
    reconciledRef.current = false;
    if (!isFirebaseConfigured || !user) return;
    const unsub = subscribeCloud(user.uid, APP_KEYS.aspiration, (cloud, meta) => {
      if (meta && meta.hasPendingWrites) return;
      if (cloud && cloud.writer === clientIdRef.current) {
        if (cloud.updatedAt > localTsRef.current) localTsRef.current = cloud.updatedAt;
        reconciledRef.current = true;
        return;
      }
      const decision = reconcile(localTsRef.current, cloud);
      if (decision === 'cloud' && cloud && cloud.data) {
        applyingRef.current = true;
        useAspirationStore.getState().applySnapshot(cloud.data);
        lastCloudSigRef.current = dataSig(snapshot()); // 以套用後的正規形狀記簽章
        localTsRef.current = cloud.updatedAt;
        applyingRef.current = false;
      } else if (decision === 'upload') {
        const snap = snapshot();
        lastCloudSigRef.current = dataSig(snap);
        saveCloudDebounced(user.uid, APP_KEYS.aspiration, snap, 0, clientIdRef.current);
      }
      reconciledRef.current = true;
    });
    return () => unsub();
  }, [user]);

  // 變更即推送（登入且完成首次 reconcile 後）；簽章相同代表是快照回放而非新編輯，略過
  useEffect(() => {
    if (!isFirebaseConfigured || !user) return;
    const unsub = useAspirationStore.subscribe(() => {
      if (applyingRef.current) return;
      if (!reconciledRef.current) return;
      const snap = snapshot();
      const sig = dataSig(snap);
      if (sig === lastCloudSigRef.current) return;
      lastCloudSigRef.current = sig;
      saveCloudDebounced(user.uid, APP_KEYS.aspiration, snap, 1000, clientIdRef.current);
    });
    return unsub;
  }, [user]);

  return null;
}
