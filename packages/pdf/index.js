// @growthmap/pdf — aspiration / momentum 共用的「DOM 區塊 → 多頁 PDF」匯出管線。
//
// 歷史：兩單元的 ExportButton 各自複製演化（momentum 版是超集：placeholder 呈現、
// echarts canvas 換圖、橫向偵測、尾頁防空白）。本包收斂為單一實作，差異以選項表達；
// 單元端只剩 UI 按鈕與檔名/選項。
//
// 管線：表單元素換成可完整換行的 div（input 會截斷超寬文字）→ echarts canvas 轉 <img>
// → html2canvas-pro 截圖 → jsPDF 多頁組裝。

export async function captureElementToPdf(element, {
  fileName,
  orientation = 'auto',        // 'auto'（寬>高轉橫式）| 'p' | 'l'
  includePlaceholders = false, // 空欄位是否以 placeholder 文字（灰色）呈現
  scale = 2,
} = {}) {
  if (!element) return;
  const { default: html2canvas } = await import('html2canvas-pro');
  const { jsPDF } = await import('jspdf');

  // ---- Phase 1：表單元素 → styled div（完整呈現與換行）----
  const restoreFns = [];
  const formEls = element.querySelectorAll('input, textarea, select');
  formEls.forEach((el) => {
    if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) {
      const wasChecked = el.hasAttribute('checked');
      restoreFns.push(() => {
        if (wasChecked) el.setAttribute('checked', '');
        else el.removeAttribute('checked');
      });
      if (el.checked) el.setAttribute('checked', '');
      else el.removeAttribute('checked');
      return;
    }

    const placeholder = includePlaceholders && 'placeholder' in el ? (el.placeholder || '') : '';
    const text = el.value || placeholder;
    if (!text) return;

    const div = document.createElement('div');
    const cs = window.getComputedStyle(el);
    const textColor = el.value ? cs.color : '#9ca3af'; // placeholder 用灰色
    div.style.cssText = [
      `font: ${cs.font}`,
      `color: ${textColor}`,
      `background: ${cs.backgroundColor}`,
      `border: ${cs.border}`,
      `border-radius: ${cs.borderRadius}`,
      `padding: ${cs.padding}`,
      'box-sizing: border-box',
      `width: ${cs.width}`,
      `min-height: ${cs.height}`,
      'white-space: pre-wrap',
      'word-break: break-word',
      'overflow-wrap: break-word',
      'overflow: visible',
      `line-height: ${cs.lineHeight}`,
      `text-align: ${cs.textAlign}`,
      'display: block',
    ].join(';');
    div.textContent = text;

    el.parentNode?.insertBefore(div, el);
    el.style.display = 'none';
    restoreFns.push(() => {
      div.remove();
      el.style.display = '';
    });
  });

  // ---- Phase 2：echarts canvas → <img>（html2canvas 對 echarts canvas 取樣不穩）----
  const chartCanvases = element.querySelectorAll('[_echarts_instance_] canvas');
  const swappedNodes = [];
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
    } catch { /* tainted canvas — 交給 html2canvas 預設處理 */ }
  });

  // ---- Phase 3：截圖 ----
  element.classList.add('pdf-exporting');
  let canvas;
  try {
    canvas = await html2canvas(element, {
      scale,
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
    restoreFns.forEach((fn) => fn());
  }

  // ---- Phase 4：多頁 PDF 組裝 ----
  const isLandscape = orientation === 'auto' ? canvas.width > canvas.height : orientation === 'l';
  const pdf = new jsPDF(isLandscape ? 'l' : 'p', 'mm', 'a4');
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgHeight = (canvas.height * pdfWidth) / canvas.width;
  const imgData = canvas.toDataURL('image/png');

  let position = 0;
  while (position < imgHeight) {
    if (position > 0) pdf.addPage();
    pdf.addImage(imgData, 'PNG', 0, -position, pdfWidth, imgHeight);
    position += pageHeight;
    if (imgHeight - position < 5) break; // 剩不足 5mm 就不再開空白尾頁
  }

  pdf.save(fileName);
}
