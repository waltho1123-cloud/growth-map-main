import React from 'react';
import { LONGLIST_MIN, LONGLIST_MAX } from '../../utils/constants';

// count = 已納入長清單（shortlisted）數；total = 總機會數。CHK-4 合格區間 7–12。
export default function ProgressBar({ count, total }) {
  const percentage = Math.min((count / LONGLIST_MAX) * 100, 100);

  let barColor = 'bg-red-400';
  let label = '加油！';
  if (count >= LONGLIST_MIN && count <= LONGLIST_MAX) {
    barColor = 'bg-emerald-500';
    label = '已達標';
  } else if (count > LONGLIST_MAX) {
    barColor = 'bg-amber-400';
    label = '偏多，可精簡';
  } else if (count >= 5) {
    barColor = 'bg-emerald-400';
    label = '接近目標';
  } else if (count >= 3) {
    barColor = 'bg-yellow-400';
    label = '持續加油';
  }

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm font-medium text-gray-600">
          已納入長清單 <span className="text-lg font-bold text-gray-800">{count}</span> 個
          {typeof total === 'number' && <span className="text-gray-400">／共 {total} 個機會</span>}
        </span>
        <span className="text-sm text-gray-500">
          目標 {LONGLIST_MIN}~{LONGLIST_MAX} 個 · {label}
        </span>
      </div>
      <div className="w-full bg-white/40 rounded-full h-3 overflow-hidden" style={{ boxShadow: 'inset 1px 1px 3px rgba(0,0,0,0.06), inset -1px -1px 3px rgba(255,255,255,0.7)' }}>
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
