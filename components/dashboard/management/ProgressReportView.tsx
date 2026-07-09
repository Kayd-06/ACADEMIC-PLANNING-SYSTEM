'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Award, BookOpen, CheckCircle2, ChevronDown, ChevronUp, FileText, Loader2, Plus, RefreshCw, Search, Trophy, User, X, Printer, Download, Check, ShieldCheck, Building, Calendar } from 'lucide-react'

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
  const [editingId, setEditingId] = useState<string | null>(null)
  const [batches, setBatches] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // SINGLE STUDENT REPORT PDF MODAL STATE
  const [showPdfModal, setShowPdfModal] = useState(false)
  const [pdfReport, setPdfReport] = useState<ProgressReport | null>(null)

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

  const handleSubjectChange = (index: number, field: keyof SubjectScore, value: any) => {
    const updated = [...subjects]
    updated[index] = { ...updated[index], [field]: field === 'marksObtained' || field === 'totalMarks' ? Number(value) : value }
    // Auto calculate grade if marks modified
    if (field === 'marksObtained' || field === 'totalMarks') {
      const obt = field === 'marksObtained' ? Number(value) : updated[index].marksObtained
      const tot = field === 'totalMarks' ? Number(value) : updated[index].totalMarks
      const pct = tot > 0 ? (obt / tot) * 100 : 0
      updated[index].grade = pct >= 90 ? 'A+' : pct >= 80 ? 'A' : pct >= 70 ? 'B+' : pct >= 60 ? 'B' : pct >= 50 ? 'C' : 'D'
    }
    setSubjects(updated)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setErrorMsg('')
    setSuccessMsg('')

    const totalObtained = subjects.reduce((acc, s) => acc + (Number(s.marksObtained) || 0), 0)
    const totalMax = subjects.reduce((acc, s) => acc + (Number(s.totalMarks) || 0), 0)
    const percentage = totalMax > 0 ? `${Math.round((totalObtained / totalMax) * 100)}%` : '0%'

    const payload = {
      ...form,
      percentage,
      rank: editingId ? (reports.find(r => r.id === editingId)?.rank || '3rd') : '3rd',
      subjects: subjects.map(s => ({
        subjectName: s.subjectName,
        marksObtained: Number(s.marksObtained),
        totalMarks: Number(s.totalMarks),
        grade: s.grade || 'B',
      })),
    }

    try {
      const url = editingId ? `/api/progress-reports?id=${editingId}` : '/api/progress-reports'
      const method = editingId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Failed to save progress report')
      }
      setSuccessMsg(editingId ? 'Report updated successfully!' : 'Progress report generated successfully!')
      setTimeout(() => {
        setShowModal(false)
        setEditingId(null)
        fetchReports()
      }, 1000)
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred while saving.')
    } finally {
      setSubmitting(false)
    }
  }

  const openEdit = (report: ProgressReport) => {
    setForm({
      studentName: report.studentName,
      rollNo: report.rollNo || '',
      batch: report.batch,
      termType: report.termType,
      academicYear: report.academicYear,
      teacherRemarks: report.teacherRemarks || '',
      principalRemarks: report.principalRemarks || '',
    })
    setSubjects((report.subjects ?? []).map(s => ({
      subjectName: s.subjectName,
      marksObtained: s.marksObtained,
      totalMarks: s.totalMarks,
      grade: s.grade,
      rankInBatch: s.rankInBatch,
    })))
    setEditingId(report.id)
    setErrorMsg('')
    setShowModal(true)
  }

  const handleDelete = async (report: ProgressReport) => {
    if (!confirm(`Delete progress report for ${report.studentName} (${report.termType} ${report.academicYear})?`)) return
    const res = await fetch(`/api/progress-reports?id=${report.id}`, { method: 'DELETE' })
    if (res.ok) fetchReports()
  }

  // Open single student report PDF export preview modal
  const openPdfPreview = (report: ProgressReport, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setPdfReport(report)
    setShowPdfModal(true)
  }

  // Download self-contained standalone HTML report card file
  const downloadReportHtml = (report: ProgressReport) => {
    const totalObtained = (report.subjects || []).reduce((acc, s) => acc + (Number(s.marksObtained) || 0), 0)
    const totalMax = (report.subjects || []).reduce((acc, s) => acc + (Number(s.totalMarks) || 0), 0)

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Progress Report - ${report.studentName}</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 40px; color: #1e293b; background: #f8fafc; }
    .report-card { max-w: 800px; margin: 0 auto; background: #ffffff; padding: 40px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border: 1px solid #e2e8f0; }
    .header { text-align: center; border-bottom: 3px solid #4f46e5; padding-bottom: 24px; margin-bottom: 30px; }
    .header h1 { margin: 0; font-size: 26px; color: #1e293b; letter-spacing: 1px; }
    .header p { margin: 6px 0 0; color: #64748b; font-size: 14px; text-transform: uppercase; font-weight: 600; }
    .student-info { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; background: #f1f5f9; padding: 20px; border-radius: 8px; margin-bottom: 30px; font-size: 14px; }
    .student-info div strong { color: #475569; display: inline-block; width: 130px; }
    table { w-full; width: 100%; border-collapse: collapse; margin-bottom: 30px; }
    th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #e2e8f0; }
    th { background: #f8fafc; color: #475569; font-weight: 700; font-size: 13px; text-transform: uppercase; }
    td { font-size: 14px; font-weight: 600; }
    .grade-badge { background: #e0e7ff; color: #4338ca; padding: 4px 10px; border-radius: 6px; font-weight: 800; display: inline-block; }
    .summary-box { display: flex; justify-content: space-between; background: #eef2ff; border: 1px solid #c7d2fe; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
    .summary-item { text-align: center; }
    .summary-item span { font-size: 12px; color: #6366f1; font-weight: 700; text-transform: uppercase; block; }
    .summary-item strong { font-size: 24px; color: #312e81; display: block; margin-top: 4px; }
    .remarks { margin-bottom: 40px; }
    .remarks h4 { margin: 0 0 8px; font-size: 13px; color: #64748b; text-transform: uppercase; }
    .remarks p { margin: 0 0 16px; background: #f8fafc; padding: 16px; border-radius: 8px; border-left: 4px solid #4f46e5; font-size: 14px; line-height: 1.6; }
    .signatures { display: flex; justify-content: space-between; margin-top: 60px; padding-top: 20px; border-top: 1px dashed #cbd5e1; }
    .sig-line { width: 220px; text-align: center; }
    .sig-line div { border-bottom: 1px solid #94a3b8; height: 40px; margin-bottom: 8px; }
    .sig-line span { font-size: 12px; font-weight: 700; color: #64748b; }
    @media print { body { background: white; padding: 0; } .report-card { box-shadow: none; border: none; } }
  </style>
</head>
<body>
  <div class="report-card">
    <div class="header">
      <h1>EDUADMIN ACADEMIC ACADEMY</h1>
      <p>OFFICIAL STUDENT PROGRESS & PERFORMANCE REPORT CARD</p>
    </div>

    <div class="student-info">
      <div><strong>Student Name:</strong> ${report.studentName}</div>
      <div><strong>Roll Number / ID:</strong> ${report.rollNo || 'N/A'}</div>
      <div><strong>Batch / Class:</strong> ${report.batch}</div>
      <div><strong>Academic Year:</strong> ${report.academicYear}</div>
      <div><strong>Examination Term:</strong> ${report.termType}</div>
      <div><strong>Report Date:</strong> ${report.generatedAt || new Date().toISOString().split('T')[0]}</div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Subject Name</th>
          <th style="text-align: right;">Marks Obtained</th>
          <th style="text-align: right;">Max Marks</th>
          <th style="text-align: right;">Percentage</th>
          <th style="text-align: center;">Grade Awarded</th>
        </tr>
      </thead>
      <tbody>
        ${(report.subjects || []).map(sub => {
          const pct = sub.totalMarks > 0 ? Math.round((sub.marksObtained / sub.totalMarks) * 100) : 0
          return `
            <tr>
              <td>${sub.subjectName}</td>
              <td style="text-align: right;">${sub.marksObtained}</td>
              <td style="text-align: right;">${sub.totalMarks}</td>
              <td style="text-align: right;">${pct}%</td>
              <td style="text-align: center;"><span class="grade-badge">${sub.grade}</span></td>
            </tr>
          `
        }).join('')}
      </tbody>
    </table>

    <div class="summary-box">
      <div class="summary-item">
        <span>Aggregate Marks</span>
        <strong>${totalObtained} / ${totalMax}</strong>
      </div>
      <div class="summary-item">
        <span>Overall Percentage</span>
        <strong>${report.percentage}</strong>
      </div>
      <div class="summary-item">
        <span>Batch Standing / Rank</span>
        <strong>${report.rank || 'N/A'}</strong>
      </div>
    </div>

    <div class="remarks">
      <h4>Class Teacher Observations (${report.teacherName || 'Faculty'})</h4>
      <p>${report.teacherRemarks || 'Satisfactory progress observed across subjects.'}</p>
      
      <h4>Principal Official Remarks</h4>
      <p>${report.principalRemarks || 'Good performance. Keep striving for excellence.'}</p>
    </div>

    <div class="signatures">
      <div class="sig-line">
        <div></div>
        <span>Class Teacher Signature</span>
      </div>
      <div class="sig-line">
        <div></div>
        <span>School Seal / Stamp</span>
      </div>
      <div class="sig-line">
        <div></div>
        <span>Principal Signature</span>
      </div>
    </div>
  </div>
</body>
</html>
    `
    const blob = new Blob([htmlContent], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Progress_Report_${report.studentName.replace(/\s+/g, '_')}_${report.termType}.html`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
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
          <p className="text-gray-500 mt-1 text-sm">Track academic performance, term evaluations, and export single student PDF reports.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => fetchReports()} className="flex items-center gap-2 px-3.5 py-2.5 text-sm text-gray-700 border border-gray-200 bg-white rounded-xl shadow-sm hover:bg-gray-50 font-semibold transition-all">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button onClick={() => {
            setEditingId(null)
            setForm(f => ({ ...f, studentName: '', rollNo: '', teacherRemarks: '', principalRemarks: 'Good performance. Keep striving for excellence.' }))
            setErrorMsg('')
            setShowModal(true)
          }} className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl shadow-sm hover:bg-indigo-700 font-semibold text-sm transition-all">
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

                  <div className="flex items-center gap-4">
                    {/* EXPORT PDF QUICK BUTTON ON EVERY CARD */}
                    <button
                      onClick={(e) => openPdfPreview(report, e)}
                      title="Export single student report as PDF"
                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all"
                    >
                      <Printer className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Export PDF</span>
                    </button>

                    <div className="text-right pl-2 border-l border-gray-200/60">
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
                        <div className="space-y-4 flex flex-col justify-between">
                          <div className="space-y-4">
                            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs">
                              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Teacher Remarks</p>
                              <p className="text-xs font-semibold text-gray-800 leading-relaxed">{report.teacherRemarks || 'No remarks provided.'}</p>
                              <p className="text-[10px] text-gray-400 mt-2 font-medium">Reported by: {report.teacherName || 'Class Faculty'}</p>
                            </div>
                            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs">
                              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Principal Remarks</p>
                              <p className="text-xs font-semibold text-gray-800 leading-relaxed">{report.principalRemarks || 'No remarks provided.'}</p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 pt-2">
                            <button
                              onClick={() => openPdfPreview(report)}
                              className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors shadow-sm flex items-center justify-center gap-1.5"
                            >
                              <Printer className="w-3.5 h-3.5" /> Export / Print Report Card PDF
                            </button>
                            <button onClick={() => openEdit(report)}
                              className="px-4 py-2.5 bg-white border border-gray-200 text-gray-700 text-xs font-bold rounded-xl hover:bg-gray-50 transition-colors shadow-2xs">
                              Edit
                            </button>
                            <button onClick={() => handleDelete(report)}
                              className="px-4 py-2.5 bg-white border border-rose-200 text-rose-600 text-xs font-bold rounded-xl hover:bg-rose-50 transition-colors shadow-2xs">
                              Delete
                            </button>
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

      {/* Modal for Generating / Editing Progress Report */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
              <div className="p-6 border-b border-gray-200 flex items-center justify-between bg-gray-50/50">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{editingId ? 'Edit Progress Report' : 'Generate Progress Report'}</h2>
                  <p className="text-xs text-gray-500 mt-0.5">{editingId ? 'Update student marks, term info, and official remarks.' : 'Enter student marks and generate term performance report.'}</p>
                </div>
                <button onClick={() => { setShowModal(false); setEditingId(null) }} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
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

      {/* SINGLE STUDENT REPORT CARD PDF PREVIEW & EXPORT MODAL */}
      <AnimatePresence>
        {showPdfModal && pdfReport && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[92vh] overflow-y-auto flex flex-col relative"
            >
              {/* Modal Top Actions Bar (Hidden on Print) */}
              <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50 sticky top-0 z-10 print:hidden">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-xs">
                    <Printer className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">
                      Official Single-Student Report Card Export
                    </h3>
                    <p className="text-xs text-slate-500">
                      Previewing formatted sheet for {pdfReport.studentName}. Click Print/Save PDF below.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => downloadReportHtml(pdfReport)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-all shadow-2xs"
                  >
                    <Download className="w-3.5 h-3.5" /> Download (.HTML)
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
                  >
                    <Printer className="w-3.5 h-3.5" /> Print / Save PDF
                  </button>
                  <button 
                    onClick={() => setShowPdfModal(false)} 
                    className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors ml-1"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Printable Student Report Sheet */}
              <div className="p-8 print:p-0 print:border-0">
                {/* Official Header */}
                <div className="text-center pb-6 border-b-2 border-indigo-600 mb-6">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <Building className="w-6 h-6 text-indigo-600" />
                    <h1 className="text-2xl font-black text-slate-900 tracking-wide uppercase">EDUADMIN ACADEMIC ACADEMY</h1>
                  </div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Official Student Performance & Progress Report Card</p>
                </div>

                {/* Student Profile Grid */}
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-5 rounded-xl border border-slate-200/80 mb-6 text-xs text-slate-700">
                  <div className="space-y-1.5">
                    <div><span className="font-bold text-slate-400 uppercase w-28 inline-block">Student Name:</span> <strong className="text-slate-900 text-sm">{pdfReport.studentName}</strong></div>
                    <div><span className="font-bold text-slate-400 uppercase w-28 inline-block">Roll Number / ID:</span> <strong className="text-slate-800">{pdfReport.rollNo || 'N/A'}</strong></div>
                    <div><span className="font-bold text-slate-400 uppercase w-28 inline-block">Batch / Class:</span> <strong className="text-slate-800">{pdfReport.batch}</strong></div>
                  </div>
                  <div className="space-y-1.5">
                    <div><span className="font-bold text-slate-400 uppercase w-28 inline-block">Academic Year:</span> <strong className="text-slate-800">{pdfReport.academicYear}</strong></div>
                    <div><span className="font-bold text-slate-400 uppercase w-28 inline-block">Term Type:</span> <strong className="text-indigo-600 font-extrabold">{pdfReport.termType}</strong></div>
                    <div><span className="font-bold text-slate-400 uppercase w-28 inline-block">Generated Date:</span> <strong className="text-slate-800">{pdfReport.generatedAt || new Date().toISOString().split('T')[0]}</strong></div>
                  </div>
                </div>

                {/* Subject Performance Table */}
                <div className="mb-6">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-indigo-600" /> Subject-wise Score Breakdown
                  </h4>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-100/90 border-b border-slate-200 font-extrabold text-slate-700 uppercase tracking-wider">
                          <th className="py-3 px-4">Subject Name</th>
                          <th className="py-3 px-4 text-right">Marks Obtained</th>
                          <th className="py-3 px-4 text-right">Maximum Marks</th>
                          <th className="py-3 px-4 text-right">Percentage</th>
                          <th className="py-3 px-4 text-center">Grade Awarded</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 font-semibold text-slate-800">
                        {(pdfReport.subjects || []).map((sub, idx) => {
                          const pct = sub.totalMarks > 0 ? Math.round((sub.marksObtained / sub.totalMarks) * 100) : 0
                          return (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              <td className="py-3 px-4 font-bold text-slate-900">{sub.subjectName}</td>
                              <td className="py-3 px-4 text-right">{sub.marksObtained}</td>
                              <td className="py-3 px-4 text-right text-slate-500">{sub.totalMarks}</td>
                              <td className="py-3 px-4 text-right font-bold text-indigo-600">{pct}%</td>
                              <td className="py-3 px-4 text-center">
                                <span className="px-2.5 py-1 rounded-md font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-100">
                                  {sub.grade}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Summary Box */}
                <div className="grid grid-cols-3 gap-4 bg-indigo-50/70 border border-indigo-200 p-5 rounded-xl mb-6 text-center">
                  <div>
                    <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest block">Aggregate Score</span>
                    <strong className="text-xl font-black text-slate-900 mt-1 block">
                      {(pdfReport.subjects || []).reduce((acc, s) => acc + (Number(s.marksObtained) || 0), 0)} / {(pdfReport.subjects || []).reduce((acc, s) => acc + (Number(s.totalMarks) || 0), 0)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest block">Overall Percentage</span>
                    <strong className="text-xl font-black text-indigo-700 mt-1 block">{pdfReport.percentage}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest block">Batch Standing / Rank</span>
                    <strong className="text-xl font-black text-slate-900 mt-1 block">{pdfReport.rank || 'N/A'}</strong>
                  </div>
                </div>

                {/* Official Remarks */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 text-xs">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1.5">Class Teacher Observations</span>
                    <p className="font-semibold text-slate-800 leading-relaxed italic">&quot;{pdfReport.teacherRemarks || 'Satisfactory academic progress and class participation.'}&quot;</p>
                    <span className="text-[10px] font-bold text-slate-400 block mt-2 text-right">Faculty: {pdfReport.teacherName || 'Class Teacher'}</span>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1.5">Principal Official Remarks</span>
                    <p className="font-semibold text-slate-800 leading-relaxed italic">&quot;{pdfReport.principalRemarks || 'Good performance. Keep striving for academic excellence.'}&quot;</p>
                  </div>
                </div>

                {/* Signature Line */}
                <div className="grid grid-cols-3 gap-8 pt-6 border-t border-dashed border-slate-300 text-center text-xs mt-12">
                  <div>
                    <div className="h-12 border-b border-slate-300 mb-2"></div>
                    <span className="font-bold text-slate-500 text-[11px] uppercase tracking-wider">Class Teacher Signature</span>
                  </div>
                  <div>
                    <div className="h-12 border-b border-slate-300 mb-2 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">[School Stamp / Seal]</span>
                    </div>
                    <span className="font-bold text-slate-500 text-[11px] uppercase tracking-wider">Official Seal</span>
                  </div>
                  <div>
                    <div className="h-12 border-b border-slate-300 mb-2"></div>
                    <span className="font-bold text-slate-500 text-[11px] uppercase tracking-wider">Principal Signature</span>
                  </div>
                </div>
              </div>

              {/* Modal Footer (Hidden on Print) */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 print:hidden mt-auto">
                <span>Tip: When the print dialog opens, choose <strong>Save as PDF</strong> as your destination for crisp vector output.</span>
                <button
                  onClick={() => setShowPdfModal(false)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition-colors"
                >
                  Close Preview
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
