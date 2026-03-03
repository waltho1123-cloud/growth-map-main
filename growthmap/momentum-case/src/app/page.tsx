'use client';

import dynamic from 'next/dynamic';

const WizardShell = dynamic(() => import('@/components/wizard/WizardShell'), {
  ssr: false,
});

export default function Home() {
  return <WizardShell />;
}
