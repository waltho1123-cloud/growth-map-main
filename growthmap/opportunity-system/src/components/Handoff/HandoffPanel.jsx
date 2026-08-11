import React from 'react';
import { useOpportunity } from '../../contexts/OpportunityContext';
import { useNav } from '../../contexts/NavContext';
import { canHandoff } from '../../utils/checkEngine';
import { isShortlisted } from '../../utils/opportunityStatus';
import { buildHandoffSnapshot, downloadJson } from '../../utils/handoff';
import toast from 'react-hot-toast';

function fmt(n) {
  return new Intl.NumberFormat('zh-TW').format(Math.round(Number(n) || 0));
}

export default function HandoffPanel() {
  const { state, dispatch } = useOpportunity();
  const { goDashboard, goCheck } = useNav();
  const checkRun = state.lastCheckRun;
  const ready = canHandoff(checkRun);
  const shortlisted = state.opportunities.filter(isShortlisted);
  const snapshots = state.longlistSnapshots || [];
  const sumRevenue = shortlisted.reduce((a, o) => a + (Number(o.estRevenue) || 0), 0);

  const handleHandoff = () => {
    if (!ready) {
      toast.error('需先通過綜合檢查 P0（CHK-1~3）才能交付');
      return;
    }
    if (shortlisted.length === 0) {
      toast.error('長清單為空，請先納入機會');
      return;
    }
    const version = snapshots.length + 1;
    const snap = buildHandoffSnapshot(state, version);
    dispatch({ type: 'ADD_SNAPSHOT', payload: snap });
    toast.success(`已交付第四堂（v${version}）：快照已凍結，可至第四堂承接`);
  };

  const handleDownload = (snap) => downloadJson(`growth-longlist-v${snap.version}.json`, snap);

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
          <h1 className="text-2xl font-bold tracking-tight text-gray-800">交付輸出</h1>
          <p className="text-gray-500 mt-1 text-sm">凍結長清單版本供第四堂承接（已交付快照不可變，續編產生新版本；如需本地副本可於下方逐版下載）。</p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* 交付就緒狀態 */}
        <div className={`rounded-xl p-4 border-l-4 ${ready ? 'bg-emerald-50/70 border-emerald-400' : 'bg-red-50/60 border-red-400'}`}>
          {ready ? (
            <p className="text-sm font-medium text-emerald-800">✓ 綜合檢查 P0（CHK-1~3）已通過，可交付第四堂。</p>
          ) : (
            <p className="text-sm font-medium text-red-700">
              ✗ 尚未可交付：需先通過綜合檢查 P0（CHK-1~3）。
              <button onClick={goCheck} className="ml-2 underline">前往綜合檢查</button>
            </p>
          )}
        </div>

        {/* 長清單摘要 */}
        <div className="glass-card rounded-xl p-5">
          <h3 className="text-sm font-bold text-gray-800 mb-3">本次交付內容</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-500">長清單機會數</p>
              <p className="text-xl font-bold text-gray-800">{shortlisted.length}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">預估營收總和</p>
              <p className="text-xl font-bold text-emerald-700">{fmt(sumRevenue)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">成長差距</p>
              <p className="text-xl font-bold text-amber-600">{state.projectMeta.targetSnapshot ? fmt(state.projectMeta.targetSnapshot.growthGap) : '—'}</p>
            </div>
          </div>
          <button
            onClick={handleHandoff}
            disabled={!ready || shortlisted.length === 0}
            className={`mt-5 inline-flex items-center px-5 py-2.5 font-semibold rounded-lg shadow transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              ready && shortlisted.length > 0
                ? 'bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-500'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            交付第四堂
          </button>
        </div>

        {/* 已交付版本（不可變快照） */}
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-800">已交付版本</h3>
            {snapshots.length > 0 && (
              <a
                href="/growthmap/evaluate-strategy/dist/"
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 transition-colors"
              >
                前往第四堂評估 →
              </a>
            )}
          </div>
          {snapshots.length === 0 ? (
            <p className="text-sm text-gray-400">尚無交付紀錄。</p>
          ) : (
            <div className="space-y-2">
              {[...snapshots].reverse().map((snap) => (
                <div key={snap.version} className="flex items-center justify-between py-2 border-b border-gray-100/60 last:border-0">
                  <div>
                    <span className="font-semibold text-gray-800 text-sm">v{snap.version}</span>
                    <span className="text-xs text-gray-400 ml-2">{new Date(snap.frozenAt).toLocaleString('zh-TW')} · {snap.opportunities.length} 個機會</span>
                  </div>
                  <button onClick={() => handleDownload(snap)} className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors">
                    下載 JSON
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <p className="text-xs text-gray-400">PDF 輸出可於長清單首頁的「匯出為 PDF」取得。</p>
      </main>
    </div>
  );
}
