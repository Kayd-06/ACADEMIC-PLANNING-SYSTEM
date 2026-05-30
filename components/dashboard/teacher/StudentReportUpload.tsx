'use client'
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Trash2, Upload, ClipboardList, CheckCircle2,
  AlertCircle, ChevronDown, BookOpen, Users, TrendingUp, X, Eye
} from 'lucide-react'

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, type: 'spring' as const, stiffness: 300, damping: 28 },
})

const GRADES = ['A+', 'A', 'B+', 'B', 'C', 'D', 'F']
const TERMS = ['Term 1 2024', 'Term 2 2024', 'Term 3 2024', 'Term 1 2025', 'Term 2 2025', 'Mid-Year 2025', 'Final 2025']
const SUBJECTS = ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English', 'History', 'Geography', 'Computer Science', 'Hindi', 'Economics']

interface StudentRow {
  name: string
  rollNo: string
  marks: string
  maxMarks: string
  grade: string
  attendance: string
  remarks: string
}

interface UploadedReport {
  _id: string
  className: string
  subject: string
  term: string
  uploadedAt: string
  students: Array<{
    name: string
    rollNo: string
    marks: number
    maxMarks: number
    grade: string
    attendance: number
    remarks?: string
  }>
}

function emptyRow(): StudentRow {
  return { name: '', rollNo: '', marks: '', maxMarks: '100', grade: 'A', attendance: '', remarks: '' }
}

function getGradeColor(grade: string) {
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

// Simple inline SVG bar chart
function MiniBarChart({ students }: { students: UploadedReport['students'] }) {
  if (!students?.length) return null
  const max = Math.max(...students.map(s => (s.marks / s.maxMarks) * 100))
  const barW = Math.max(8, Math.min(28, Math.floor(280 / students.length) - 4))

  return (
    <div className="flex items-end gap-1 h-16 px-1">
      {students.map((s, i) => {
        const pct = (s.marks / s.maxMarks) * 100
        const h = Math.round((pct / 100) * 56)
        const color = pct >= 80 ? '#6366f1' : pct >= 60 ? '#f59e0b' : '#ef4444'
        return (
          <div key={i} className="flex flex-col items-center group relative" style={{ width: barW }}>
            <div
              className="rounded-t transition-all"
              style={{ width: barW, height: h, background: color, minHeight: 4 }}
            />
            <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] bg-gray-800 text-white px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
              {s.name.split(' ')[0]}: {pct.toFixed(0)}%
            </span>
          </div>
        )
      })}
    </div>
  )
}

