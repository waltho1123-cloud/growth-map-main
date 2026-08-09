import React from 'react';
import ReactDOM from 'react-dom/client';
import { installChunkReloadRecovery } from '@growthmap/cloud';
import { RECOVERY_KEYS } from '@growthmap/contracts';
import { AppErrorBoundary } from '@growthmap/ui';
import './index.css';
import App from './App';

// 部署切換恢復（實作正本在 @growthmap/cloud，三單元共用）：
// preloadError → 先觸發 bw:flush-save（OpportunityContext 同步寫 localStorage，
// 本單元的本地持久化是 300ms debounce，必須顯式 flush）→ 寫 flush 時間戳 → 重載。
// 60 秒內第二次失敗放行拋錯，交給 AppErrorBoundary 顯示可操作畫面。
installChunkReloadRecovery({
  reloadKey: RECOVERY_KEYS.opportunity.reload,
  flushTsKey: RECOVERY_KEYS.opportunity.flushTs,
  onBeforeReload: () => window.dispatchEvent(new Event('bw:flush-save')),
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>
);
