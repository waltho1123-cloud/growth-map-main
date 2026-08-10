import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { installChunkReloadRecovery } from '@growthmap/cloud'
import { RECOVERY_KEYS } from '@growthmap/contracts'
import { AppErrorBoundary } from '@growthmap/ui'
import './index.css'
import App from './App.jsx'

installChunkReloadRecovery({
  reloadKey: RECOVERY_KEYS.evaluate.reload,
  flushTsKey: RECOVERY_KEYS.evaluate.flushTs,
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
)
