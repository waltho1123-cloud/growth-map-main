import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// 部署切換後，停留在舊版頁面的使用者載入 lazy chunk 會 404（雜湊已換、舊檔不保留）。
// Vite 在 preload 失敗時發 vite:preloadError：自動整頁重載一次換取新版。
// 60 秒內只重載一次，失敗第二次就放行預設拋錯，避免無限重載。
window.addEventListener('vite:preloadError', (event) => {
  const KEY = 'bw_chunk_reload_at';
  const last = Number(sessionStorage.getItem(KEY) || 0);
  if (Date.now() - last < 60000) return;
  sessionStorage.setItem(KEY, String(Date.now()));
  event.preventDefault();
  window.location.reload();
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
