'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  HeartHandshake, Plus, Search, Filter, Eye, Flag, RefreshCw,
  X, ChevronLeft, ChevronRight, Calendar, Clock, User, FileText,
  CheckCircle, AlertTriangle, XCircle, CalendarX, Trash2, Edit3
} from 'lucide-react'

interface Session {
  _id: string
  studentName: string
  studentInitials: string
  counselor: string
  type: 'Academic' | 'Career' | 'Personal' | 'Disciplinary'
  date: string
  time: string
  status: 'Scheduled' | 'Completed' | 'No-Show' | 'Cancelled'
  notes?: string
  flagged: boolean
  createdAt: string
}

interface Stats {
  sessionsThisWeek: number
  upcomingSessions: number
  noShowsThisMonth: number
  studentsFlagged: number
}

const TYPE_COLORS: Record<string, string> = {
  Academic: 'bg-indigo-50 text-indigo-700 border border-indigo-100',
  Career: 'bg-violet-50 text-violet-700 border border-violet-100',
  Personal: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
  Disciplinary: 'bg-rose-50 text-rose-700 border border-rose-100',
}

const STATUS_STYLES: Record<string, { badge: string; icon: React.ReactNode }> = {
  Scheduled: { badge: 'bg-blue-50 text-blue-700 border border-blue-100', icon: <Clock className="w-3 h-3" /> },
  Completed: { badge: 'bg-emerald-50 text-emerald-700 border border-emerald-100', icon: <CheckCircle className="w-3 h-3" /> },
  'No-Show': { badge: 'bg-red-50 text-red-600 border border-red-100', icon: <AlertTriangle className="w-3 h-3" /> },
  Cancelled: { badge: 'bg-slate-100 text-slate-500 border border-slate-200', icon: <XCircle className="w-3 h-3" /> },
}

const COUNSELORS = ['Dr. Anjali Sharma', 'Mr. David Chen', 'Ms. Rebecca Torres']

function formatDate(dateStr: string) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function getInitials(name: string) {
  return name.trim().split(' ').map(n => n[0]?.toUpperCase() || '').slice(0, 2).join('')
}

const AVATAR_COLORS = [
  'bg-indigo-100 text-indigo-700',
  'bg-violet-100 text-violet-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
]

function avatarColor(name: string) {
  const idx = name.charCodeAt(0) % AVATAR_COLORS.length
  return AVATAR_COLORS[idx]
}

