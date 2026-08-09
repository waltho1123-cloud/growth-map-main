import { APP_KEYS, extractOrientSnapshot } from '@growthmap/contracts';
import { loadCloud } from './sync';
import { DEFAULT_CURRENCY } from '../../utils/constants';

// MOD-08：讀取第二堂（加速增長情境 / Orient）雲端資料，萃取差距儀表所需。
// 欄位契約（第二堂寫入形狀 ↔ 本處讀取）的唯一正本在 @growthmap/contracts——
// 勿在此直接讀 data.companyInfo.* 欄位，改動形狀請先改契約包。
export async function loadOrientSnapshot(uid) {
  const cloud = await loadCloud(uid, APP_KEYS.aspiration);
  if (!cloud || !cloud.data) return null;
  const core = extractOrientSnapshot(cloud.data);
  if (!core) return null;
  return {
    ...core,
    currency: DEFAULT_CURRENCY,
    syncedAt: Date.now(),
  };
}
