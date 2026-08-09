import { createCloudSyncBootstrap, consumeFlushTs } from '@growthmap/cloud';
import { APP_KEYS, RECOVERY_KEYS } from '@growthmap/contracts';
import { subscribeCloud, saveCloudDebounced } from './sync';
import { useAuth } from './auth';
import { isFirebaseConfigured } from './firebase-config';
import { useAssignmentStore } from '@/store/useAssignmentStore';

type SyncedSnapshot = {
  tree: unknown;
  drivers: unknown;
  wickedChallenges: unknown;
  currentStep: unknown;
};

// 同步控制器正本在 @growthmap/cloud 的 createCloudSyncBootstrap（與 aspiration 共用，
// 防迴授四層＋onSaved 簽章＋部署恢復 priming）；本檔只剩單元專屬的宣告式 config。
// 模組層一次性消耗 flush-ts（免 React 併發 render 重播問題）。
const INITIAL_LOCAL_TS = consumeFlushTs(RECOVERY_KEYS.momentum.flushTs);

export const CloudSyncBootstrap = createCloudSyncBootstrap<SyncedSnapshot>({
  appKey: APP_KEYS.momentum,
  flushTsKey: RECOVERY_KEYS.momentum.flushTs,
  initialLocalTs: INITIAL_LOCAL_TS,
  useAuth,
  isConfigured: isFirebaseConfigured,
  sync: { subscribeCloud, saveCloudDebounced },
  subscribe: (listener) => useAssignmentStore.subscribe(listener),
  getSnapshot: () => {
    const s = useAssignmentStore.getState();
    return { tree: s.tree, drivers: s.drivers, wickedChallenges: s.wickedChallenges, currentStep: s.currentStep };
  },
  applySnapshot: (data) =>
    useAssignmentStore.setState(data as Partial<ReturnType<typeof useAssignmentStore.getState>>),
});
