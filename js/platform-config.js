// Portal 層（無建置頁）呼叫後端用的基底網址。建置型單元走 VITE_AI_BASE_URL（建置時注入），
// 靜態頁無法讀 Vite 變數，故在此寫死線上後端；本機測管理頁時後端 ALLOWED_ORIGINS 須含本機 origin。
export const AI_BASE_URL = 'https://growthmap-ai.zeabur.app';
