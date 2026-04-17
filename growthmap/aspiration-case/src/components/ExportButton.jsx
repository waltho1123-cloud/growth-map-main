export default function ExportButton({ companyName }) {
  const handleExport = async () => {
    try {
      const { default: html2canvas } = await import('html2canvas-pro')
      const { jsPDF } = await import('jspdf')

      const element = document.getElementById('pdf-content')
      if (!element) return

      // ---- Phase 1: replace inputs/textareas with styled divs ----
      // html2canvas captures the visible portion of an <input>, but users can
      // scroll horizontally inside the box — that scrolled text gets clipped.
      // Swapping to <div>s lets the full text render and wrap naturally.
      const restoreFns = []
      const formEls = element.querySelectorAll('input, textarea, select')

      formEls.forEach((el) => {
        if (el.type === 'checkbox' || el.type === 'radio') {
          // For checkboxes: sync checked attribute
          const wasChecked = el.hasAttribute('checked')
          restoreFns.push(() => {
            if (wasChecked) el.setAttribute('checked', '')
            else el.removeAttribute('checked')
          })
          if (el.checked) el.setAttribute('checked', '')
          else el.removeAttribute('checked')
          return
        }

        const text = el.value || ''
        if (!text) return // empty — nothing to clip

        // Create a visible div that shows the full text
        const div = document.createElement('div')
        const cs = window.getComputedStyle(el)
        div.style.cssText = [
          `font: ${cs.font}`,
          `color: ${cs.color}`,
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
        ].join(';')
        div.textContent = text

        el.parentNode.insertBefore(div, el)
        el.style.display = 'none'

        restoreFns.push(() => {
          div.remove()
          el.style.display = ''
        })
      })

      // ---- Phase 2: snapshot ----
      element.classList.add('pdf-exporting')

      let canvas
      try {
        canvas = await html2canvas(element, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          windowWidth: element.scrollWidth,
          width: element.scrollWidth,
          height: element.scrollHeight,
        })
      } finally {
        element.classList.remove('pdf-exporting')
        restoreFns.forEach((fn) => fn())
      }

      // ---- Phase 3: build PDF (multi-page) ----
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width

      let position = 0
      const pageHeight = pdf.internal.pageSize.getHeight()

      while (position < pdfHeight) {
        if (position > 0) pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, -position, pdfWidth, pdfHeight)
        position += pageHeight
      }

      const fileName = 'Aspiration_Case_建立情境.pdf'
      pdf.save(fileName)
    } catch (err) {
      console.error('PDF export failed:', err)
      alert('匯出 PDF 發生錯誤：' + (err.message || err))
    }
  }

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
  )
}
