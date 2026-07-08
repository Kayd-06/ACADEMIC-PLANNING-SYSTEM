import { NextRequest, NextResponse } from 'next/server'
import { db, questions } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// ── PDF text parser ──────────────────────────────────────────────────────────
interface ParsedQuestion {
  qNum: number
  subject: string
  topic: string
  difficulty: string
  type: string
  text: string
  options: string[]
  correctAnswer: string
  marks: number
  negativeMarks: number
  source: string
}

function cleanAnswer(ans: string): string {
  const trimmed = ans.trim()
  const m = trimmed.match(/^\(?([A-Ea-e])\)?(?:\s+(.+))?$/)
  if (m) {
    return m[1].toUpperCase()
  }
  return trimmed
}

function parsePdfText(rawText: string): ParsedQuestion[] {
  // Normalise line endings
  const text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  // ── 1. Extract header metadata ──────────────────────────────────────────
  let subject = 'General'
  let topic = 'General'
  let difficulty = 'Medium'
  let type = 'MCQ'
  let marks = 4
  let negativeMarks = 0
  let source = 'PDF Upload'

  for (const line of lines) {
    const lower = line.toLowerCase()
    if (lower.startsWith('subject:'))   subject    = line.slice(line.indexOf(':') + 1).trim()
    else if (lower.startsWith('topic:'))      topic      = line.slice(line.indexOf(':') + 1).trim()
    else if (lower.startsWith('difficulty:')) difficulty = line.slice(line.indexOf(':') + 1).trim()
    else if (lower.startsWith('type:'))       type       = line.slice(line.indexOf(':') + 1).trim()
    else if (lower.startsWith('marks:'))      marks      = parseInt(line.slice(line.indexOf(':') + 1).trim()) || 4
    else if (lower.startsWith('negative marks:') || lower.startsWith('negativemarks:')) {
      negativeMarks = parseInt(line.slice(line.indexOf(':') + 1).trim()) || 0
    }
    else if (lower.startsWith('source:'))     source     = line.slice(line.indexOf(':') + 1).trim()
  }

  // Normalise type
  const typeMap: Record<string, string> = {
    mcq: 'MCQ', 'multiple choice': 'MCQ',
    numerical: 'Numerical', integer: 'Integer', subjective: 'Subjective',
    'short answer': 'Subjective', descriptive: 'Subjective',
  }
  type = typeMap[type.toLowerCase()] ?? type

  // ── 2. Split into question blocks and answer key ─────────────────────────
  const fullText = lines.join('\n')

  // Find where the ANSWER KEY section starts
  const ansKeyMatch = fullText.match(/\bANSWER\s*KEY\b/i)
  const bodyText    = ansKeyMatch ? fullText.slice(0, ansKeyMatch.index) : fullText
  const answerText  = ansKeyMatch ? fullText.slice(ansKeyMatch.index!) : ''

  // ── 3. Parse answer key  Q_num → answer ──────────────────────────────────
  const answerMap: Record<number, string> = {}
  
  // Try parsing after "ANSWER KEY"
  const ansKeyLinesAfter = answerText.split('\n').slice(1).map(l => l.trim()).filter(Boolean)
  for (const line of ansKeyLinesAfter) {
    const m = line.match(/^[Qq]?(\d+)[.):\s]+(.+)/)
    if (m) {
      const num = parseInt(m[1])
      const ans = m[2].trim()
      if (!isNaN(num) && ans) {
        answerMap[num] = cleanAnswer(ans)
      }
    }
  }

  let parsedBodyText = bodyText

  // If no answers found after "ANSWER KEY", look before it (scanning backwards from the end of bodyText)
  if (Object.keys(answerMap).length === 0) {
    const bodyLines = bodyText.split('\n').map(l => l.trim()).filter(Boolean)
    let answersFound = 0
    let startIdx = -1

    for (let idx = bodyLines.length - 1; idx >= 0; idx--) {
      const line = bodyLines[idx]
      const m = line.match(/^[Qq]?\.?(\d+)[.)]\s*(.+)/)
      if (m) {
        const num = parseInt(m[1])
        const ans = m[2].trim()
        if (!isNaN(num) && ans) {
          answerMap[num] = cleanAnswer(ans)
          answersFound++
          startIdx = idx
        }
      } else {
        if (answersFound > 0) {
          break
        }
      }
    }

    if (answersFound > 0 && startIdx !== -1) {
      parsedBodyText = bodyLines.slice(0, startIdx).join('\n')
    }
  }

  // ── 4. Parse question blocks ──────────────────────────────────────────────
  // Split body on lines that look like "1." / "Q1." / "Q.1" / "1)"
  const questionBlocks = parsedBodyText.split(/(?=(?:^|\n)[Qq]?\.?\d+[.)]\s)/m)

  const parsed: ParsedQuestion[] = []

  for (const block of questionBlocks) {
    const bLines = block.split('\n').map(l => l.trim()).filter(Boolean)
    if (!bLines.length) continue

    // First line should be the question number + text
    const firstLine = bLines[0]
    const qMatch = firstLine.match(/^[Qq]?\.?(\d+)[.)]\s*(.+)/)
    if (!qMatch) continue

    const qNum = parseInt(qMatch[1])
    let questionText = qMatch[2].trim()

    // Collect continuation lines until first option or end
    const opts: string[] = []
    let i = 1
    // Collect extra text lines before options
    while (i < bLines.length && !bLines[i].match(/^\([A-Ea-e]\)/)) {
      // Check if it looks like another question start
      if (bLines[i].match(/^[Qq]?\.?\d+[.)]\s/)) break
      questionText += ' ' + bLines[i]
      i++
    }

    // Collect option lines (A)–(D)
    while (i < bLines.length) {
      const optMatch = bLines[i].match(/^\(([A-Ea-e])\)\s*(.+)/)
      if (optMatch) {
        opts.push(optMatch[2].trim())
        i++
      } else {
        // Option text continuation
        if (opts.length > 0 && !bLines[i].match(/^[Qq]?\.?\d+[.)]\s/)) {
          opts[opts.length - 1] += ' ' + bLines[i]
          i++
        } else {
          break
        }
      }
    }

    if (!questionText) continue

    parsed.push({
      qNum,
      subject,
      topic,
      difficulty,
      type,
      text: questionText.trim(),
      options: opts,
      correctAnswer: answerMap[qNum] ?? '',
      marks,
      negativeMarks,
      source,
    })
  }

  return parsed
}

