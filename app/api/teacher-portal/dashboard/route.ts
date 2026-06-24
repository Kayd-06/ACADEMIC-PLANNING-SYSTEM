import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Faculty from '@/models/Faculty'
import StudyMaterial from '@/models/StudyMaterial'
import CounselingSession from '@/models/CounselingSession'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await connectDB()

    const [faculty, materials, sessions] = await Promise.all([
      Faculty.find().sort({ name: 1 }).lean(),
      StudyMaterial.find().sort({ createdAt: -1 }).limit(5).lean(),
      CounselingSession.find().sort({ date: -1, time: -1 }).limit(5).lean()
    ])

    // KPIs
    let activeBatches = 0
    faculty.forEach((f: any) => { activeBatches += (f.batches || 0) })

    // Date calculations for "This Week" - simplified to just count all for this demo, or filter by recent
    const recentMaterialsCount = await StudyMaterial.countDocuments() 
    const recentSessionsCount = await CounselingSession.countDocuments()

    const kpis = {
      totalFaculty: faculty.length,
      activeBatches,
      materialsThisWeek: recentMaterialsCount,
      counselingSessions: recentSessionsCount
    }

    // Faculty Mapping
    const mappedFaculty = faculty.map((fac: any) => {
      const colors = ['bg-indigo-600 text-white', 'bg-emerald-600 text-white', 'bg-amber-500 text-white', 'bg-rose-600 text-white', 'bg-blue-600 text-white']
      const initials = fac.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
      const color = colors[fac.name.length % colors.length]
      
      let specTheme = 'blue'
      if (fac.specialization.toLowerCase().includes('neet')) specTheme = 'green'
      if (fac.specialization.toLowerCase().includes('found')) specTheme = 'purple'

      return {
        _id: fac._id.toString(),
        name: fac.name,
        sub: fac.subject,
        spec: fac.specialization,
        specTheme,
        batches: fac.batches,
        exp: fac.experience,
        status: fac.status,
        initials,
        color
      }
    })

    // Materials Mapping
    const mappedMaterials = materials.map((mat: any) => {
      const isDoc = mat.type.toLowerCase().includes('doc') || mat.type.toLowerCase().includes('word')
      return {
        _id: mat._id.toString(),
        title: mat.fileName || mat.provider + ' Upload',
        type: mat.type || 'PDF',
        spec: mat.subject.includes('JEE') ? 'JEE' : (mat.subject.includes('NEET') ? 'NEET' : 'GENERAL'),
        specTheme: mat.subject.includes('NEET') ? 'green' : 'blue',
        author: mat.provider,
        time: new Date(mat.createdAt).toLocaleDateString(),
        iconColor: isDoc ? 'text-blue-500' : 'text-red-500',
        iconBg: isDoc ? 'bg-blue-50' : 'bg-red-50'
      }
    })

    // Counseling Mapping
    const mappedCounseling = sessions.map((sess: any) => ({
      _id: sess._id.toString(),
      student: sess.studentName,
      teacher: `with ${sess.counselor}`,
      date: new Date(sess.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }))

    return NextResponse.json({
      kpis,
      faculty: mappedFaculty,
      materials: mappedMaterials,
      counseling: mappedCounseling
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
