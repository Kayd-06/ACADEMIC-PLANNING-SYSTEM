import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { assignments, students, assignmentSubmissions } from '@/lib/db/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

function getSchoolId(session: any): string | null {
  const schoolId = session?.user?.schoolId
  if (!schoolId || schoolId === 'null' || schoolId === 'undefined' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(schoolId)) {
    return null
  }
  return schoolId
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if ((session.user as any).role !== 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const assignmentId = searchParams.get('assignmentId')
    const schoolId = getSchoolId(session)

    if (!assignmentId) {
      return NextResponse.json({ error: 'Missing assignmentId' }, { status: 400 })
    }

    // Fetch assignment first to know the batch
    const [assignment] = await db
      .select()
      .from(assignments)
      .where(eq(assignments.id, assignmentId))

    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
    }

    // Fetch students of the assignment's batch and left join their submission for this assignment
    const rows = await db
      .select({
        studentId: students.id,
        studentName: students.name,
        rollNo: students.rollNo,
        email: students.email,
        submissionId: assignmentSubmissions.id,
        submittedAt: assignmentSubmissions.submittedAt,
        gradedAt: assignmentSubmissions.gradedAt,
        gradedBy: assignmentSubmissions.gradedBy,
        fileUrl: assignmentSubmissions.fileUrl,
        marksObtained: assignmentSubmissions.marksObtained,
        feedback: assignmentSubmissions.feedback,
        submissionStatus: assignmentSubmissions.status,
      })
      .from(students)
      .leftJoin(
        assignmentSubmissions,
        and(
          eq(assignmentSubmissions.studentId, students.id),
          eq(assignmentSubmissions.assignmentId, assignmentId)
        )
      )
      .where(
        and(
          eq(students.batch, assignment.batch),
          schoolId ? eq(students.schoolId, schoolId) : undefined
        )
      )

    // Compute status and format response
    let dueDateTime = new Date(`${assignment.dueDate}T23:59:59`)
    if (assignment.dueTime) {
      try {
        // Try parsing time e.g., "11:59 PM" -> hours & minutes
        const timeParts = assignment.dueTime.match(/^(\d+):(\d+)\s*(AM|PM)$/i)
        if (timeParts) {
          let hrs = parseInt(timeParts[1])
          const mins = parseInt(timeParts[2])
          const ampm = timeParts[3].toUpperCase()
          if (ampm === 'PM' && hrs < 12) hrs += 12
          if (ampm === 'AM' && hrs === 12) hrs = 0
          dueDateTime = new Date(`${assignment.dueDate}T${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:00`)
        }
      } catch (err) {
        console.error('Error parsing due time', err)
      }
    }
    const isPastDue = new Date() > dueDateTime

    const formattedList = rows.map((r) => {
      let computedStatus = r.submissionStatus || 'Pending'
      if (!r.submissionId) {
        computedStatus = isPastDue ? 'Not Submitted' : 'Pending'
      } else if (r.marksObtained !== null) {
        computedStatus = 'Graded'
      } else if (r.submittedAt && r.submittedAt > dueDateTime) {
        computedStatus = 'Late'
      } else {
        computedStatus = 'Submitted'
      }

      return {
        studentId: r.studentId,
        studentName: r.studentName,
        rollNo: r.rollNo,
        email: r.email,
        submissionId: r.submissionId,
        submittedAt: r.submittedAt,
        gradedAt: r.gradedAt,
        gradedBy: r.gradedBy,
        fileUrl: r.fileUrl,
        marksObtained: r.marksObtained,
        feedback: r.feedback,
        status: computedStatus,
      }
    })

    return NextResponse.json(formattedList)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if ((session.user as any).role !== 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const { assignmentId, studentId, marksObtained, feedback, fileUrl } = body

    if (!assignmentId || !studentId) {
      return NextResponse.json({ error: 'Missing assignmentId or studentId' }, { status: 400 })
    }

    // Check if submission already exists
    const [existing] = await db
      .select()
      .from(assignmentSubmissions)
      .where(
        and(
          eq(assignmentSubmissions.assignmentId, assignmentId),
          eq(assignmentSubmissions.studentId, studentId)
        )
      )

    const teacherEmail = session.user.email!.toLowerCase()
    let result

    if (existing) {
      const [updated] = await db
        .update(assignmentSubmissions)
        .set({
          marksObtained: marksObtained !== undefined ? Number(marksObtained) : existing.marksObtained,
          feedback: feedback !== undefined ? feedback : existing.feedback,
          fileUrl: fileUrl !== undefined ? fileUrl : existing.fileUrl,
          gradedAt: new Date(),
          gradedBy: teacherEmail,
          status: 'Graded',
          updatedAt: new Date(),
        })
        .where(eq(assignmentSubmissions.id, existing.id))
        .returning()
      result = updated
    } else {
      const [inserted] = await db
        .insert(assignmentSubmissions)
        .values({
          assignmentId,
          studentId,
          marksObtained: marksObtained !== undefined ? Number(marksObtained) : null,
          feedback: feedback || '',
          fileUrl: fileUrl || '',
          gradedAt: new Date(),
          gradedBy: teacherEmail,
          status: 'Graded',
          submittedAt: new Date(), // Mock submission time if graded directly
        })
        .returning()
      result = inserted
    }

    // Dynamically update the submittedCount of the assignment
    const allSubs = await db
      .select()
      .from(assignmentSubmissions)
      .where(eq(assignmentSubmissions.assignmentId, assignmentId))
    
    await db
      .update(assignments)
      .set({ submittedCount: allSubs.length })
      .where(eq(assignments.id, assignmentId))

    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
