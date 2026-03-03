'use client';

import { useRef, useCallback } from 'react';
import { useAssignmentStore } from '@/store/useAssignmentStore';
import WaterfallChart from '@/components/charts/WaterfallChart';

export default function Step4Future() {
  const drivers = useAssignmentStore((s) => s.drivers);
  const chartRef = useRef<HTMLDivElement>(null);

  const handleExportPNG = useCallback(async () => {
    if (!chartRef.current) return;
    const canvas = chartRef.current.querySelector('canvas');
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = 'growth-map-future.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">未來預測瀑布圖</h2>
          <p className="text-sm text-gray-500 mt-1">
            根據 Step 2 設定的未來假設，預測各驅動因子對營收成長的貢獻。
          </p>
        </div>
        <button
          onClick={handleExportPNG}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-[#00A651] text-white hover:bg-[#00A651]/90 transition-all flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          匯出 PNG
        </button>
      </div>
      <div ref={chartRef}>
        <WaterfallChart
          drivers={drivers}
          mode="future"
          title="未來營收成長預測"
        />
      </div>
    </div>
  );
}
