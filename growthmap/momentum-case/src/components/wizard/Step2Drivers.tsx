'use client';

import { useEffect } from 'react';
import { useAssignmentStore } from '@/store/useAssignmentStore';

export default function Step2Drivers() {
  const { drivers, updateDriver, syncDriversFromTree } = useAssignmentStore();

  useEffect(() => {
    syncDriversFromTree();
  }, [syncDriversFromTree]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-white">驅動因子設定</h2>
        <p className="text-sm text-gray-400 mt-1">
          以下為樹狀圖中的葉節點（驅動因子）。請為每個因子設定歷史貢獻度與未來假設百分比。
        </p>
      </div>

      <div className="bg-[#242442] rounded-xl border border-white/10 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left px-6 py-4 text-sm font-semibold text-gray-300">驅動因子路徑</th>
              <th className="text-center px-6 py-4 text-sm font-semibold text-gray-300 w-48">
                歷史貢獻度 (%)
              </th>
              <th className="text-center px-6 py-4 text-sm font-semibold text-gray-300 w-48">
                未來假設 (%)
              </th>
            </tr>
          </thead>
          <tbody>
            {drivers.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-6 py-12 text-center text-gray-500">
                  尚無驅動因子。請先在 Step 1 建立樹狀結構。
                </td>
              </tr>
            ) : (
              drivers.map((driver, idx) => (
                <tr
                  key={driver.id}
                  className={`border-b border-white/5 ${idx % 2 === 0 ? 'bg-white/[0.02]' : ''}`}
                >
                  <td className="px-6 py-3">
                    <span className="text-sm text-gray-300">{driver.name}</span>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <input
                        type="number"
                        value={driver.historicalContribution}
                        onChange={(e) =>
                          updateDriver(driver.id, {
                            historicalContribution: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-24 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm text-center focus:outline-none focus:border-[#00A651] transition-colors"
                        step="0.1"
                      />
                      <span className="text-gray-500 text-sm">%</span>
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <input
                        type="number"
                        value={driver.futureAssumption}
                        onChange={(e) =>
                          updateDriver(driver.id, {
                            futureAssumption: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-24 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm text-center focus:outline-none focus:border-[#00A651] transition-colors"
                        step="0.1"
                      />
                      <span className="text-gray-500 text-sm">%</span>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {drivers.length > 0 && (
        <div className="flex gap-8 text-sm text-gray-400">
          <div>
            歷史貢獻度合計：
            <span className={`font-semibold ml-1 ${Math.abs(drivers.reduce((s, d) => s + d.historicalContribution, 0) - 100) < 0.1 ? 'text-[#22C55E]' : 'text-amber-400'}`}>
              {drivers.reduce((s, d) => s + d.historicalContribution, 0).toFixed(1)}%
            </span>
          </div>
          <div>
            未來假設合計：
            <span className={`font-semibold ml-1 ${Math.abs(drivers.reduce((s, d) => s + d.futureAssumption, 0) - 100) < 0.1 ? 'text-[#22C55E]' : 'text-amber-400'}`}>
              {drivers.reduce((s, d) => s + d.futureAssumption, 0).toFixed(1)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