export default function CounselingView() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [stats, setStats] = useState<Stats>({ sessionsThisWeek: 0, upcomingSessions: 0, noShowsThisMonth: 0, studentsFlagged: 0 })
  const [loading, setLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [typeFilter, setTypeFilter] = useState('All')
  const [counselorFilter, setCounselorFilter] = useState('All')
  const [flaggedOnly, setFlaggedOnly] = useState(false)

  // Pagination
  const [page, setPage] = useState(1)
  const perPage = 8

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Create form
  const [form, setForm] = useState({
    studentName: '',
    counselor: COUNSELORS[0],
    type: 'Academic' as Session['type'],
    date: '',
    time: '10:00 AM',
    notes: ''
  })

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'All') params.set('status', statusFilter)
      if (typeFilter !== 'All') params.set('type', typeFilter)
      if (counselorFilter !== 'All') params.set('counselor', counselorFilter)
      if (flaggedOnly) params.set('flagged', 'true')
      if (search.trim()) params.set('search', search.trim())

      const res = await fetch(`/api/counseling?${params.toString()}`)
      const data = await res.json()
      if (!data.error) {
        setSessions(data.sessions || [])
        setStats(data.stats || {})
      }
    } catch (err) {
      console.error('Error fetching counseling sessions:', err)
    } finally {
      setLoading(false)
    }
  }, [statusFilter, typeFilter, counselorFilter, flaggedOnly, search])

  useEffect(() => {
    fetchData()
    setPage(1)
  }, [statusFilter, typeFilter, counselorFilter, flaggedOnly])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData()
      setPage(1)
    }, 350)
    return () => clearTimeout(timer)
  }, [search])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.studentName.trim() || !form.date) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/counseling', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      const data = await res.json()
      if (res.ok && !data.error) {
        setShowCreateModal(false)
        setForm({ studentName: '', counselor: COUNSELORS[0], type: 'Academic', date: '', time: '10:00 AM', notes: '' })
        fetchData()
      } else {
        alert(data.error || 'Failed to schedule session.')
      }
    } catch (err) {
      alert('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleStatusUpdate(id: string, status: string) {
    try {
      const res = await fetch('/api/counseling', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status })
      })
      if (res.ok) {
        fetchData()
        if (selectedSession?._id === id) {
          setSelectedSession(prev => prev ? { ...prev, status: status as Session['status'] } : null)
        }
      }
    } catch (err) {
      console.error(err)
    }
  }

  async function handleToggleFlag(id: string, current: boolean) {
    try {
      const res = await fetch('/api/counseling', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, flagged: !current })
      })
      if (res.ok) {
        fetchData()
        if (selectedSession?._id === id) {
          setSelectedSession(prev => prev ? { ...prev, flagged: !current } : null)
        }
      }
    } catch (err) {
      console.error(err)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this counseling session?')) return
    try {
      const res = await fetch(`/api/counseling?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        setShowDetailModal(false)
        setSelectedSession(null)
        fetchData()
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to delete session.')
      }
    } catch (err) {
      alert('Network error.')
    }
  }

  const totalPages = Math.ceil(sessions.length / perPage) || 1
  const paginatedSessions = sessions.slice((page - 1) * perPage, page * perPage)

  return (
    <div className="flex-1 p-8 overflow-y-auto bg-slate-50 min-h-screen">

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Counseling Sessions</h1>
          <p className="text-[13px] text-slate-500 mt-1">
            Track academic, career, and personal counseling activity across students
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-semibold shadow-sm transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#0b1320] hover:bg-slate-800 text-white rounded-lg text-sm font-semibold transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Schedule Session
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Sessions This Week', value: stats.sessionsThisWeek, sub: '+12% vs last week', subColor: 'text-emerald-500', icon: <HeartHandshake className="w-5 h-5" />, iconBg: 'bg-indigo-50 text-indigo-600' },
          { label: 'Upcoming Sessions', value: stats.upcomingSessions, sub: 'Scheduled ahead', subColor: 'text-slate-500', icon: <Calendar className="w-5 h-5" />, iconBg: 'bg-blue-50 text-blue-600' },
          { label: 'No-Shows This Month', value: stats.noShowsThisMonth, sub: 'Requires follow-up', subColor: 'text-red-500', icon: <CalendarX className="w-5 h-5" />, iconBg: 'bg-red-50 text-red-500' },
          { label: 'Students Flagged', value: stats.studentsFlagged, sub: 'Need attention', subColor: 'text-amber-500', icon: <AlertTriangle className="w-5 h-5" />, iconBg: 'bg-amber-50 text-amber-500' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{stat.label}</span>
              <div className={`p-2 rounded-xl ${stat.iconBg}`}>{stat.icon}</div>
            </div>
            <div className="flex flex-col">
              <span className={`text-2xl font-bold ${i === 2 ? 'text-red-600' : i === 3 ? 'text-amber-600' : 'text-slate-900'}`}>
                {loading ? '—' : stat.value}
              </span>
              <span className={`text-[11px] font-semibold mt-1 ${stat.subColor}`}>{stat.sub}</span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Session Registry */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

        {/* Table header + filters */}
        <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h2 className="text-sm font-bold text-slate-900">Session Registry</h2>
          <div className="flex flex-wrap items-center gap-2">

            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search student, counselor..."
                className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-[11px] bg-slate-50 outline-none focus:border-slate-400 transition-all w-48 shadow-sm"
              />
            </div>

            {/* Status filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 shadow-sm">
              <Filter className="w-3 h-3 text-slate-400" />
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="text-[11px] font-semibold text-slate-700 bg-transparent outline-none cursor-pointer"
              >
                <option value="All">All Status</option>
                <option value="Scheduled">Scheduled</option>
                <option value="Completed">Completed</option>
                <option value="No-Show">No-Show</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            {/* Type filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 shadow-sm">
              <Filter className="w-3 h-3 text-slate-400" />
              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value)}
                className="text-[11px] font-semibold text-slate-700 bg-transparent outline-none cursor-pointer"
              >
                <option value="All">All Types</option>
                <option value="Academic">Academic</option>
                <option value="Career">Career</option>
                <option value="Personal">Personal</option>
                <option value="Disciplinary">Disciplinary</option>
              </select>
            </div>

            {/* Counselor filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 shadow-sm">
              <Filter className="w-3 h-3 text-slate-400" />
              <select
                value={counselorFilter}
                onChange={e => setCounselorFilter(e.target.value)}
                className="text-[11px] font-semibold text-slate-700 bg-transparent outline-none cursor-pointer"
              >
                <option value="All">All Counselors</option>
                {COUNSELORS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Flagged toggle */}
            <button
              onClick={() => setFlaggedOnly(f => !f)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-all shadow-sm ${
                flaggedOnly
                  ? 'bg-amber-500 border-amber-500 text-white'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-amber-50 hover:border-amber-200 hover:text-amber-700'
              }`}
            >
              <Flag className="w-3 h-3" /> Flagged
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Student</th>
                <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Counselor</th>
                <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Type</th>
                <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date / Time</th>
                <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Status</th>
                <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center">
                    <RefreshCw className="w-7 h-7 text-slate-300 animate-spin mx-auto mb-2" />
                    <span className="text-xs font-semibold text-slate-400">Loading sessions...</span>
                  </td>
                </tr>
              ) : paginatedSessions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center text-xs font-semibold text-slate-400">
                    No sessions found. Try adjusting filters or schedule a new session.
                  </td>
                </tr>
              ) : paginatedSessions.map((session) => {
                const statusInfo = STATUS_STYLES[session.status] || STATUS_STYLES.Scheduled
                return (
                  <motion.tr
                    key={session._id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    {/* Student */}
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${avatarColor(session.studentName)}`}>
                          {session.studentInitials || getInitials(session.studentName)}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[13px] font-semibold text-slate-800">{session.studentName}</span>
                          {session.flagged && (
                            <span className="text-[10px] font-bold text-amber-600 flex items-center gap-1">
                              <Flag className="w-2.5 h-2.5" /> Flagged
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Counselor */}
                    <td className="px-6 py-3.5 text-[12px] font-medium text-slate-600">{session.counselor}</td>

                    {/* Type */}
                    <td className="px-6 py-3.5 text-center">
                      <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full ${TYPE_COLORS[session.type]}`}>
                        {session.type}
                      </span>
                    </td>

                    {/* Date / Time */}
                    <td className="px-6 py-3.5">
                      <div className="flex flex-col text-[12px]">
                        <span className="font-semibold text-slate-700">{formatDate(session.date)}</span>
                        <span className="text-slate-400 flex items-center gap-1 mt-0.5">
                          <Clock className="w-2.5 h-2.5" /> {session.time}
                        </span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-6 py-3.5 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded-full ${statusInfo.badge}`}>
                        {statusInfo.icon}
                        {session.status}
                      </span>
                    </td>

                    {/* Action */}
                    <td className="px-6 py-3.5 text-right">
                      <button
                        onClick={() => { setSelectedSession(session); setShowDetailModal(true) }}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                        title="View details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </motion.tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Showing {sessions.length > 0 ? (page - 1) * perPage + 1 : 0}–{Math.min(page * perPage, sessions.length)} of {sessions.length} sessions
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(p - 1, 1))}
              disabled={page === 1}
              className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 bg-white hover:bg-slate-50 transition-colors disabled:opacity-40 flex items-center gap-1 shadow-sm"
            >
              <ChevronLeft className="w-3 h-3" /> Prev
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`w-7 h-7 rounded-lg text-[10px] font-bold transition-all border ${
                  page === p ? 'bg-[#0b1320] border-[#0b1320] text-white' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => setPage(p => Math.min(p + 1, totalPages))}
              disabled={page === totalPages}
              className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 bg-white hover:bg-slate-50 transition-colors disabled:opacity-40 flex items-center gap-1 shadow-sm"
            >
              Next <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* CREATE SESSION MODAL */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-slate-100"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Schedule Session</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Book a new counseling appointment</p>
                </div>
                <button onClick={() => setShowCreateModal(false)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreate} className="p-6 space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Student Name *</label>
                  <input
                    required
                    type="text"
                    value={form.studentName}
                    onChange={e => setForm({ ...form, studentName: e.target.value })}
                    placeholder="e.g. Isha Patel"
                    className="w-full mt-1.5 px-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-slate-400 transition-colors"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Counselor *</label>
                  <select
                    value={form.counselor}
                    onChange={e => setForm({ ...form, counselor: e.target.value })}
                    className="w-full mt-1.5 px-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-slate-400 transition-colors cursor-pointer"
                  >
                    {COUNSELORS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Session Type *</label>
                    <select
                      value={form.type}
                      onChange={e => setForm({ ...form, type: e.target.value as Session['type'] })}
                      className="w-full mt-1.5 px-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-slate-400 transition-colors cursor-pointer"
                    >
                      <option value="Academic">Academic</option>
                      <option value="Career">Career</option>
                      <option value="Personal">Personal</option>
                      <option value="Disciplinary">Disciplinary</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Time *</label>
                    <input
                      required
                      type="text"
                      value={form.time}
                      onChange={e => setForm({ ...form, time: e.target.value })}
                      placeholder="e.g. 10:30 AM"
                      className="w-full mt-1.5 px-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-slate-400 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Date *</label>
                  <input
                    required
                    type="date"
                    value={form.date}
                    onChange={e => setForm({ ...form, date: e.target.value })}
                    className="w-full mt-1.5 px-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-slate-400 transition-colors"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Notes</label>
                  <textarea
                    value={form.notes}
                    onChange={e => setForm({ ...form, notes: e.target.value })}
                    placeholder="Session purpose or initial observations..."
                    rows={3}
                    className="w-full mt-1.5 px-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-slate-400 transition-colors resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 py-2.5 bg-[#0b1320] hover:bg-slate-800 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-60 shadow-sm"
                  >
                    {submitting ? 'Scheduling...' : 'Schedule Session'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DETAIL / VIEW MODAL */}
      <AnimatePresence>
        {showDetailModal && selectedSession && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-slate-100"
            >
              {/* Modal header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-bold ${avatarColor(selectedSession.studentName)}`}>
                    {selectedSession.studentInitials || getInitials(selectedSession.studentName)}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{selectedSession.studentName}</h3>
                    <p className="text-[11px] text-slate-400">{selectedSession.counselor}</p>
                  </div>
                </div>
                <button onClick={() => setShowDetailModal(false)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Session details */}
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Type</span>
                    <span className={`w-fit px-2.5 py-0.5 text-[10px] font-bold rounded-full ${TYPE_COLORS[selectedSession.type]}`}>
                      {selectedSession.type}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</span>
                    <span className={`w-fit inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded-full ${STATUS_STYLES[selectedSession.status]?.badge}`}>
                      {STATUS_STYLES[selectedSession.status]?.icon}
                      {selectedSession.status}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date</span>
                    <span className="text-sm font-semibold text-slate-700">{formatDate(selectedSession.date)}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Time</span>
                    <span className="text-sm font-semibold text-slate-700">{selectedSession.time}</span>
                  </div>
                </div>

                {selectedSession.notes && (
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Notes</span>
                    <p className="text-[12px] text-slate-700 leading-relaxed">{selectedSession.notes}</p>
                  </div>
                )}

                {/* Update Status */}
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Update Status</span>
                  <div className="grid grid-cols-2 gap-2">
                    {(['Scheduled', 'Completed', 'No-Show', 'Cancelled'] as const).map(s => (
                      <button
                        key={s}
                        onClick={() => handleStatusUpdate(selectedSession._id, s)}
                        className={`py-2 rounded-lg text-[11px] font-bold border transition-all ${
                          selectedSession.status === s
                            ? `${STATUS_STYLES[s]?.badge} shadow-sm`
                            : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Modal footer */}
              <div className="px-6 pb-5 pt-2 flex items-center justify-between border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleFlag(selectedSession._id, selectedSession.flagged)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                      selectedSession.flagged
                        ? 'bg-amber-100 border-amber-200 text-amber-700'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-amber-50 hover:border-amber-200 hover:text-amber-700'
                    }`}
                  >
                    <Flag className="w-3 h-3" />
                    {selectedSession.flagged ? 'Unflag' : 'Flag'}
                  </button>
                  <button
                    onClick={() => handleDelete(selectedSession._id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-transparent text-red-500 hover:bg-red-50 hover:border-red-100 transition-all"
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete
                  </button>
                </div>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="px-5 py-2 bg-[#0b1320] hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-colors shadow-sm"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
