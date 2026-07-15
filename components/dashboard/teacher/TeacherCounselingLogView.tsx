'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  HeartHandshake, Plus, Search, Filter, Eye, RefreshCw,
  X, Calendar, Clock, CheckCircle, AlertTriangle, XCircle, Trash2, ChevronRight, ChevronDown, User, AlertCircle
} from 'lucide-react'

interface Session {
  _id: string
  studentName: string
  studentInitials: string
  counselor: string
  counselorId?: string
  counselorRole?: string
  type: 'Academic' | 'Career' | 'Personal' | 'Disciplinary' | 'Parent Meeting'
  date: string
  time: string
  duration?: string
  durationMinutes?: number
  status: 'Scheduled' | 'Completed' | 'No-Show' | 'Cancelled'
  notes?: string
  actionItems?: string
  nextSessionDate?: string
  flagged: boolean
  createdAt: string
}

interface Student {
  _id: string
  name: string
  rollNo?: string
  class?: string
  section?: string
}

const TYPE_COLORS: Record<string, string> = {
  Academic:         'bg-blue-50 text-blue-700 border border-blue-100',
  Career:           'bg-amber-50 text-amber-700 border border-amber-100',
  Personal:         'bg-emerald-50 text-emerald-700 border border-emerald-100',
  Disciplinary:     'bg-rose-50 text-rose-700 border border-rose-100',
  'Parent Meeting': 'bg-violet-50 text-violet-700 border border-violet-100',
}

const TYPE_DOT_COLORS: Record<string, string> = {
  Academic:         'bg-blue-600',
  Career:           'bg-amber-500',
  Personal:         'bg-emerald-600',
  Disciplinary:     'bg-rose-600',
  'Parent Meeting': 'bg-violet-600',
}

const STATUS_BADGE: Record<string, string> = {
  Scheduled: 'bg-blue-50 text-blue-700 border border-blue-100',
  Completed: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
  'No-Show': 'bg-rose-50 text-rose-700 border border-rose-100',
  Cancelled: 'bg-slate-100 text-slate-500 border border-slate-200',
}

const AVATAR_BG = [
  'bg-blue-100 text-blue-700',
  'bg-indigo-100 text-indigo-700',
  'bg-violet-100 text-violet-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
]

function getAvatarBg(name: string) {
  if (!name) return AVATAR_BG[0]
  return AVATAR_BG[name.charCodeAt(0) % AVATAR_BG.length]
}

