'use client'

import { useState, useEffect, useRef } from 'react'
import { useAlert } from '@/components/dashboard/AlertProvider'
import { motion, AnimatePresence } from 'framer-motion'
import { formatDate } from '@/lib/date'
import {
  HeartHandshake, Plus, Search, Filter, Eye, Flag, RefreshCw,
  X, ChevronLeft, ChevronRight, Calendar, Clock,
  CheckCircle, AlertTriangle, XCircle, CalendarX, Trash2
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
  status: 'Scheduled' | 'Completed' | 'No-Show' | 'Cancelled'
  notes?: string
  actionItems?: string
  durationMinutes?: number
  nextSessionDate?: string
  flagged: boolean
  createdAt: string
}

interface CounselorUser {
  id: string
  name: string
  role: 'teacher' | 'management'
  email?: string
}

const SESSION_TYPES = ['Academic', 'Career', 'Personal', 'Disciplinary', 'Parent Meeting'] as const

interface Stats {
  sessionsThisWeek: number
  upcomingSessions: number
  noShowsThisMonth: number
  studentsFlagged: number
}

const TYPE_COLORS: Record<string, string> = {
  Academic:         'bg-indigo-50 text-indigo-700 border border-indigo-100',
  Career:           'bg-violet-50 text-violet-700 border border-violet-100',
  Personal:         'bg-emerald-50 text-emerald-700 border border-emerald-100',
  Disciplinary:     'bg-rose-50 text-rose-700 border border-rose-100',
  'Parent Meeting': 'bg-amber-50 text-amber-700 border border-amber-100',
}

const STATUS_BADGE: Record<string, string> = {
  Scheduled: 'bg-blue-50 text-blue-700 border border-blue-100',
  Completed:  'bg-emerald-50 text-emerald-700 border border-emerald-100',
  'No-Show':  'bg-red-50 text-red-600 border border-red-100',
  Cancelled:  'bg-slate-100 text-slate-500 border border-slate-200',
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  Scheduled: <Clock className="w-3 h-3" />,
  Completed:  <CheckCircle className="w-3 h-3" />,
  'No-Show':  <AlertTriangle className="w-3 h-3" />,
  Cancelled:  <XCircle className="w-3 h-3" />,
}

const AVATAR_BG = [
  'bg-indigo-100 text-indigo-700',
  'bg-violet-100 text-violet-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
]

function avatarBg(name: string) {
  return AVATAR_BG[name.charCodeAt(0) % AVATAR_BG.length]
}

function getInitials(name: string) {
  return name.trim().split(' ').map(n => n[0]?.toUpperCase() || '').slice(0, 2).join('')
}

function fmtDate(d: string) {
  return formatDate(d) || '—'
}

const EMPTY_FORM = {
  studentName: '',
  counselor: '',
  counselorId: '',
  counselorRole: '',
  type: 'Academic' as Session['type'],
  date: '',
  time: '10:00 AM',
  notes: '',
  actionItems: '',
  durationMinutes: 30,
  nextSessionDate: '',
}

