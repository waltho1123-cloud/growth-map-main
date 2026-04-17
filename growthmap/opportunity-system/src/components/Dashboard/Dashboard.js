import React, { useState } from 'react';
import { useOpportunity } from '../../contexts/OpportunityContext';
import ProgressBar from './ProgressBar';
import OpportunityTable from './OpportunityTable';
export default function Dashboard() {
  const { state, dispatch } = useOpportunity();
  const { opportunities } = state;
  const [exporting, setExporting] = useState(false);
  const [snapshotting, setSnapshotting] = useState(false);

  const handleAdd = () => dispatch({ type: 'ADD_OPPORTUNITY' });

  const handleSnapshot = async () => {
    setSnapshotting(true);
    try {
      const { default: html2canvas } = await import('html2canvas');
      const { jsPDF } = await import('jspdf');
      const el = document.getElementById('pdf-content');
      if (!el) return;

      // Force overflow visible inline (overrides Tailwind regardless of specificity)
      const saved = el.style.cssText;
      el.style.overflow = 'visible';
      el.style.backdropFilter = 'none';
      el.style.webkitBackdropFilter = 'none';
      el.style.background = '#ffffff';
      el.style.boxShadow = 'none';
      el.style.paddingBottom = '24px';
      // Also fix inner overflow-x-auto wrapper
      const inner = el.querySelector('.overflow-x-auto');
      const innerSaved = inner ? inner.style.cssText : '';
      if (inner) inner.style.overflow = 'visible';

      // Hide 操作 column, show BCG tool legend
      el.querySelectorAll('.pdf-hide').forEach((e) => { e.style.display = 'none'; });
      el.querySelectorAll('.pdf-only').forEach((e) => { e.style.setProperty('display', 'block', 'important'); });

      // Measure AFTER overflow fix
      const w = el.scrollWidth;
      const h = el.scrollHeight;

      const canvas = await html2canvas(el, {
        scale: 2, useCORS: true, backgroundColor: '#ffffff',
        windowWidth: w, width: w, height: h,
      });

      // Restore
      el.style.cssText = saved;
      if (inner) inner.style.cssText = innerSaved;
      el.querySelectorAll('.pdf-hide').forEach((e) => { e.style.display = ''; });
      el.querySelectorAll('.pdf-only').forEach((e) => { e.style.display = 'none'; });

      // Always landscape for wide tables
      const pdf = new jsPDF('l', 'mm', 'a4');
      const pW = pdf.internal.pageSize.getWidth();
      const pH = pdf.internal.pageSize.getHeight();
      const imgH = (canvas.height * pW) / canvas.width;
      const imgData = canvas.toDataURL('image/png');
      let pos = 0;
      while (pos < imgH) {
        if (pos > 0) pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, -pos, pW, imgH);
        pos += pH;
        if (imgH - pos < 5) break;
      }
      pdf.save('Opportunity_識別機會.pdf');
    } catch (e) {
      console.error(e);
      alert('匯出 PDF 失敗，請重新整理後再試一次。');
    } finally {
      setSnapshotting(false);
    }
  };

  const handleExport = async () => {
    if (opportunities.length === 0) {
      alert('請先建立至少一個增長機會再匯出。');
      return;
    }
    setExporting(true);
    try {
      const { exportToPdf } = await import('../../utils/pdfExport');
      await exportToPdf(opportunities);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="glass-header">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4 mb-2">
            <a
              href="/"
              onClick={(e) => { e.preventDefault(); window.location.href = '/'; }}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors px-2 py-1.5 -ml-2 rounded-md hover:bg-gray-100"
            >
              <span>←</span>
              <span>返回藍圖</span>
            </a>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-800">
            <span className="text-[#00A651]">BW</span> 成長藍圖實作平台
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            識別機會(Identify Opportunities)
          </p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* 提示 */}
        <div className="bg-amber-50/80 border-l-4 border-amber-400 p-4 rounded-r-lg">
          <div className="flex items-start">
            <span className="text-amber-500 mr-2 text-lg">⚠️</span>
            <p className="text-amber-800 text-sm font-medium">
              溫馨提醒：現階段為「破框」，請先不考慮資源限制，大鳴大放找機會！
            </p>
          </div>
        </div>

        {/* 進度列 */}
        <div className="glass-card rounded-2xl p-6">
          <ProgressBar count={opportunities.length} />
        </div>

        {/* 動作按鈕 */}
        <div className="flex flex-wrap gap-3">
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
            disabled={exporting}
            className={`inline-flex items-center px-5 py-2.5 glass-card text-gray-700 font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 ${exporting ? 'opacity-70 cursor-wait' : 'hover:bg-white/70'}`}
          >
            {exporting ? (
              <svg className="w-5 h-5 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            )}
            {exporting ? '匯出中，請稍候…' : '匯出作業為 PDF'}
          </button>
        </div>

        {/* 清單表格 */}
        <div id="pdf-content" className="glass-card rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/40">
            <h2 className="text-lg font-semibold text-gray-800">
              增長機會長清單 (Long-list)
            </h2>
          </div>
          <OpportunityTable />
        </div>
      </main>

      {/* Sticky footer — 匯出為 PDF */}
      <footer className="glass-header sticky bottom-0 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-center">
          <button
            onClick={handleSnapshot}
            disabled={snapshotting}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              snapshotting
                ? 'bg-[#00A651]/70 text-white cursor-wait'
                : 'bg-[#00A651] text-white hover:bg-[#00A651]/90'
            }`}
          >
            {snapshotting ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            )}
            {snapshotting ? '匯出中，請稍候…' : '匯出為 PDF'}
          </button>
        </div>
      </footer>
    </div>
  );
}
