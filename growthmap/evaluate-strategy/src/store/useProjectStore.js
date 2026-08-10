// 選定專案的即時狀態（zustand）：專案文件＋六個子集合的 onSnapshot 綁定。
// 所有寫入走 lib/db.js；本 store 只當雲端資料的即時鏡像，不做樂觀本地改寫——
// Firestore SDK 的 latency compensation 已提供本地即時回饋。

import { create } from 'zustand';
import { subscribeProjectDoc, subscribeSubcollection, subscribeScores } from '../lib/db';

const SUB_SORTERS = {
  opportunities: (a, b) => (a.no || 0) - (b.no || 0),
  rounds: (a, b) => (a.n || 0) - (b.n || 0),
  scores: (a, b) => (a.updatedAt || 0) - (b.updatedAt || 0),
  plays: (a, b) => (a.createdAt || 0) - (b.createdAt || 0),
  assumptions: (a, b) => (b.createdAt || 0) - (a.createdAt || 0),
  handoffs: (a, b) => (b.version || 0) - (a.version || 0),
  workshops: (a, b) => (a.n || 0) - (b.n || 0),
  wsOpinions: (a, b) => (a.createdAt || 0) - (b.createdAt || 0),
  comments: (a, b) => (b.createdAt || 0) - (a.createdAt || 0),
  aiLogs: (a, b) => (b.createdAt || 0) - (a.createdAt || 0),
};

const EMPTY_SUBS = Object.fromEntries(Object.keys(SUB_SORTERS).map((k) => [k, []]));

export const useProjectStore = create((set, get) => ({
  pid: null,
  project: null,      // null＝載入中或不存在；ready 後仍 null＝已被刪除/無權限
  projectLoaded: false,
  ...EMPTY_SUBS,
  error: null,
  _unsubs: [],

  bind(pid, uid) {
    const state = get();
    if (state.pid === pid) return;
    state._unsubs.forEach((u) => u?.());
    if (!pid) {
      set({ pid: null, project: null, projectLoaded: false, error: null, _unsubs: [], ...EMPTY_SUBS });
      return;
    }
    const onError = (err) => set({ error: err?.message || String(err) });
    const unsubs = [
      subscribeProjectDoc(pid, (project) => set({ project, projectLoaded: true }), onError),
      ...Object.keys(SUB_SORTERS).filter((s) => s !== 'scores').map((sub) =>
        subscribeSubcollection(pid, sub, (rows) => {
          rows.sort(SUB_SORTERS[sub]);
          set({ [sub]: rows });
        }, onError)
      ),
      // scores 走盲評雙查詢（已提交全員＋自己的草稿）
      subscribeScores(pid, uid, (rows) => {
        rows.sort(SUB_SORTERS.scores);
        set({ scores: rows });
      }, onError),
    ];
    set({ pid, project: null, projectLoaded: false, error: null, _unsubs: unsubs, ...EMPTY_SUBS });
  },

  unbind() {
    get()._unsubs.forEach((u) => u?.());
    set({ pid: null, project: null, projectLoaded: false, error: null, _unsubs: [], ...EMPTY_SUBS });
  },
}));

// 目前使用者在專案中的角色；非成員回 null
export function roleOf(project, uid) {
  return project?.members?.[uid]?.role || null;
}
