import { Suspense, lazy } from 'react';

// next/dynamic(ssr:false) → React.lazy：Vite 無 SSR，僅保留分塊載入的效果。
const AuthWidget = lazy(() =>
  import('@/components/AuthWidget').then((m) => ({ default: m.AuthWidget }))
);
const CloudSyncBootstrap = lazy(() =>
  import('@/lib/cloud/CloudSyncBootstrap').then((m) => ({ default: m.CloudSyncBootstrap }))
);

export function CloudProvider() {
  return (
    <Suspense fallback={null}>
      <CloudSyncBootstrap />
      <AuthWidget />
    </Suspense>
  );
}
