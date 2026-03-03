export default function ExportButton({ companyName }) {
  const handleExport = async () => {
    try {
      const { default: html2canvas } = await import('html2canvas')
      const { default: jsPDF } = await import('jspdf')

      const element = document.getElementById('pdf-content')
      if (!element) return

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#eef1f5',
      })

      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width

      let position = 0
      const pageHeight = pdf.internal.pageSize.getHeight()

      // 多頁處理
      while (position < pdfHeight) {
        if (position > 0) pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, -position, pdfWidth, pdfHeight)
        position += pageHeight
      }

      const fileName = companyName
        ? `專班_組別_${companyName}_Aspiration_case.pdf`
        : 'Aspiration_case.pdf'
      pdf.save(fileName)
    } catch {
      alert('匯出 PDF 需要安裝 html2canvas 與 jspdf 套件。\n請執行: npm install html2canvas jspdf')
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
