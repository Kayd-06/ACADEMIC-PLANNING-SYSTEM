import { NextResponse } from 'next/server'
import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { academicMetrics, academicMilestones, academicPlanningLogs } from '@/lib/db/schema'
import { isUuid, requireSchool } from '@/lib/tenant'
import { errorResponse, HttpError } from '@/lib/api/http'
import { parseMetricInput } from '@/lib/academicPlanning/metrics'

export const dynamic = 'force-dynamic'

// Academic Planning board (milestones, planning logs, metrics) — moved from
// MongoDB to Postgres (migration 0052). Response shapes are unchanged:
// GET -> { milestones, logs, metrics }, items carry `_id` as before.
// Differences: requires a signed-in staff user, data is per school, and an
// empty board stays empty (the old GET seeded demo rows into the database);
// stat tiles (metrics) are created explicitly via POST modelType 'metric'.

type BoardRole = 'management' | 'teacher'
type ModelType = 'milestone' | 'log' | 'metric'

const withMongoId = <T extends { id: string }>(row: T) => ({ ...row, _id: row.id })

async function requireStaff() {
  const session = await auth()
  if (!session) throw new HttpError(401, 'Unauthorized')
  const role = (session.user as any).role as string
  if (role !== 'management' && role !== 'teacher') throw new HttpError(403, 'Forbidden')
  return { session, role: role as BoardRole }
}

/** Management may use either board; a teacher only the teacher board. */
function checkBoard(userRole: BoardRole, board: unknown): BoardRole {
  if (board !== 'management' && board !== 'teacher') throw new HttpError(400, 'Role is required')
  if (userRole === 'teacher' && board !== 'teacher') throw new HttpError(403, 'Forbidden')
  return board
}

function str(body: Record<string, unknown>, key: string, max: number, required: boolean): string | undefined {
  const v = body[key]
  if (v === undefined || v === null || v === '') {
    if (required) throw new HttpError(400, `${key} is required`)
    return undefined
  }
  if (typeof v !== 'string' && typeof v !== 'number') throw new HttpError(400, `${key} is invalid`)
  const s = String(v).trim()
  if (required && !s) throw new HttpError(400, `${key} is required`)
  if (s.length > max) throw new HttpError(400, `${key} is too long`)
  return s
}

function milestoneFields(body: Record<string, unknown>, partial: boolean) {
  const out = {
    name: str(body, 'name', 255, !partial),
    type: str(body, 'type', 100, !partial),
    date: str(body, 'date', 10, !partial),
    subject: str(body, 'subject', 255, !partial),
    status: str(body, 'status', 50, false),
  }
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined))
}

function logFields(body: Record<string, unknown>, partial: boolean) {
  const out = {
    title: str(body, 'title', 255, !partial),
    focus: str(body, 'focus', 5000, !partial),
    type: str(body, 'type', 50, !partial),
    measure: str(body, 'measure', 5000, !partial),
    measureLabel: str(body, 'measureLabel', 255, !partial),
  }
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined))
}

function metricFields(body: Record<string, unknown>, partial: boolean) {
  const parsed = parseMetricInput(body, partial)
  if (!parsed.ok) throw new HttpError(400, parsed.error)
  return parsed.value
}

export async function GET(request: Request) {
  try {
    const { session, role } = await requireStaff()
    const { searchParams } = new URL(request.url)
    const board = checkBoard(role, searchParams.get('role'))
    const schoolId = requireSchool(session)

    // Read-only: no seeding on GET.
    const [milestones, logs, metrics] = await Promise.all([
      db.select().from(academicMilestones)
        .where(and(eq(academicMilestones.schoolId, schoolId), eq(academicMilestones.role, board)))
        .orderBy(asc(academicMilestones.date)),
      db.select().from(academicPlanningLogs)
        .where(and(eq(academicPlanningLogs.schoolId, schoolId), eq(academicPlanningLogs.role, board)))
        .orderBy(desc(academicPlanningLogs.createdAt)),
      db.select().from(academicMetrics)
        .where(and(eq(academicMetrics.schoolId, schoolId), eq(academicMetrics.role, board)))
        .orderBy(asc(academicMetrics.createdAt)),
    ])

    return NextResponse.json({
      milestones: milestones.map(withMongoId),
      logs: logs.map(withMongoId),
      metrics: metrics.map(withMongoId),
    }, {
      headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' },
    })
  } catch (error) {
    return errorResponse(error, 'GET /api/academic-planning')
  }
}

