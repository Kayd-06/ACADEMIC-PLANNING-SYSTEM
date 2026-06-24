import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import StudentReport from '@/models/StudentReport'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await connectDB()

    const reports = await StudentReport.find().sort({ uploadedAt: -1 }).lean()

    if (!reports || reports.length === 0) {
      return NextResponse.json({
        performanceTrends: [],
        uploadedReports: [],
        topPerformers: [],
        attentionSubjects: []
      }, {
        headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' }
      })
    }

    // 1. Uploaded Reports mapping
    const uploadedReports = reports.map((r: any) => ({
      _id: r._id.toString(),
      initials: r.teacherName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2),
      name: r.teacherName,
      className: r.className,
      subject: r.subject,
      term: r.term,
      date: new Date(r.uploadedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      students: r.students ? r.students.length : 0,
      theme: 'blue' // Default theme, could be randomized or mapped
    }))

    // 2. Top Performers aggregation
    let allStudents: any[] = []
    reports.forEach((r: any) => {
      if (r.students && Array.isArray(r.students)) {
        r.students.forEach((s: any) => {
          const scorePercentage = (s.marks / s.maxMarks) * 100
          allStudents.push({
            name: s.name,
            className: r.className,
            scoreNum: scorePercentage,
            score: `${scorePercentage.toFixed(1)}%`,
            initials: s.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
          })
        })
      }
    })

    // Sort descending and take top 5
    allStudents.sort((a, b) => b.scoreNum - a.scoreNum)
    const topPerformers = allStudents.slice(0, 5).map((s, idx) => {
      let bg = ''
      if (idx === 0) bg = 'bg-[#0b1320] text-white'
      else if (idx === 1) bg = 'bg-indigo-100 text-indigo-700'
      else if (idx === 2) bg = 'bg-purple-100 text-purple-700'
      
      return {
        _id: `top-${idx}`,
        rank: idx + 1,
        name: s.name,
        className: s.className,
        score: s.score,
        initials: idx < 3 ? s.initials : (idx + 1).toString(),
        bg
      }
    })

    // 3. Needs Attention
    const subjectStats: Record<string, { total: number, count: number }> = {}
    reports.forEach((r: any) => {
      if (!subjectStats[r.subject]) {
        subjectStats[r.subject] = { total: 0, count: 0 }
      }
      if (r.students && Array.isArray(r.students)) {
        r.students.forEach((s: any) => {
          subjectStats[r.subject].total += (s.marks / s.maxMarks) * 100
          subjectStats[r.subject].count += 1
        })
      }
    })

    const attentionSubjects: any[] = []
    Object.keys(subjectStats).forEach(sub => {
      if (subjectStats[sub].count > 0) {
        const avg = subjectStats[sub].total / subjectStats[sub].count
        if (avg < 65) {
          attentionSubjects.push({
            _id: `att-${sub}`,
            subject: sub,
            avg: `${avg.toFixed(1)}%`,
            target: '65%',
            theme: avg < 60 ? 'red' : 'amber'
          })
        }
      }
    })

    // 4. Performance Trends (Math/Science across Terms)
    const termStats: Record<string, { mathTotal: number, mathCount: number, sciTotal: number, sciCount: number }> = {}
    reports.forEach((r: any) => {
      if (!termStats[r.term]) {
        termStats[r.term] = { mathTotal: 0, mathCount: 0, sciTotal: 0, sciCount: 0 }
      }
      
      if (r.subject.toLowerCase().includes('math')) {
        if (r.students) {
          r.students.forEach((s: any) => {
            termStats[r.term].mathTotal += (s.marks / s.maxMarks) * 100
            termStats[r.term].mathCount += 1
          })
        }
      } else if (r.subject.toLowerCase().includes('science')) {
        if (r.students) {
          r.students.forEach((s: any) => {
            termStats[r.term].sciTotal += (s.marks / s.maxMarks) * 100
            termStats[r.term].sciCount += 1
          })
        }
      }
    })

    // Create sorted terms (assuming standard order, or just alphabetically for now)
    const terms = Object.keys(termStats).sort()
    const performanceTrends = terms.map(term => {
      const stats = termStats[term]
      const mathAvg = stats.mathCount > 0 ? (stats.mathTotal / stats.mathCount) : 0
      const sciAvg = stats.sciCount > 0 ? (stats.sciTotal / stats.sciCount) : 0
      
      return {
        _id: `trend-${term}`,
        label: term,
        math: Math.round(mathAvg),
        science: Math.round(sciAvg)
      }
    })

    return NextResponse.json({
      performanceTrends,
      uploadedReports,
      topPerformers,
      attentionSubjects
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0, must-revalidate'
      }
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
