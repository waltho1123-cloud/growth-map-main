import { loadCloud } from './sync';
import { DEFAULT_CURRENCY } from '../../utils/constants';

// MOD-08：讀取第二堂（加速增長情境 / Orient）雲端資料，萃取差距儀表所需。
// 第二堂 Firestore：users/{uid}/apps/aspiration
//   data.companyInfo.naturalGrowth.targetRevenue2028   → Momentum（自然增長）
//   data.companyInfo.aspirationGrowth.targetRevenue2028 → Aspiration（加速增長）
//   data.partA                                          → 營收拆解（revenue-breakdown）
export async function loadOrientSnapshot(uid) {
  const cloud = await loadCloud(uid, 'aspiration');
  if (!cloud || !cloud.data) return null;
  const ci = cloud.data.companyInfo || {};
  const momentum = Number(ci.naturalGrowth?.targetRevenue2028) || 0;
  const aspiration = Number(ci.aspirationGrowth?.targetRevenue2028) || 0;
  return {
    aspiration,
    momentum,
    growthGap: Math.max(aspiration - momentum, 0),
    revenue2025: Number(ci.revenue2025) || 0,
    companyName: ci.name || '',
    currency: DEFAULT_CURRENCY,
    revenueBreakdown: Array.isArray(cloud.data.partA) ? cloud.data.partA : [],
    syncedAt: Date.now(),
  };
}
