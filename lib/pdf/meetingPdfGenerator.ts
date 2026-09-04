// Formal, print-ready exports for the Meeting Log feature: a short circulation
// Agenda and a full Minutes of Meeting (per agenda item: discussion, action,
// responsibility, target date, communicated to/by, status, priority).
// Freeform text layout rather than autoTable — this is a document, not a data table.

interface MeetingAgendaItemLike {
  itemTitle: string
  discussion: string
  action: string
  responsibility: string
  targetDate: string
  communicatedTo: string
  communicatedBy: string
  status?: string
  priority?: string
}

interface MeetingLike {
  title: string
  date: string
  time: string
  type: string
  venue: string
  attendees: string
  minutesPreparedBy?: string
  nextMeetingDate?: string
  agendaItems: MeetingAgendaItemLike[]
}

function formatDate(value: string): string {
  if (!value) return '—'
  const parsed = new Date(value)
  if (isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })
}

function safeFileTag(title: string): string {
  return (title || 'Meeting').replace(/[^a-z0-9]+/gi, '_').slice(0, 60)
}

type RGB = [number, number, number]

const ink: RGB = [17, 24, 39]
const muted: RGB = [90, 90, 90]
const accent: RGB = [79, 70, 229] // indigo-600, matches the app's brand accent

const BADGE_STYLES: Record<string, { fill: RGB; border: RGB; text: RGB }> = {
  'Not Started': { fill: [255, 241, 242], border: [254, 205, 211], text: [225, 29, 72] },
  'In Progress': { fill: [255, 251, 235], border: [253, 230, 138], text: [217, 119, 6] },
  'Completed': { fill: [236, 253, 245], border: [167, 243, 208], text: [5, 150, 105] },
  'Low': { fill: [248, 250, 252], border: [226, 232, 240], text: [71, 85, 105] },
  'Medium': { fill: [255, 251, 235], border: [253, 230, 138], text: [217, 119, 6] },
  'High': { fill: [255, 241, 242], border: [254, 205, 211], text: [225, 29, 72] },
}

// Draws a small rounded pill badge with its left edge at x, vertically centered
// on yBaseline (the text baseline of the surrounding line). Returns the x
// position immediately after the badge, so badges can be chained left-to-right.
function drawBadge(doc: any, text: string, x: number, yBaseline: number, styleKey?: string): number {
  const style = BADGE_STYLES[styleKey || 'Medium'] || BADGE_STYLES['Medium']
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  const paddingX = 2.6
  const height = 5
  const width = doc.getTextWidth(text) + paddingX * 2
  const rectY = yBaseline - height + 1.3
  doc.setFillColor(...style.fill)
  doc.setDrawColor(...style.border)
  doc.setLineWidth(0.25)
  doc.roundedRect(x, rectY, width, height, 2.2, 2.2, 'FD')
  doc.setTextColor(...style.text)
  doc.text(text, x + paddingX, yBaseline - 1.2)
  return x + width
}

export async function downloadMeetingAgendaPDF(meeting: MeetingLike) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 18

  let y = 20

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(...ink)
  doc.text(`Agenda for the Meeting on ${formatDate(meeting.date)}`, pageWidth / 2, y, { align: 'center' })

  y += 8
  doc.setDrawColor(...accent)
  doc.setLineWidth(0.8)
  doc.line(margin, y, pageWidth - margin, y)
  y += 7

  doc.setFontSize(9.5)
  const metaLeft = margin
  const metaRight = pageWidth / 2 + 5

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...ink)
  doc.text('Date Of Meeting:', metaLeft, y)
  doc.text('Attendees:', metaRight, y)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...muted)
  doc.text(formatDate(meeting.date), metaLeft + 30, y)
  doc.text(meeting.attendees || '—', metaRight + 22, y)

  y += 6
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...ink)
  doc.text('Nature Of Meeting:', metaLeft, y)
  doc.text('Venue:', metaRight, y)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...muted)
  doc.text(meeting.type || '—', metaLeft + 30, y)
  doc.text(meeting.venue || '—', metaRight + 22, y)

  y += 8
  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.3)
  doc.line(margin, y, pageWidth - margin, y)
  y += 8

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.setTextColor(...accent)
  doc.text('Agenda for the Meeting', margin, y)
  y += 7

  const items = meeting.agendaItems || []
  if (items.length === 0) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(9.5)
    doc.setTextColor(...muted)
    doc.text('No agenda items recorded.', margin + 4, y)
    y += 6
  } else {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    items.forEach((item, idx) => {
      if (y > pageHeight - 30) {
        doc.addPage()
        y = 20
      }
      const numbered = `${idx + 1}. ${item.itemTitle}`
      const wrapped = doc.splitTextToSize(numbered, pageWidth - margin * 2 - 6)
      doc.setTextColor(...ink)
      doc.text(wrapped, margin + 6, y)
      y += wrapped.length * 5 + 3
    })
  }

  y += 6
  if (y > pageHeight - 35) {
    doc.addPage()
    y = 20
  }
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...muted)
  doc.text('All attendees are required to be present in the venue at the time of meeting without fail', margin, y)

  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...muted)
    if (i === pageCount) {
      doc.text('(Convenor of the Meeting)', pageWidth - margin, pageHeight - 20, { align: 'right' })
    }
    doc.setDrawColor(200, 200, 200)
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12)
    doc.text(new Date().toLocaleDateString('en-US'), margin, pageHeight - 7)
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 7, { align: 'right' })
  }

  doc.save(`Agenda_${safeFileTag(meeting.title)}_${meeting.date}.pdf`)
}

