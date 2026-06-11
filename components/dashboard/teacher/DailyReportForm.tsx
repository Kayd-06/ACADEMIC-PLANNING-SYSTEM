'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ClipboardList,
  Plus,
  Trash2,
  Send,
  Save,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clock,
  BookOpen,
  Users,
  Pencil,
  CalendarDays,
  AlertCircle,
  Loader2,
} from 'lucide-react'

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, type: 'spring' as const, stiffness: 320, damping: 28 },
})

interface ClassRow {
  className: string
  subject: string
  topicCovered: string
  studentsPresent: number | ''
}

interface HistoryReport {
  _id: string
  date: string
  classesHeld: ClassRow[]
  activitiesConducted: string
  materialsUsed: string
  studentsAttended: string
  remarks: string
  status: 'draft' | 'submitted'
  createdAt: string
}

function getTodayLocal() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().split('T')[0]
}

function formatDisplayDate(dateStr: string) {
  try {
    const d = new Date(dateStr.replace(/-/g, '/'))
    return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return dateStr
  }
}

const emptyClass = (): ClassRow => ({ className: '', subject: '', topicCovered: '', studentsPresent: '' })

export default function DailyReportForm({ firstName }: { firstName: string }) {
  const [date, setDate] = useState(getTodayLocal())
  const [classesHeld, setClassesHeld] = useState<ClassRow[]>([emptyClass()])
  const [activitiesConducted, setActivitiesConducted] = useState('')
  const [materialsUsed, setMaterialsUsed] = useState('')
  const [studentsAttended, setStudentsAttended] = useState('')
  const [remarks, setRemarks] = useState('')
  const [saving, setSaving] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'saved' | 'submitted' | 'error'>('idle')
  const [currentReportId, setCurrentReportId] = useState<string | null>(null)
  const [currentStatus, setCurrentStatus] = useState<'draft' | 'submitted'>('draft')

  const [history, setHistory] = useState<HistoryReport[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [expandedReport, setExpandedReport] = useState<string | null>(null)

  // Load report for the selected date + recent history
  useEffect(() => {
    fetchHistory()
  }, [])

  useEffect(() => {
    loadReportForDate(date)
  }, [date, history])

  async function fetchHistory() {
    setLoadingHistory(true)
    try {
      const res = await fetch('/api/daily-report')
      const data = await res.json()
      if (!data.error) setHistory(data)
    } finally {
      setLoadingHistory(false)
    }
  }

  function loadReportForDate(d: string) {
    const existing = history.find(r => r.date === d)
    if (existing) {
      setClassesHeld(existing.classesHeld.length > 0 ? existing.classesHeld : [emptyClass()])
      setActivitiesConducted(existing.activitiesConducted || '')
      setMaterialsUsed(existing.materialsUsed || '')
      setStudentsAttended(existing.studentsAttended || '')
      setRemarks(existing.remarks || '')
      setCurrentReportId(existing._id)
      setCurrentStatus(existing.status)
      setSubmitStatus('idle')
    } else {
      // Reset form for new date
      setClassesHeld([emptyClass()])
      setActivitiesConducted('')
      setMaterialsUsed('')
      setStudentsAttended('')
      setRemarks('')
      setCurrentReportId(null)
      setCurrentStatus('draft')
      setSubmitStatus('idle')
    }
  }

  function updateClass(index: number, field: keyof ClassRow, value: string | number) {
    setClassesHeld(prev => prev.map((row, i) => i === index ? { ...row, [field]: value } : row))
  }

  function addClass() {
    setClassesHeld(prev => [...prev, emptyClass()])
  }

  function removeClass(index: number) {
    setClassesHeld(prev => prev.filter((_, i) => i !== index))
  }

  async function saveReport(submitAsStatus: 'draft' | 'submitted') {
    setSaving(true)
    setSubmitStatus('idle')
    try {
      const payload = {
        date,
        classesHeld: classesHeld.filter(c => c.className || c.subject || c.topicCovered).map(c => ({
          ...c,
          studentsPresent: Number(c.studentsPresent) || 0,
        })),
        activitiesConducted,
        materialsUsed,
        studentsAttended,
        remarks,
        status: submitAsStatus,
      }
      const res = await fetch('/api/daily-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setCurrentReportId(data._id)
      setCurrentStatus(data.status)
      setSubmitStatus(submitAsStatus === 'submitted' ? 'submitted' : 'saved')
      await fetchHistory()
    } catch {
      setSubmitStatus('error')
    } finally {
      setSaving(false)
    }
  }

  const isSubmitted = currentStatus === 'submitted'
  const isToday = date === getTodayLocal()

  return (
    <div className="flex-1 p-6 overflow-auto bg-gray-50/50">
      {/* Header */}
      <motion.div {...fadeUp(0)} className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Daily Activity Report</h1>
          <p className="text-gray-500 mt-1 text-sm">
            {isToday ? "Log what you accomplished today." : `Viewing report for ${formatDisplayDate(date)}.`}
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm bg-white border border-gray-200 shadow-sm px-3 py-2 rounded-xl">
          <CalendarDays className="w-4 h-4 text-[#002045]" />
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            max={getTodayLocal()}
            className="text-sm font-semibold text-gray-700 outline-none cursor-pointer"
          />
        </div>
      </motion.div>

      {/* Status badge if already submitted */}
      <AnimatePresence>
        {isSubmitted && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2.5 mb-6 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl text-sm font-semibold"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            Report for {formatDisplayDate(date)} has been submitted. You can still edit and resubmit.
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-12 gap-6">
        {/* Main Form */}
        <div className="col-span-8 space-y-5">

          {/* Classes Held */}
          <motion.div {...fadeUp(0.05)} className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-[#002045]" />
                <h2 className="text-sm font-bold text-gray-900">Classes Held</h2>
              </div>
              <button
                onClick={addClass}
                className="flex items-center gap-1.5 text-xs font-semibold text-[#002045] hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors border border-[#002045]/20"
              >
                <Plus className="w-3.5 h-3.5" /> Add Class
              </button>
            </div>

            <div className="space-y-3">
              {/* Column headers */}
              <div className="grid grid-cols-12 gap-2 px-1">
                {['Class / Batch', 'Subject', 'Topic Covered', 'Students Present'].map(h => (
                  <span key={h} className="text-[10px] font-bold uppercase tracking-wider text-gray-400 col-span-3">{h}</span>
                ))}
              </div>

              <AnimatePresence>
                {classesHeld.map((row, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="grid grid-cols-12 gap-2 items-center group"
                  >
                    <input
                      value={row.className}
                      onChange={e => updateClass(idx, 'className', e.target.value)}
                      placeholder="e.g. Class 10-A"
                      className="col-span-3 px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#002045]/20 focus:border-[#002045]/40 transition-all"
                    />
                    <input
                      value={row.subject}
                      onChange={e => updateClass(idx, 'subject', e.target.value)}
                      placeholder="e.g. Physics"
                      className="col-span-3 px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#002045]/20 focus:border-[#002045]/40 transition-all"
                    />
                    <input
                      value={row.topicCovered}
                      onChange={e => updateClass(idx, 'topicCovered', e.target.value)}
                      placeholder="e.g. Newton's Laws"
                      className="col-span-3 px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#002045]/20 focus:border-[#002045]/40 transition-all"
                    />
                    <div className="col-span-3 flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        value={row.studentsPresent}
                        onChange={e => updateClass(idx, 'studentsPresent', e.target.value)}
                        placeholder="0"
                        className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#002045]/20 focus:border-[#002045]/40 transition-all"
                      />
                      {classesHeld.length > 1 && (
                        <button
                          onClick={() => removeClass(idx)}
                          className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              <button
                onClick={addClass}
                className="mt-2 w-full border border-dashed border-gray-200 rounded-xl py-3 text-xs font-bold text-gray-400 hover:bg-gray-50 hover:border-[#002045]/30 hover:text-[#002045] transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-3.5 h-3.5" /> Add another class
              </button>
            </div>
          </motion.div>

          {/* Activities Conducted */}
          <motion.div {...fadeUp(0.08)} className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
            <label className="flex items-center gap-2 text-sm font-bold text-gray-900 mb-3">
              <Pencil className="w-4 h-4 text-[#002045]" />
              Extra Activities Conducted
            </label>
            <textarea
              value={activitiesConducted}
              onChange={e => setActivitiesConducted(e.target.value)}
              rows={3}
              placeholder="Describe any extra duties, events, meetings, lab sessions, supervision rounds, or other activities conducted today..."
              className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#002045]/20 focus:border-[#002045]/40 transition-all resize-none leading-relaxed"
            />
          </motion.div>

          {/* Materials Used */}
          <motion.div {...fadeUp(0.11)} className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
            <label className="flex items-center gap-2 text-sm font-bold text-gray-900 mb-3">
              <BookOpen className="w-4 h-4 text-indigo-500" />
              Teaching Materials & Resources Used
            </label>
            <textarea
              value={materialsUsed}
              onChange={e => setMaterialsUsed(e.target.value)}
              rows={2}
              placeholder="e.g. Allen Modules Ch. 12, NCERT textbook, PowerPoint slides, online simulation tools..."
              className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#002045]/20 focus:border-[#002045]/40 transition-all resize-none leading-relaxed"
            />
          </motion.div>

          {/* Remarks */}
          <motion.div {...fadeUp(0.14)} className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
            <label className="flex items-center gap-2 text-sm font-bold text-gray-900 mb-3">
              <ClipboardList className="w-4 h-4 text-amber-500" />
              Observations & Remarks
            </label>
            <textarea
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              rows={3}
              placeholder="Any observations about student performance, challenges faced, suggestions for improvement, or things to follow up on..."
              className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#002045]/20 focus:border-[#002045]/40 transition-all resize-none leading-relaxed"
            />
          </motion.div>

          {/* Action Buttons */}
          <motion.div {...fadeUp(0.17)} className="flex items-center gap-3">
            <button
              onClick={() => saveReport('draft')}
              disabled={saving || isSubmitted}
              className="flex items-center gap-2 px-5 py-2.5 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-xl transition-all shadow-sm disabled:opacity-40"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Draft
            </button>
            <button
              onClick={() => saveReport('submitted')}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-[#002045] hover:bg-[#1a365d] text-white text-sm font-bold rounded-xl transition-all shadow-sm disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {isSubmitted ? 'Resubmit Report' : 'Submit Report'}
            </button>

            <AnimatePresence>
              {submitStatus === 'saved' && (
                <motion.span
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-1.5 text-sm text-emerald-600 font-semibold"
                >
                  <CheckCircle2 className="w-4 h-4" /> Draft saved
                </motion.span>
              )}
              {submitStatus === 'submitted' && (
                <motion.span
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-1.5 text-sm text-[#002045] font-semibold"
                >
                  <CheckCircle2 className="w-4 h-4" /> Report submitted!
                </motion.span>
              )}
              {submitStatus === 'error' && (
                <motion.span
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-1.5 text-sm text-red-500 font-semibold"
                >
                  <AlertCircle className="w-4 h-4" /> Failed to save. Try again.
                </motion.span>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* Sidebar — Stats + History */}
        <div className="col-span-4 space-y-5">

          {/* Quick Stats */}
          <motion.div {...fadeUp(0.06)} className="bg-[#002045] rounded-2xl p-5 text-white shadow-md">
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/60 mb-4">Today's Summary</p>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm text-white/80">
                  <BookOpen className="w-4 h-4 text-white/50" /> Classes planned
                </span>
                <span className="text-lg font-bold">{classesHeld.filter(c => c.className).length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm text-white/80">
                  <Users className="w-4 h-4 text-white/50" /> Total students
                </span>
                <span className="text-lg font-bold">
                  {classesHeld.reduce((sum, c) => sum + (Number(c.studentsPresent) || 0), 0)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm text-white/80">
                  <ClipboardList className="w-4 h-4 text-white/50" /> Status
                </span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  currentStatus === 'submitted'
                    ? 'bg-emerald-400/20 text-emerald-300'
                    : 'bg-amber-400/20 text-amber-300'
                }`}>
                  {currentStatus === 'submitted' ? 'Submitted' : 'Draft'}
                </span>
              </div>
            </div>
          </motion.div>

          {/* Students Attended (general note) */}
          <motion.div {...fadeUp(0.09)} className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
            <label className="flex items-center gap-2 text-sm font-bold text-gray-900 mb-2">
              <Users className="w-4 h-4 text-indigo-500" /> Attendance Note
            </label>
            <textarea
              value={studentsAttended}
              onChange={e => setStudentsAttended(e.target.value)}
              rows={2}
              placeholder="Overall attendance observation (e.g. 18/22 present in batch A1)..."
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#002045]/20 transition-all resize-none"
            />
          </motion.div>

          {/* Past Reports History */}
          <motion.div {...fadeUp(0.12)} className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-bold text-gray-900">Recent Reports</p>
              <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Last 7 days</span>
            </div>

            {loadingHistory ? (
              <div className="flex justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
              </div>
            ) : history.length === 0 ? (
              <p className="text-xs text-gray-400 italic text-center py-4">No reports yet. Submit your first one!</p>
            ) : (
              <div className="space-y-2">
                {history.slice(0, 7).map(report => {
                  const isExpanded = expandedReport === report._id
                  const isActive = report.date === date
                  return (
                    <div
                      key={report._id}
                      className={`border rounded-xl transition-all overflow-hidden ${
                        isActive ? 'border-[#002045]/30 bg-blue-50/50' : 'border-gray-100 bg-gray-50/50'
                      }`}
                    >
                      <button
                        className="w-full flex items-center justify-between px-3 py-2.5 text-left"
                        onClick={() => {
                          setDate(report.date)
                          setExpandedReport(isExpanded ? null : report._id)
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            report.status === 'submitted' ? 'bg-emerald-500' : 'bg-amber-400'
                          }`} />
                          <span className="text-xs font-semibold text-gray-700">
                            {new Date(report.date.replace(/-/g, '/')).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          </span>
                          {isActive && (
                            <span className="text-[9px] font-bold text-[#002045] uppercase tracking-wider">Active</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                            report.status === 'submitted'
                              ? 'bg-emerald-50 text-emerald-600'
                              : 'bg-amber-50 text-amber-600'
                          }`}>
                            {report.status === 'submitted' ? 'Submitted' : 'Draft'}
                          </span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
                        </div>
                      </button>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="px-3 pb-3 border-t border-gray-100 pt-2 space-y-1.5">
                              <p className="text-[11px] text-gray-500">
                                <span className="font-bold text-gray-700">Classes:</span>{' '}
                                {report.classesHeld.length > 0
                                  ? report.classesHeld.map(c => c.className).filter(Boolean).join(', ')
                                  : '—'}
                              </p>
                              {report.remarks && (
                                <p className="text-[11px] text-gray-500 line-clamp-2">
                                  <span className="font-bold text-gray-700">Remarks:</span> {report.remarks}
                                </p>
                              )}
                              <div className="flex items-center gap-1.5 pt-1">
                                {report.status === 'submitted'
                                  ? <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                  : <Clock className="w-3 h-3 text-amber-400" />
                                }
                                <span className="text-[10px] text-gray-400 font-medium">
                                  {report.status === 'submitted' ? 'Submitted' : 'Saved as draft'}
                                </span>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )
                })}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  )
}
