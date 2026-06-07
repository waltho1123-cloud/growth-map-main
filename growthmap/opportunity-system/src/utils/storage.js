import { migrateData } from './schema';

const STORAGE_KEY = 'bw-ceo-opportunities';

// 載入完整 app data（含 opportunities / projectMeta / toolAnalyses / lastCheckRun）。
// 相容舊格式：localStorage 舊值為純機會陣列時，自動包裝並 migrate。
export function loadAppData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return migrateData(null);
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return migrateData({ opportunities: parsed });
    return migrateData(parsed);
  } catch {
    return migrateData(null);
  }
}

export function saveAppData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save to localStorage:', e);
  }
}

// ── 相容舊 API（保留既有呼叫端不破壞）
export function loadOpportunities() {
  return loadAppData().opportunities;
}

export function saveOpportunities(opportunities) {
  const cur = loadAppData();
  saveAppData({ ...cur, opportunities });
}
