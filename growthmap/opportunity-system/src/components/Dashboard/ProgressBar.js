import React from 'react';
import { PROGRESS_TARGET, PROGRESS_MAX } from '../../utils/constants';

export default function ProgressBar({ count }) {
  const percentage = Math.min((count / PROGRESS_MAX) * 100, 100);

  let barColor = 'bg-red-400';
  let label = '加油！';
  if (count >= PROGRESS_TARGET) {
    barColor = 'bg-emerald-500';
    label = '達標！';
  } else if (count >= 7) {
    barColor = 'bg-emerald-400';
    label = '接近目標';
  } else if (count >= 4) {
    barColor = 'bg-yellow-400';
    label = '持續加油';
  }

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm font-medium text-gray-600">
          已建立 <span className="text-lg font-bold text-gray-800">{count}</span> 個機會點
        </span>
        <span className="text-sm text-gray-500">
          目標 {PROGRESS_TARGET}~{PROGRESS_MAX} 個 · {label}
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
