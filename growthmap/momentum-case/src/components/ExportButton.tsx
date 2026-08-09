import { captureElementToPdf } from '@growthmap/pdf';

interface ExportButtonProps {
  stepLabel?: string;
  className?: string;
}

// 匯出管線正本在 @growthmap/pdf（與 aspiration 共用）；此處只剩 UI 與檔名/選項。
// orientation 'auto'（樹/圖表寬版轉橫式）、含 placeholder：維持本單元原有輸出行為。
export default function ExportButton({ stepLabel, className }: ExportButtonProps) {
  const handleExport = async () => {
    try {
      const safeLabel = (stepLabel ?? '總覽').replace(/[^\w一-龥 -]/g, '');
      await captureElementToPdf(document.getElementById('pdf-content'), {
        fileName: `Momentum_Case_${safeLabel}.pdf`,
        orientation: 'auto',
        includePlaceholders: true,
      });
    } catch (e) {
      console.error(e);
      alert('匯出 PDF 失敗，請重新整理後再試一次。');
    }
  };

  return (
    <button
      onClick={handleExport}
      className={
        className ??
        'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#00A651] text-white hover:bg-[#00A651]/90 transition-all'
      }
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      匯出為 PDF
    </button>
  );
}
