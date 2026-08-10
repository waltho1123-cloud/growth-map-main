// 雲端寫入狀態（TopBar「已同步」膠囊用）。
// 單元四沒有 @growthmap/cloud 的 debounce 儲存管線——寫入是即發的 Firestore
// targeted update；這裡以「在途寫入計數」呈現等效的 已同步/同步中/同步失敗。

import { create } from 'zustand';

export const useSyncStatus = create((set) => ({
  pending: 0,
  lastError: null,
  lastSyncedAt: null,
  _begin() { set((s) => ({ pending: s.pending + 1 })); },
  _end(error) {
    set((s) => ({
      pending: Math.max(0, s.pending - 1),
      lastError: error ? (error.message || String(error)) : null, // 成功清除舊錯
      ...(error ? {} : { lastSyncedAt: Date.now() }),
    }));
  },
}));

// 包裝一個寫入 promise：計數進行中、結束時記錄成敗
export function trackWrite(promise) {
  const { _begin, _end } = useSyncStatus.getState();
  _begin();
  return promise.then(
    (v) => { _end(null); return v; },
    (e) => { _end(e); throw e; }
  );
}
