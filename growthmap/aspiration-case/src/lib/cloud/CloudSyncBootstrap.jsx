import { useEffect, useRef } from 'react';
import { useAuth } from './auth';
import { subscribeCloud, saveCloudDebounced, reconcile } from './sync';
import { consumeFlushTs, registerLocalTsProvider } from '@growthmap/cloud';
import { useAspirationStore } from '../../store/useAspirationStore';
import { isFirebaseConfigured } from './firebase-config';
import { APP_KEYS, assertOrientProducerShape } from '@growthmap/contracts';

const FLUSH_TS_KEY = 'asp-flush-ts';

// 模組層一次性消耗（非 render 期）：React 併發模式可能丟棄並重播首次 render，
// render 期的消耗性讀取會在重播時拿到 0 而遺失 priming。模組載入只執行一次，無此問題。
const INITIAL_FLUSH_TS = consumeFlushTs(FLUSH_TS_KEY);

// 純組裝，不做任何檢查——內容簽章與「套用雲端快照後」的路徑使用（快照來自雲端，
// 不得對其跑生產端 assert，否則違約文件會在 applying 窗內拋出、旗標卡死）。
function buildSnapshot() {
  const s = useAspirationStore.getState();
  return {
    companyInfo: s.companyInfo,
    partA: s.partA,
    partB: s.partB,
    partC: s.partC,
  };
}

// 上傳路徑專用：dev 守衛——本單元是 orient 契約的生產端，store 改掉契約欄位名
// 時在開發期立即炸出明確錯誤，而非等下游儀表靜默歸零。
function snapshot() {
  const snap = buildSnapshot();
  if (import.meta.env.DEV) assertOrientProducerShape(snap);
  return snap;
}

// 內容簽章：分辨「使用者編輯」與「套用/回送的雲端快照」，防止把收到的快照又回寫
// 雲端而成迴圈（與 opportunity-system 的 dataSig 同一機制）。
const dataSig = (snap) => JSON.stringify(snap);

// 2026-08（Phase 2b-ii＋兩輪審查修復）：onSnapshot 即時訂閱，防迴授四層
// （hasPendingWrites／writer=clientId／applying 旗標／內容簽章）。
// 簽章一律在 onSaved（寫入確實成功）後才記錄——先記後存會讓存檔失敗被永久視為已同步。
export function CloudSyncBootstrap() {
  const { user } = useAuth();
  const localTsRef = useRef(INITIAL_FLUSH_TS);
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

  // 向恢復機制註冊「真實最後編輯時間」：部署切換重載前寫入的是這個值，
  // 沒編輯過（0）就不寫——沉睡分頁的過期資料不得在重載後反蓋較新雲端。
  useEffect(() => {
    return registerLocalTsProvider(FLUSH_TS_KEY, () => localTsRef.current);
  }, []);

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
        try {
          useAspirationStore.getState().applySnapshot(cloud.data);
          lastCloudSigRef.current = dataSig(buildSnapshot()); // 套用後的正規形狀；內容來自雲端故可直接記
          localTsRef.current = cloud.updatedAt;
        } finally {
          applyingRef.current = false; // 任何拋出都不得讓旗標卡死（否則整個 session 停止同步）
        }
      } else if (decision === 'upload') {
        const snap = snapshot();
        const sig = dataSig(snap);
        saveCloudDebounced(user.uid, APP_KEYS.aspiration, snap, 0, clientIdRef.current, {
          onSaved: () => { lastCloudSigRef.current = sig; },
        });
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
      saveCloudDebounced(user.uid, APP_KEYS.aspiration, snap, 1000, clientIdRef.current, {
        onSaved: () => { lastCloudSigRef.current = sig; },
      });
    });
    return unsub;
  }, [user]);

  return null;
}
