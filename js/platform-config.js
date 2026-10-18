// Portal 層（無建置頁）呼叫後端用的基底網址。建置型單元走 VITE_AI_BASE_URL（建置時注入），
// 靜態頁無法讀 Vite 變數，故在此寫死線上後端；本機測管理頁時後端 ALLOWED_ORIGINS 須含本機 origin。
// 2026-10 W2 搬遷（Zeabur→Vultr）：改為新網域；建置型單元的 VITE_AI_BASE_URL 要用同一個值重建（見 CLAUDE.md 常用指令）。
export const AI_BASE_URL = 'https://growthmap-ai.wiwiapps.com';