function formatDate(dateStr: string) {
  if (!dateStr) return '—'
  const dateObj = new Date(dateStr)
  if (isNaN(dateObj.getTime())) return dateStr
  return dateObj.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function TeacherCounselingLogView({ counselorName, counselorId }: { counselorName: string, counselorId?: string }) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('All')
  
  // Modal states
  const [showCreate, setShowCreate] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [selected, setSelected] = useState<Session | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Expandable notes states (keyed by session ID)
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({})

  // Form states
  const [studentSearch, setStudentSearch] = useState('')
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [showStudentDropdown, setShowStudentDropdown] = useState(false)
  const [formType, setFormType] = useState<Session['type']>('Academic')
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split('T')[0])
  const [formTime, setFormTime] = useState('10:00 AM')
  const [formDuration, setFormDuration] = useState('30 mins')
  const [formNotes, setFormNotes] = useState('')
  const [formActionItems, setFormActionItems] = useState('')
  const [formNextSessionDate, setFormNextSessionDate] = useState('')
  const [formStatus, setFormStatus] = useState<Session['status']>('Scheduled')

  // Toast message
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function fetchSessions() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (typeFilter !== 'All') params.set('type', typeFilter)
      if (search.trim()) params.set('search', search.trim())
      if (counselorId) params.set('counselorId', counselorId)
      else if (counselorName) params.set('counselor', counselorName)

      const res = await fetch(`/api/counseling?${params.toString()}`)
      const data = await res.json()
      if (!data.error) {
        setSessions(data.sessions ?? [])
      } else {
        setMessage({ type: 'error', text: data.error })
      }
    } catch (err) {
      console.error('Failed to fetch sessions:', err)
      setMessage({ type: 'error', text: 'Failed to load counseling sessions.' })
    } finally {
      setLoading(false)
    }
  }

  async function fetchStudents() {
    try {
      const res = await fetch('/api/students?activeOnly=true')
      const data = await res.json()
      if (Array.isArray(data)) {
        setStudents(data)
      }
    } catch (err) {
      console.error('Failed to fetch students:', err)
    }
  }

  // Load initial data
  useEffect(() => {
    fetchSessions()
    fetchStudents()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter])

  // Debounced search
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchSessions()
    }, 350)

    return () => clearTimeout(delayDebounceFn)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  // Auto-clear message toasts
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [message])

  // Toggle notes expansion helper
  const toggleNotes = (id: string) => {
    setExpandedNotes(prev => ({ ...prev, [id]: !prev[id] }))
  }

  // Handle Log Session Submit
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedStudent || !formDate || !formTime) {
      setMessage({ type: 'error', text: 'Please select a student and fill in date/time.' })
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/counseling', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName: selectedStudent.name,
          counselor: counselorName,
          counselorId: counselorId,
          counselorRole: 'teacher',
          type: formType,
          date: formDate,
          time: formTime,
          duration: formDuration,
          notes: formNotes,
          actionItems: formActionItems,
          nextSessionDate: formNextSessionDate
        })
      })
      
      const data = await res.json()
      if (res.ok && !data.error) {
        setMessage({ type: 'success', text: `Session for ${selectedStudent.name} logged successfully!` })
        setShowCreate(false)
        resetForm()
        fetchSessions()
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to log session.' })
      }
    } catch (err) {
      console.error(err)
      setMessage({ type: 'error', text: 'Network error. Please try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  // Handle Edit/Update Session Submit
  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!selected || !formDate || !formTime) return

    setSubmitting(true)
    try {
      const res = await fetch('/api/counseling', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selected._id,
          status: formStatus,
          notes: formNotes,
          duration: formDuration,
          actionItems: formActionItems,
          nextSessionDate: formNextSessionDate
        })
      })

      const data = await res.json()
      if (res.ok && !data.error) {
        setMessage({ type: 'success', text: 'Session updated successfully!' })
        setShowEdit(false)
        fetchSessions()
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to update session.' })
      }
    } catch (err) {
      console.error(err)
      setMessage({ type: 'error', text: 'Network error. Please try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  // Handle Delete Session
  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this session entry?')) return

    try {
      const res = await fetch(`/api/counseling?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        setMessage({ type: 'success', text: 'Session entry deleted successfully.' })
        setShowEdit(false)
        fetchSessions()
      } else {
        const d = await res.json()
        setMessage({ type: 'error', text: d.error || 'Failed to delete.' })
      }
    } catch (err) {
      console.error(err)
      setMessage({ type: 'error', text: 'Network error.' })
    }
  }

  const resetForm = () => {
    setSelectedStudent(null)
    setStudentSearch('')
    setFormType('Academic')
    setFormDate(new Date().toISOString().split('T')[0])
    setFormTime('10:00 AM')
    setFormDuration('30 mins')
    setFormNotes('')
    setFormActionItems('')
    setFormNextSessionDate('')
    setFormStatus('Scheduled')
  }

  const openEditModal = (session: Session) => {
    setSelected(session)
    setFormStatus(session.status)
    setFormDuration(session.duration || '30 mins')
    setFormNotes(session.notes || '')
    setFormActionItems(session.actionItems || '')
    setFormNextSessionDate(session.nextSessionDate || '')
    setShowEdit(true)
  }

  // Filter students by search term in selection dropdown
  const filteredStudents = students.filter(student =>
    student.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
    (student.class && student.class.toLowerCase().includes(studentSearch.toLowerCase()))
  ).slice(0, 5) // Limit results for clean UI

  return (
    <div className="flex-1 p-6 space-y-6 overflow-y-auto max-h-[calc(100vh-64px)] bg-gray-50 flex flex-col font-sans">
      
      {/* Toast Notification Container */}
      {message && (
        <div className={`p-4 rounded-xl flex items-start gap-3 border shadow-sm max-w-md fixed top-4 right-4 z-50 animate-fade-in ${
          message.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          )}
          <span className="text-sm font-medium">{message.text}</span>
        </div>
      )}

      {/* Header toolbar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Counseling Log</h1>
          <p className="text-sm text-slate-500 mt-1">Log and track counseling sessions with your students</p>
        </div>
        
        <button
          onClick={() => { resetForm(); setShowCreate(true) }}
          className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition shadow-sm cursor-pointer border-none self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          Log Session
        </button>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row items-center gap-4 bg-white border border-slate-100 rounded-2xl p-4 shadow-2xs">
        <div className="relative w-full sm:flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filter by student name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-700"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full sm:w-48 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          >
            <option value="All">All Session Types</option>
            <option value="Academic">Academic</option>
            <option value="Career">Career</option>
            <option value="Personal">Personal</option>
            <option value="Disciplinary">Disciplinary</option>
            <option value="Parent Meeting">Parent Meeting</option>
          </select>
        </div>
      </div>

      {/* Main List Section with Timeline */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col flex-1 relative min-h-[400px]">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-400 space-y-2">
            <RefreshCw className="w-8 h-8 animate-spin text-slate-500" />
            <p className="text-sm font-medium">Loading counseling logs...</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-400">
            <HeartHandshake className="w-12 h-12 text-slate-300 mb-3" />
            <p className="text-sm font-medium">No counseling sessions found.</p>
          </div>
        ) : (
          <div className="relative pl-6 md:pl-8 border-l border-slate-150 ml-3 md:ml-4 space-y-6 my-2">
            {sessions.map((session) => {
              const typeColor = TYPE_COLORS[session.type] || 'bg-slate-50 text-slate-600 border border-slate-200'
              const statusColor = STATUS_BADGE[session.status] || 'bg-slate-50 text-slate-600 border border-slate-200'
              const dotColor = TYPE_DOT_COLORS[session.type] || 'bg-slate-400'
              const isNotesExpanded = !!expandedNotes[session._id]

              return (
                <div key={session._id} className="relative group">
                  {/* Timeline Dot */}
                  <span className={`absolute -left-[30px] md:-left-[38px] top-6 w-3 h-3 rounded-full border-2 border-white shadow-2xs z-10 transition-transform group-hover:scale-125 ${dotColor}`} />

                  {/* Card Container */}
                  <div className="border border-slate-100 rounded-xl p-5 hover:bg-slate-50/50 hover:border-slate-200 transition-all bg-white shadow-xs">
                    
                    {/* Header Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      
                      {/* Left: Avatar & Name details */}
                      <div className="flex items-center gap-3">
                        <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm shadow-2xs ${getAvatarBg(session.studentName)}`}>
                          {session.studentInitials || 'ST'}
                        </div>
                        <div>
                          <h3 
                            onClick={() => openEditModal(session)}
                            className="font-bold text-slate-800 text-sm hover:text-blue-600 transition cursor-pointer"
                          >
                            {session.studentName}
                          </h3>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-1">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {formatDate(session.date)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {session.duration || '30 mins'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Badges */}
                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${typeColor}`}>
                          {session.type}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${statusColor}`}>
                          {session.status}
                        </span>
                      </div>
                    </div>

                    {/* Expandable Notes Trigger & Area */}
                    <div className="border-t border-slate-100/60 mt-4 pt-3 flex flex-col gap-2">
                      {session.status === 'No-Show' && session.notes && !isNotesExpanded && (
                        <p className="text-xs text-slate-400 italic">
                          {session.notes}
                        </p>
                      )}

                      <button
                        onClick={() => toggleNotes(session._id)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-slate-700 transition cursor-pointer border-none bg-transparent self-start p-0"
                      >
                        {isNotesExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        View Notes & Action Items
                      </button>

                      <AnimatePresence>
                        {isNotesExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 mt-1.5 text-xs text-slate-600 leading-relaxed space-y-1">
                              <p className="font-semibold text-slate-700">Notes & Session Detail:</p>
                              <p>{session.notes || 'No notes documented.'}</p>
                              <div className="flex items-center justify-between pt-2.5 text-[10px] text-slate-400 font-mono">
                                <span>Counselor: {session.counselor}</span>
                                <span>Logged: {new Date(session.createdAt).toLocaleDateString()}</span>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Log Session Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl max-w-md w-full p-6 space-y-5 relative">
            <button
              onClick={() => setShowCreate(false)}
              className="absolute right-4 top-4 p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-slate-800">Log Counseling Session</h3>
            
            <form onSubmit={handleCreate} className="space-y-4">
              
              {/* Student Dropdown Selector */}
              <div className="space-y-1 relative">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Select Student</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    placeholder="Search active students..."
                    value={selectedStudent ? selectedStudent.name : studentSearch}
                    onChange={(e) => {
                      setStudentSearch(e.target.value)
                      setSelectedStudent(null)
                      setShowStudentDropdown(true)
                    }}
                    onFocus={() => setShowStudentDropdown(true)}
                    className="w-full border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-700"
                  />
                  {selectedStudent && (
                    <button
                      type="button"
                      onClick={() => { setSelectedStudent(null); setStudentSearch('') }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:bg-slate-100 rounded-full"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Dropdown Results */}
                {showStudentDropdown && studentSearch && !selectedStudent && (
                  <div className="absolute left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-lg mt-1 z-50 overflow-hidden divide-y divide-slate-50">
                    {filteredStudents.length === 0 ? (
                      <div className="p-3 text-xs text-slate-400 italic">No matching students found.</div>
                    ) : (
                      filteredStudents.map(student => (
                        <div
                          key={student._id}
                          onClick={() => {
                            setSelectedStudent(student)
                            setShowStudentDropdown(false)
                          }}
                          className="p-3 hover:bg-slate-50 transition cursor-pointer text-sm text-slate-700 flex justify-between items-center"
                        >
                          <span className="font-medium">{student.name}</span>
                          <span className="text-xs text-slate-400">Class {student.class || 'N/A'}{student.section ? `-${student.section}` : ''}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Type & Duration */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Session Type</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none"
                  >
                    <option value="Academic">Academic</option>
                    <option value="Career">Career</option>
                    <option value="Personal">Personal</option>
                    <option value="Disciplinary">Disciplinary</option>
                    <option value="Parent Meeting">Parent Meeting</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Duration</label>
                  <select
                    value={formDuration}
                    onChange={(e) => setFormDuration(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none"
                  >
                    <option value="15 mins">15 mins</option>
                    <option value="30 mins">30 mins</option>
                    <option value="45 mins">45 mins</option>
                    <option value="60 mins">60 mins</option>
                    <option value="90 mins">90 mins</option>
                  </select>
                </div>
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Date</label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-700"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Time</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 10:30 AM"
                    value={formTime}
                    onChange={(e) => setFormTime(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-700"
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Notes & Observations</label>
                <textarea
                  placeholder="Describe notes and observations..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  rows={3}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-700"
                />
              </div>

              {/* Action Items & Next Session */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Action Items</label>
                <textarea
                  placeholder="Follow-up tasks agreed in the session..."
                  value={formActionItems}
                  onChange={(e) => setFormActionItems(e.target.value)}
                  rows={2}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-700"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Next Session Date (Opt)</label>
                <input
                  type="date"
                  value={formNextSessionDate}
                  onChange={(e) => setFormNextSessionDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-700"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-5 py-2.5 border border-slate-200 rounded-xl text-slate-700 font-semibold text-sm hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold text-sm transition flex items-center gap-2 cursor-pointer disabled:opacity-50 border-none"
                >
                  {submitting && <RefreshCw className="w-4 h-4 animate-spin" />}
                  Save Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Session Modal */}
      {showEdit && selected && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl max-w-md w-full p-6 space-y-5 relative">
            <button
              onClick={() => setShowEdit(false)}
              className="absolute right-4 top-4 p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex justify-between items-center pr-8">
              <h3 className="text-lg font-bold text-slate-800">Update Session details</h3>
              <button
                type="button"
                onClick={() => handleDelete(selected._id)}
                className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition cursor-pointer border-none bg-transparent"
                title="Delete Session"
              >
                <Trash2 className="w-4.5 h-4.5" />
              </button>
            </div>
            
            <form onSubmit={handleUpdate} className="space-y-4">
              
              {/* Student Name (Read Only) */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Student</label>
                <input
                  type="text"
                  readOnly
                  disabled
                  value={selected.studentName}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-500"
                />
              </div>

              {/* Status & Duration */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Status</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none"
                  >
                    <option value="Scheduled">Scheduled</option>
                    <option value="Completed">Completed</option>
                    <option value="No-Show">No-Show</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Duration</label>
                  <select
                    value={formDuration}
                    onChange={(e) => setFormDuration(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none"
                  >
                    <option value="15 mins">15 mins</option>
                    <option value="30 mins">30 mins</option>
                    <option value="45 mins">45 mins</option>
                    <option value="60 mins">60 mins</option>
                    <option value="90 mins">90 mins</option>
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Notes & Observations</label>
                <textarea
                  placeholder="Describe notes and observations..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  rows={3}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-700"
                />
              </div>

              {/* Action Items & Next Session */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Action Items</label>
                <textarea
                  placeholder="Follow-up tasks agreed in the session..."
                  value={formActionItems}
                  onChange={(e) => setFormActionItems(e.target.value)}
                  rows={2}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-700"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Next Session Date (Opt)</label>
                <input
                  type="date"
                  value={formNextSessionDate}
                  onChange={(e) => setFormNextSessionDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-700"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEdit(false)}
                  className="px-5 py-2.5 border border-slate-200 rounded-xl text-slate-700 font-semibold text-sm hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold text-sm transition flex items-center gap-2 cursor-pointer disabled:opacity-50 border-none"
                >
                  {submitting && <RefreshCw className="w-4 h-4 animate-spin" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
