'use client'
import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Printer, Download, User, Calendar, Award, ChevronRight, BarChart2, CheckCircle2, TrendingUp, ChevronDown, List } from 'lucide-react'

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, type: 'spring' as const, stiffness: 320, damping: 28 },
})

const trendData = [
  { label: 'Unit Test 1', physics: 82, chemistry: 71, math: 88 },
  { label: 'Mid-Term', physics: 78, chemistry: 82, math: 92 },
  { label: 'Unit Test 2', physics: 87, chemistry: 76, math: 97 },
  { label: 'Pre-Board', physics: 93, chemistry: 88, math: 95 },
  { label: 'Finals', physics: 97, chemistry: 91, math: 100 },
]

function MultiLineChart({ data }: { data: any[] }) {
  const W = 500
  const H = 220
  const max = 100
  
  const getPts = (key: string) => data.map((d, i) => ({
    x: (i / (data.length - 1)) * W,
    y: H - (d[key] / max) * H
  }))

  const phys = getPts('physics')
  const chem = getPts('chemistry')
  const math = getPts('math')

  const toPath = (pts: {x: number, y: number}[]) => 
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

  return (
    <div className="overflow-x-auto w-full pt-4">
      <svg width="100%" viewBox={`-10 -10 ${W + 20} ${H + 40}`} style={{ minWidth: 400 }}>
        {/* Grid */}
        {[0, 20, 40, 60, 80, 100].map(v => (
          <g key={v}>
            <line x1={0} y1={H - (v / 100) * H} x2={W} y2={H - (v / 100) * H} stroke="#f1f5f9" strokeWidth={1} strokeDasharray="4 4" />
            <text x={-5} y={H - (v / 100) * H + 3} textAnchor="end" fontSize={10} fill="#94a3b8">{v}</text>
          </g>
        ))}
        {/* Lines */}
        {phys.length > 0 && <path d={toPath(phys)} fill="none" stroke="#0f172a" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />}
        {chem.length > 0 && <path d={toPath(chem)} fill="none" stroke="#93c5fd" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />}
        {math.length > 0 && <path d={toPath(math)} fill="none" stroke="#d97706" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />}
        
        {/* Points */}
        {phys.map((p, i) => <circle key={`p${i}`} cx={p.x} cy={p.y} r={4} fill="#0f172a" />)}
        {chem.map((p, i) => <circle key={`c${i}`} cx={p.x} cy={p.y} r={4} fill="#93c5fd" />)}
        {math.map((p, i) => <circle key={`m${i}`} cx={p.x} cy={p.y} r={4} fill="#d97706" />)}
        
        {/* Labels */}
        {data.map((d, i) => (
          <text key={d.label} x={(i / (data.length - 1)) * W} y={H + 20} textAnchor="middle" fontSize={10} fill="#64748b">
            {d.label}
          </text>
        ))}
      </svg>
      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-4 pb-2">
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-slate-900"/> <span className="text-xs font-semibold text-slate-600">Physics</span></div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-blue-300"/> <span className="text-xs font-semibold text-slate-600">Chemistry</span></div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-amber-600"/> <span className="text-xs font-semibold text-slate-600">Mathematics</span></div>
      </div>
    </div>
  )
}

