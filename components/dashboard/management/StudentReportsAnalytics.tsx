'use client'
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart2, Users, TrendingUp, Award, ClipboardList,
  Search, ChevronDown, X, Eye, BookOpen
} from 'lucide-react'

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, type: 'spring' as const, stiffness: 300, damping: 28 },
})

interface StudentEntry {
  name: string
  rollNo: string
  marks: number
  maxMarks: number
  grade: string
  attendance: number
  remarks?: string
}

interface Report {
  _id: string
  teacherName: string
  className: string
  subject: string
  term: string
  uploadedAt: string
  students: StudentEntry[]
}

const GRADE_COLORS: Record<string, string> = {
  'A+': '#6366f1',
  'A': '#8b5cf6',
  'B+': '#3b82f6',
  'B': '#06b6d4',
  'C': '#f59e0b',
  'D': '#f97316',
  'F': '#ef4444',
}

function getGradeBadge(grade: string) {
  const map: Record<string, string> = {
    'A+': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'A': 'bg-green-50 text-green-700 border-green-200',
    'B+': 'bg-blue-50 text-blue-700 border-blue-200',
    'B': 'bg-sky-50 text-sky-700 border-sky-200',
    'C': 'bg-yellow-50 text-yellow-700 border-yellow-200',
    'D': 'bg-orange-50 text-orange-700 border-orange-200',
    'F': 'bg-red-50 text-red-700 border-red-200',
  }
  return map[grade] || 'bg-gray-50 text-gray-700 border-gray-200'
}

