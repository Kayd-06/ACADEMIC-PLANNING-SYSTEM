'use client'
import { useState, useEffect } from 'react'
import { Calendar, ChevronDown, CheckCircle2, Flag, Send, UserCheck, UserX, Loader2, ChevronUp, Pencil, Trash2, X } from 'lucide-react'
import { formatDate } from '@/lib/date'
import { motion, AnimatePresence } from 'framer-motion'

function getTodayLocal() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().split('T')[0]
}

interface DailyReport {
  id: string
  date: string
  batch: string
  subject: string
  chapter: string
  topicsCovered: string
  presentCount: number
  absentCount: number
  homeworkGiven: string
  observations: string
  isLate: boolean
  submittedAt: string
}

export default function TeacherDailyReportView() {
  const today = getTodayLocal()

  const [form, setForm] = useState({
    date: today,
    batch: '',
    subject: '',
    chapter: '',
    topicsCovered: '',
    homeworkGiven: '',
    observations: '',
  })

  const [batches, setBatches] = useState<string[]>([])
  const [subjects, setSubjects] = useState<string[]>([])
  const [chapters, setChapters] = useState<string[]>([])
  const [submissions, setSubmissions] = useState<DailyReport[]>([])
  const [showAll, setShowAll] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const [editingReport, setEditingReport] = useState<DailyReport | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Fetch batches from students table
  useEffect(() => {
    fetch('/api/daily-report', { method: 'PUT' })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setBatches(data) })
      .catch(() => {})
      
    fetch('/api/teacher-portal/subjects')
      .then(r => r.json())
      .then(data => { if (data.subjects) setSubjects(data.subjects) })
      .catch(() => {})
  }, [])

  // Fetch chapters when batch or subject changes
  useEffect(() => {
    if (!form.batch || !form.subject) { setChapters([]); return }
    fetch(`/api/teacher-portal/academic-planning/chapters?class=${encodeURIComponent(form.batch)}&subject=${encodeURIComponent(form.subject)}`)
      .then(r => r.json())
      .then(data => {
        if (data.chapters) setChapters(data.chapters.map((c: any) => c.title))
        else setChapters([])
      })
      .catch(() => setChapters([]))
  }, [form.batch, form.subject])

  // Fetch past submissions
  const fetchSubmissions = () => {
    fetch('/api/daily-report?cacheBuster=' + Date.now())
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setSubmissions(data) })
      .catch(() => {})
  }

  useEffect(() => {
    fetchSubmissions()
  }, [])

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async () => {
    if (!form.batch || !form.subject || !form.topicsCovered) {
      setErrorMsg('Batch, subject, and topics covered are required.'); return
    }
    setSubmitting(true); setErrorMsg(''); setSuccessMsg('')
    try {
      const res = await fetch('/api/daily-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        const saved = await res.json()
        setSuccessMsg(saved.isLate ? 'Report submitted (marked as Late — submitted after hours).' : 'Report submitted successfully!')
        setForm({ date: today, batch: '', subject: '', chapter: '', topicsCovered: '', homeworkGiven: '', observations: '' })
        fetchSubmissions()
      } else {
        const err = await res.json()
        setErrorMsg(err.error || 'Submission failed')
      }
    } catch { setErrorMsg('Network error') } finally { setSubmitting(false) }
  }

  const handleEditSave = async () => {
    if (!editingReport) return
    setSavingEdit(true)
    try {
      const res = await fetch(`/api/daily-report?id=${editingReport.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicsCovered: editingReport.topicsCovered,
          homeworkGiven: editingReport.homeworkGiven,
          observations: editingReport.observations
        })
      })
      if (res.ok) {
        setEditingReport(null)
        fetchSubmissions()
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to update')
      }
    } catch (err) {
      alert('Network error')
    } finally {
      setSavingEdit(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this report?')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/daily-report?id=${id}`, { method: 'DELETE' })
      if (res.ok) fetchSubmissions()
      else alert('Failed to delete')
    } finally {
      setDeletingId(null)
    }
  }

  const displayed = showAll ? submissions : submissions.slice(0, 5)

  return (
    <div className="flex-1 p-8 overflow-auto bg-slate-50 min-h-screen">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Daily Report</h1>
        <p className="text-[13px] text-slate-500 mt-1">Log what was taught today</p>
      </div>

      {/* Form */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 mb-8 max-w-4xl">
        <div className="space-y-6">

          {/* Date & Batch */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-[13px] font-bold text-slate-900 mb-2">Date</label>
              <div className="relative">
                <Calendar className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="date" value={form.date} onChange={e => set('date', e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
            <div>
              <label className="block text-[13px] font-bold text-slate-900 mb-2">Batch</label>
              <div className="relative">
                <select value={form.batch} onChange={e => set('batch', e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none">
                  <option value="">Select batch...</option>
                  {batches.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
                <ChevronDown className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Subject & Chapter */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-[13px] font-bold text-slate-900 mb-2">Subject</label>
              <div className="relative">
                {subjects.length > 0 ? (
                  <>
                    <select value={form.subject} onChange={e => set('subject', e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none">
                      <option value="">Select subject...</option>
                      {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <ChevronDown className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </>
                ) : (
                  <input value={form.subject} onChange={e => set('subject', e.target.value)}
                    placeholder="e.g. Physics, Chemistry..."
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                )}
              </div>
            </div>
            <div>
              <label className="block text-[13px] font-bold text-slate-900 mb-2">Chapter</label>
              <div className="relative">
                {chapters.length > 0 ? (
                  <>
                    <select value={form.chapter} onChange={e => set('chapter', e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none">
                      <option value="">Select chapter...</option>
                      {chapters.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <ChevronDown className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </>
                ) : (
                  <input value={form.chapter} onChange={e => set('chapter', e.target.value)}
                    placeholder="Enter chapter name..."
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                )}
              </div>
            </div>
          </div>

          {/* Topics Covered */}
          <div>
            <label className="block text-[13px] font-bold text-slate-900 mb-2">Topics Covered <span className="text-red-500">*</span></label>
            <textarea rows={4} value={form.topicsCovered} onChange={e => set('topicsCovered', e.target.value)}
              placeholder="Briefly describe the topics discussed..."
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
          </div>



          {/* Homework & Observations */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-[13px] font-bold text-slate-900 mb-2">Homework Given</label>
              <textarea rows={3} value={form.homeworkGiven} onChange={e => set('homeworkGiven', e.target.value)}
                placeholder="Assignments or readings..."
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
            </div>
            <div>
              <label className="block text-[13px] font-bold text-slate-900 mb-2">Observations (Optional)</label>
              <textarea rows={3} value={form.observations} onChange={e => set('observations', e.target.value)}
                placeholder="Any behavioral or academic notes..."
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
            </div>
          </div>

          {errorMsg && <p className="text-sm text-red-600 font-medium">{errorMsg}</p>}
          {successMsg && <p className="text-sm text-emerald-600 font-medium">{successMsg}</p>}

          <button type="button" onClick={handleSubmit} disabled={submitting}
            className="w-full py-4 bg-[#0b1320] text-white rounded-xl text-sm font-bold shadow-sm hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Submit Daily Report
          </button>
        </div>
      </div>

      {/* Recent Submissions */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden max-w-4xl pb-4">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Your Recent Submissions</h2>
          {submissions.length > 5 && (
            <button onClick={() => setShowAll(v => !v)} className="flex items-center gap-1 text-[12px] font-bold text-indigo-600 hover:underline">
              {showAll ? <><ChevronUp className="w-3.5 h-3.5" /> Show Less</> : <>View All ({submissions.length})</>}
            </button>
          )}
        </div>
        {submissions.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">No submissions yet. Submit your first report above.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Date</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Batch</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Subject</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Chapter</th>
                <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayed.map((sub, idx) => (
                <tr key={sub.id || idx} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4 text-[13px] font-semibold text-slate-700">{formatDate(sub.date)}</td>
                  <td className="px-6 py-4 text-[13px] font-bold text-slate-900">{sub.batch}</td>
                  <td className="px-6 py-4 text-[13px] text-slate-600">{sub.subject}</td>
                  <td className="px-6 py-4 text-[13px] text-slate-500 max-w-[180px] truncate">{sub.chapter || '—'}</td>
                  <td className="px-6 py-4 text-right">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold rounded-full uppercase tracking-wider ${sub.isLate ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                      {sub.isLate ? <Flag className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                      {sub.isLate ? 'Late' : 'On Time'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setEditingReport(sub)}
                        className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Edit">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(sub.id)} disabled={deletingId === sub.id}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete">
                        {deletingId === sub.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit Modal */}
      <AnimatePresence>
        {editingReport && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setEditingReport(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div>
                  <h3 className="text-base font-bold text-gray-900">Edit Report</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{formatDate(editingReport.date)} · {editingReport.batch} · {editingReport.subject}</p>
                </div>
                <button onClick={() => setEditingReport(null)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-5">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2">Topics Covered</label>
                  <textarea rows={3} value={editingReport.topicsCovered}
                    onChange={e => setEditingReport({ ...editingReport, topicsCovered: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                </div>
                


                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2">Homework Given</label>
                  <textarea rows={2} value={editingReport.homeworkGiven || ''}
                    onChange={e => setEditingReport({ ...editingReport, homeworkGiven: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2">Observations</label>
                  <textarea rows={2} value={editingReport.observations || ''}
                    onChange={e => setEditingReport({ ...editingReport, observations: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                </div>
              </div>

              <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                <button onClick={() => setEditingReport(null)}
                  className="px-4 py-2 text-sm font-bold text-gray-600 hover:text-gray-900 transition-colors">
                  Cancel
                </button>
                <button onClick={handleEditSave} disabled={savingEdit}
                  className="px-5 py-2 bg-[#0b1320] hover:bg-slate-800 text-white text-sm font-bold rounded-lg transition-colors flex items-center gap-2">
                  {savingEdit && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save Changes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
