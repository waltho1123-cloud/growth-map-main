import { Suspense, lazy } from 'react';
import { CloudProvider } from '@/components/CloudProvider';
import Loading from '@/app/loading';

// 主畫面 lazy 載入（沿用 Next 時代的分塊策略）；index.html 的 #app-loading
// overlay 蓋在最上層，WizardShell 掛載時自行移除。
const WizardShell = lazy(() => import('@/components/wizard/WizardShell'));

export default function App() {
  return (
    <>
      <CloudProvider />
      <Suspense fallback={<Loading />}>
        <WizardShell />
      </Suspense>
    </>
  );
}