// ── SVG Bar Chart ──────────────────────────────────────────────────────────
function BarChart({ data }: { data: { label: string; value: number; color?: string }[] }) {
  const max = Math.max(...data.map(d => d.value), 1)
  const BAR_WIDTH = 36
  const GAP = 16
  const HEIGHT = 140
  const svgW = data.length * (BAR_WIDTH + GAP)

  return (
    <div className="overflow-x-auto">
      <svg width={Math.max(svgW, 300)} height={HEIGHT + 40} style={{ display: 'block' }}>
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map(v => (
          <g key={v}>
            <line
              x1={0} y1={HEIGHT - (v / 100) * HEIGHT}
              x2={svgW} y2={HEIGHT - (v / 100) * HEIGHT}
              stroke="#f3f4f6" strokeWidth={1}
            />
            <text x={svgW - 2} y={HEIGHT - (v / 100) * HEIGHT - 3} textAnchor="end" fontSize={9} fill="#9ca3af">{v}%</text>
          </g>
        ))}
        {data.map((d, i) => {
          const barH = Math.round((d.value / max) * HEIGHT * (max / 100))
          const x = i * (BAR_WIDTH + GAP)
          const y = HEIGHT - barH
          const color = d.color || '#6366f1'
          return (
            <g key={i}>
              <rect x={x} y={y} width={BAR_WIDTH} height={barH} rx={6} fill={color} fillOpacity={0.9} />
              <text x={x + BAR_WIDTH / 2} y={y - 5} textAnchor="middle" fontSize={10} fontWeight="600" fill={color}>
                {d.value.toFixed(0)}%
              </text>
              <text x={x + BAR_WIDTH / 2} y={HEIGHT + 14} textAnchor="middle" fontSize={9} fill="#6b7280">
                {d.label.length > 10 ? d.label.slice(0, 10) + '…' : d.label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ── SVG Donut Chart ─────────────────────────────────────────────────────────
function DonutChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) return <div className="text-xs text-gray-400 text-center py-8">No data yet</div>

  const R = 54
  const CX = 70
  const CY = 70
  let cumulativeAngle = -Math.PI / 2

  const slices = data.map(d => {
    const startAngle = cumulativeAngle
    const angle = (d.value / total) * 2 * Math.PI
    cumulativeAngle += angle
    const endAngle = cumulativeAngle
    const x1 = CX + R * Math.cos(startAngle)
    const y1 = CY + R * Math.sin(startAngle)
    const x2 = CX + R * Math.cos(endAngle)
    const y2 = CY + R * Math.sin(endAngle)
    const largeArc = angle > Math.PI ? 1 : 0
    const path = `M ${CX} ${CY} L ${x1} ${y1} A ${R} ${R} 0 ${largeArc} 1 ${x2} ${y2} Z`
    return { ...d, path, pct: ((d.value / total) * 100).toFixed(0) }
  })

  return (
    <div className="flex items-center gap-4">
      <svg width={140} height={140}>
        {slices.map((s, i) => (
          <path key={i} d={s.path} fill={s.color} fillOpacity={0.88} stroke="white" strokeWidth={2} />
        ))}
        <circle cx={CX} cy={CY} r={32} fill="white" />
        <text x={CX} y={CY + 5} textAnchor="middle" fontSize={13} fontWeight="700" fill="#1f2937">{total}</text>
        <text x={CX} y={CY + 18} textAnchor="middle" fontSize={8} fill="#9ca3af">TOTAL</text>
      </svg>
      <div className="space-y-1.5">
        {slices.filter(s => Number(s.value) > 0).map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
            <span className="text-xs text-gray-600">{s.label}</span>
            <span className="text-xs font-semibold text-gray-900 ml-auto pl-2">{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── SVG Line Chart ──────────────────────────────────────────────────────────
function LineChart({ data }: { data: { label: string; value: number }[] }) {
  if (data.length < 2) return (
    <div className="text-xs text-gray-400 text-center py-8">Upload reports for multiple terms to see trends.</div>
  )
  const max = Math.max(...data.map(d => d.value), 1)
  const W = 320
  const H = 100
  const pts = data.map((d, i) => ({
    x: (i / (data.length - 1)) * W,
    y: H - (d.value / 100) * H,
    label: d.label,
    value: d.value,
  }))
  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const areaD = `${pathD} L ${pts[pts.length - 1].x} ${H} L 0 ${H} Z`

  return (
    <div className="overflow-x-auto">
      <svg width={W} height={H + 30}>
        <defs>
          <linearGradient id="lineGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.01" />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#lineGrad)" />
        <path d={pathD} fill="none" stroke="#6366f1" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={4} fill="#6366f1" stroke="white" strokeWidth={2} />
            <text x={p.x} y={p.y - 9} textAnchor="middle" fontSize={9} fontWeight="600" fill="#6366f1">{p.value.toFixed(0)}%</text>
            <text x={p.x} y={H + 20} textAnchor="middle" fontSize={9} fill="#9ca3af">
              {p.label.length > 8 ? p.label.slice(0, 8) + '…' : p.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}

// ── Detail Modal ─────────────────────────────────────────────────────────────
function ReportDetailModal({ report, onClose }: { report: Report; onClose: () => void }) {
  const avg = report.students.length
    ? (report.students.reduce((s, st) => s + (st.marks / st.maxMarks) * 100, 0) / report.students.length).toFixed(1)
    : '0'
  const pass = report.students.filter(s => s.grade !== 'F').length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">{report.className} — {report.subject}</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {report.term} · by {report.teacherName} · {new Date(report.uploadedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-px bg-gray-100 border-b border-gray-100">
          {[
            { label: 'Students', value: report.students.length },
            { label: 'Avg Score', value: `${avg}%` },
            { label: 'Pass Rate', value: `${report.students.length ? Math.round((pass / report.students.length) * 100) : 0}%` },
          ].map(s => (
            <div key={s.label} className="bg-white px-5 py-4 text-center">
              <p className="text-xl font-semibold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
        <div className="overflow-auto flex-1">
          <table className="w-full">
            <thead className="sticky top-0 bg-gray-50/90 backdrop-blur-sm">
              <tr>
                {['#', 'Student', 'Roll No', 'Marks', 'Grade', 'Attendance', 'Remarks'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.students.map((s, i) => (
                <tr key={i} className="border-t border-gray-50 hover:bg-gray-50/60 transition-colors">
                  <td className="px-4 py-3 text-xs text-gray-400">{i + 1}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-800">{s.name}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{s.rollNo}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{s.marks}<span className="text-gray-400">/{s.maxMarks}</span></td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${getGradeBadge(s.grade)}`}>{s.grade}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${s.attendance}%`, background: s.attendance >= 80 ? '#10b981' : s.attendance >= 60 ? '#f59e0b' : '#ef4444' }} />
                      </div>
                      <span className="text-xs text-gray-600">{s.attendance}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400 max-w-[160px] truncate">{s.remarks || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function StudentReportsAnalytics() {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterSubject, setFilterSubject] = useState('All')
  const [detailReport, setDetailReport] = useState<Report | null>(null)

  const fetchReports = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/student-reports')
      const data = await res.json()
      if (!data.error) setReports(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchReports() }, [fetchReports])

  // ── Derived Analytics ──
  const allSubjects = ['All', ...Array.from(new Set(reports.map(r => r.subject)))]

  const filtered = reports.filter(r => {
    const matchSearch = r.className.toLowerCase().includes(search.toLowerCase()) ||
      r.subject.toLowerCase().includes(search.toLowerCase()) ||
      r.teacherName.toLowerCase().includes(search.toLowerCase())
    const matchSubject = filterSubject === 'All' || r.subject === filterSubject
    return matchSearch && matchSubject
  })

  const totalStudents = reports.reduce((s, r) => s + r.students.length, 0)
  const overallAvg = reports.length
    ? reports.reduce((sum, r) => {
        const avg = r.students.reduce((s, st) => s + (st.marks / st.maxMarks) * 100, 0) / (r.students.length || 1)
        return sum + avg
      }, 0) / reports.length
    : 0
  const passRate = totalStudents
    ? (reports.reduce((s, r) => s + r.students.filter(st => st.grade !== 'F').length, 0) / totalStudents) * 100
    : 0

  // Bar chart: avg score per class
  const classMap: Record<string, number[]> = {}
  filtered.forEach(r => {
    if (!classMap[r.className]) classMap[r.className] = []
    const avg = r.students.reduce((s, st) => s + (st.marks / st.maxMarks) * 100, 0) / (r.students.length || 1)
    classMap[r.className].push(avg)
  })
  const barData = Object.entries(classMap).map(([label, vals]) => ({
    label,
    value: vals.reduce((s, v) => s + v, 0) / vals.length,
    color: '#6366f1',
  })).sort((a, b) => b.value - a.value).slice(0, 12)

  // Grade distribution donut
  const gradeCounts: Record<string, number> = {}
  reports.forEach(r => r.students.forEach(s => {
    gradeCounts[s.grade] = (gradeCounts[s.grade] || 0) + 1
  }))
  const donutData = Object.entries(GRADE_COLORS).map(([grade, color]) => ({
    label: grade, value: gradeCounts[grade] || 0, color
  }))

  // Line chart: avg score by term (chronological)
  const termMap: Record<string, number[]> = {}
  reports.forEach(r => {
    if (!termMap[r.term]) termMap[r.term] = []
    const avg = r.students.reduce((s, st) => s + (st.marks / st.maxMarks) * 100, 0) / (r.students.length || 1)
    termMap[r.term].push(avg)
  })
  const lineData = Object.entries(termMap).map(([label, vals]) => ({
    label,
    value: vals.reduce((s, v) => s + v, 0) / vals.length,
  }))

  // Avg attendance per class
  const attendanceMap: Record<string, number[]> = {}
  reports.forEach(r => r.students.forEach(s => {
    if (!attendanceMap[r.className]) attendanceMap[r.className] = []
    attendanceMap[r.className].push(s.attendance)
  }))

  return (
    <div className="flex-1 p-6 overflow-auto">
      <AnimatePresence>
        {detailReport && (
          <ReportDetailModal report={detailReport} onClose={() => setDetailReport(null)} />
        )}
      </AnimatePresence>

      {/* Page Header */}
      <motion.div {...fadeUp(0)} className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Student Reports Analytics</h1>
          <p className="text-sm text-gray-400 mt-0.5">Institutional view of student performance across all classes and subjects.</p>
        </div>
      </motion.div>

      {/* KPI Cards */}
      <motion.div {...fadeUp(0.04)} className="grid grid-cols-4 gap-4 mb-6">
        {[
          { icon: <ClipboardList className="w-4 h-4" />, label: 'Total Reports', value: reports.length, color: 'text-indigo-600 bg-indigo-50', suffix: '' },
          { icon: <Users className="w-4 h-4" />, label: 'Students Tracked', value: totalStudents, color: 'text-violet-600 bg-violet-50', suffix: '' },
          { icon: <TrendingUp className="w-4 h-4" />, label: 'Institution Avg', value: overallAvg.toFixed(1), color: 'text-blue-600 bg-blue-50', suffix: '%' },
          { icon: <Award className="w-4 h-4" />, label: 'Pass Rate', value: passRate.toFixed(1), color: 'text-emerald-600 bg-emerald-50', suffix: '%' },
        ].map((kpi, i) => (
          <motion.div key={kpi.label} {...fadeUp(0.06 + i * 0.04)} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm flex items-center gap-4">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${kpi.color}`}>{kpi.icon}</div>
            <div>
              <p className="text-xl font-semibold text-gray-900">{kpi.value}{kpi.suffix}</p>
              <p className="text-xs text-gray-400">{kpi.label}</p>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {loading ? (
        <div className="flex items-center justify-center py-28 text-gray-400 text-sm">Loading analytics…</div>
      ) : reports.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-28 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
            <BarChart2 className="w-6 h-6 text-gray-400" />
          </div>
          <p className="text-sm font-medium text-gray-700">No reports uploaded yet</p>
          <p className="text-xs text-gray-400 mt-1">Teachers will upload student reports and they'll appear here as rich analytics.</p>
        </div>
      ) : (
        <>
          {/* Charts row */}
          <div className="grid grid-cols-12 gap-4 mb-6">
            {/* Bar Chart — 7 cols */}
            <motion.div {...fadeUp(0.14)} className="col-span-7 bg-white border border-gray-100 rounded-xl shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Avg Score by Class</p>
                  <p className="text-xs text-gray-400 mt-0.5">Across all uploaded reports</p>
                </div>
                <BarChart2 className="w-4 h-4 text-gray-300" />
              </div>
              {barData.length > 0 ? <BarChart data={barData} /> : (
                <div className="text-xs text-gray-400 text-center py-8">No class data yet</div>
              )}
            </motion.div>

            {/* Donut — 5 cols */}
            <motion.div {...fadeUp(0.18)} className="col-span-5 bg-white border border-gray-100 rounded-xl shadow-sm p-5">
              <div className="mb-4">
                <p className="text-sm font-semibold text-gray-900">Grade Distribution</p>
                <p className="text-xs text-gray-400 mt-0.5">All students combined</p>
              </div>
              <DonutChart data={donutData} />
            </motion.div>
          </div>

          {/* Line chart + Attendance */}
          <div className="grid grid-cols-12 gap-4 mb-6">
            {/* Line Chart — 7 cols */}
            <motion.div {...fadeUp(0.20)} className="col-span-7 bg-white border border-gray-100 rounded-xl shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Score Trend by Term</p>
                  <p className="text-xs text-gray-400 mt-0.5">Institution-wide average across terms</p>
                </div>
                <TrendingUp className="w-4 h-4 text-gray-300" />
              </div>
              <LineChart data={lineData} />
            </motion.div>

            {/* Attendance summary — 5 cols */}
            <motion.div {...fadeUp(0.22)} className="col-span-5 bg-white border border-gray-100 rounded-xl shadow-sm p-5">
              <div className="mb-4">
                <p className="text-sm font-semibold text-gray-900">Attendance by Class</p>
                <p className="text-xs text-gray-400 mt-0.5">Average attendance rate</p>
              </div>
              <div className="space-y-3">
                {Object.entries(attendanceMap).slice(0, 6).map(([cls, vals]) => {
                  const avg = vals.reduce((s, v) => s + v, 0) / vals.length
                  const color = avg >= 80 ? '#10b981' : avg >= 60 ? '#f59e0b' : '#ef4444'
                  return (
                    <div key={cls}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-700 truncate max-w-[130px]">{cls}</span>
                        <span className="text-xs font-semibold" style={{ color }}>{avg.toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${avg}%` }}
                          transition={{ duration: 0.8, ease: 'easeOut' }}
                          style={{ background: color }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </motion.div>
          </div>

          {/* Reports Table */}
          <motion.div {...fadeUp(0.26)} className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 gap-3 flex-wrap">
              <p className="text-sm font-semibold text-gray-900">All Reports <span className="text-gray-400 font-normal">({filtered.length})</span></p>
              <div className="flex items-center gap-2">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search class, subject…"
                    className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all w-48"
                  />
                </div>
                {/* Subject filter */}
                <div className="relative">
                  <select
                    value={filterSubject}
                    onChange={e => setFilterSubject(e.target.value)}
                    className="pl-3 pr-8 py-1.5 text-sm border border-gray-200 rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all"
                  >
                    {allSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <BookOpen className="w-6 h-6 text-gray-300 mb-2" />
                <p className="text-sm text-gray-400">No matching reports found.</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-50">
                    {['Class', 'Subject', 'Term', 'Teacher', 'Students', 'Avg Score', 'Pass Rate', 'Uploaded', ''].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => {
                    const avg = r.students.length
                      ? (r.students.reduce((s, st) => s + (st.marks / st.maxMarks) * 100, 0) / r.students.length)
                      : 0
                    const pass = r.students.filter(s => s.grade !== 'F').length
                    const passRt = r.students.length ? Math.round((pass / r.students.length) * 100) : 0
                    return (
                      <motion.tr
                        key={r._id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.03 }}
                        className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors"
                      >
                        <td className="px-5 py-3.5 text-sm font-medium text-gray-800">{r.className}</td>
                        <td className="px-5 py-3.5 text-sm text-gray-600">{r.subject}</td>
                        <td className="px-5 py-3.5">
                          <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-100 font-medium">{r.term}</span>
                        </td>
                        <td className="px-5 py-3.5 text-sm text-gray-600">{r.teacherName}</td>
                        <td className="px-5 py-3.5 text-sm text-gray-700">{r.students.length}</td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full bg-indigo-500" style={{ width: `${avg}%` }} />
                            </div>
                            <span className="text-sm font-semibold text-gray-800">{avg.toFixed(1)}%</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${passRt >= 80 ? 'bg-emerald-50 text-emerald-700' : passRt >= 60 ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-700'}`}>
                            {passRt}%
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-gray-400">
                          {new Date(r.uploadedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </td>
                        <td className="px-5 py-3.5">
                          <button
                            onClick={() => setDetailReport(r)}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 border border-indigo-100 rounded-lg hover:bg-indigo-50 transition-colors"
                          >
                            <Eye className="w-3 h-3" /> View
                          </button>
                        </td>
                      </motion.tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </motion.div>
        </>
      )}
    </div>
  )
}
