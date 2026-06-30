import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { counselingSessions, faculty, studyMaterials } from '@/lib/db/schema'
import { desc } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [facultyList, materials, sessions] = await Promise.all([
      db.select().from(faculty).orderBy(faculty.name),
      db.select().from(studyMaterials).orderBy(desc(studyMaterials.createdAt)).limit(5),
      db.select().from(counselingSessions).orderBy(desc(counselingSessions.date), desc(counselingSessions.time)).limit(5),
    ])

    const totalBatches = facultyList.reduce((sum, f) => sum + (f.batches ?? 0), 0)
    const allSessions = await db.select().from(counselingSessions)

    const kpis = {
      totalFaculty: facultyList.length,
      activeBatches: totalBatches,
      materialsThisWeek: await db.select().from(studyMaterials).then(r => r.length),
      counselingSessions: allSessions.length,
    }

    const colors = ['bg-indigo-600 text-white', 'bg-emerald-600 text-white', 'bg-amber-500 text-white', 'bg-rose-600 text-white', 'bg-blue-600 text-white']

    const mappedFaculty = facultyList.map(fac => {
      const initials = fac.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
      const color = colors[fac.name.length % colors.length]
      let specTheme = 'blue'
      if (fac.specialization.toLowerCase().includes('neet')) specTheme = 'green'
      if (fac.specialization.toLowerCase().includes('found')) specTheme = 'purple'
      return { _id: fac.id, name: fac.name, sub: fac.subject, spec: fac.specialization, specTheme, batches: fac.batches, exp: fac.experience, status: fac.status, initials, color }
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
        time: new Date(mat.createdAt).toLocaleDateString(),
        iconColor: isDoc ? 'text-blue-500' : 'text-red-500',
        iconBg: isDoc ? 'bg-blue-50' : 'bg-red-50',
      }
    })

    const mappedCounseling = sessions.map(sess => ({
      _id: sess.id,
      student: sess.studentName,
      teacher: `with ${sess.counselor}`,
      date: new Date(sess.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
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
