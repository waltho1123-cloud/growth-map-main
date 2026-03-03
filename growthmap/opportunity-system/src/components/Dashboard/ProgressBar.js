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
        <span className="text-sm font-medium text-navy-700">
          已建立 <span className="text-lg font-bold text-navy-900">{count}</span> 個機會點
        </span>
        <span className="text-sm text-navy-500">
          目標 {PROGRESS_TARGET}~{PROGRESS_MAX} 個 · {label}
        </span>
      </div>
      <div className="w-full bg-navy-100 rounded-full h-3 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