export async function downloadMeetingMinutesPDF(meeting: MeetingLike) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 18
  const contentWidth = pageWidth - margin * 2

  let y = 20

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(...ink)
  doc.text('Minutes of The Meeting', pageWidth / 2, y, { align: 'center' })
  y += 9

  doc.setFontSize(9)
  const col2 = margin + 62
  const col3 = margin + 124

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...ink)
  doc.text('Date Of Meeting', margin, y)
  doc.text('Nature Of Meeting', col2, y)
  doc.text('Attendees', col3, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...muted)
  doc.text(formatDate(meeting.date), margin, y)
  doc.text(meeting.type || '—', col2, y)
  const attendeesWrapped = doc.splitTextToSize(meeting.attendees || '—', pageWidth - margin - col3)
  doc.text(attendeesWrapped, col3, y)
  y += Math.max(6, attendeesWrapped.length * 4.5 + 1)

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...ink)
  doc.text('Time Of Meeting', margin, y)
  doc.text('Venue Of Meeting', col2, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...muted)
  doc.text(meeting.time || '—', margin, y)
  doc.text(meeting.venue || '—', col2, y)
  y += 6

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...ink)
  doc.text('Minutes Prepared By', margin, y)
  doc.text('Next Meeting Date', col2, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...muted)
  doc.text(meeting.minutesPreparedBy || '—', margin, y)
  doc.text(meeting.nextMeetingDate ? formatDate(meeting.nextMeetingDate) : '—', col2, y)
  y += 6

  doc.setDrawColor(...accent)
  doc.setLineWidth(0.8)
  doc.line(margin, y, pageWidth - margin, y)
  y += 8

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 18) {
      doc.addPage()
      y = 20
    }
  }

  const addField = (label: string, value: string, wide = true) => {
    ensureSpace(10)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...ink)
    doc.text(label, margin, y)
    y += 4.5
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...muted)
    const text = value || '—'
    const wrapped = doc.splitTextToSize(text, wide ? contentWidth : contentWidth / 2 - 4)
    ensureSpace(wrapped.length * 4.5)
    doc.text(wrapped, margin, y)
    y += wrapped.length * 4.5 + 4
  }

  const items = meeting.agendaItems || []
  if (items.length === 0) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(9.5)
    doc.setTextColor(...muted)
    doc.text('No agenda items recorded for this meeting.', margin, y)
  }

  items.forEach((item, idx) => {
    ensureSpace(14)

    // Item number + title, with status/priority badges on the same line
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...ink)
    doc.text('Agenda', margin, y)
    y += 4.5
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...accent)
    const numberLabel = `${idx + 1}.`
    doc.text(numberLabel, margin, y)
    const numberWidth = doc.getTextWidth(numberLabel) + 2
    doc.setTextColor(...ink)
    const titleMaxWidth = contentWidth - numberWidth - 44
    const titleWrapped = doc.splitTextToSize(item.itemTitle, titleMaxWidth)
    doc.text(titleWrapped, margin + numberWidth, y)

    let badgeX = pageWidth - margin
    const priorityText = `${item.priority || 'Medium'} Priority`
    const statusText = item.status || 'Not Started'
    doc.setFontSize(7.5)
    const priorityWidth = doc.getTextWidth(priorityText) + 5.2
    const statusWidth = doc.getTextWidth(statusText) + 5.2
    badgeX = pageWidth - margin - priorityWidth
    drawBadge(doc, priorityText, badgeX, y, item.priority)
    badgeX -= statusWidth + 2
    drawBadge(doc, statusText, badgeX, y, item.status)

    y += Math.max(titleWrapped.length * 5, 6) + 3

    addField('Discussion*', item.discussion)
    addField('Action to be taken', item.action)

    ensureSpace(10)
    const halfWidth = contentWidth / 2 - 4
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...ink)
    doc.text('Person Responsible', margin, y)
    doc.text('Target Date', margin + halfWidth + 8, y)
    y += 4.5
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...muted)
    doc.text(doc.splitTextToSize(item.responsibility || '—', halfWidth), margin, y)
    doc.text(doc.splitTextToSize(formatDate(item.targetDate), halfWidth), margin + halfWidth + 8, y)
    y += 8

    ensureSpace(10)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...ink)
    doc.text('To be Communicated to', margin, y)
    doc.text('To be Communicated by', margin + halfWidth + 8, y)
    y += 4.5
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...muted)
    doc.text(doc.splitTextToSize(item.communicatedTo || '—', halfWidth), margin, y)
    doc.text(doc.splitTextToSize(item.communicatedBy || '—', halfWidth), margin + halfWidth + 8, y)
    y += 8

    if (idx < items.length - 1) {
      ensureSpace(6)
      doc.setDrawColor(220, 220, 220)
      doc.setLineWidth(0.3)
      doc.line(margin, y, pageWidth - margin, y)
      y += 6
    }
  })

  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setDrawColor(200, 200, 200)
    doc.setLineWidth(0.3)
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12)
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(7)
    doc.setTextColor(...muted)
    doc.text('*Kindly refer to any attachments (if any) for the Minutes of Meeting', margin, pageHeight - 15)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text(new Date().toLocaleDateString('en-US'), pageWidth - margin, pageHeight - 7, { align: 'right' })
  }

  doc.save(`Minutes_${safeFileTag(meeting.title)}_${meeting.date}.pdf`)
}
