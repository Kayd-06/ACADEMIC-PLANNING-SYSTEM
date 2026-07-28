import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export async function downloadFacultyCvPDF(teacher: any) {
  const { jsPDF } = await import('jspdf')
  const autoTableModule = await import('jspdf-autotable')
  const autoTable = autoTableModule.default

  // Fetch full details if available
  let fullTeacher = { ...teacher }
  if (teacher._id || teacher.id) {
    try {
      const teacherId = teacher._id || teacher.id
      const res = await fetch(`/api/teacher-portal/faculty/${teacherId}/assignments`)
      if (res.ok) {
        const details = await res.json()
        fullTeacher.subjects = details.subjects || fullTeacher.subjects || []
        fullTeacher.batchAssignments = details.batches || fullTeacher.batchAssignments || []
        fullTeacher.programAssignments = details.programs || fullTeacher.programAssignments || []
      }
    } catch (e) {
      // Fallback to existing fields
    }
  }

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  // Palette
  const darkNavy: [number, number, number] = [15, 23, 42] // #0f172a
  const indigoDark: [number, number, number] = [30, 27, 75] // #1e1b4b
  const accentIndigo: [number, number, number] = [99, 102, 241] // #6366f1

  let startY = 12

  // 1. Executive Header Banner
  doc.setFillColor(...indigoDark)
  doc.roundedRect(12, startY, pageWidth - 24, 34, 3, 3, 'F')

  // Faculty Name
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text(fullTeacher.name || 'Faculty Curriculum Vitae', 18, startY + 12)

  // Subtitle / Designation
  const specText = fullTeacher.specialization ? ` — ${fullTeacher.specialization}` : ''
  const subText = `${fullTeacher.subject || 'Faculty Member'}${specText} ${fullTeacher.primaryStream ? `• ${fullTeacher.primaryStream}` : ''}`
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(199, 210, 254)
  doc.text(subText, 18, startY + 19)

  // Badge on Header Right (ID / Status)
  const empIdStr = fullTeacher.employeeId ? `ID: ${fullTeacher.employeeId}` : 'FACULTY CV'
  doc.setFillColor(255, 255, 255)
  doc.roundedRect(pageWidth - 58, startY + 7, 42, 8, 4, 4, 'F')
  doc.setTextColor(30, 27, 75)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.text(empIdStr, pageWidth - 37, startY + 12.2, { align: 'center' })

  // Contact Pills below header
  doc.setFontSize(8)
  doc.setTextColor(165, 180, 252)
  const emailStr = fullTeacher.email ? `Email: ${fullTeacher.email}` : ''
  const phoneStr = fullTeacher.phone ? `Phone: ${fullTeacher.phone}` : ''
  const contactLine = [emailStr, phoneStr].filter(Boolean).join('   |   ')
  if (contactLine) {
    doc.text(contactLine, 18, startY + 27)
  }

  startY += 40

  // 2. Executive Quick Stats Bar (4 cards)
  const cardWidth = (pageWidth - 24 - 9) / 4
  const cardHeight = 16

  const expYears = fullTeacher.experienceYears || fullTeacher.experience || '—'
  const expLabel = typeof expYears === 'number' ? `${expYears} Years` : String(expYears).includes('year') ? String(expYears) : `${expYears}`
  const qualLabel = fullTeacher.qualification || 'Higher Education'
  const batchesCount = Array.isArray(fullTeacher.batchAssignments) ? fullTeacher.batchAssignments.length : (fullTeacher.batches || 0)
  const joiningDateLabel = fullTeacher.joiningDate || '—'

  const stats = [
    { label: 'EXPERIENCE', val: expLabel, accent: [139, 92, 246] as [number, number, number], bg: [245, 243, 255] as [number, number, number] },
    { label: 'QUALIFICATION', val: qualLabel, accent: [16, 185, 129] as [number, number, number], bg: [240, 253, 244] as [number, number, number] },
    { label: 'BATCHES ASSIGNED', val: `${batchesCount} Batches`, accent: [59, 130, 246] as [number, number, number], bg: [239, 246, 255] as [number, number, number] },
    { label: 'JOINING DATE', val: joiningDateLabel, accent: [100, 116, 139] as [number, number, number], bg: [248, 250, 252] as [number, number, number] },
  ]

  stats.forEach((st, idx) => {
    const cardX = 12 + idx * (cardWidth + 3)
    
    doc.setFillColor(...st.bg)
    doc.roundedRect(cardX, startY, cardWidth, cardHeight, 2, 2, 'F')

    doc.setFillColor(...st.accent)
    doc.rect(cardX, startY, 1.5, cardHeight, 'F')

    doc.setDrawColor(226, 232, 240)
    doc.roundedRect(cardX, startY, cardWidth, cardHeight, 2, 2, 'D')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.5)
    doc.setTextColor(100, 116, 139)
    doc.text(st.label, cardX + 4.5, startY + 5.5)

    doc.setFontSize(9.5)
    doc.setTextColor(st.accent[0], st.accent[1], st.accent[2])
    doc.text(st.val, cardX + 4.5, startY + 12)
  })

  startY += 21

  // 3. Professional Biography & Statement
  if (fullTeacher.bio) {
    doc.setFillColor(248, 250, 252)
    doc.setDrawColor(226, 232, 240)
    
    const splitBio = doc.splitTextToSize(fullTeacher.bio, pageWidth - 36)
    const bioHeight = Math.max(16, splitBio.length * 4.5 + 10)

    doc.roundedRect(12, startY, pageWidth - 24, bioHeight, 2, 2, 'FD')
    doc.setFillColor(...accentIndigo)
    doc.rect(12, startY, 1.5, bioHeight, 'F')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(30, 41, 59)
    doc.text('PROFESSIONAL STATEMENT & BIOGRAPHY', 17, startY + 6.5)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(71, 85, 105)
    doc.text(splitBio, 17, startY + 12)

    startY += bioHeight + 6
  }

  // 4. Personal & Academic Credentials Table
  doc.setFillColor(...darkNavy)
  doc.roundedRect(12, startY, pageWidth - 24, 7, 2, 2, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(255, 255, 255)
  doc.text('ACADEMIC & PROFESSIONAL CREDENTIALS', 16, startY + 4.8)

  startY += 7

  const credRows = [
    ['Full Name', fullTeacher.name || '—', 'Employee ID', fullTeacher.employeeId || '—'],
    ['Primary Subject', fullTeacher.subject || '—', 'Specialization', fullTeacher.specialization || '—'],
    ['Highest Qualification', fullTeacher.qualification || '—', 'Teaching Experience', expLabel],
    ['Primary Stream', fullTeacher.primaryStream || '—', 'Date of Joining', fullTeacher.joiningDate || '—'],
    ['Email Address', fullTeacher.email || '—', 'Phone Number', fullTeacher.phone || '—'],
    ['Gender', fullTeacher.gender || '—', 'Date of Birth', fullTeacher.dob || '—'],
  ]

  if (fullTeacher.addressLine1 || fullTeacher.city || fullTeacher.state || fullTeacher.pincode) {
    const fullAddr = [fullTeacher.addressLine1, fullTeacher.city, fullTeacher.state, fullTeacher.pincode].filter(Boolean).join(', ')
    credRows.push(['Address', fullAddr, 'Alt Phone', fullTeacher.altPhone || '—'])
  }

  autoTable(doc, {
    startY: startY,
    margin: { left: 12, right: 12 },
    body: credRows,
    theme: 'grid',
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 41, 59],
      cellPadding: 2.5,
    },
    columnStyles: {
      0: { cellWidth: 38, fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [71, 85, 105] },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 38, fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [71, 85, 105] },
      3: { cellWidth: 'auto' },
    },
  })

  // @ts-ignore
  startY = doc.lastAutoTable.finalY + 7

  // 5. Subject & Program Teaching Assignments
  const subAssignments = fullTeacher.subjects || []
  const batchAssignments = fullTeacher.batchAssignments || []

  if (subAssignments.length > 0 || batchAssignments.length > 0) {
    doc.setFillColor(...darkNavy)
    doc.roundedRect(12, startY, pageWidth - 24, 7, 2, 2, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(255, 255, 255)
    doc.text('TEACHING ASSIGNMENTS & BATCH PORTFOLIO', 16, startY + 4.8)

    startY += 7

    const portfolioRows: string[][] = []
    
    if (subAssignments.length > 0) {
      subAssignments.forEach((s: any) => {
        portfolioRows.push([
          'Subject Assignment',
          s.subjectName || s.name || fullTeacher.subject || '—',
          s.programName ? `Program: ${s.programName}` : 'All Programs',
          s.isPrimary ? 'PRIMARY FACULTY' : 'FACULTY'
        ])
      })
    }

    if (batchAssignments.length > 0) {
      batchAssignments.forEach((b: any) => {
        portfolioRows.push([
          'Batch Coverage',
          b.batchName || b.name || '—',
          b.subjectName ? `Subject: ${b.subjectName}` : (fullTeacher.subject || '—'),
          (b.role || 'Primary').toUpperCase()
        ])
      })
    }

    autoTable(doc, {
      startY: startY,
      margin: { left: 12, right: 12 },
      head: [['TYPE', 'ASSIGNMENT / BATCH', 'SCOPE / DETAILS', 'FACULTY ROLE']],
      body: portfolioRows,
      theme: 'grid',
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [71, 85, 105],
        fontSize: 7.5,
        fontStyle: 'bold',
        cellPadding: 2.5,
      },
      bodyStyles: {
        fontSize: 7.5,
        textColor: [30, 41, 59],
        cellPadding: 2.5,
      },
      columnStyles: {
        0: { cellWidth: 38, fontStyle: 'bold', textColor: [99, 102, 241] },
        1: { cellWidth: 'auto', fontStyle: 'bold' },
        2: { cellWidth: 50 },
        3: { cellWidth: 32, fontStyle: 'bold', halign: 'center' },
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
    })

    // @ts-ignore
    startY = doc.lastAutoTable.finalY + 7
  }

  // Footer & Page Numbers
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(148, 163, 184)
    doc.text('Academic Planning System • Official Faculty Curriculum Vitae', 12, pageHeight - 6)
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 12, pageHeight - 6, { align: 'right' })
  }

  const cleanName = (fullTeacher.name || 'Faculty').replace(/\s+/g, '_')
  doc.save(`Faculty_CV_${cleanName}.pdf`)
}
