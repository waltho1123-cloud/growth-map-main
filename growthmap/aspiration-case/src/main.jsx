import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { installChunkReloadRecovery } from '@growthmap/cloud'
import { RECOVERY_KEYS } from '@growthmap/contracts'
import { AppErrorBoundary } from '@growthmap/ui'
import './index.css'
import App from './App.jsx'

// 部署切換恢復（實作正本在 @growthmap/cloud，三單元共用）：
// 本單元的本地持久化是 zustand persist（同步寫 localStorage），不需 flush 回呼；
// 只需 flush 時間戳讓重載後的 bootstrap 以它作為 localTs（否則雲端舊資料會蓋回本地）。
installChunkReloadRecovery({
  reloadKey: RECOVERY_KEYS.aspiration.reload,
  flushTsKey: RECOVERY_KEYS.aspiration.flushTs,
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
)
