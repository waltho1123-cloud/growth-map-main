// 量測埋點（PRD §8.1 EVT-*）輕量落地：寫 events 子集合（append-only）。
// 沒有外部分析後端——事件存自家 Firestore；讀取路徑＝設定頁「匯出量測事件」
// （一次性 getDocs 下載 JSON，不做即時訂閱）。失敗靜默（埋點不得干擾業務流）。
//
// 規模裁定（對抗式審查 P2 的回應）：事件全是「按鈕級」人工操作（提交評分、
// 建方案、交付…），一輪工作坊數百筆、單專案年千筆級——遠低於需要 TTL/聚合
// 的量級；若未來接入高頻事件（欄位級編輯）再引入保留策略。

import { addSubDoc } from './db';

export function logEvent(pid, code, props = {}, uid = null) {
  if (!pid || !code) return;
  addSubDoc(pid, 'events', { code, props, by: uid, at: Date.now() }).catch(() => {});
}
