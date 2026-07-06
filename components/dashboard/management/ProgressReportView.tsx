'use client'
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Award, BookOpen, CheckCircle2, ChevronDown, ChevronUp, FileText, Loader2, Plus, RefreshCw, Search, Trophy, User, X } from 'lucide-react'

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, type: 'spring' as const, stiffness: 320, damping: 28 },
})

interface SubjectScore {
  id?: string
  subjectName: string
  marksObtained: number
  totalMarks: number
  grade: string
  rankInBatch?: string
}

interface ProgressReport {
  id: string
  studentName: string
  rollNo: string
  batch: string
  termType: string
  academicYear: string
  percentage: string
  rank: string
  teacherRemarks: string
  principalRemarks: string
  teacherName: string
  generatedAt: string
  subjects?: SubjectScore[]
}

export default function ProgressReportView() {
  const [reports, setReports] = useState<ProgressReport[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedBatch, setSelectedBatch] = useState('All')
  const [selectedTerm, setSelectedTerm] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [batches, setBatches] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Form state for generating new report
  const [form, setForm] = useState({
    studentName: '',
    rollNo: '',
    batch: '',
    termType: 'Mid-Term',
    academicYear: '2025-2026',
    teacherRemarks: '',
    principalRemarks: 'Good performance. Keep striving for excellence.',
  })

  const [subjects, setSubjects] = useState<SubjectScore[]>([
    { subjectName: 'Mathematics', marksObtained: 85, totalMarks: 100, grade: 'A+' },
    { subjectName: 'Physics', marksObtained: 78, totalMarks: 100, grade: 'A' },
    { subjectName: 'Chemistry', marksObtained: 82, totalMarks: 100, grade: 'A+' },
  ])

  const fetchReports = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/progress-reports?batch=${encodeURIComponent(selectedBatch)}&termType=${encodeURIComponent(selectedTerm)}`)
      const data = await res.json()
      if (Array.isArray(data)) setReports(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [selectedBatch, selectedTerm])

  useEffect(() => {
    fetchReports()
  }, [fetchReports])

  useEffect(() => {
    fetch('/api/daily-report', { method: 'PUT' })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setBatches(data)
          if (data.length > 0 && !form.batch) setForm(f => ({ ...f, batch: data[0] }))
        }
      })
      .catch(() => {})
  }, [form.batch])

  const handleAddSubject = () => {
    setSubjects([...subjects, { subjectName: '', marksObtained: 0, totalMarks: 100, grade: 'B' }])
  }

  const handleRemoveSubject = (index: number) => {
    setSubjects(subjects.filter((_, i) => i !== index))
  }

  const handleSubjectChange = (index: number, field: keyof SubjectScore, val: any) => {
    const next = [...subjects]
    next[index] = { ...next[index], [field]: val }
    if (field === 'marksObtained' || field === 'totalMarks') {
      const obt = field === 'marksObtained' ? Number(val) : Number(next[index].marksObtained)
      const tot = field === 'totalMarks' ? Number(val) : Number(next[index].totalMarks)
      const pct = tot > 0 ? (obt / tot) * 100 : 0
      next[index].grade = pct >= 90 ? 'A+' : pct >= 80 ? 'A' : pct >= 70 ? 'B+' : pct >= 60 ? 'B' : 'C'
    }
    setSubjects(next)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.studentName || !form.batch) {
      setErrorMsg('Student Name and Batch are required')
      return
    }
    setSubmitting(true)
    setErrorMsg('')
    setSuccessMsg('')
    try {
      const res = await fetch('/api/progress-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, subjects }),
      })
      if (res.ok) {
        setSuccessMsg('Progress report generated successfully!')
        setTimeout(() => {
          setShowModal(false)
          setSuccessMsg('')
          fetchReports()
        }, 1200)
      } else {
        const err = await res.json()
        setErrorMsg(err.error || 'Failed to generate report')
      }
    } catch {
      setErrorMsg('Network error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  const filtered = reports.filter(r => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return r.studentName.toLowerCase().includes(q) || r.rollNo.toLowerCase().includes(q) || r.batch.toLowerCase().includes(q)
  })

  // KPIs
  const totalReports = reports.length
  const topRankers = reports.filter(r => r.rank === '1st' || r.rank === '2nd' || r.rank === '3rd').length
  const avgPct = reports.length > 0
    ? Math.round(reports.reduce((acc, r) => acc + parseInt(r.percentage || '0', 10), 0) / reports.length)
    : 0

  return (
    <div className="flex-1 p-8 overflow-auto bg-gray-50/50">
      {/* Header */}
      <motion.div {...fadeUp(0)} className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Student Progress Reports</h1>
          <p className="text-gray-500 mt-1 text-sm">Track academic performance, term evaluations, and subject scores.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => fetchReports()} className="flex items-center gap-2 px-3.5 py-2.5 text-sm text-gray-700 border border-gray-200 bg-white rounded-xl shadow-sm hover:bg-gray-50 font-semibold transition-all">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl shadow-sm hover:bg-indigo-700 font-semibold text-sm transition-all">
            <Plus className="w-4 h-4" /> Generate Report
          </button>
        </div>
      </motion.div>

      {/* KPIs */}
      <motion.div {...fadeUp(0.05)} className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-500">Total Reports Generated</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{totalReports}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center"><FileText className="w-6 h-6" /></div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-500">Average Percentage</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{avgPct}%</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><Award className="w-6 h-6" /></div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-500">Top Rankers (1st-3rd)</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{topRankers}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center"><Trophy className="w-6 h-6" /></div>
        </div>
      </motion.div>

      {/* Filter & Search Bar */}
      <motion.div {...fadeUp(0.1)} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 mb-8 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input type="text" placeholder="Search student or roll no..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:bg-white focus:border-indigo-500 text-gray-900 font-medium" />
          </div>
          <select value={selectedBatch} onChange={e => setSelectedBatch(e.target.value)}
            className="px-3.5 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl font-semibold text-gray-700 focus:outline-none focus:bg-white focus:border-indigo-500">
            <option value="All">All Batches</option>
            {batches.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <select value={selectedTerm} onChange={e => setSelectedTerm(e.target.value)}
            className="px-3.5 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl font-semibold text-gray-700 focus:outline-none focus:bg-white focus:border-indigo-500">
            <option value="All">All Terms</option>
            <option value="Mid-Term">Mid-Term</option>
            <option value="Annual">Annual</option>
            <option value="Term 1">Term 1</option>
            <option value="Term 2">Term 2</option>
            <option value="Unit Test 1">Unit Test 1</option>
          </select>
        </div>
        <div className="text-xs font-semibold text-gray-500">
          Showing <span className="text-gray-900 font-bold">{filtered.length}</span> report{filtered.length !== 1 ? 's' : ''}
        </div>
      </motion.div>

      {/* Reports List */}
      <motion.div {...fadeUp(0.15)} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /><span className="text-sm font-semibold">Loading progress reports...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center">
            <Award className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-base font-bold text-gray-700">No Progress Reports Found</p>
            <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">No student progress reports match your filters. Try generating a new report or adjusting your search.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map(report => (
              <div key={report.id} className="transition-colors hover:bg-gray-50/80">
                <div onClick={() => setExpandedId(expandedId === report.id ? null : report.id)}
                  className="px-6 py-4 flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 font-bold flex items-center justify-center text-sm flex-shrink-0">
                      {report.studentName.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-gray-900 truncate">{report.studentName}</p>
                        {report.rollNo && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-semibold">Roll #{report.rollNo}</span>}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 font-medium">{report.batch} · <span className="text-indigo-600 font-semibold">{report.termType}</span> ({report.academicYear})</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-sm font-extrabold text-gray-900">{report.percentage}</p>
                      <p className="text-[11px] font-semibold text-gray-500">Rank: <span className="text-indigo-600 font-bold">{report.rank}</span></p>
                    </div>
                    <div className="text-gray-400">
                      {expandedId === report.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                <AnimatePresence>
                  {expandedId === report.id && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      className="px-6 pb-6 pt-2 bg-gray-50/60 border-t border-gray-100 overflow-hidden">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                        <div>
                          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Subject Breakdown</p>
                          {report.subjects && report.subjects.length > 0 ? (
                            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                              <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold">
                                    <th className="py-2.5 px-3.5">Subject</th>
                                    <th className="py-2.5 px-3.5 text-right">Marks</th>
                                    <th className="py-2.5 px-3.5 text-center">Grade</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
                                  {report.subjects.map((sub, idx) => (
                                    <tr key={idx}>
                                      <td className="py-2.5 px-3.5 font-bold text-gray-900">{sub.subjectName}</td>
                                      <td className="py-2.5 px-3.5 text-right">{sub.marksObtained} / {sub.totalMarks}</td>
                                      <td className="py-2.5 px-3.5 text-center"><span className="px-2 py-0.5 rounded font-bold bg-indigo-50 text-indigo-700">{sub.grade}</span></td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <p className="text-xs text-gray-500 italic">No detailed subject scores available.</p>
                          )}
                        </div>
                        <div className="space-y-4">
                          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Teacher Remarks</p>
                            <p className="text-xs font-semibold text-gray-800 leading-relaxed">{report.teacherRemarks || 'No remarks provided.'}</p>
                            <p className="text-[10px] text-gray-400 mt-2 font-medium">Reported by: {report.teacherName}</p>
                          </div>
                          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Principal Remarks</p>
                            <p className="text-xs font-semibold text-gray-800 leading-relaxed">{report.principalRemarks || 'No remarks provided.'}</p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Modal for Generating Progress Report */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
              <div className="p-6 border-b border-gray-200 flex items-center justify-between bg-gray-50/50">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Generate Progress Report</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Enter student marks and generate term performance report.</p>
                </div>
                <button onClick={() => setShowModal(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1">
                {errorMsg && <div className="p-3 bg-red-50 text-red-700 text-xs font-bold rounded-xl border border-red-200">{errorMsg}</div>}
                {successMsg && <div className="p-3 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-xl border border-emerald-200">{successMsg}</div>}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Student Name *</label>
                    <input type="text" required placeholder="e.g. Aarav Sharma" value={form.studentName} onChange={e => setForm({ ...form, studentName: e.target.value })}
                      className="w-full px-3.5 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-900 focus:outline-none focus:bg-white focus:border-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Roll No / ID</label>
                    <input type="text" placeholder="e.g. 102" value={form.rollNo} onChange={e => setForm({ ...form, rollNo: e.target.value })}
                      className="w-full px-3.5 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-900 focus:outline-none focus:bg-white focus:border-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Batch / Class *</label>
                    {batches.length > 0 ? (
                      <select required value={form.batch} onChange={e => setForm({ ...form, batch: e.target.value })}
                        className="w-full px-3.5 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl font-semibold text-gray-900 focus:outline-none focus:bg-white focus:border-indigo-500">
                        <option value="">Select Batch</option>
                        {batches.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    ) : (
                      <input type="text" required placeholder="e.g. Class 10-A" value={form.batch} onChange={e => setForm({ ...form, batch: e.target.value })}
                        className="w-full px-3.5 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-900 focus:outline-none focus:bg-white focus:border-indigo-500" />
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Term Type *</label>
                    <select value={form.termType} onChange={e => setForm({ ...form, termType: e.target.value })}
                      className="w-full px-3.5 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl font-semibold text-gray-900 focus:outline-none focus:bg-white focus:border-indigo-500">
                      <option value="Mid-Term">Mid-Term</option>
                      <option value="Annual">Annual</option>
                      <option value="Term 1">Term 1</option>
                      <option value="Term 2">Term 2</option>
                      <option value="Unit Test 1">Unit Test 1</option>
                    </select>
                  </div>
                </div>

                {/* Subjects Table */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-gray-700">Subject Marks</label>
                    <button type="button" onClick={handleAddSubject} className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                      <Plus className="w-3.5 h-3.5" /> Add Subject
                    </button>
                  </div>
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-50 border-b border-gray-200 font-bold text-gray-500">
                        <tr>
                          <th className="py-2 px-3">Subject Name</th>
                          <th className="py-2 px-3 w-24">Obtained</th>
                          <th className="py-2 px-3 w-24">Total</th>
                          <th className="py-2 px-3 w-20 text-center">Grade</th>
                          <th className="py-2 px-3 w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {subjects.map((sub, idx) => (
                          <tr key={idx}>
                            <td className="py-2 px-3">
                              <input type="text" required placeholder="Subject" value={sub.subjectName} onChange={e => handleSubjectChange(idx, 'subjectName', e.target.value)}
                                className="w-full px-2 py-1 bg-gray-50 border border-gray-200 rounded font-medium text-gray-900 focus:outline-none focus:bg-white" />
                            </td>
                            <td className="py-2 px-3">
                              <input type="number" required min={0} value={sub.marksObtained} onChange={e => handleSubjectChange(idx, 'marksObtained', e.target.value)}
                                className="w-full px-2 py-1 bg-gray-50 border border-gray-200 rounded font-medium text-gray-900 focus:outline-none focus:bg-white text-right" />
                            </td>
                            <td className="py-2 px-3">
                              <input type="number" required min={1} value={sub.totalMarks} onChange={e => handleSubjectChange(idx, 'totalMarks', e.target.value)}
                                className="w-full px-2 py-1 bg-gray-50 border border-gray-200 rounded font-medium text-gray-900 focus:outline-none focus:bg-white text-right" />
                            </td>
                            <td className="py-2 px-3 text-center font-bold text-indigo-600">
                              {sub.grade}
                            </td>
                            <td className="py-2 px-3 text-center">
                              {subjects.length > 1 && (
                                <button type="button" onClick={() => handleRemoveSubject(idx)} className="text-gray-400 hover:text-red-600">
                                  <X className="w-4 h-4" />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Remarks */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Teacher Remarks</label>
                    <textarea rows={2} placeholder="Observations and feedback..." value={form.teacherRemarks} onChange={e => setForm({ ...form, teacherRemarks: e.target.value })}
                      className="w-full px-3.5 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-900 focus:outline-none focus:bg-white focus:border-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Principal Remarks</label>
                    <textarea rows={2} placeholder="Official remarks..." value={form.principalRemarks} onChange={e => setForm({ ...form, principalRemarks: e.target.value })}
                      className="w-full px-3.5 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-900 focus:outline-none focus:bg-white focus:border-indigo-500" />
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-3 border-t border-gray-100">
                  <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200">
                    Cancel
                  </button>
                  <button type="submit" disabled={submitting} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 shadow-sm">
                    {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    Save Progress Report
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
