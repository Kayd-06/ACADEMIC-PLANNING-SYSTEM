'use client'

import { useState, useEffect } from 'react'
import { MessageSquare, Calendar, User, CheckCircle2, XCircle, Plus, Search, Filter, Loader2, Send, Clock, AlertCircle } from 'lucide-react'
import { formatDate } from '@/lib/date'

function getTodayLocal() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().split('T')[0]
}

interface StudentOption {
  id: string
  name: string
  rollNo: string
  batch: string
}

interface PtmLog {
  id: string
  studentId: string
  studentName: string
  rollNo: string
  batch: string
  date: string
  parentName?: string
  parentAttended: boolean
  discussionNotes: string
  actionItems: string
  followUpDate?: string
  createdAt: string
}

export default function PTMNotesView() {
  const today = getTodayLocal()

  const [batches, setBatches] = useState<string[]>([])
  const [selectedBatch, setSelectedBatch] = useState('')
  const [students, setStudents] = useState<StudentOption[]>([])
  const [selectedStudentId, setSelectedStudentId] = useState('')
  
  const [date, setDate] = useState(today)
  const [parentName, setParentName] = useState('')
  const [parentAttended, setParentAttended] = useState(true)
  const [discussionNotes, setDiscussionNotes] = useState('')
  const [actionItems, setActionItems] = useState('')
  const [followUpDate, setFollowUpDate] = useState('')

  const [ptmLogs, setPtmLogs] = useState<PtmLog[]>([])
  const [loadingLogs, setLoadingLogs] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Fetch batches
  useEffect(() => {
    fetch('/api/daily-report', { method: 'PUT' })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setBatches(data)
          if (data.length > 0 && !selectedBatch) setSelectedBatch(data[0])
        }
      })
      .catch(() => {})
  }, [selectedBatch])

  // Fetch students when batch changes
  useEffect(() => {
    if (!selectedBatch) return
    fetch(`/api/teacher/daily-ratings?batch=${encodeURIComponent(selectedBatch)}&date=${encodeURIComponent(today)}`)
      .then(r => r.json())
      .then(data => {
        if (data.students) {
          const list = data.students.map((s: any) => ({
            id: s.studentId,
            name: s.studentName,
            rollNo: s.rollNo,
            batch: s.batch,
          }))
          setStudents(list)
          if (list.length > 0) setSelectedStudentId(list[0].id)
        }
      })
      .catch(() => {})
  }, [selectedBatch, today])

  // Fetch PTM logs
  const fetchPtmLogs = async () => {
    setLoadingLogs(true)
    try {
      const res = await fetch(`/api/teacher/ptm-reports${selectedBatch ? `?batch=${encodeURIComponent(selectedBatch)}` : ''}`)
      const data = await res.json()
      if (Array.isArray(data)) setPtmLogs(data)
    } catch (e) {
      console.error('Failed to fetch PTM logs', e)
    } finally {
      setLoadingLogs(false)
    }
  }

  useEffect(() => {
    fetchPtmLogs()
  }, [selectedBatch])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedStudentId || !discussionNotes.trim()) {
      setErrorMsg('Please select a student and enter discussion notes.')
      return
    }

    setSubmitting(true)
    setErrorMsg('')
    setSuccessMsg('')

    try {
      const res = await fetch('/api/teacher/ptm-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: selectedStudentId,
          batch: selectedBatch,
          date,
          parentName,
          parentAttended,
          discussionNotes,
          actionItems,
          followUpDate: followUpDate || undefined,
        }),
      })

      const data = await res.json()

      if (res.ok && data.success) {
        setSuccessMsg('Parent meeting notes saved successfully!')
        setDiscussionNotes('')
        setActionItems('')
        setParentName('')
        setFollowUpDate('')
        fetchPtmLogs()
        setTimeout(() => setSuccessMsg(''), 4000)
      } else {
        setErrorMsg(data.error || 'Failed to save meeting notes.')
      }
    } catch (err) {
      console.error(err)
      setErrorMsg('Network error. Failed to submit notes.')
    } finally {
      setSubmitting(false)
    }
  }

  const filteredLogs = ptmLogs.filter(log => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      log.studentName?.toLowerCase().includes(q) ||
      log.discussionNotes?.toLowerCase().includes(q) ||
      log.actionItems?.toLowerCase().includes(q)
    )
  })

  return (
    <div className="flex-1 p-6 md:p-8 overflow-auto bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
          <MessageSquare className="w-6 h-6 text-indigo-600" />
          Parent Meeting Notes & Action Items (PTM Log)
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Record discussion notes, action items, parent attendance, and follow-up tasks from Parent-Teacher Meetings.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Entry Form */}
        <div className="lg:col-span-5">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 sticky top-6">
            <h2 className="text-sm font-bold text-slate-900 mb-4 pb-3 border-b border-slate-100 flex items-center gap-2">
              <Plus className="w-4 h-4 text-indigo-600" />
              Log New Parent Meeting
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Batch & Student Picker */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">
                    Batch
                  </label>
                  <select
                    value={selectedBatch}
                    onChange={e => setSelectedBatch(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {batches.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Student Selector */}
              <div>
                <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">
                  Select Student <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedStudentId}
                  onChange={e => setSelectedStudentId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select a student...</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.rollNo || 'N/A'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Parent Name & Attendance */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">
                    Parent Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Mr. Sharma"
                    value={parentName}
                    onChange={e => setParentName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">
                    Parent Attended?
                  </label>
                  <div className="flex items-center gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => setParentAttended(true)}
                      className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold border transition ${
                        parentAttended ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-slate-50 text-slate-400 border-slate-200'
                      }`}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => setParentAttended(false)}
                      className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold border transition ${
                        !parentAttended ? 'bg-rose-50 text-rose-700 border-rose-300' : 'bg-slate-50 text-slate-400 border-slate-200'
                      }`}
                    >
                      No
                    </button>
                  </div>
                </div>
              </div>

              {/* Discussion Notes */}
              <div>
                <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">
                  Discussion Notes <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Key feedback discussed with parent regarding performance, attendance, behavior..."
                  value={discussionNotes}
                  onChange={e => setDiscussionNotes(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              {/* Action Items */}
              <div>
                <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">
                  Action Items & Commitments
                </label>
                <textarea
                  rows={3}
                  placeholder="Agreed action points (e.g. daily 1-hour self-study, extra guidance in Physics)..."
                  value={actionItems}
                  onChange={e => setActionItems(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              {/* Follow up date */}
              <div>
                <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">
                  Follow-up Date (Optional)
                </label>
                <input
                  type="date"
                  value={followUpDate}
                  onChange={e => setFollowUpDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {errorMsg && <p className="text-xs text-rose-600 font-semibold">{errorMsg}</p>}
              {successMsg && <p className="text-xs text-emerald-600 font-semibold">{successMsg}</p>}

              <button
                type="submit"
                disabled={submitting || !selectedStudentId}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Submit Meeting Notes
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Log History */}
        <div className="lg:col-span-7 space-y-4">
          {/* Filter Toolbar */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center justify-between gap-4">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by student name or notes..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <span className="text-xs font-bold text-slate-400">
              Total: {filteredLogs.length}
            </span>
          </div>

          {/* Logs List */}
          {loadingLogs ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-600 mb-2" />
              <p className="text-xs font-semibold">Loading meeting logs...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
              <MessageSquare className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-semibold">No parent meeting logs found.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLogs.map(log => (
                <div key={log.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs hover:shadow-xs transition space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{log.studentName}</h3>
                      <p className="text-[11px] text-slate-400">
                        {log.batch} · Roll No: {log.rollNo || 'N/A'} {log.parentName ? `· Parent: ${log.parentName}` : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                        log.parentAttended ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}>
                        {log.parentAttended ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {log.parentAttended ? 'Parent Attended' : 'Parent Absent'}
                      </span>
                      <span className="text-[11px] text-slate-400 font-semibold">{formatDate(log.date)}</span>
                    </div>
                  </div>

                  {/* Notes & Action items */}
                  <div className="bg-slate-50/70 rounded-xl p-3.5 space-y-2 border border-slate-100 text-xs text-slate-700">
                    <div>
                      <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-0.5">Discussion Notes</p>
                      <p className="leading-relaxed font-normal">{log.discussionNotes}</p>
                    </div>
                    {log.actionItems && (
                      <div className="pt-2 border-t border-slate-200/60">
                        <p className="text-[10px] font-extrabold text-indigo-500 uppercase tracking-widest mb-0.5">Action Items</p>
                        <p className="leading-relaxed font-medium text-slate-800">{log.actionItems}</p>
                      </div>
                    )}
                  </div>

                  {log.followUpDate && (
                    <div className="flex items-center gap-1.5 text-[11px] text-indigo-600 font-bold">
                      <Clock className="w-3.5 h-3.5" />
                      Follow-up Scheduled: {formatDate(log.followUpDate)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