// ── Route handler ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const role = (session.user as any).role
    if (role !== 'management' && role !== 'teacher') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const schoolId = (session.user as any).schoolId as string | null

    // Read multipart form data
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded.' }, { status: 400 })
    }
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'Only PDF files are supported.' }, { status: 400 })
    }

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Dynamically import pdf-parse and construct it using the correct API
    const { PDFParse } = await import('pdf-parse') as any
    const parser = new PDFParse({ data: buffer })
    const pdfData = await parser.getText()
    const rawText = pdfData.text

    if (!rawText || rawText.trim().length < 20) {
      return NextResponse.json({ error: 'Could not extract text from the PDF. Make sure the PDF contains selectable text (not a scanned image).' }, { status: 422 })
    }

    // ── Format Validation ───────────────────────────────────────────────────
    
    // Check 1: Mandatory ANSWER KEY section
    if (!/\bANSWER\s*KEY\b/i.test(rawText)) {
      return NextResponse.json({
        error: "The mandatory 'ANSWER KEY' section is missing at the end of the PDF. Please check the Format Guide and template."
      }, { status: 422 })
    }

    // Parse questions from text
    const parsed = parsePdfText(rawText)

    // Check 2: At least one question found
    if (parsed.length === 0) {
      return NextResponse.json({
        error: 'No questions could be parsed. Ensure they are numbered (e.g. "1. ", "2. ") and follow the header block.',
      }, { status: 422 })
    }

    // Check 3: Check options and answers for each question
    for (const q of parsed) {
      if (q.type === 'MCQ') {
        if (q.options.length < 2) {
          return NextResponse.json({
            error: `Question ${q.qNum} is defined as MCQ but has fewer than 2 options (found ${q.options.length}). MCQ options must start with (A), (B), (C), (D) on new lines.`
          }, { status: 422 })
        }
      }
      if (!q.correctAnswer) {
        return NextResponse.json({
          error: `Question ${q.qNum} does not have a corresponding answer in the ANSWER KEY section. Please ensure all question numbers match answer numbers (e.g. '${q.qNum}. B').`
        }, { status: 422 })
      }
    }

    // Bulk insert into Neon
    const rows = await db.insert(questions).values(
      parsed.map(q => ({
        subject: q.subject,
        topic: q.topic,
        difficulty: q.difficulty,
        type: q.type,
        text: q.text,
        options: JSON.stringify(q.options),
        correctAnswer: q.correctAnswer,
        marks: q.marks,
        negativeMarks: q.negativeMarks,
        source: q.source,
        schoolId,
      }))
    ).returning()

    return NextResponse.json({
      inserted: rows.length,
      questions: rows.map(r => ({
        ...r,
        options: (() => { try { return JSON.parse(r.options) } catch { return [] } })()
      }))
    }, { status: 201 })

  } catch (error: any) {
    console.error('[upload-pdf] Error:', error)
    const msg = error.message || ''
    if (msg.includes('Invalid PDF structure') || msg.includes('header')) {
      return NextResponse.json({ error: 'Invalid PDF structure. Please upload a valid, non-corrupted PDF file.' }, { status: 422 })
    }
    return NextResponse.json({ error: error.message || 'Failed to process PDF.' }, { status: 500 })
  }
}