export default function CounselingView() {
  const { showAlert } = useAlert()
  const [sessions, setSessions]         = useState<Session[]>([])
  const [counselors, setCounselors]     = useState<CounselorUser[]>([])
  const [stats, setStats]               = useState<Stats>({ sessionsThisWeek: 0, upcomingSessions: 0, noShowsThisMonth: 0, studentsFlagged: 0 })
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [typeFilter, setTypeFilter]     = useState('All')
  const [counselorFilter, setCounselorFilter] = useState('All')
  const [flaggedOnly, setFlaggedOnly]   = useState(false)
  const [page, setPage]                 = useState(1)
  const perPage = 8

  const [showCreate, setShowCreate]         = useState(false)
  const [showDetail, setShowDetail]         = useState(false)
  const [selected, setSelected]             = useState<Session | null>(null)
  const [submitting, setSubmitting]         = useState(false)
  const [form, setForm]                     = useState(EMPTY_FORM)

  // keep a ref so fetch always reads latest values
  const filtersRef = useRef({ search, statusFilter, typeFilter, counselorFilter, flaggedOnly })
  useEffect(() => {
    filtersRef.current = { search, statusFilter, typeFilter, counselorFilter, flaggedOnly }
  })

  async function fetchData() {
    setLoading(true)
    try {
      const { search, statusFilter, typeFilter, counselorFilter, flaggedOnly } = filtersRef.current
      const p = new URLSearchParams()
      if (statusFilter !== 'All') p.set('status', statusFilter)
      if (typeFilter !== 'All') p.set('type', typeFilter)
      if (counselorFilter !== 'All') p.set('counselor', counselorFilter)
      if (flaggedOnly) p.set('flagged', 'true')
      if (search.trim()) p.set('search', search.trim())

      const res = await fetch(`/api/counseling?${p.toString()}`)
      const data = await res.json()
      if (!data.error) {
        setSessions(data.sessions ?? [])
        setStats(data.stats ?? {})
        if (data.counselors) setCounselors(data.counselors)
      }
    } catch (err) {
      console.error('Counseling fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  // initial load + when non-search filters change
  useEffect(() => {
    fetchData()
    setPage(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, typeFilter, counselorFilter, flaggedOnly])

  // debounced search
  useEffect(() => {
    const t = setTimeout(() => { fetchData(); setPage(1) }, 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  // ── CRUD ─────────────────────────────────────────────────────────────────

  async function createSession(payload: any) {
    setSubmitting(true)
    try {
      const res = await fetch('/api/counseling', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (res.ok && !data.error) {
        setShowCreate(false)
        setForm(EMPTY_FORM)
        fetchData()
      } else {
        showAlert({
          title: 'Failed to Schedule Session',
          message: data.error || 'Failed to schedule session.',
          type: 'calendar',
          onRetry: () => createSession(payload)
        })
      }
    } catch {
      showAlert({
        title: 'Error Scheduling Session',
        message: 'Network error. Please try again.',
        type: 'calendar',
        onRetry: () => createSession(payload)
      })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.studentName.trim() || !form.date) return
    await createSession(form)
  }

  async function handleStatusUpdate(id: string, status: string) {
    try {
      const res = await fetch('/api/counseling', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      if (res.ok) {
        setSelected(prev => prev ? { ...prev, status: status as Session['status'] } : null)
        fetchData()
      }
    } catch (err) { console.error(err) }
  }

  async function handleToggleFlag(id: string, current: boolean) {
    try {
      const res = await fetch('/api/counseling', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, flagged: !current }),
      })
      if (res.ok) {
        setSelected(prev => prev ? { ...prev, flagged: !current } : null)
        fetchData()
      }
    } catch (err) { console.error(err) }
  }

  async function deleteSession(id: string) {
    try {
      const res = await fetch(`/api/counseling?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        setShowDetail(false)
        setSelected(null)
        fetchData()
      } else {
        const d = await res.json()
        const session = sessions.find(s => s._id === id)
        const name = session ? session.studentName : 'session'
        showAlert({
          title: 'Failed to Delete Session',
          message: `Could not delete counseling session for ${name}. ${d.error || 'Failed to delete.'}`,
          type: 'trash',
          onRetry: () => deleteSession(id)
        })
      }
    } catch {
      showAlert({
        title: 'Error Deleting Session',
        message: 'Network error. Could not delete counseling session.',
        type: 'trash',
        onRetry: () => deleteSession(id)
      })
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this counseling session?')) return
    await deleteSession(id)
  }

  // ── PAGINATION ────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(sessions.length / perPage))
  const pageRows   = sessions.slice((page - 1) * perPage, page * perPage)

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 p-8 overflow-y-auto bg-slate-50 min-h-screen">

      {/* ── HEADER ── */}
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
            onClick={() => {
              const defaultCounselor = counselors[0] || { id: '', name: '', role: '' }
              setForm({
                ...EMPTY_FORM,
                counselorId: defaultCounselor.id,
                counselor: defaultCounselor.name,
                counselorRole: defaultCounselor.role
              })
              setShowCreate(true)
            }}
            className="flex items-center gap-2 px-4 py-2 bg-[#0b1320] hover:bg-slate-800 text-white rounded-lg text-sm font-semibold transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" /> Schedule Session
          </button>
        </div>
      </div>

      {/* ── STATS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {([
          { label: 'Sessions This Week',  value: stats.sessionsThisWeek,   sub: '+12% vs last week',   subColor: 'text-emerald-500', icon: <HeartHandshake className="w-5 h-5" />, bg: 'bg-indigo-50 text-indigo-600', textColor: 'text-slate-900' },
          { label: 'Upcoming Sessions',   value: stats.upcomingSessions,   sub: 'Scheduled ahead',     subColor: 'text-slate-500',   icon: <Calendar className="w-5 h-5" />,       bg: 'bg-blue-50 text-blue-600',    textColor: 'text-slate-900' },
          { label: 'No-Shows This Month', value: stats.noShowsThisMonth,   sub: 'Requires follow-up',  subColor: 'text-red-500',     icon: <CalendarX className="w-5 h-5" />,      bg: 'bg-red-50 text-red-500',      textColor: 'text-red-600' },
          { label: 'Students Flagged',    value: stats.studentsFlagged,    sub: 'Need attention',      subColor: 'text-amber-500',   icon: <AlertTriangle className="w-5 h-5" />,  bg: 'bg-amber-50 text-amber-500',  textColor: 'text-amber-600' },
        ] as const).map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-tight">{s.label}</span>
              <div className={`p-2 rounded-xl ${s.bg}`}>{s.icon}</div>
            </div>
            <span className={`text-2xl font-bold ${s.textColor}`}>{loading ? '—' : s.value}</span>
            <p className={`text-[11px] font-semibold mt-1 ${s.subColor}`}>{s.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* ── SESSION REGISTRY ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

        {/* toolbar */}
        <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-slate-900 shrink-0">Session Registry</h2>
          <div className="flex flex-wrap items-center gap-2">

            {/* search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search student or counselor…"
                className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-[11px] bg-slate-50 outline-none focus:border-slate-400 w-48 shadow-sm transition-colors"
              />
            </div>

            {/* status */}
            <label className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 shadow-sm">
              <Filter className="w-3 h-3 text-slate-400 shrink-0" />
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="text-[11px] font-semibold text-slate-700 bg-transparent outline-none cursor-pointer">
                <option value="All">All Status</option>
                <option value="Scheduled">Scheduled</option>
                <option value="Completed">Completed</option>
                <option value="No-Show">No-Show</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </label>

            {/* type */}
            <label className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 shadow-sm">
              <Filter className="w-3 h-3 text-slate-400 shrink-0" />
              <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="text-[11px] font-semibold text-slate-700 bg-transparent outline-none cursor-pointer">
                <option value="All">All Types</option>
                <option value="Academic">Academic</option>
                <option value="Career">Career</option>
                <option value="Personal">Personal</option>
                <option value="Disciplinary">Disciplinary</option>
                <option value="Parent Meeting">Parent Meeting</option>
              </select>
            </label>

            {/* counselor */}
            <label className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 shadow-sm">
              <Filter className="w-3 h-3 text-slate-400 shrink-0" />
              <select value={counselorFilter} onChange={e => setCounselorFilter(e.target.value)} className="text-[11px] font-semibold text-slate-700 bg-transparent outline-none cursor-pointer">
                <option value="All">All Counselors</option>
                {counselors.map(c => (
                  <option key={c.id} value={c.name}>
                    {c.name} ({c.role === 'management' ? 'Admin' : 'Faculty'})
                  </option>
                ))}
              </select>
            </label>

            {/* flagged toggle */}
            <button
              onClick={() => setFlaggedOnly(f => !f)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-all shadow-sm ${
                flaggedOnly ? 'bg-amber-500 border-amber-500 text-white' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-amber-50 hover:border-amber-200 hover:text-amber-700'
              }`}
            >
              <Flag className="w-3 h-3" /> Flagged
            </button>
          </div>
        </div>

        {/* table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/60 border-b border-slate-100">
                {['Student', 'Counselor', 'Type', 'Date / Time', 'Status', 'Action'].map((h, i) => (
                  <th key={h} className={`px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest ${i >= 2 && i <= 4 ? 'text-center' : ''} ${i === 5 ? 'text-right' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center">
                    <RefreshCw className="w-7 h-7 text-slate-300 animate-spin mx-auto mb-2" />
                    <span className="text-xs font-semibold text-slate-400">Loading sessions…</span>
                  </td>
                </tr>
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center text-xs font-semibold text-slate-400">
                    No sessions found. Adjust filters or schedule a new session.
                  </td>
                </tr>
              ) : pageRows.map(session => (
                <tr key={session._id} className="hover:bg-slate-50/60 transition-colors">

                  {/* student */}
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${avatarBg(session.studentName)}`}>
                        {session.studentInitials || getInitials(session.studentName)}
                      </div>
                      <div>
                        <p className="text-[13px] font-semibold text-slate-800">{session.studentName}</p>
                        {session.flagged && (
                          <p className="text-[10px] font-bold text-amber-600 flex items-center gap-0.5">
                            <Flag className="w-2.5 h-2.5" /> Flagged
                          </p>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* counselor */}
                  <td className="px-6 py-3.5 text-[12px] font-medium text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <span>{session.counselor}</span>
                      {session.counselorRole && (
                        <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${
                          session.counselorRole === 'management'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}>
                          {session.counselorRole === 'management' ? 'Admin' : 'Faculty'}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* type */}
                  <td className="px-6 py-3.5 text-center">
                    <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full ${TYPE_COLORS[session.type] || ''}`}>{session.type}</span>
                  </td>

                  {/* date/time */}
                  <td className="px-6 py-3.5">
                    <p className="text-[12px] font-semibold text-slate-700">{fmtDate(session.date)}</p>
                    <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                      <Clock className="w-2.5 h-2.5" /> {session.time}
                    </p>
                  </td>

                  {/* status */}
                  <td className="px-6 py-3.5 text-center">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded-full ${STATUS_BADGE[session.status] || ''}`}>
                      {STATUS_ICON[session.status]}
                      {session.status}
                    </span>
                  </td>

                  {/* action */}
                  <td className="px-6 py-3.5 text-right">
                    <button
                      onClick={() => { setSelected(session); setShowDetail(true) }}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                      title="View details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* pagination */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            {sessions.length === 0 ? 'No sessions' : `Showing ${(page - 1) * perPage + 1}–${Math.min(page * perPage, sessions.length)} of ${sessions.length}`}
          </span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(p - 1, 1))} disabled={page === 1}
              className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-40 flex items-center gap-1 shadow-sm transition-colors">
              <ChevronLeft className="w-3 h-3" /> Prev
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button key={p} onClick={() => setPage(p)}
                className={`w-7 h-7 rounded-lg text-[10px] font-bold transition-all border ${page === p ? 'bg-[#0b1320] border-[#0b1320] text-white' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                {p}
              </button>
            ))}
            <button onClick={() => setPage(p => Math.min(p + 1, totalPages))} disabled={page === totalPages}
              className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-40 flex items-center gap-1 shadow-sm transition-colors">
              Next <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* ── CREATE MODAL ── */}
      <AnimatePresence>
        {showCreate && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-8 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-100 max-h-[calc(100vh-8rem)] flex flex-col"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Schedule Session</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Book a new counseling appointment</p>
                </div>
                <button onClick={() => setShowCreate(false)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreate} className="p-6 space-y-4 overflow-y-auto flex-1">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Student Name *</label>
                  <input required type="text" value={form.studentName} onChange={e => setForm({ ...form, studentName: e.target.value })}
                    placeholder="e.g. Isha Patel"
                    className="w-full mt-1.5 px-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-slate-400 transition-colors" />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Counselor *</label>
                  <select
                    value={form.counselorId || form.counselor || ''}
                    onChange={e => {
                      const val = e.target.value
                      const selectedUser = counselors.find(c => c.id === val || c.name === val)
                      if (selectedUser) {
                        setForm({
                          ...form,
                          counselorId: selectedUser.id,
                          counselor: selectedUser.name,
                          counselorRole: selectedUser.role
                        })
                      } else {
                        setForm({ ...form, counselorId: '', counselor: val, counselorRole: '' })
                      }
                    }}
                    required
                    className="w-full mt-1.5 px-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-slate-400 transition-colors cursor-pointer"
                  >
                    <option value="">Select a Counselor...</option>
                    {counselors.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.role === 'management' ? 'Admin' : 'Faculty'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Session Type *</label>
                    <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as Session['type'] })}
                      className="w-full mt-1.5 px-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-slate-400 transition-colors cursor-pointer">
                      {SESSION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Time *</label>
                    <input required type="text" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })}
                      placeholder="10:30 AM"
                      className="w-full mt-1.5 px-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-slate-400 transition-colors" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Date *</label>
                    <input required type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                      className="w-full mt-1.5 px-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-slate-400 transition-colors" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Duration (Minutes)</label>
                    <input type="number" min={5} step={5} value={form.durationMinutes}
                      onChange={e => setForm({ ...form, durationMinutes: Number(e.target.value) || 30 })}
                      className="w-full mt-1.5 px-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-slate-400 transition-colors" />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Next Session Date</label>
                  <input type="date" value={form.nextSessionDate} onChange={e => setForm({ ...form, nextSessionDate: e.target.value })}
                    className="w-full mt-1.5 px-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-slate-400 transition-colors" />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Notes</label>
                  <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                    placeholder="Session purpose or observations…" rows={3}
                    className="w-full mt-1.5 px-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-slate-400 transition-colors resize-none" />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Action Items</label>
                  <textarea value={form.actionItems} onChange={e => setForm({ ...form, actionItems: e.target.value })}
                    placeholder="Follow-up tasks agreed in the session…" rows={2}
                    className="w-full mt-1.5 px-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-slate-400 transition-colors resize-none" />
                </div>

                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setShowCreate(false)}
                    className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors">
                    Cancel
                  </button>
                  <button type="submit" disabled={submitting}
                    className="flex-1 py-2.5 bg-[#0b1320] hover:bg-slate-800 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-60 shadow-sm">
                    {submitting ? 'Scheduling…' : 'Schedule Session'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── DETAIL MODAL ── */}
      <AnimatePresence>
        {showDetail && selected && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-8 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-100 max-h-[calc(100vh-8rem)] flex flex-col"
            >
              {/* header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-bold ${avatarBg(selected.studentName)}`}>
                    {selected.studentInitials || getInitials(selected.studentName)}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{selected.studentName}</h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[11px] text-slate-400">{selected.counselor}</span>
                      {selected.counselorRole && (
                        <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${
                          selected.counselorRole === 'management'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}>
                          {selected.counselorRole === 'management' ? 'Admin' : 'Faculty'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button onClick={() => setShowDetail(false)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* body */}
              <div className="p-6 space-y-5 overflow-y-auto flex-1">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Type</p>
                    <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full ${TYPE_COLORS[selected.type] || ''}`}>{selected.type}</span>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Status</p>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded-full ${STATUS_BADGE[selected.status] || ''}`}>
                      {STATUS_ICON[selected.status]}{selected.status}
                    </span>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Date</p>
                    <p className="text-sm font-semibold text-slate-700">{fmtDate(selected.date)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Time</p>
                    <p className="text-sm font-semibold text-slate-700">{selected.time}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Duration</p>
                    <p className="text-sm font-semibold text-slate-700">{selected.durationMinutes ?? 30} minutes</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Next Session</p>
                    <p className="text-sm font-semibold text-slate-700">{selected.nextSessionDate ? fmtDate(selected.nextSessionDate) : '—'}</p>
                  </div>
                </div>

                {selected.notes && (
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Notes</p>
                    <p className="text-[12px] text-slate-700 leading-relaxed">{selected.notes}</p>
                  </div>
                )}

                {selected.actionItems && (
                  <div className="bg-amber-50/50 rounded-xl p-4 border border-amber-100">
                    <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1.5">Action Items</p>
                    <p className="text-[12px] text-slate-700 leading-relaxed whitespace-pre-wrap">{selected.actionItems}</p>
                  </div>
                )}

                {/* update status */}
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Update Status</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(['Scheduled', 'Completed', 'No-Show', 'Cancelled'] as const).map(s => (
                      <button key={s} onClick={() => handleStatusUpdate(selected._id, s)}
                        className={`py-2 rounded-lg text-[11px] font-bold border transition-all ${
                          selected.status === s
                            ? `${STATUS_BADGE[s]} shadow-sm`
                            : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                        }`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* footer */}
              <div className="px-6 pb-5 pt-2 flex items-center justify-between border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <button onClick={() => handleToggleFlag(selected._id, selected.flagged)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                      selected.flagged
                        ? 'bg-amber-100 border-amber-200 text-amber-700'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-amber-50 hover:border-amber-200 hover:text-amber-700'
                    }`}>
                    <Flag className="w-3 h-3" /> {selected.flagged ? 'Unflag' : 'Flag Student'}
                  </button>
                  <button onClick={() => handleDelete(selected._id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-transparent text-red-500 hover:bg-red-50 hover:border-red-100 transition-all">
                    <Trash2 className="w-3 h-3" /> Delete
                  </button>
                </div>
                <button onClick={() => setShowDetail(false)}
                  className="px-5 py-2 bg-[#0b1320] hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-colors shadow-sm">
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
