import React, { useState } from 'react';
import { useOpportunity } from '../../contexts/OpportunityContext';
import { useNav } from '../../contexts/NavContext';
import { computeChecks, canHandoff } from '../../utils/checkEngine';
import toast from 'react-hot-toast';

const STATUS_META = {
  pass: { label: '通過', dot: 'bg-emerald-500', text: 'text-emerald-700', border: 'border-emerald-400' },
  warn: { label: '警告', dot: 'bg-amber-500', text: 'text-amber-700', border: 'border-amber-400' },
  fail: { label: '未通過', dot: 'bg-red-500', text: 'text-red-700', border: 'border-red-400' },
};

function CheckResultCard({ result }) {
  const meta = STATUS_META[result.status] || STATUS_META.warn;
  const d = result.detail || {};
  const isP0 = ['CHK-1', 'CHK-2', 'CHK-3'].includes(result.code);
  return (
    <div className={`glass-card rounded-xl p-5 border-l-4 ${meta.border}`}>
      <div className="flex items-center justify-between mb-2 gap-2">
        <h3 className="font-bold text-gray-800 text-sm">
          {result.code} · {result.title}
          {isP0 && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 align-middle">P0</span>}
        </h3>
        <span className={`shrink-0 inline-flex items-center gap-1.5 text-xs font-medium ${meta.text}`}>
          <span className={`w-2 h-2 rounded-full ${meta.dot}`} />{meta.label}
        </span>
      </div>
      {d.message && <p className="text-sm text-gray-600">{d.message}</p>}
      {result.code === 'CHK-3' && d.dist && (
        <div className="flex flex-wrap gap-2 mt-2">
          {Object.entries(d.dist).map(([k, v]) => (
            <span key={k} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{k}：{v}</span>
          ))}
        </div>
      )}
      {result.code === 'CHK-2' && Array.isArray(d.deviations) && d.deviations.length > 0 && (
        <p className="text-xs text-amber-600 mt-2">偏離機會：{d.deviations.join('、')}</p>
      )}
    </div>
  );
}

export default function CheckPanel() {
  const { state, dispatch } = useOpportunity();
  const { goDashboard } = useNav();
  const [running, setRunning] = useState(false);
  const checkRun = state.lastCheckRun;

  const handleRun = () => {
    setRunning(true);
    setTimeout(() => {
      const result = computeChecks(state);
      dispatch({ type: 'SET_CHECK_RUN', payload: result });
      setRunning(false);
      toast.success('已完成綜合檢查');
    }, 150);
  };

  const handoffReady = canHandoff(checkRun);

  return (
    <div className="min-h-screen">
      <header className="glass-header">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <button
            onClick={goDashboard}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors px-2 py-1.5 -ml-2 rounded-md hover:bg-gray-100 mb-2"
          >
            <span>←</span><span>返回長清單</span>
          </button>
          <h1 className="text-2xl font-bold tracking-tight text-gray-800">綜合檢查</h1>
          <p className="text-gray-500 mt-1 text-sm">CHK-1~5 檢視長清單品質；P0（CHK-1~3）全通過方可交付第四堂。</p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={handleRun}
            disabled={running}
            className={`inline-flex items-center px-5 py-2.5 bg-emerald-600 text-white font-semibold rounded-lg shadow hover:bg-emerald-700 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${running ? 'opacity-70 cursor-wait' : ''}`}
          >
            {running ? '檢查中…' : '執行綜合檢查'}
          </button>
          {checkRun && (
            <span className="text-xs text-gray-400">上次檢查：{new Date(checkRun.ranAt).toLocaleString('zh-TW')}</span>
          )}
        </div>

        {checkRun ? (
          <>
            {/* 交付就緒狀態 */}
            <div className={`rounded-xl p-4 border-l-4 ${handoffReady ? 'bg-emerald-50/70 border-emerald-400' : 'bg-red-50/60 border-red-400'}`}>
              <p className={`text-sm font-medium ${handoffReady ? 'text-emerald-800' : 'text-red-700'}`}>
                {handoffReady
                  ? '✓ P0 檢查（CHK-1~3）全部通過，已可交付第四堂（交付於「交付輸出」頁執行）。'
                  : '✗ 尚未可交付：P0 檢查（CHK-1~3）需全部通過。請依下方建議調整。'}
              </p>
            </div>

            <div className="space-y-3">
              {checkRun.results.map((r) => <CheckResultCard key={r.code} result={r} />)}
            </div>
            <p className="text-xs text-gray-400">
              提示：失敗／警告項的 AI 修正建議（AI-05）將於 AI 協作階段提供，目前顯示規則型建議。
            </p>
          </>
        ) : (
          <div className="text-sm text-gray-500 bg-amber-50/60 border-l-4 border-amber-400 p-4 rounded-r-lg">
            尚未執行綜合檢查。點擊上方「執行綜合檢查」以檢視 CHK-1~5 結果與交付就緒狀態。
          </div>
        )}
      </main>
    </div>
  );
}
