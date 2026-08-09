import { captureElementToPdf } from '@growthmap/pdf';

// 匯出管線正本在 @growthmap/pdf（與 momentum 共用）；此處只剩 UI 與檔名/選項。
// orientation 'p'、不含 placeholder：維持本單元原有輸出行為。
export default function ExportButton() {
  const handleExport = async () => {
    try {
      await captureElementToPdf(document.getElementById('pdf-content'), {
        fileName: 'Aspiration_Case_建立情境.pdf',
        orientation: 'p',
        includePlaceholders: false,
      });
    } catch (err) {
      console.error('PDF export failed:', err);
      alert('匯出 PDF 發生錯誤：' + (err.message || err));
    }
  };

  return (
    <button
      onClick={handleExport}
      className="inline-flex items-center gap-2 bg-brand-green hover:bg-brand-green/90 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors backdrop-blur-sm cursor-pointer"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      匯出為 PDF
    </button>
  );
}
