import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import AppErrorBoundary from './components/AppErrorBoundary';

// 部署切換後，停留在舊版頁面的使用者載入 lazy chunk 會 404（雜湊已換、舊檔不保留）。
// Vite 在 preload 失敗時發 vite:preloadError：先同步 flush 未存檔的編輯（bw:flush-save，
// 由 OpportunityContext 監聽），再整頁重載換取新版。60 秒內只重載一次；第二次失敗
// 放行預設拋錯，交給 AppErrorBoundary 顯示可操作的錯誤畫面（而非白屏）。
const RELOAD_KEY = 'bw_chunk_reload_at';

// sessionStorage 可能被使用者設定封鎖（讀寫都會丟 SecurityError）——
// 封鎖時改用 URL 參數當防迴圈標記，確保恢復機制在無 storage 環境仍運作。
function readLastReloadAt() {
  try {
    return { at: Number(sessionStorage.getItem(RELOAD_KEY) || 0), persistable: true };
  } catch {
    return { at: Number(new URLSearchParams(window.location.search).get('bwreload') || 0), persistable: false };
  }
}

window.addEventListener('vite:preloadError', (event) => {
  const now = Date.now();
  const { at, persistable } = readLastReloadAt();
  if (now - at < 60000) return;
  event.preventDefault();
  window.dispatchEvent(new Event('bw:flush-save'));
  if (persistable) {
    try { sessionStorage.setItem(RELOAD_KEY, String(now)); } catch { /* 寫入失敗就退回單次 reload */ }
    window.location.reload();
  } else {
    const url = new URL(window.location.href);
    url.searchParams.set('bwreload', String(now));
    window.location.replace(url.toString());
  }
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>
);
