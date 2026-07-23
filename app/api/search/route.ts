import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { students, faculty, batches, programs } from '@/lib/db/schema'
import { and, or, ilike, eq, isNull } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

function schoolCondition(column: any, schoolId: string | null) {
  return schoolId ? eq(column, schoolId) : isNull(column)
}

const EMPTY = { students: [], faculty: [], batches: [], programs: [] }

// GET — global omnisearch across students, faculty, batches & programs
// (?q=<term>, minimum 2 chars). Powers the top-header search bar.
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const role = (session.user as any).role as string | undefined
    const schoolId = (session.user as any).schoolId as string | null

    const q = (req.nextUrl.searchParams.get('q') || '').trim()
    if (q.length < 2) return NextResponse.json(EMPTY)
    const term = `%${q}%`

    const [studentRows, batchRows, programRows, facultyRows] = await Promise.all([
      db.select({ id: students.id, name: students.name, rollNo: students.rollNo, class: students.class, section: students.section })
        .from(students)
        .where(and(
          schoolCondition(students.schoolId, schoolId),
          or(ilike(students.name, term), ilike(students.rollNo, term), ilike(students.admissionNumber, term)),
        ))
        .limit(5),
      db.select({ id: batches.id, name: batches.name, classLevel: batches.classLevel })
        .from(batches)
        .where(and(schoolCondition(batches.schoolId, schoolId), ilike(batches.name, term)))
        .limit(5),
      db.select({ id: programs.id, name: programs.name, type: programs.type })
        .from(programs)
        .where(and(schoolCondition(programs.schoolId, schoolId), ilike(programs.name, term)))
        .limit(5),
      // Faculty directory is a management-only concern
      role === 'management'
        ? db.select({ id: faculty.id, name: faculty.name, subject: faculty.subject })
            .from(faculty)
            .where(and(schoolCondition(faculty.schoolId, schoolId), ilike(faculty.name, term)))
            .limit(5)
        : Promise.resolve([]),
    ])

    return NextResponse.json({
      students: studentRows.map(s => ({
        id: s.id,
        label: s.name,
        sublabel: [s.class && s.section ? `${s.class}-${s.section}` : null, s.rollNo ? `Roll ${s.rollNo}` : null].filter(Boolean).join(' · '),
      })),
      batches: batchRows.map(b => ({ id: b.id, label: b.name, sublabel: b.classLevel ? `Class ${b.classLevel}` : '' })),
      programs: programRows.map(p => ({ id: p.id, label: p.name, sublabel: p.type })),
      faculty: facultyRows.map((f: any) => ({ id: f.id, label: f.name, sublabel: f.subject })),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
