import { AuthWidget } from '@/components/AuthWidget';
import { CloudSyncBootstrap } from '@/lib/cloud/CloudSyncBootstrap';

// 靜態 import（勿改回 React.lazy）：bootstrap 與 store 若被拆進獨立 chunk，
// 會與入口 chunk 形成循環相依，React 實例在 store chunk 執行時尚未初始化，
// 造成線上 useCallback of null 白屏（2026-08-09 Playwright smoke 抓到的 Phase 3 事故）。
// 兩個元件本來就極小，靜態載入無效能代價。
export function CloudProvider() {
  return (
    <>
      <CloudSyncBootstrap />
      <AuthWidget />
    </>
  );
}