function ReportDetailModal({ report, onClose }: { report: UploadedReport; onClose: () => void }) {
  const avg = report.students.length
    ? (report.students.reduce((sum, s) => sum + (s.marks / s.maxMarks) * 100, 0) / report.students.length).toFixed(1)
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
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">{report.className} — {report.subject}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{report.term} · {new Date(report.uploadedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-px bg-gray-100 border-b border-gray-100">
          {[
            { label: 'Students', value: report.students.length },
            { label: 'Avg Score', value: `${avg}%` },
            { label: 'Pass Rate', value: `${Math.round((pass / report.students.length) * 100)}%` },
          ].map(s => (
            <div key={s.label} className="bg-white px-5 py-4 text-center">
              <p className="text-xl font-semibold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Mini bar chart */}
        <div className="px-6 pt-4 pb-2 border-b border-gray-50">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Score Distribution</p>
          <MiniBarChart students={report.students} />
        </div>

        {/* Table */}
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
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${getGradeColor(s.grade)}`}>{s.grade}</span>
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

export default function StudentReportUpload({ firstName }: { firstName: string }) {
  const [tab, setTab] = useState<'upload' | 'history'>('upload')
  const [className, setClassName] = useState('')
  const [subject, setSubject] = useState('')
  const [term, setTerm] = useState('')
  const [students, setStudents] = useState<StudentRow[]>([emptyRow(), emptyRow(), emptyRow()])
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [reports, setReports] = useState<UploadedReport[]>([])
  const [loadingReports, setLoadingReports] = useState(false)
  const [detailReport, setDetailReport] = useState<UploadedReport | null>(null)

  const fetchReports = useCallback(async () => {
    setLoadingReports(true)
    try {
      const res = await fetch('/api/student-reports')
      const data = await res.json()
      if (!data.error) setReports(data)
    } finally {
      setLoadingReports(false)
    }
  }, [])

  useEffect(() => { fetchReports() }, [fetchReports])

  function updateRow(i: number, field: keyof StudentRow, value: string) {
    setStudents(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r))
  }

  function addRow() {
    setStudents(prev => [...prev, emptyRow()])
  }

  function removeRow(i: number) {
    if (students.length <= 1) return
    setStudents(prev => prev.filter((_, idx) => idx !== i))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!className.trim() || !subject || !term) {
      setError('Please fill in class, subject and term.')
      return
    }
    const validStudents = students.filter(s => s.name.trim() && s.rollNo.trim() && s.marks !== '')
    if (validStudents.length === 0) {
      setError('Add at least one student with name, roll number and marks.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/student-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          className: className.trim(),
          subject,
          term,
          students: validStudents.map(s => ({
            name: s.name.trim(),
            rollNo: s.rollNo.trim(),
            marks: Number(s.marks),
            maxMarks: Number(s.maxMarks) || 100,
            grade: s.grade,
            attendance: Number(s.attendance) || 0,
            remarks: s.remarks.trim(),
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Upload failed'); return }
      setSuccess(true)
      setClassName('')
      setSubject('')
      setTerm('')
      setStudents([emptyRow(), emptyRow(), emptyRow()])
      await fetchReports()
      setTimeout(() => { setSuccess(false); setTab('history') }, 1800)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const totalStudentsReported = reports.reduce((sum, r) => sum + r.students.length, 0)
  const overallAvg = reports.length
    ? (reports.reduce((sum, r) => {
        const avg = r.students.reduce((s, st) => s + (st.marks / st.maxMarks) * 100, 0) / (r.students.length || 1)
        return sum + avg
      }, 0) / reports.length).toFixed(1)
    : '—'

  return (
    <div className="flex-1 p-6 overflow-auto">
      <AnimatePresence>
        {detailReport && (
          <ReportDetailModal report={detailReport} onClose={() => setDetailReport(null)} />
        )}
      </AnimatePresence>

      {/* Page header */}
      <motion.div {...fadeUp(0)} className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Student Reports</h1>
          <p className="text-sm text-gray-400 mt-0.5">Upload class performance reports and track student progress.</p>
        </div>
      </motion.div>

      {/* KPI strip */}
      <motion.div {...fadeUp(0.04)} className="grid grid-cols-3 gap-4 mb-6">
        {[
          { icon: <ClipboardList className="w-4 h-4" />, label: 'Reports Uploaded', value: reports.length, color: 'text-indigo-600 bg-indigo-50' },
          { icon: <Users className="w-4 h-4" />, label: 'Total Students', value: totalStudentsReported, color: 'text-violet-600 bg-violet-50' },
          { icon: <TrendingUp className="w-4 h-4" />, label: 'Overall Average', value: overallAvg !== '—' ? `${overallAvg}%` : '—', color: 'text-emerald-600 bg-emerald-50' },
        ].map((kpi, i) => (
          <motion.div key={kpi.label} {...fadeUp(0.06 + i * 0.04)} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm flex items-center gap-4">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${kpi.color}`}>{kpi.icon}</div>
            <div>
              <p className="text-xl font-semibold text-gray-900">{kpi.value}</p>
              <p className="text-xs text-gray-400">{kpi.label}</p>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Tabs */}
      <motion.div {...fadeUp(0.12)} className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-6">
        {(['upload', 'history'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t === 'upload' ? '↑ Upload Report' : `History (${reports.length})`}
          </button>
        ))}
      </motion.div>

      <AnimatePresence mode="wait">
        {tab === 'upload' ? (
          /* ─── Upload Form ─── */
          <motion.div key="upload" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <form onSubmit={handleSubmit}>
              {/* Meta fields */}
              <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-5 mb-4">
                <p className="text-sm font-semibold text-gray-700 mb-4">Report Details</p>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Class Name *</label>
                    <input
                      type="text"
                      value={className}
                      onChange={e => setClassName(e.target.value)}
                      placeholder="e.g. Grade 10-A"
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Subject *</label>
                    <div className="relative">
                      <select
                        value={subject}
                        onChange={e => setSubject(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 appearance-none transition-all"
                      >
                        <option value="">Select subject…</option>
                        {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Term *</label>
                    <div className="relative">
                      <select
                        value={term}
                        onChange={e => setTerm(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 appearance-none transition-all"
                      >
                        <option value="">Select term…</option>
                        {TERMS.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Student table */}
              <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden mb-4">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-700">Student Marks</p>
                  <button
                    type="button"
                    onClick={addRow}
                    className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Student
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[780px]">
                    <thead>
                      <tr className="border-b border-gray-50">
                        {['#', 'Student Name', 'Roll No', 'Marks', 'Max Marks', 'Grade', 'Attendance %', 'Remarks', ''].map(h => (
                          <th key={h} className="px-3 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((row, i) => (
                        <tr key={i} className="border-b border-gray-50 last:border-0">
                          <td className="px-3 py-2.5 text-xs text-gray-400 w-8">{i + 1}</td>
                          <td className="px-3 py-2.5">
                            <input
                              type="text"
                              value={row.name}
                              onChange={e => updateRow(i, 'name', e.target.value)}
                              placeholder="Full name"
                              className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400 transition-all"
                            />
                          </td>
                          <td className="px-3 py-2.5 w-24">
                            <input
                              type="text"
                              value={row.rollNo}
                              onChange={e => updateRow(i, 'rollNo', e.target.value)}
                              placeholder="Roll no."
                              className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400 transition-all"
                            />
                          </td>
                          <td className="px-3 py-2.5 w-20">
                            <input
                              type="number"
                              value={row.marks}
                              onChange={e => updateRow(i, 'marks', e.target.value)}
                              placeholder="0"
                              min={0}
                              className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400 transition-all"
                            />
                          </td>
                          <td className="px-3 py-2.5 w-24">
                            <input
                              type="number"
                              value={row.maxMarks}
                              onChange={e => updateRow(i, 'maxMarks', e.target.value)}
                              placeholder="100"
                              min={1}
                              className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400 transition-all"
                            />
                          </td>
                          <td className="px-3 py-2.5 w-24">
                            <div className="relative">
                              <select
                                value={row.grade}
                                onChange={e => updateRow(i, 'grade', e.target.value)}
                                className={`w-full px-2 py-1.5 text-xs font-semibold border rounded-lg appearance-none focus:outline-none focus:ring-1 focus:ring-indigo-400 ${getGradeColor(row.grade)}`}
                              >
                                {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                              </select>
                              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none opacity-50" />
                            </div>
                          </td>
                          <td className="px-3 py-2.5 w-28">
                            <input
                              type="number"
                              value={row.attendance}
                              onChange={e => updateRow(i, 'attendance', e.target.value)}
                              placeholder="0–100"
                              min={0}
                              max={100}
                              className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400 transition-all"
                            />
                          </td>
                          <td className="px-3 py-2.5">
                            <input
                              type="text"
                              value={row.remarks}
                              onChange={e => updateRow(i, 'remarks', e.target.value)}
                              placeholder="Optional"
                              className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400 transition-all"
                            />
                          </td>
                          <td className="px-3 py-2.5 w-10">
                            <button
                              type="button"
                              onClick={() => removeRow(i)}
                              className="p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Error / Success */}
              <AnimatePresence>
                {error && (
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600 mb-4">
                    <AlertCircle className="w-4 h-4 shrink-0" />{error}
                  </motion.div>
                )}
                {success && (
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-xl text-sm text-emerald-700 mb-4">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />Report submitted successfully!
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Submit */}
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => { setStudents([emptyRow(), emptyRow(), emptyRow()]); setClassName(''); setSubject(''); setTerm(''); setError('') }}
                  className="px-4 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 transition-all"
                >
                  Reset
                </button>
                <motion.button
                  type="submit"
                  disabled={submitting}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl shadow-md shadow-indigo-100 transition-all"
                >
                  <Upload className="w-4 h-4" />
                  {submitting ? 'Uploading…' : 'Upload Report'}
                </motion.button>
              </div>
            </form>
          </motion.div>
        ) : (
          /* ─── History ─── */
          <motion.div key="history" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            {loadingReports ? (
              <div className="flex items-center justify-center py-20 text-gray-400 text-sm">Loading reports…</div>
            ) : reports.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
                  <BookOpen className="w-5 h-5 text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-700">No reports uploaded yet</p>
                <p className="text-xs text-gray-400 mt-1">Upload your first student report to see it here.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {reports.map((r, i) => {
                  const avg = r.students.length
                    ? (r.students.reduce((s, st) => s + (st.marks / st.maxMarks) * 100, 0) / r.students.length).toFixed(1)
                    : '0'
                  const pass = r.students.filter(s => s.grade !== 'F').length
                  return (
                    <motion.div
                      key={r._id}
                      {...fadeUp(i * 0.04)}
                      className="bg-white border border-gray-100 rounded-xl shadow-sm p-5 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-semibold text-gray-900">{r.className}</span>
                            <span className="text-xs text-gray-400">·</span>
                            <span className="text-sm text-gray-600">{r.subject}</span>
                            <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-100 font-medium">{r.term}</span>
                          </div>
                          <p className="text-xs text-gray-400">{new Date(r.uploadedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                        </div>
                        <div className="flex items-center gap-4 shrink-0">
                          <div className="text-center">
                            <p className="text-base font-semibold text-gray-900">{r.students.length}</p>
                            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Students</p>
                          </div>
                          <div className="text-center">
                            <p className="text-base font-semibold text-indigo-600">{avg}%</p>
                            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Avg Score</p>
                          </div>
                          <div className="text-center">
                            <p className="text-base font-semibold text-emerald-600">{r.students.length ? Math.round((pass / r.students.length) * 100) : 0}%</p>
                            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Pass Rate</p>
                          </div>
                          <button
                            onClick={() => setDetailReport(r)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 border border-indigo-100 rounded-lg hover:bg-indigo-50 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" /> View
                          </button>
                        </div>
                      </div>
                      {/* Mini preview chart */}
                      <div className="mt-4 pt-3 border-t border-gray-50">
                        <MiniBarChart students={r.students.slice(0, 20)} />
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
