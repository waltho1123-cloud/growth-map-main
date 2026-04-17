'use client';

import { useEffect } from 'react';
import { useAssignmentStore } from '@/store/useAssignmentStore';
import Step0Dashboard from './Step0Dashboard';
import Step1Tree from './Step1Tree';
import Step2Drivers from './Step2Drivers';
import Step3Historical from './Step3Historical';
import Step4Future from './Step4Future';
import Step5Wicked from './Step5Wicked';
import ExportButton from '@/components/ExportButton';

const STEPS = [
  { label: '總覽', shortLabel: '0' },
  { label: '營收拆解', shortLabel: '1' },
  { label: '驅動因子', shortLabel: '2' },
  { label: '歷史瀑布圖', shortLabel: '3' },
  { label: '未來預測', shortLabel: '4' },
  { label: '棘手挑戰', shortLabel: '5' },
];

export default function WizardShell() {
  const { currentStep, setCurrentStep } = useAssignmentStore();

  // Prefetch ECharts chunk in background so Step 3/4 render instantly
  useEffect(() => {
    const timer = setTimeout(() => {
      import('@/components/charts/WaterfallChart');
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  const renderStep = () => {
    switch (currentStep) {
      case 0: return <Step0Dashboard />;
      case 1: return <Step1Tree />;
      case 2: return <Step2Drivers />;
      case 3: return <Step3Historical />;
      case 4: return <Step4Future />;
      case 5: return <Step5Wicked />;
      default: return <Step0Dashboard />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="glass-header px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-4">
            <a
              href="/"
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors shrink-0"
            >
              <span>←</span>
              <span>返回藍圖</span>
            </a>
            <div className="w-px h-8 bg-gray-200 hidden sm:block" />
            <div>
              <h1 className="text-xl font-bold text-gray-800">
                <span className="text-[#00A651]">BW</span> 成長藍圖實作平台
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">建立自然增長情境(Momentum Case)</p>
            </div>
          </div>
          <div className="text-sm text-gray-500">
            Step {currentStep} / {STEPS.length - 1}
          </div>
        </div>
      </header>

      {/* Progress Bar */}
      <nav className="glass-header px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-1 overflow-x-auto">
            {STEPS.map((step, i) => (
              <button
                key={i}
                onClick={() => setCurrentStep(i)}
                className={`
                  flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all
                  ${i === currentStep
                    ? 'bg-[#00A651] text-white'
                    : i < currentStep
                      ? 'bg-[#00A651]/20 text-[#00A651] hover:bg-[#00A651]/30'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }
                `}
              >
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs border border-current">
                  {i < currentStep ? '✓' : step.shortLabel}
                </span>
                <span className="hidden sm:inline">{step.label}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1 overflow-auto">
        <div id="pdf-content" className="max-w-7xl mx-auto px-6 py-6">
          <div className="print-step-title hidden">
            <h1 className="text-2xl font-bold text-gray-800">
              建立自然增長情境 — Step {currentStep}. {STEPS[currentStep]?.label}
            </h1>
          </div>
          {renderStep()}
        </div>
      </main>

      {/* Bottom Navigation */}
      <footer className="glass-header px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 flex-wrap">
          <button
            onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
            disabled={currentStep === 0}
            className="px-5 py-2.5 rounded-lg text-sm font-medium bg-white/50 text-gray-600 hover:bg-white/70 border border-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            ← 上一步
          </button>
          <ExportButton stepLabel={`${currentStep}_${STEPS[currentStep]?.label ?? ''}`} />
          <button
            onClick={() => setCurrentStep(Math.min(STEPS.length - 1, currentStep + 1))}
            disabled={currentStep === STEPS.length - 1}
            className="px-5 py-2.5 rounded-lg text-sm font-medium bg-[#00A651] text-white hover:bg-[#00A651]/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            下一步 →
          </button>
        </div>
      </footer>
    </div>
  );
}
