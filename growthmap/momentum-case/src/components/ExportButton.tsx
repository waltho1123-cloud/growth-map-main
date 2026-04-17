'use client';

interface ExportButtonProps {
  stepLabel?: string;
  className?: string;
}

export default function ExportButton({ stepLabel, className }: ExportButtonProps) {
  const handleExport = async () => {
    try {
      // html2canvas-pro: maintained fork with native oklch/lab/color-mix support.
      const { default: html2canvas } = await import('html2canvas-pro');
      const { jsPDF } = await import('jspdf');

      const element = document.getElementById('pdf-content') as HTMLElement | null;
      if (!element) return;

      // Replace inputs/textareas with styled divs so html2canvas captures full text
      // (inputs clip text beyond visible width; divs wrap naturally)
      const formEls = element.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
        'input, textarea, select'
      );
      const restore: Array<() => void> = [];
      formEls.forEach((el) => {
        if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) {
          const wasChecked = el.hasAttribute('checked');
          restore.push(() => {
            if (wasChecked) el.setAttribute('checked', '');
            else el.removeAttribute('checked');
          });
          if (el.checked) el.setAttribute('checked', '');
          else el.removeAttribute('checked');
          return;
        }

        // Use actual value, or fall back to placeholder if value is empty
        const text = el.value || (el instanceof HTMLInputElement ? el.placeholder : '') || '';
        if (!text) return;

        const div = document.createElement('div');
        const cs = window.getComputedStyle(el);
        // If showing placeholder, use placeholder color; otherwise use input color
        const textColor = el.value ? cs.color : (cs.getPropertyValue('--placeholder-color') || '#9ca3af');
        div.style.cssText = [
          `font: ${cs.font}`,
          `color: ${textColor}`,
          `background: ${cs.backgroundColor}`,
          `border: ${cs.border}`,
          `border-radius: ${cs.borderRadius}`,
          `padding: ${cs.padding}`,
          `box-sizing: border-box`,
          `width: ${cs.width}`,
          `min-height: ${cs.height}`,
          `white-space: pre-wrap`,
          `word-break: break-word`,
          `overflow-wrap: break-word`,
          `line-height: ${cs.lineHeight}`,
          `text-align: ${cs.textAlign}`,
        ].join(';');
        div.textContent = text;

        el.parentNode?.insertBefore(div, el);
        el.style.display = 'none';

        restore.push(() => {
          div.remove();
          el.style.display = '';
        });
      });

      // Swap echarts canvases with <img> so html2canvas captures them faithfully.
      const chartCanvases = element.querySelectorAll<HTMLCanvasElement>(
        '[_echarts_instance_] canvas'
      );
      const swappedNodes: Array<{ canvas: HTMLCanvasElement; img: HTMLImageElement }> = [];
      chartCanvases.forEach((canvas) => {
        try {
          const dataUrl = canvas.toDataURL('image/png');
          const img = document.createElement('img');
          img.src = dataUrl;
          img.style.width = `${canvas.clientWidth}px`;
          img.style.height = `${canvas.clientHeight}px`;
          img.style.display = 'block';
          canvas.parentNode?.insertBefore(img, canvas);
          canvas.style.display = 'none';
          swappedNodes.push({ canvas, img });
        } catch {
          /* tainted canvas — fall back to html2canvas default handling */
        }
      });

      element.classList.add('pdf-exporting');

      let canvas: HTMLCanvasElement;
      try {
        canvas = await html2canvas(element, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          windowWidth: element.scrollWidth,
          width: element.scrollWidth,
          height: element.scrollHeight,
        });
      } finally {
        element.classList.remove('pdf-exporting');
        swappedNodes.forEach(({ canvas: c, img }) => {
          img.remove();
          c.style.display = '';
        });
        restore.forEach((fn) => fn());
      }

      // Landscape if content is wider than it is tall (tree / charts).
      const landscape = canvas.width > canvas.height;
      const pdf = new jsPDF(landscape ? 'l' : 'p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      const imgData = canvas.toDataURL('image/png');
      let position = 0;
      while (position < imgHeight) {
        if (position > 0) pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, -position, pdfWidth, imgHeight);
        position += pdfHeight;
        // Stop if remaining content is less than 5mm (avoids blank trailing page)
        if (imgHeight - position < 5) break;
      }

      const safeLabel = (stepLabel ?? '總覽').replace(/[^\w\u4e00-\u9fa5\- ]/g, '');
      pdf.save(`Momentum_Case_${safeLabel}.pdf`);
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
