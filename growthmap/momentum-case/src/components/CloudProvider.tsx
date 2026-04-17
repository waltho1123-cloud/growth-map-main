'use client';

import dynamic from 'next/dynamic';

const AuthWidget = dynamic(
  () => import('@/components/AuthWidget').then((m) => m.AuthWidget),
  { ssr: false }
);
const CloudSyncBootstrap = dynamic(
  () => import('@/lib/cloud/CloudSyncBootstrap').then((m) => m.CloudSyncBootstrap),
  { ssr: false }
);

export function CloudProvider() {
  return (
    <>
      <CloudSyncBootstrap />
      <AuthWidget />
    </>
  );
}
