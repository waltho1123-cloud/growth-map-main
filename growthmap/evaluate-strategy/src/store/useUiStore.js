// UI 層狀態（右側抽屜等；PRD 7.2.1 區 D——同時僅開一個）

import { create } from 'zustand';

export const useUiStore = create((set) => ({
  drawer: null, // null | { type: 'assumptions', ref, label }
  openAssumptions(ref = null, label = '') {
    set({ drawer: { type: 'assumptions', ref, label } });
  },
  closeDrawer() {
    set({ drawer: null });
  },
}));
