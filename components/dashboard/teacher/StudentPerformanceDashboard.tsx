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

const SUBJECT_COLORS = [
  '#6366f1', // Indigo
  '#d97706', // Amber
  '#10b981', // Emerald
  '#ec4899', // Pink
  '#3b82f6', // Blue
  '#8b5cf6', // Purple
  '#06b6d4', // Cyan
  '#f43f5e', // Rose
]

function MultiLineChart({ data, subjects }: { data: any[], subjects: string[] }) {
  const W = 500
  const H = 220
  const max = 100
  
  const getSubjectColor = (idx: number) => SUBJECT_COLORS[idx % SUBJECT_COLORS.length]

  const toPath = (pts: {x: number, y: number}[]) => {
    if (pts.length === 0) return ''
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y} L ${pts[0].x} ${pts[0].y}`
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  }

  // Pre-calculate points for each subject
  const subjectLines = useMemo(() => {
    return subjects.map((subj, idx) => {
      const pts = data.map((d, i) => {
        const val = d.scores?.[subj]
        if (val === undefined || val === null) return null
        const x = data.length > 1 ? (i / (data.length - 1)) * W : W / 2
        return { x, y: H - (val / max) * H, val }
      }).filter((p): p is { x: number; y: number; val: number } => p !== null)

      return {
        subject: subj,
        pts,
        color: getSubjectColor(idx),
        path: toPath(pts)
      }
    })
  }, [data, subjects])

  return (
    <div className="overflow-x-auto w-full pt-4">
      <svg width="100%" viewBox={`-35 -10 ${W + 45} ${H + 40}`} style={{ minWidth: 400 }}>
        {/* Grid */}
        {[0, 20, 40, 60, 80, 100].map(v => (
          <g key={v}>
            <line x1={0} y1={H - (v / 100) * H} x2={W} y2={H - (v / 100) * H} stroke="#f1f5f9" strokeWidth={1} strokeDasharray="4 4" />
            <text x={-8} y={H - (v / 100) * H + 3} textAnchor="end" fontSize={10} fill="#94a3b8">{v}%</text>
          </g>
        ))}
        
        {/* Lines */}
        {subjectLines.map(line => (
          line.pts.length > 0 && (
            <path
              key={line.subject}
              d={line.path}
              fill="none"
              stroke={line.color}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )
        ))}
        
        {/* Points */}
        {subjectLines.map(line => (
          line.pts.map((p, i) => (
            <circle
              key={`${line.subject}-${i}`}
              cx={p.x}
              cy={p.y}
              r={4}
              fill={line.color}
              stroke="white"
              strokeWidth={1.5}
            />
          ))
        ))}
        
        {/* X Labels */}
        {data.map((d, i) => {
          const x = data.length > 1 ? (i / (data.length - 1)) * W : W / 2
          return (
            <text key={d.label} x={x} y={H + 20} textAnchor="middle" fontSize={10} fill="#64748b">
              {d.label}
            </text>
          )
        })}
      </svg>
      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-6 mt-4 pb-2">
        {subjectLines.map(line => (
          <div key={line.subject} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm animate-pulse" style={{ backgroundColor: line.color }} />
            <span className="text-xs font-semibold text-slate-600">{line.subject}</span>
          </div>
        ))}
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
  const [selectedClassName, setSelectedClassName] = useState<string>('')
  const [selectedStudentName, setSelectedStudentName] = useState<string>('')

  useEffect(() => {
    fetch('/api/student-reports')
      .then(res => res.json())
      .then(data => {
        if (!data.error) {
          setReports(data)
          // Extract unique classes
          const classes = Array.from(new Set(data.map((r: any) => r.className))).sort() as string[]
          if (classes.length > 0) {
            setSelectedClassName(classes[0])
            
            // Get students of this class
            const classReports = data.filter((r: any) => r.className === classes[0])
            const classStudents = new Set<string>()
            classReports.forEach((r: any) => r.students.forEach((s: any) => classStudents.add(s.name)))
            const arr = Array.from(classStudents).sort()
            if (arr.length > 0) setSelectedStudentName(arr[0])
          }
        }
      })
      .finally(() => setLoading(false))
  }, [])

  const uniqueClasses = useMemo(() => {
    return Array.from(new Set(reports.map(r => r.className))).sort()
  }, [reports])

  const studentsInSelectedClass = useMemo(() => {
    if (!selectedClassName) return []
    const classReports = reports.filter(r => r.className === selectedClassName)
    const set = new Set<string>()
    classReports.forEach(r => r.students.forEach((s: any) => set.add(s.name)))
    return Array.from(set).sort()
  }, [reports, selectedClassName])

  const handleClassChange = (newClassName: string) => {
    setSelectedClassName(newClassName)
    const classReports = reports.filter(r => r.className === newClassName)
    const set = new Set<string>()
    classReports.forEach(r => r.students.forEach((s: any) => set.add(s.name)))
    const arr = Array.from(set).sort()
    if (arr.length > 0) {
      setSelectedStudentName(arr[0])
    } else {
      setSelectedStudentName('')
    }
  }

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

    // Trend Data (Group by term for all dynamic subjects)
    const termsMap = new Map<string, any>()
    const studentSubjectsSet = new Set<string>()
    studentReports.forEach(r => {
      studentSubjectsSet.add(r.subject)
      if (!termsMap.has(r.term)) {
        termsMap.set(r.term, { label: r.term, scores: {} })
      }
      const termData = termsMap.get(r.term)
      const s = r.students.find((s: any) => s.name === selectedStudentName)
      if (s) {
        termData.scores[r.subject] = (s.marks / s.maxMarks) * 100
      }
    })
    
    const studentSubjects = Array.from(studentSubjectsSet).sort()

    const termOrder = ['Term 1 2024', 'Unit Test 1', 'Mid-Term', 'Unit Test 2', 'Pre-Board', 'Finals', 'Mid-Year 2025']
    const trend = Array.from(termsMap.values()).map(t => ({
      label: t.label,
      scores: t.scores
    })).sort((a, b) => {
      const idxA = termOrder.indexOf(a.label)
      const idxB = termOrder.indexOf(b.label)
      if (idxA !== -1 && idxB !== -1) return idxA - idxB
      if (idxA !== -1) return -1
      if (idxB !== -1) return 1
      return a.label.localeCompare(b.label)
    })

    // Calculate Class Rank dynamically
    const allStudentsSet = new Set<string>()
    reports.forEach(r => r.students.forEach((s: any) => allStudentsSet.add(s.name)))
    const studentNames = Array.from(allStudentsSet)
    
    const studentAverages = studentNames.map(name => {
      const sReports = reports.filter(r => r.students.some((s: any) => s.name === name))
      const scores = sReports.map(r => {
        const s = r.students.find((s: any) => s.name === name)
        return s ? (s.marks / s.maxMarks) * 100 : 0
      }).filter(s => s > 0)
      const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
      return { name, avg }
    })
    
    studentAverages.sort((a, b) => b.avg - a.avg)
    const rankIndex = studentAverages.findIndex(s => s.name === selectedStudentName)
    const rank = rankIndex !== -1 ? rankIndex + 1 : 1
    const totalStudents = studentAverages.length

    // Gather teacher remarks from reports
    const observations = studentReports
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
      .map(r => {
        const s = r.students.find((s: any) => s.name === selectedStudentName)
        return s?.remarks ? { subject: r.subject, term: r.term, text: s.remarks } : null
      })
      .filter(obs => obs !== null) as any[]

    return {
      name: selectedStudentName,
      className: latestReport.className,
      term: latestReport.term,
      id: studentInfo.rollNo || `STU-${Math.floor(Math.random()*10000)}`,
      averageScore,
      averageAttendance,
      subjectProficiency,
      trend,
      subjects: studentSubjects,
      rank,
      totalStudents,
      observations,
      allStudents: studentNames.sort()
    }
  }, [reports, selectedStudentName])

  if (loading) return <div className="p-8 text-slate-500">Loading student data...</div>
  if (!studentData) return <div className="p-8 text-slate-500">No student data available. Please upload reports first.</div>

  return (
    <div className="flex-1 p-6 overflow-auto bg-slate-50">
      {/* Breadcrumb & Selector */}
      <motion.div {...fadeUp(0)} className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span 
            onClick={() => {
              if (uniqueClasses.length > 0) handleClassChange(uniqueClasses[0])
            }}
            className="hover:text-slate-900 cursor-pointer transition-colors"
          >
            Students
          </span>
          <ChevronRight className="w-4 h-4" />
          
          <div className="relative inline-block print:hidden bg-slate-100 hover:bg-slate-200/80 px-2.5 py-1 rounded-lg transition-all border border-slate-200/50 shadow-sm">
            <select
              value={selectedClassName}
              onChange={(e) => handleClassChange(e.target.value)}
              className="appearance-none bg-transparent hover:text-slate-900 cursor-pointer font-extrabold text-slate-800 transition-colors focus:outline-none pr-5 text-xs tracking-wide uppercase"
            >
              {uniqueClasses.map(cls => <option key={cls} value={cls}>{cls}</option>)}
            </select>
            <ChevronDown className="w-3 h-3 text-slate-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          
          {/* For printing: show class name statically */}
          <span className="hidden print:inline font-bold text-slate-800">{selectedClassName}</span>
          
          <ChevronRight className="w-4 h-4" />
          <span className="font-semibold text-slate-900">{studentData.name}</span>
        </div>
        
        <div className="flex items-center gap-2 print:hidden">
          <span className="text-sm font-semibold text-slate-500">Select Student:</span>
          <div className="relative">
            <select
              value={selectedStudentName}
              onChange={(e) => setSelectedStudentName(e.target.value)}
              className="appearance-none pl-4 pr-10 py-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {studentsInSelectedClass.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </motion.div>

      {/* Header */}
      <motion.div {...fadeUp(0.05)} className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Student Performance Report</h1>
        <div className="flex items-center gap-3 print:hidden">
          <button 
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors shadow-sm"
          >
            <Printer className="w-4 h-4" /> Print
          </button>
          <button 
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-[#0f172a] text-white rounded-lg text-sm font-semibold hover:bg-slate-800 transition-colors shadow-sm"
          >
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
                <span className="text-3xl font-bold text-slate-900 leading-none">{studentData.rank}</span>
                <span className="text-sm font-semibold text-slate-400 mb-1">/ {studentData.totalStudents}</span>
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
            <MultiLineChart data={studentData.trend} subjects={studentData.subjects} />
          </motion.div>

          {/* Counselor Observations */}
          <motion.div {...fadeUp(0.25)} className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <User className="w-4 h-4 text-slate-500" />
              <h3 className="text-sm font-bold text-slate-900">Counselor Observations</h3>
            </div>
            
            <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Academic Strengths & Feedback</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <p className="text-sm text-slate-700 leading-relaxed mb-3">
                {studentData.name} demonstrates strong academic potential and actively participates in subjects. 
                {studentData.averageScore > 85 ? ` ${studentData.name.split(' ')[0]} is performing exceptionally well across the board.` : ''}
              </p>
              {studentData.observations && studentData.observations.length > 0 && (
                <div className="mt-3 pt-3 border-t border-emerald-100 space-y-2">
                  <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block mb-1">Teacher Remarks</span>
                  <div className="grid gap-2">
                    {studentData.observations.map((obs: any, idx: number) => (
                      <div key={idx} className="text-xs text-slate-600 bg-white/40 p-2 rounded border border-emerald-50/50">
                        <div className="flex justify-between items-center mb-0.5">
                          <span className="font-bold text-slate-800 text-[10px]">{obs.subject}</span>
                          <span className="text-[10px] text-slate-400 font-medium">{obs.term}</span>
                        </div>
                        <p className="italic text-slate-600 font-medium">"{obs.text}"</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
