// 同步協定正本在 @growthmap/cloud（三單元共用單一實作）；
// 此檔僅把協定綁定到本單元的 firebase 實例，保持既有 import 路徑不變。
import { createCloudSync, reconcile } from '@growthmap/cloud';
import { getFirebase } from './firebase';

const sync = createCloudSync(getFirebase);

export const loadCloud = sync.loadCloud;
export const saveCloud = sync.saveCloud;
export const saveCloudDebounced = sync.saveCloudDebounced;
export const subscribeCloud = sync.subscribeCloud;
export { reconcile };