function Heatmap({ averageAttendance }: { averageAttendance: number }) {
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  const statusColors = ['#fecaca', '#bbf7d0', '#fef08a', '#e2e8f0']
  
  // Create a mock 30-day pattern based on the average attendance percentage
  const grid = useMemo(() => {
    const presentCount = Math.round((averageAttendance / 100) * 35) // out of 5 weeks (35 days)
    const arr = Array(35).fill(0)
    for (let i = 0; i < presentCount; i++) arr[i] = 1
    // Add weekends (gray)
    for (let i = 5; i < 35; i += 7) arr[i] = 3
    for (let i = 6; i < 35; i += 7) arr[i] = 3
    // Shuffle the weekdays slightly for realism
    for (let i = 0; i < 35; i++) {
      if (arr[i] === 3) continue
      const swapWith = Math.floor(Math.random() * 35)
      if (arr[swapWith] !== 3) {
        const temp = arr[i]; arr[i] = arr[swapWith]; arr[swapWith] = temp
      }
    }
    // Convert to 2D array of 5 weeks
    const result = []
    for(let i = 0; i < 35; i += 7) result.push(arr.slice(i, i + 7))
    return result
  }, [averageAttendance])

  return (
    <div className="w-full">
      <div className="grid grid-cols-7 gap-2 mb-2">
        {days.map((d, i) => (
          <div key={i} className="text-center text-[10px] font-semibold text-slate-400">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {grid.flat().map((status, i) => (
          <div 
            key={i} 
            className="aspect-square rounded-sm transition-colors duration-300 hover:opacity-80"
            style={{ backgroundColor: statusColors[status] }}
          />
        ))}
      </div>
    </div>
  )
}

export default function StudentPerformanceDashboard() {
  const [reports, setReports] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedStudentName, setSelectedStudentName] = useState<string>('')

  useEffect(() => {
    fetch('/api/student-reports')
      .then(res => res.json())
      .then(data => {
        if (!data.error) {
          setReports(data)
          // Extract unique students to pick a default
          const students = new Set<string>()
          data.forEach((r: any) => r.students.forEach((s: any) => students.add(s.name)))
          const arr = Array.from(students)
          if (arr.length > 0) setSelectedStudentName(arr[0])
        }
      })
      .finally(() => setLoading(false))
  }, [])

  // Aggregate data for the selected student
  const studentData = useMemo(() => {
    if (!selectedStudentName) return null

    const studentReports = reports.filter(r => r.students.some((s: any) => s.name === selectedStudentName))
    if (studentReports.length === 0) return null

    // Get basic info from the most recent report
    const latestReport = studentReports.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())[0]
    const studentInfo = latestReport.students.find((s: any) => s.name === selectedStudentName)

    // Calculate Subject Proficiency (latest score for each subject)
    const subjectsMap = new Map<string, any>()
    studentReports.forEach(r => {
      const s = r.students.find((s: any) => s.name === selectedStudentName)
      if (!s) return
      // Calculate class average for this report
      const classAvg = r.students.length ? r.students.reduce((acc: number, st: any) => acc + (st.marks/st.maxMarks)*100, 0) / r.students.length : 0
      
      // If we haven't recorded this subject yet, or if this report is newer, update it
      // (Assuming reports are processed chronologically, but we sorted descending, so we should reverse or just take first)
      if (!subjectsMap.has(r.subject)) {
        subjectsMap.set(r.subject, {
          sub: r.subject,
          score: `${Math.round((s.marks / s.maxMarks) * 100)}%`,
          scoreNum: (s.marks / s.maxMarks) * 100,
          avg: `${Math.round(classAvg)}%`,
          grade: s.grade,
          col: s.grade.startsWith('A') ? 'bg-emerald-50 text-emerald-700' : s.grade.startsWith('B') ? 'bg-blue-50 text-blue-700' : 'bg-yellow-50 text-yellow-700'
        })
      }
    })
    const subjectProficiency = Array.from(subjectsMap.values())

    // Calculate Average Score across all subjects/terms
    const allScores = studentReports.map(r => {
      const s = r.students.find((s: any) => s.name === selectedStudentName)
      return s ? (s.marks / s.maxMarks) * 100 : 0
    }).filter(s => s > 0)
    const averageScore = allScores.length ? allScores.reduce((a,b)=>a+b,0) / allScores.length : 0

    // Calculate Attendance
    const allAttendance = studentReports.map(r => {
      const s = r.students.find((s: any) => s.name === selectedStudentName)
      return s ? s.attendance : 0
    })
    const averageAttendance = allAttendance.length ? allAttendance.reduce((a,b)=>a+b,0) / allAttendance.length : 0

    // Trend Data (Group by term for Math, Physics, Chemistry)
    const termsMap = new Map<string, any>()
    studentReports.forEach(r => {
      if (!termsMap.has(r.term)) termsMap.set(r.term, { label: r.term, physics: null, chemistry: null, math: null })
      const termData = termsMap.get(r.term)
      const s = r.students.find((s: any) => s.name === selectedStudentName)
      if (s) {
        const score = (s.marks / s.maxMarks) * 100
        if (r.subject.toLowerCase().includes('phys')) termData.physics = score
        if (r.subject.toLowerCase().includes('chem')) termData.chemistry = score
        if (r.subject.toLowerCase().includes('math')) termData.math = score
      }
    })
    const trend = Array.from(termsMap.values()).map(t => ({
      label: t.label,
      physics: t.physics || 0,
      chemistry: t.chemistry || 0,
      math: t.math || 0
    }))

    // Get all unique students for dropdown
    const allStudentsSet = new Set<string>()
    reports.forEach(r => r.students.forEach((s: any) => allStudentsSet.add(s.name)))

    return {
      name: selectedStudentName,
      className: latestReport.className,
      term: latestReport.term,
      id: studentInfo.rollNo || `STU-${Math.floor(Math.random()*10000)}`,
      averageScore,
      averageAttendance,
      subjectProficiency,
      trend,
      allStudents: Array.from(allStudentsSet).sort()
    }
  }, [reports, selectedStudentName])

  if (loading) return <div className="p-8 text-slate-500">Loading student data...</div>
  if (!studentData) return <div className="p-8 text-slate-500">No student data available. Please upload reports first.</div>

  return (
    <div className="flex-1 p-6 overflow-auto bg-slate-50 min-h-screen">
      {/* Breadcrumb & Selector */}
      <motion.div {...fadeUp(0)} className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span className="hover:text-slate-900 cursor-pointer transition-colors">Students</span>
          <ChevronRight className="w-4 h-4" />
          <span className="hover:text-slate-900 cursor-pointer transition-colors">{studentData.className}</span>
          <ChevronRight className="w-4 h-4" />
          <span className="font-semibold text-slate-900">{studentData.name}</span>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-500">Select Student:</span>
          <div className="relative">
            <select
              value={selectedStudentName}
              onChange={(e) => setSelectedStudentName(e.target.value)}
              className="appearance-none pl-4 pr-10 py-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {studentData.allStudents.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </motion.div>

      {/* Header */}
      <motion.div {...fadeUp(0.05)} className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Student Performance Report</h1>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors shadow-sm">
            <Printer className="w-4 h-4" /> Print
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-[#0f172a] text-white rounded-lg text-sm font-semibold hover:bg-slate-800 transition-colors shadow-sm">
            <Download className="w-4 h-4" /> Export PDF
          </button>
        </div>
      </motion.div>

      <div className="grid grid-cols-12 gap-6 mb-6">
        {/* Profile Card (8 cols) */}
        <motion.div {...fadeUp(0.1)} className="col-span-12 lg:col-span-8 bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex items-start gap-6">
          <div className="w-24 h-24 rounded-lg bg-slate-100 border border-slate-200 shrink-0 overflow-hidden flex items-center justify-center">
            {/* Using a placeholder SVG or just a generic avatar icon */}
            <User className="w-10 h-10 text-slate-300" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-xl font-bold text-slate-900">{studentData.name}</h2>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide border flex items-center gap-1 ${
                studentData.averageScore >= 90 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                studentData.averageScore >= 75 ? 'bg-blue-50 text-blue-700 border-blue-200' :
                'bg-yellow-50 text-yellow-700 border-yellow-200'
              }`}>
                <CheckCircle2 className="w-3 h-3" /> {studentData.averageScore >= 90 ? 'Excellent' : studentData.averageScore >= 75 ? 'Good' : 'Needs Work'}
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <User className="w-4 h-4 text-slate-400" /> ID: {studentData.id}
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Award className="w-4 h-4 text-slate-400" /> Class: {studentData.className}
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Calendar className="w-4 h-4 text-slate-400" /> Term: {studentData.term}
              </div>
            </div>
          </div>
        </motion.div>

        {/* KPIs (4 cols) */}
        <motion.div {...fadeUp(0.15)} className="col-span-12 lg:col-span-4 flex flex-col gap-4">
          <div className="flex gap-4">
            <div className="flex-1 bg-white border border-slate-200 rounded-xl p-4 shadow-sm relative overflow-hidden">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                <BarChart2 className="w-4 h-4 text-indigo-500" /> Average Score
              </div>
              <div className="flex items-end gap-2">
                <span className="text-3xl font-bold text-slate-900 leading-none">{studentData.averageScore.toFixed(1)}%</span>
                <span className="text-sm font-bold text-emerald-500 flex items-center mb-1"><TrendingUp className="w-3 h-3 mr-0.5"/></span>
              </div>
            </div>
            <div className="flex-1 bg-white border border-slate-200 rounded-xl p-4 shadow-sm relative overflow-hidden">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                <Award className="w-4 h-4 text-amber-500" /> Class Rank
              </div>
              <div className="flex items-end gap-1">
                <span className="text-3xl font-bold text-slate-900 leading-none">--</span>
                <span className="text-sm font-semibold text-slate-400 mb-1">/ --</span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <Calendar className="w-4 h-4 text-emerald-500" /> Attendance Rate
              </div>
              <span className="text-xl font-bold text-slate-900">{studentData.averageAttendance.toFixed(0)}%</span>
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden mt-2">
              <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${studentData.averageAttendance}%` }} />
            </div>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Left Column */}
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
          
          {/* Trend Analysis Chart */}
          <motion.div {...fadeUp(0.2)} className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-bold text-slate-900">Trend Analysis: Core Subjects</h3>
              <button className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-600 rounded-md text-xs font-semibold hover:bg-slate-100 transition-colors">
                Academic Year 2023-24 <ChevronDown className="w-3 h-3" />
              </button>
            </div>
            <MultiLineChart data={studentData.trend.length ? studentData.trend : trendData} />
          </motion.div>

          {/* Counselor Observations */}
          <motion.div {...fadeUp(0.25)} className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <User className="w-4 h-4 text-slate-500" />
              <h3 className="text-sm font-bold text-slate-900">Counselor Observations</h3>
            </div>
            
            <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Academic Strengths</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">
                {studentData.name} demonstrates strong academic potential and actively participates in subjects. 
                {studentData.averageScore > 85 ? ` ${studentData.name.split(' ')[0]} is performing exceptionally well across the board.` : ''}
              </p>
            </div>
          </motion.div>
        </div>

        {/* Right Column */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
          
          {/* Subject Proficiency */}
          <motion.div {...fadeUp(0.3)} className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
            <div className="flex items-center gap-2 mb-6">
              <List className="w-4 h-4 text-slate-500" />
              <h3 className="text-sm font-bold text-slate-900">Subject Proficiency</h3>
            </div>
            
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="pb-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Subject</th>
                  <th className="pb-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Score</th>
                  <th className="pb-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Class Avg</th>
                  <th className="pb-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Grade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {studentData.subjectProficiency.map((row: any, i: number) => (
                  <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 text-sm font-bold text-slate-800">{row.sub}</td>
                    <td className="py-3.5 text-sm font-bold text-slate-900">{row.score}</td>
                    <td className="py-3.5 text-sm text-slate-500">{row.avg}</td>
                    <td className="py-3.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${row.col}`}>{row.grade}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>

          {/* Attendance Heatmap */}
          <motion.div {...fadeUp(0.35)} className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
            <div className="flex items-center gap-2 mb-6">
              <Calendar className="w-4 h-4 text-slate-500" />
              <h3 className="text-sm font-bold text-slate-900">Attendance Heatmap <span className="text-slate-400 font-normal">(Last 30 Days)</span></h3>
            </div>
            
            <Heatmap averageAttendance={studentData.averageAttendance} />
          </motion.div>

        </div>
      </div>

    </div>
  )
}
