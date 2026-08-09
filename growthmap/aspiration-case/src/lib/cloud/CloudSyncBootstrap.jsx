import { createCloudSyncBootstrap, consumeFlushTs } from '@growthmap/cloud';
import { APP_KEYS, RECOVERY_KEYS, assertOrientProducerShape } from '@growthmap/contracts';
import { subscribeCloud, saveCloudDebounced } from './sync';
import { useAuth } from './auth';
import { isFirebaseConfigured } from './firebase-config';
import { useAspirationStore } from '../../store/useAspirationStore';

// 同步控制器正本在 @growthmap/cloud 的 createCloudSyncBootstrap（與 momentum 共用，
// 防迴授四層＋onSaved 簽章＋部署恢復 priming）；本檔只剩單元專屬的宣告式 config。
// 模組層一次性消耗 flush-ts（免 React 併發 render 重播問題）。
const INITIAL_LOCAL_TS = consumeFlushTs(RECOVERY_KEYS.aspiration.flushTs);

export const CloudSyncBootstrap = createCloudSyncBootstrap({
  appKey: APP_KEYS.aspiration,
  flushTsKey: RECOVERY_KEYS.aspiration.flushTs,
  initialLocalTs: INITIAL_LOCAL_TS,
  useAuth,
  isConfigured: isFirebaseConfigured,
  sync: { subscribeCloud, saveCloudDebounced },
  subscribe: (listener) => useAspirationStore.subscribe(listener),
  getSnapshot: () => {
    const s = useAspirationStore.getState();
    return { companyInfo: s.companyInfo, partA: s.partA, partB: s.partB, partC: s.partC };
  },
  applySnapshot: (data) => useAspirationStore.getState().applySnapshot(data),
  // dev 守衛：本單元是 orient 契約的生產端——store 改掉契約欄位名時上傳前立即炸錯
  guardSnapshot: import.meta.env.DEV ? assertOrientProducerShape : null,
});
