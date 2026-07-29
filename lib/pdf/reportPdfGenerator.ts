// Generic formatted PDF export for tabular management reports (Faculty Directory,
// Student Reports, Daily Reports, ...). Deliberately simpler than the bespoke
// Syllabus Coverage PDF (components/dashboard/SyllabusKanbanBoard.tsx) — a banner,
// an optional KPI strip, one table, and a footer — since those screens don't have
// syllabus's per-subject grouping/progress-bar needs.
export interface ReportKpi {
  label: string
  value: string
}

export async function downloadTabularReportPDF({
  title,
  subtitle,
  kpis,
  columns,
  rows,
  fileName,
}: {
  title: string
  subtitle: string
  kpis?: ReportKpi[]
  columns: string[]
  rows: (string | number)[][]
  fileName: string
}) {
  const { jsPDF } = await import('jspdf')
  const autoTableModule = await import('jspdf-autotable')
  const autoTable = autoTableModule.default

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const todayStr = new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })

  const indigoDark: [number, number, number] = [30, 27, 75]
  const purpleAccent: [number, number, number] = [139, 92, 246]

  let startY = 12

  // Header banner
  doc.setFillColor(...indigoDark)
  doc.roundedRect(12, startY, pageWidth - 24, 22, 3, 3, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text(title, 18, startY + 9)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(199, 210, 254)
  doc.text(subtitle, 18, startY + 16)
  doc.setTextColor(165, 180, 252)
  doc.text(`Generated: ${todayStr}`, pageWidth - 18, startY + 16, { align: 'right' })

  startY += 27

  // Optional KPI strip
  if (kpis && kpis.length > 0) {
    const cardWidth = (pageWidth - 24 - (kpis.length - 1) * 3) / kpis.length
    const cardHeight = 16
    kpis.forEach((kpi, idx) => {
      const cardX = 12 + idx * (cardWidth + 3)
      doc.setFillColor(245, 243, 255)
      doc.roundedRect(cardX, startY, cardWidth, cardHeight, 2, 2, 'F')
      doc.setFillColor(...purpleAccent)
      doc.rect(cardX, startY, 1.5, cardHeight, 'F')
      doc.setDrawColor(226, 232, 240)
      doc.roundedRect(cardX, startY, cardWidth, cardHeight, 2, 2, 'D')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(6.5)
      doc.setTextColor(100, 116, 139)
      doc.text(kpi.label, cardX + 4, startY + 5.5)
      doc.setFontSize(10.5)
      doc.setTextColor(...purpleAccent)
      doc.text(kpi.value, cardX + 4, startY + 12)
    })
    startY += cardHeight + 6
  }

  autoTable(doc, {
    startY,
    margin: { left: 12, right: 12 },
    head: [columns],
    body: rows,
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.2, overflow: 'linebreak' },
    headStyles: { fillColor: [241, 245, 249], textColor: [71, 85, 105], fontSize: 7.5, fontStyle: 'bold' },
    bodyStyles: { textColor: [30, 41, 59] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  })

  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(148, 163, 184)
    doc.text('Academic Planning System • Official Report', 12, pageHeight - 6)
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 12, pageHeight - 6, { align: 'right' })
  }

  doc.save(fileName)
}
