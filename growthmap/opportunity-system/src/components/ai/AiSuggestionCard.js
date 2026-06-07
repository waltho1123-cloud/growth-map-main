import React from 'react';

// 通用 AI 建議卡（人在迴路）：顯示 draft 內容 + 採納/捨棄。
// 低信心（<0.6）以醒目樣式提示需逐項複核（SDD §4.5.3）。
export default function AiSuggestionCard({ loading, error, confidence, title, children, onAccept, onReject }) {
  const lowConf = typeof confidence === 'number' && confidence < 0.6;
  return (
    <div className={`rounded-xl border-l-4 p-4 mt-3 ${lowConf ? 'bg-amber-50/70 border-amber-400' : 'bg-blue-50/60 border-blue-400'}`}>
      <div className="flex items-center justify-between mb-2 gap-2">
        <span className="text-xs font-bold text-gray-700">🤖 AI 建議稿{title ? `：${title}` : ''}</span>
        {typeof confidence === 'number' && (
          <span className={`text-xs shrink-0 ${lowConf ? 'text-amber-700 font-medium' : 'text-gray-500'}`}>
            信心 {(confidence * 100).toFixed(0)}%{lowConf && ' · 需逐項複核'}
          </span>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">AI 思考中…</p>
      ) : error ? (
        <p className="text-sm text-red-500">{error}</p>
      ) : (
        <>
          <div className="text-sm text-gray-700 space-y-1.5">{children}</div>
          <div className="flex gap-2 mt-3">
            <button onClick={onAccept} className="text-xs font-medium px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">
              採納
            </button>
            <button onClick={onReject} className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors">
              捨棄
            </button>
          </div>
        </>
      )}
    </div>
  );
}
