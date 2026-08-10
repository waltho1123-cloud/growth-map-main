// 量測埋點（PRD §8.1 EVT-*）輕量落地：寫 events 子集合（append-only）。
// 沒有外部分析後端——事件存自家 Firestore，之後要算 KPI（BG-01 週期、
// AI 未編輯採納率…）直接查集合。失敗靜默（埋點不得干擾業務流）。

import { addSubDoc } from './db';

export function logEvent(pid, code, props = {}, uid = null) {
  if (!pid || !code) return;
  addSubDoc(pid, 'events', { code, props, by: uid, at: Date.now() }).catch(() => {});
}