export async function POST(request: Request) {
  try {
    const { session, role } = await requireStaff()
    const body = (await request.json()) as Record<string, unknown>
    const modelType = body.modelType as ModelType
    if (modelType !== 'milestone' && modelType !== 'log' && modelType !== 'metric') {
      return NextResponse.json({ error: 'Invalid modelType' }, { status: 400 })
    }
    const board = checkBoard(role, body.role)
    const schoolId = requireSchool(session)
    const createdBy = isUuid((session.user as any).id) ? (session.user as any).id as string : null

    if (modelType === 'milestone') {
      const [row] = await db.insert(academicMilestones)
        .values({ ...(milestoneFields(body, false) as any), role: board, schoolId, createdBy })
        .returning()
      return NextResponse.json(withMongoId(row))
    }
    if (modelType === 'metric') {
      const fields = metricFields(body, false)
      const [row] = await db.insert(academicMetrics)
        .values({
          label: fields.label!, value: fields.value!, trend: fields.trend!, category: fields.category!,
          chartData: fields.chartData ?? [], role: board, schoolId,
        })
        .returning()
      return NextResponse.json(withMongoId(row))
    }
    const [row] = await db.insert(academicPlanningLogs)
      .values({ ...(logFields(body, false) as any), role: board, schoolId, createdBy })
      .returning()
    return NextResponse.json(withMongoId(row))
  } catch (error) {
    return errorResponse(error, 'POST /api/academic-planning')
  }
}

export async function PATCH(request: Request) {
  try {
    const { session, role } = await requireStaff()
    const body = (await request.json()) as Record<string, unknown>
    const { id, modelType } = body as { id?: unknown; modelType?: ModelType }
    if (!isUuid(id)) return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    if (modelType !== 'milestone' && modelType !== 'log' && modelType !== 'metric') {
      return NextResponse.json({ error: 'Invalid modelType' }, { status: 400 })
    }
    const schoolId = requireSchool(session)
    // A teacher can only edit the teacher board.
    const boards: BoardRole[] = role === 'management' ? ['management', 'teacher'] : ['teacher']

    let updated: { id: string } | undefined
    if (modelType === 'milestone') {
      const fields = milestoneFields(body, true)
      ;[updated] = await db.update(academicMilestones).set({ ...fields, updatedAt: new Date() })
        .where(and(eq(academicMilestones.id, id), eq(academicMilestones.schoolId, schoolId), inArray(academicMilestones.role, boards)))
        .returning()
    } else if (modelType === 'log') {
      const fields = logFields(body, true)
      ;[updated] = await db.update(academicPlanningLogs).set({ ...fields, updatedAt: new Date() })
        .where(and(eq(academicPlanningLogs.id, id), eq(academicPlanningLogs.schoolId, schoolId), inArray(academicPlanningLogs.role, boards)))
        .returning()
    } else {
      const fields = metricFields(body, true)
      ;[updated] = await db.update(academicMetrics).set({ ...fields, updatedAt: new Date() })
        .where(and(eq(academicMetrics.id, id), eq(academicMetrics.schoolId, schoolId), inArray(academicMetrics.role, boards)))
        .returning()
    }
    if (!updated) return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    return NextResponse.json(withMongoId(updated))
  } catch (error) {
    return errorResponse(error, 'PATCH /api/academic-planning')
  }
}

export async function DELETE(request: Request) {
  try {
    const { session, role } = await requireStaff()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const type = searchParams.get('type')

    if (!id || !type) return NextResponse.json({ error: 'ID and Type are required' }, { status: 400 })
    if (!isUuid(id)) return NextResponse.json({ success: true })
    const schoolId = requireSchool(session)
    const boards: BoardRole[] = role === 'management' ? ['management', 'teacher'] : ['teacher']

    if (type === 'milestone') {
      await db.delete(academicMilestones).where(and(eq(academicMilestones.id, id), eq(academicMilestones.schoolId, schoolId), inArray(academicMilestones.role, boards)))
    } else if (type === 'log') {
      await db.delete(academicPlanningLogs).where(and(eq(academicPlanningLogs.id, id), eq(academicPlanningLogs.schoolId, schoolId), inArray(academicPlanningLogs.role, boards)))
    } else if (type === 'metric') {
      await db.delete(academicMetrics).where(and(eq(academicMetrics.id, id), eq(academicMetrics.schoolId, schoolId), inArray(academicMetrics.role, boards)))
    } else {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return errorResponse(error, 'DELETE /api/academic-planning')
  }
}
