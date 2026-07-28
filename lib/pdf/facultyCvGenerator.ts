import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export async function downloadFacultyCvPDF(teacher: any, defaultSchoolName?: string) {
  const { jsPDF } = await import('jspdf')
  const autoTableModule = await import('jspdf-autotable')
  const autoTable = autoTableModule.default

  let fullTeacher = { ...teacher }
  
  // 1. Fetch complete faculty record from API to get all fields (employeeId, dob, gender, bio, email, etc.)
  const teacherId = teacher._id || teacher.id
  if (teacherId) {
    try {
      const res = await fetch('/api/teacher-portal/faculty')
      if (res.ok) {
        const list = await res.json()
        const found = Array.isArray(list) ? list.find((f: any) => f.id === teacherId || f._id === teacherId) : null
        if (found) {
          fullTeacher = { ...found, ...teacher, ...found }
        }
      }
    } catch (e) {
      console.error('Failed to fetch full faculty record', e)
    }
  }

  // Ensure subject & specialization fields are mapped properly
  if (!fullTeacher.subject && fullTeacher.sub) {
    fullTeacher.subject = fullTeacher.sub
  }
  if (!fullTeacher.specialization && fullTeacher.spec) {
    fullTeacher.specialization = fullTeacher.spec
  }
  if (!fullTeacher.experienceYears && fullTeacher.exp) {
    fullTeacher.experienceYears = fullTeacher.exp
  }

  // 2. Resolve School Name
  let schoolName = defaultSchoolName || fullTeacher.schoolName || ''
  if (!schoolName) {
    try {
      const sRes = await fetch('/api/admin/schools')
      if (sRes.ok) {
        const sList = await sRes.json()
        if (Array.isArray(sList)) {
          const matched = sList.find((s: any) => s.id === fullTeacher.schoolId || s._id === fullTeacher.schoolId)
          if (matched) schoolName = matched.name
          else if (sList.length > 0) schoolName = sList[0].name
        }
      }
    } catch (e) {}
  }
  if (!schoolName) schoolName = 'Academic Planning System'

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 16

  // Palette (Professional Corporate Charcoal & Dark Slate)
  const charcoalDark: [number, number, number] = [17, 24, 39] // #111827
  const slateDark: [number, number, number] = [55, 65, 81] // #374151
  const slateMuted: [number, number, number] = [107, 114, 128] // #6b7280
  const dividerLine: [number, number, number] = [209, 213, 219] // #d1d5db

  let startY = 18

  // Helper for Section Headings
  const addSectionHeader = (title: string) => {
    if (startY + 25 > pageHeight) {
      doc.addPage()
      startY = 18
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...charcoalDark)
    doc.text(title.toUpperCase(), margin, startY)

    startY += 2.5
    doc.setDrawColor(...charcoalDark)
    doc.setLineWidth(0.6)
    doc.line(margin, startY, pageWidth - margin, startY)

    startY += 5.5
  }

  // 1. CANDIDATE HEADER
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(...charcoalDark)
  doc.text(fullTeacher.name || 'Faculty Member', margin, startY)

  startY += 6.5

  // School Name & Subject Subtitle
  const specText = fullTeacher.specialization ? ` (Specialization: ${fullTeacher.specialization})` : ''
  const subjectStr = fullTeacher.subject ? `Subject: ${fullTeacher.subject}${specText}` : 'Faculty Member'
  const subText = `School / Institution: ${schoolName}   •   ${subjectStr}`
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...slateDark)
  doc.text(subText, margin, startY)

  startY += 6

  // Contact Info Line (Phone, Email, Employee ID, DOB, Gender)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...slateMuted)

  const contactItems = []
  if (fullTeacher.employeeId) contactItems.push(`Emp ID: ${fullTeacher.employeeId}`)
  if (fullTeacher.phone) contactItems.push(`Phone: ${fullTeacher.phone}`)
  if (fullTeacher.email) contactItems.push(`Email: ${fullTeacher.email}`)
  if (fullTeacher.dob) contactItems.push(`DOB: ${fullTeacher.dob}`)
  if (fullTeacher.gender) contactItems.push(`Gender: ${fullTeacher.gender}`)
  if (fullTeacher.joiningDate) contactItems.push(`Joined: ${fullTeacher.joiningDate}`)

  const contactLine = contactItems.join('   |   ') || `Institution: ${schoolName}`
  doc.text(contactLine, margin, startY)

  startY += 4
  doc.setDrawColor(...dividerLine)
  doc.setLineWidth(0.4)
  doc.line(margin, startY, pageWidth - margin, startY)

  startY += 8.5

  // 2. PROFESSIONAL BIOGRAPHY / STATEMENT
  if (fullTeacher.bio) {
    addSectionHeader('Professional Summary')

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...slateDark)

    const splitBio = doc.splitTextToSize(fullTeacher.bio, pageWidth - margin * 2)
    doc.text(splitBio, margin, startY)

    startY += splitBio.length * 4.5 + 4
  }

  // 3. EXECUTIVE OVERVIEW & TEACHING PROFILE
  addSectionHeader('Executive Overview & Teaching Profile')

  const expYears = fullTeacher.experienceYears || fullTeacher.experience || '—'
  const expLabel = typeof expYears === 'number' ? `${expYears} Years` : String(expYears).includes('year') ? String(expYears) : `${expYears}`
  const qualLabel = fullTeacher.qualification || 'Higher Education'
  const batchesCount = Array.isArray(fullTeacher.batchAssignments) ? fullTeacher.batchAssignments.length : (fullTeacher.batches || 0)

  const overviewRows = [
    ['School / Institution', schoolName, 'Employee ID', fullTeacher.employeeId || '—'],
    ['Primary Subject', fullTeacher.subject || '—', 'Specialization', fullTeacher.specialization || '—'],
    ['Highest Qualification', qualLabel, 'Teaching Experience', expLabel],
    ['Primary Academic Stream', fullTeacher.primaryStream || '—', 'Active Batches Assigned', `${batchesCount} Batches`],
    ['Employee Status', fullTeacher.status || 'ACTIVE', 'Date of Joining', fullTeacher.joiningDate || '—'],
  ]

  autoTable(doc, {
    startY: startY,
    margin: { left: margin, right: margin },
    body: overviewRows,
    theme: 'plain',
    bodyStyles: {
      fontSize: 8.5,
      textColor: [55, 65, 81],
      cellPadding: 2,
    },
    columnStyles: {
      0: { cellWidth: 42, fontStyle: 'bold', textColor: [17, 24, 39] },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 42, fontStyle: 'bold', textColor: [17, 24, 39] },
      3: { cellWidth: 'auto' },
    },
    didDrawCell: (data) => {
      if (data.section === 'body') {
        doc.setDrawColor(243, 244, 246)
        doc.setLineWidth(0.2)
        doc.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height)
      }
    }
  })

  // @ts-ignore
  startY = doc.lastAutoTable.finalY + 7

  // 4. ACADEMIC & PERSONAL CREDENTIALS TABLE (ALL DETAILS FROM EDIT MODAL)
  addSectionHeader('Academic & Personal Details')

  const credRows = [
    ['Full Name', fullTeacher.name || '—', 'Employee ID', fullTeacher.employeeId || '—'],
    ['School Name', schoolName, 'Date of Birth', fullTeacher.dob || '—'],
    ['Gender', fullTeacher.gender || '—', 'Primary Subject', fullTeacher.subject || '—'],
    ['Specialization', fullTeacher.specialization || '—', 'Highest Qualification', qualLabel],
    ['Teaching Experience', expLabel, 'Primary Stream', fullTeacher.primaryStream || '—'],
    ['Date of Joining', fullTeacher.joiningDate || '—', 'Employee Status', fullTeacher.status || 'ACTIVE'],
    ['Email Address', fullTeacher.email || '—', 'Phone Number', fullTeacher.phone || '—'],
  ]

  if (fullTeacher.addressLine1 || fullTeacher.city || fullTeacher.state || fullTeacher.pincode || fullTeacher.altPhone) {
    const fullAddr = [fullTeacher.addressLine1, fullTeacher.city, fullTeacher.state, fullTeacher.pincode].filter(Boolean).join(', ')
    credRows.push(['Residential Address', fullAddr || '—', 'Alternate Phone', fullTeacher.altPhone || '—'])
  }

  autoTable(doc, {
    startY: startY,
    margin: { left: margin, right: margin },
    body: credRows,
    theme: 'grid',
    headStyles: {
      fillColor: [243, 244, 246],
      textColor: [17, 24, 39],
      fontSize: 8.5,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: [55, 65, 81],
      cellPadding: 2.5,
    },
    columnStyles: {
      0: { cellWidth: 42, fontStyle: 'bold', fillColor: [249, 250, 251], textColor: [17, 24, 39] },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 42, fontStyle: 'bold', fillColor: [249, 250, 251], textColor: [17, 24, 39] },
      3: { cellWidth: 'auto' },
    },
  })

  // @ts-ignore
  startY = doc.lastAutoTable.finalY + 7

  // 5. SUBJECTS TAUGHT & BATCH ASSIGNMENTS
  const subAssignments = fullTeacher.subjects || []
  const batchAssignments = fullTeacher.batchAssignments || []

  if (subAssignments.length > 0 || batchAssignments.length > 0 || fullTeacher.subject) {
    addSectionHeader('Teaching Portfolio & Active Assignments')

    const portfolioRows: string[][] = []
    
    if (subAssignments.length > 0) {
      subAssignments.forEach((s: any) => {
        portfolioRows.push([
          'Subject Assignment',
          s.subjectName || s.name || fullTeacher.subject || '—',
          s.programName ? `Program: ${s.programName}` : 'All Academic Programs',
          s.isPrimary ? 'Primary Faculty' : 'Faculty'
        ])
      })
    } else if (fullTeacher.subject) {
      portfolioRows.push([
        'Primary Subject',
        fullTeacher.subject,
        fullTeacher.specialization ? `Specialization: ${fullTeacher.specialization}` : 'General',
        'Primary Faculty'
      ])
    }

    if (batchAssignments.length > 0) {
      batchAssignments.forEach((b: any) => {
        portfolioRows.push([
          'Batch Coverage',
          b.batchName || b.name || '—',
          b.subjectName ? `Subject: ${b.subjectName}` : (fullTeacher.subject || '—'),
          String(b.role || 'Primary').charAt(0).toUpperCase() + String(b.role || 'Primary').slice(1)
        ])
      })
    }

    autoTable(doc, {
      startY: startY,
      margin: { left: margin, right: margin },
      head: [['ASSIGNMENT TYPE', 'SUBJECT / BATCH NAME', 'SCOPE & PROGRAM DETAILS', 'FACULTY ROLE']],
      body: portfolioRows,
      theme: 'grid',
      headStyles: {
        fillColor: [243, 244, 246],
        textColor: [17, 24, 39],
        fontSize: 8,
        fontStyle: 'bold',
        cellPadding: 2.5,
      },
      bodyStyles: {
        fontSize: 8.5,
        textColor: [55, 65, 81],
        cellPadding: 2.5,
      },
      columnStyles: {
        0: { cellWidth: 42, fontStyle: 'bold', textColor: [17, 24, 39] },
        1: { cellWidth: 'auto', fontStyle: 'bold' },
        2: { cellWidth: 55 },
        3: { cellWidth: 32, fontStyle: 'bold', halign: 'center' },
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251],
      },
    })

    // @ts-ignore
    startY = doc.lastAutoTable.finalY + 7
  }

  // FOOTER & PAGE NUMBERING
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)

    doc.setDrawColor(...dividerLine)
    doc.setLineWidth(0.4)
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...slateMuted)
    doc.text(`Academic Planning System • Official Faculty Resume — ${schoolName}`, margin, pageHeight - 7)
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 7, { align: 'right' })
  }

  const cleanName = (fullTeacher.name || 'Faculty').replace(/\s+/g, '_')
  doc.save(`Faculty_Resume_${cleanName}.pdf`)
}
