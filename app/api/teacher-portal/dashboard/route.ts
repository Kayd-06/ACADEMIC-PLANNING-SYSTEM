import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { counselingSessions, faculty, studyMaterials } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { formatDate } from '@/lib/date'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const schoolId = (session.user as any).schoolId as string | null

    const [facultyList, materials, sessions] = await Promise.all([
      schoolId
        ? db.select().from(faculty).where(eq(faculty.schoolId, schoolId)).orderBy(faculty.name)
        : db.select().from(faculty).orderBy(faculty.name),
      schoolId
        ? db.select().from(studyMaterials).where(eq(studyMaterials.schoolId, schoolId)).orderBy(desc(studyMaterials.createdAt)).limit(5)
        : db.select().from(studyMaterials).orderBy(desc(studyMaterials.createdAt)).limit(5),
      schoolId
        ? db.select().from(counselingSessions).where(eq(counselingSessions.schoolId, schoolId)).orderBy(desc(counselingSessions.date), desc(counselingSessions.time)).limit(5)
        : db.select().from(counselingSessions).orderBy(desc(counselingSessions.date), desc(counselingSessions.time)).limit(5),
    ])

    const totalBatches = facultyList.reduce((sum, f) => sum + (f.batches ?? 0), 0)
    const allSessions = schoolId
      ? await db.select().from(counselingSessions).where(eq(counselingSessions.schoolId, schoolId))
      : await db.select().from(counselingSessions)
    const allMaterials = schoolId
      ? await db.select().from(studyMaterials).where(eq(studyMaterials.schoolId, schoolId))
      : await db.select().from(studyMaterials)

    const kpis = {
      totalFaculty: facultyList.length,
      activeBatches: totalBatches,
      materialsThisWeek: allMaterials.length,
      counselingSessions: allSessions.length,
    }

    const colors = ['bg-indigo-600 text-white', 'bg-emerald-600 text-white', 'bg-amber-500 text-white', 'bg-rose-600 text-white', 'bg-blue-600 text-white']

    const mappedFaculty = facultyList.map(fac => {
      const initials = fac.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
      const color = colors[fac.name.length % colors.length]
      let specTheme = 'blue'
      if (fac.specialization.toLowerCase().includes('neet')) specTheme = 'green'
      if (fac.specialization.toLowerCase().includes('found')) specTheme = 'purple'
      return { _id: fac.id, name: fac.name, sub: fac.subject, spec: fac.specialization, specTheme, batches: fac.batches, exp: fac.experience, status: fac.status, initials, color, profileImgUrl: fac.profileImgUrl }
    })

    const mappedMaterials = materials.map(mat => {
      const isDoc = mat.type.toLowerCase().includes('doc') || mat.type.toLowerCase().includes('word')
      return {
        _id: mat.id,
        title: mat.fileName,
        type: mat.type,
        fileUrl: mat.fileUrl ?? '',
        spec: mat.subject.includes('JEE') ? 'JEE' : (mat.subject.includes('NEET') ? 'NEET' : 'GENERAL'),
        specTheme: mat.subject.includes('NEET') ? 'green' : 'blue',
        author: mat.provider,
        time: formatDate(mat.createdAt),
        iconColor: isDoc ? 'text-blue-500' : 'text-red-500',
        iconBg: isDoc ? 'bg-blue-50' : 'bg-red-50',
      }
    })

    const mappedCounseling = sessions.map(sess => ({
      _id: sess.id,
      student: sess.studentName,
      teacher: `with ${sess.counselor}`,
      date: formatDate(sess.date),
      rawDate: sess.date,
      notes: sess.notes,
      status: sess.status,
      type: sess.type,
      counselor: sess.counselor,
      time: sess.time,
      duration: sess.duration,
      flagged: sess.flagged,
    }))

    return NextResponse.json({ kpis, faculty: mappedFaculty, materials: mappedMaterials, counseling: mappedCounseling })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
