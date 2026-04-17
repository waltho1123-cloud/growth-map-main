'use client';

import { useAssignmentStore } from '@/store/useAssignmentStore';
import WaterfallChart from '@/components/charts/WaterfallChart';

export default function Step3Historical() {
  const drivers = useAssignmentStore((s) => s.drivers);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">歷史瀑布圖</h2>
        <p className="text-sm text-gray-500 mt-1">
          根據 Step 2 設定的歷史貢獻度，視覺化各驅動因子對營收成長的歷史貢獻。
        </p>
      </div>
      <WaterfallChart
        drivers={drivers}
        mode="historical"
        title="歷史營收成長驅動因子分析"
      />
    </div>
  );
}
