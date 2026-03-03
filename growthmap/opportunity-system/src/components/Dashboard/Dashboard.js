import React from 'react';
import { useOpportunity } from '../../contexts/OpportunityContext';
import ProgressBar from './ProgressBar';
import OpportunityTable from './OpportunityTable';
import { exportToPdf } from '../../utils/pdfExport';

export default function Dashboard() {
  const { state, dispatch } = useOpportunity();
  const { opportunities } = state;

  const handleAdd = () => dispatch({ type: 'ADD_OPPORTUNITY' });

  const handleExport = () => {
    if (opportunities.length === 0) {
      alert('請先建立至少一個增長機會再匯出。');
      return;
    }
    exportToPdf(opportunities);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-50 to-slate-100">
      {/* Header */}
      <header className="bg-navy-900 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4 mb-2">
            <a
              href="/"
              className="flex items-center gap-1.5 text-sm text-navy-200 hover:text-white transition-colors"
              style={{ color: '#94a3b8' }}
            >
              <span>←</span>
              <span>返回藍圖</span>
            </a>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            202601 BW CEO Workshop — Class 3 作業
          </h1>
          <p className="text-navy-200 mt-1 text-sm">
            BW CEO 成長機會探索系統 · Opportunity Identification System
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* 提示 */}
        <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-r-lg">
          <div className="flex items-start">
            <span className="text-amber-500 mr-2 text-lg">⚠️</span>
            <p className="text-amber-800 text-sm font-medium">
              溫馨提醒：現階段為「破框」，請先不考慮資源限制，大鳴大放找機會！
            </p>
          </div>
        </div>

        {/* 進度列 */}
        <div className="bg-white rounded-xl shadow-sm border border-navy-100 p-6">
          <ProgressBar count={opportunities.length} />
        </div>

        {/* 動作按鈕 */}
        <div className="flex gap-3">
          <button
            onClick={handleAdd}
            className="inline-flex items-center px-5 py-2.5 bg-emerald-600 text-white font-semibold rounded-lg shadow hover:bg-emerald-700 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
          >
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            新增增長機會
          </button>
          <button
            onClick={handleExport}
            className="inline-flex items-center px-5 py-2.5 bg-navy-700 text-white font-semibold rounded-lg shadow hover:bg-navy-800 transition-colors focus:outline-none focus:ring-2 focus:ring-navy-500 focus:ring-offset-2"
          >
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            匯出作業為 PDF
          </button>
        </div>

        {/* 清單表格 */}
        <div className="bg-white rounded-xl shadow-sm border border-navy-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-navy-100">
            <h2 className="text-lg font-semibold text-navy-900">
              增長機會長清單 (Long-list)
            </h2>
          </div>
          <OpportunityTable />
        </div>
      </main>
    </div>
  );
}
