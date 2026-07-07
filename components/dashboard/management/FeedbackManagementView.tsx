'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Star,
  Calendar,
  BookOpen,
  Users,
  Folder,
  RefreshCw,
  TrendingUp,
  Info,
  User,
  Search,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Clock,
} from 'lucide-react'

function formatShortDate(dateStr: string) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const STATUS_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  Submitted: { label: 'Submitted', color: 'bg-slate-100 text-slate-600 border-slate-200',      icon: <Clock className="w-3 h-3" /> },
  Reviewed:  { label: 'Reviewed',  color: 'bg-amber-50 text-amber-700 border-amber-200',       icon: <AlertCircle className="w-3 h-3" /> },
  Actioned:  { label: 'Actioned',  color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: <CheckCircle2 className="w-3 h-3" /> },
  Dismissed: { label: 'Dismissed', color: 'bg-slate-50 text-slate-400 border-slate-100',       icon: <XCircle className="w-3 h-3" /> },
}

const TYPE_BADGE: Record<string, string> = {
  'Student -> Teacher': 'bg-blue-50 text-blue-700 border-blue-100',
  'Parent -> School': 'bg-emerald-50 text-emerald-700 border-emerald-100',
  'Teacher -> Management': 'bg-indigo-50 text-indigo-700 border-indigo-100',
  'Management -> Teacher': 'bg-violet-50 text-violet-700 border-violet-100',
}

export default function FeedbackManagementView() {
  const [data, setData] = useState<any>({ totalCount: 0, avgRating: 0, pendingCount: 0, actionedCount: 0, ratingDistribution: {}, feedbackList: [] })
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'pending' | 'actioned'>('pending')
  const [activeTab, setActiveTab] = useState<'All' | 'Student -> Teacher' | 'Parent -> School' | 'Teacher -> Management' | 'Management -> Teacher'>('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [ratingFilter, setRatingFilter] = useState<number | null>(null)

  // Send feedback to teachers (Management -> Teacher flow)
  const [showSendModal, setShowSendModal] = useState(false)
  const [sendContent, setSendContent] = useState('')
  const [sendRating, setSendRating] = useState(5)
  const [sendCategory, setSendCategory] = useState('Academics')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')

  async function fetchFeedback() {
    setLoading(true)
    try {
      const res = await fetch(`/api/feedback?type=${encodeURIComponent(activeTab)}&view=${view}`)
      const resData = await res.json()
      if (!resData.error) setData(resData)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchFeedback(); setSearchQuery(''); setRatingFilter(null) }, [activeTab, view])

  async function handleUpdateStatus(id: string, newStatus: 'Submitted' | 'Reviewed' | 'Actioned' | 'Dismissed') {
    try {
      const res = await fetch('/api/feedback', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      })
      if (res.ok) fetchFeedback()
    } catch (err) { console.error(err) }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this feedback entry permanently?')) return
    try {
      const res = await fetch(`/api/feedback?id=${id}`, { method: 'DELETE' })
      if (res.ok) fetchFeedback()
    } catch (err) { console.error(err) }
  }

  async function handleSendFeedback(e: React.FormEvent) {
    e.preventDefault()
    if (!sendContent.trim()) { setSendError('Feedback content is required.'); return }
    setSending(true)
    setSendError('')
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: sendContent, rating: sendRating, category: sendCategory }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setSendError(data.error || 'Failed to send feedback.')
        return
      }
      setShowSendModal(false)
      setSendContent('')
      setSendRating(5)
      fetchFeedback()
    } finally {
      setSending(false)
    }
  }

  function renderStars(rating: number) {
    return Array.from({ length: 5 }, (_, i) => (
      <Star key={i} className={`w-3.5 h-3.5 ${i < rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200 fill-transparent'}`} />
    ))
  }

  function getProfileIcon(name: string, isAnon: boolean) {
    if (isAnon) return (
      <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 border border-slate-200/50 shrink-0">
        <User className="w-4 h-4" />
      </div>
    )
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    return (
      <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-extrabold text-xs shadow-sm border border-emerald-200/50 shrink-0">
        {initials}
      </div>
    )
  }

  const filteredList = (data.feedbackList || []).filter((item: any) => {
    const q = searchQuery.toLowerCase()
    const matchSearch = !q || item.content.toLowerCase().includes(q) ||
      (item.isAnonymous ? 'anonymous' : item.senderName.toLowerCase()).includes(q) ||
      (item.subject || '').toLowerCase().includes(q) ||
      (item.batch || '').toLowerCase().includes(q) ||
      (item.category || '').toLowerCase().includes(q) ||
      item.status.toLowerCase().includes(q) ||
      item.type.toLowerCase().includes(q)
    const matchRating = ratingFilter === null || item.rating === ratingFilter
    return matchSearch && matchRating
  })

  return (
    <div className="flex-1 p-8 overflow-y-auto bg-slate-50 flex flex-col justify-between min-h-[calc(100vh-72px)]">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Feedback Management</h1>
            <p className="text-[13px] text-slate-500 mt-1">Review feedback from students, parents, and staff</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { setSendError(''); setShowSendModal(true) }} className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shadow-sm transition-all">
              Send Feedback to Teachers
            </button>
            <button onClick={fetchFeedback} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-semibold shadow-sm transition-all">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Total Feedback This Month</span>
            <span className="text-3xl font-extrabold text-slate-900 mt-2 block">{data.totalCount}</span>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Average Rating</span>
            <div className="flex items-center gap-1 mt-2">
              <span className="text-3xl font-extrabold text-slate-900">{data.avgRating}</span>
              <Star className="w-5 h-5 fill-amber-400 text-amber-400 ml-1.5" />
            </div>
          </div>
          <div
            onClick={() => setView('pending')}
            className={`bg-white p-5 rounded-2xl border shadow-sm cursor-pointer transition-all ${view === 'pending' ? 'border-amber-400 ring-1 ring-amber-300' : 'border-slate-200 hover:border-amber-200'}`}
          >
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Pending Review</span>
            <span className="text-3xl font-extrabold text-amber-500 mt-2 block">{data.pendingCount}</span>
            <span className="text-[10px] text-slate-400 mt-1 block">Click to view</span>
          </div>
          <div
            onClick={() => setView('actioned')}
            className={`bg-white p-5 rounded-2xl border shadow-sm cursor-pointer transition-all ${view === 'actioned' ? 'border-emerald-400 ring-1 ring-emerald-300' : 'border-slate-200 hover:border-emerald-200'}`}
          >
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Actioned</span>
            <span className="text-3xl font-extrabold text-emerald-600 mt-2 block">{data.actionedCount}</span>
            <span className="text-[10px] text-slate-400 mt-1 block">Click to view</span>
          </div>
        </div>

        {/* View switcher + type tabs */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 shadow-sm">
            <button onClick={() => setView('pending')} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${view === 'pending' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              Pending
            </button>
            <button onClick={() => setView('actioned')} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${view === 'actioned' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              Actioned ({data.actionedCount})
            </button>
          </div>

          <div className="flex items-center gap-1 border-b border-slate-200 flex-1 overflow-x-auto whitespace-nowrap">
            {([
              { id: 'All', label: 'All' },
              { id: 'Student -> Teacher', label: 'Student → Teacher' },
              { id: 'Parent -> School', label: 'Parent → School' },
              { id: 'Teacher -> Management', label: 'Teacher → Management' },
              { id: 'Management -> Teacher', label: 'Management → Teacher' },
            ] as const).map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 text-xs font-bold transition-all relative ${activeTab === tab.id ? 'text-slate-900 border-b-2 border-slate-950' : 'text-slate-400 hover:text-slate-700'}`}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* Feed / Actioned table (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search feedback content, sender, subject, batch, category..."
                className="w-full pl-10 pr-12 py-3 bg-white border border-slate-200/90 rounded-2xl text-xs font-semibold outline-none focus:border-slate-400 transition-all shadow-sm" />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold">Clear</button>
              )}
            </div>

            {loading ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center shadow-sm">
                <RefreshCw className="w-8 h-8 text-slate-400 animate-spin mx-auto mb-2" />
                <span className="text-xs font-bold text-slate-400">Loading...</span>
              </div>
            ) : view === 'actioned' ? (
              /* ── ACTIONED TABLE ── */
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-slate-900">Actioned Feedback</p>
                    <p className="text-xs text-slate-400 mt-0.5">All investigated, reviewed, and dismissed entries</p>
                  </div>
                  <span className="text-xs font-bold text-slate-500">{filteredList.length} records</span>
                </div>
                {filteredList.length === 0 ? (
                  <div className="py-16 text-center text-xs font-bold text-slate-400">No actioned feedback yet.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[700px]">
                      <thead>
                        <tr className="bg-slate-50/60 border-b border-slate-100">
                          <th className="px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sender</th>
                          <th className="px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Feedback</th>
                          <th className="px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Type</th>
                          <th className="px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Rating</th>
                          <th className="px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date</th>
                          <th className="px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                          <th className="px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredList.map((item: any) => {
                          const sm = STATUS_META[item.status] || STATUS_META.Submitted
                          return (
                            <tr key={item.id} className="hover:bg-slate-50/40 transition-colors">
                              <td className="px-5 py-3.5">
                                <div className="flex items-center gap-2">
                                  {getProfileIcon(item.senderName, item.isAnonymous)}
                                  <span className="text-xs font-bold text-slate-800 whitespace-nowrap">
                                    {item.isAnonymous ? 'Anonymous' : item.senderName}
                                  </span>
                                </div>
                              </td>
                              <td className="px-5 py-3.5 max-w-[240px]">
                                <p className="text-xs text-slate-600 line-clamp-2 italic">"{item.content}"</p>
                                {item.subject && <span className="text-[10px] text-slate-400 mt-0.5 block">{item.subject} · {item.batch}</span>}
                                {item.category && <span className="text-[10px] text-slate-400 mt-0.5 block">{item.category}</span>}
                              </td>
                              <td className="px-5 py-3.5">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold border whitespace-nowrap ${TYPE_BADGE[item.type] ?? 'bg-slate-50 text-slate-600 border-slate-100'}`}>{item.type}</span>
                              </td>
                              <td className="px-5 py-3.5">
                                <div className="flex items-center gap-0.5">{renderStars(item.rating)}</div>
                              </td>
                              <td className="px-5 py-3.5 text-xs font-semibold text-slate-500 whitespace-nowrap">{formatShortDate(item.date)}</td>
                              <td className="px-5 py-3.5">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${sm.color}`}>
                                  {sm.icon} {sm.label}
                                </span>
                              </td>
                              <td className="px-5 py-3.5">
                                <div className="flex items-center gap-2">
                                  {item.status !== 'Dismissed' && (
                                    <button onClick={() => handleUpdateStatus(item.id, 'Dismissed')}
                                      className="text-[10px] font-bold text-slate-400 hover:text-red-500 transition-colors whitespace-nowrap">
                                      Dismiss
                                    </button>
                                  )}
                                  {item.status === 'Dismissed' && (
                                    <button onClick={() => handleUpdateStatus(item.id, 'Submitted')}
                                      className="text-[10px] font-bold text-indigo-500 hover:text-indigo-700 transition-colors whitespace-nowrap">
                                      Reopen
                                    </button>
                                  )}
                                  <button onClick={() => handleDelete(item.id)}
                                    className="text-[10px] font-bold text-slate-300 hover:text-rose-600 transition-colors whitespace-nowrap">
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              /* ── PENDING CARDS ── */
              filteredList.length > 0 ? filteredList.map((item: any) => (
                <div key={item.id} className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between min-h-[220px]">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        {getProfileIcon(item.senderName, item.isAnonymous)}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-bold text-slate-800">{item.isAnonymous ? 'Anonymous' : item.senderName}</span>
                            <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold border ${TYPE_BADGE[item.type] ?? 'bg-slate-50 text-slate-600 border-slate-100'}`}>{item.type}</span>
                          </div>
                          <div className="flex items-center gap-0.5 mt-1">{renderStars(item.rating)}</div>
                        </div>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${STATUS_META[item.status]?.color || ''}`}>
                        {STATUS_META[item.status]?.label || item.status}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-slate-600 leading-relaxed italic mb-5 pl-0.5">"{item.content}"</p>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-50">
                    <div className="flex flex-wrap items-center gap-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {item.type === 'Student -> Teacher' ? (
                        <>
                          <span className="flex items-center gap-1 bg-slate-50 border border-slate-100 px-2 py-1 rounded-md text-slate-500 font-semibold">
                            <BookOpen className="w-3.5 h-3.5 text-slate-400" /> Subject: {item.subject}
                          </span>
                          <span className="flex items-center gap-1 bg-slate-50 border border-slate-100 px-2 py-1 rounded-md text-slate-500 font-semibold">
                            <Users className="w-3.5 h-3.5 text-slate-400" /> Batch: {item.batch}
                          </span>
                        </>
                      ) : (
                        <span className="flex items-center gap-1 bg-slate-50 border border-slate-100 px-2 py-1 rounded-md text-slate-500 font-semibold">
                          <Folder className="w-3.5 h-3.5 text-slate-400" /> Category: {item.category}
                        </span>
                      )}
                      <span className="flex items-center gap-1 bg-slate-50 border border-slate-100 px-2 py-1 rounded-md text-slate-400 font-semibold">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" /> Date: {formatShortDate(item.date)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.status !== 'Actioned' && item.status !== 'Dismissed' && (
                        <button onClick={() => handleUpdateStatus(item.id, 'Dismissed')}
                          className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-50 rounded-lg transition-colors border border-transparent">
                          Dismiss
                        </button>
                      )}
                      {item.status === 'Submitted' && (
                        <>
                          <button onClick={() => handleUpdateStatus(item.id, 'Reviewed')}
                            className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 bg-white rounded-lg text-xs font-bold shadow-sm transition-all">
                            Mark Reviewed
                          </button>
                          <button onClick={() => handleUpdateStatus(item.id, 'Actioned')}
                            className="px-4 py-2 bg-slate-950 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shadow-md transition-all">
                            Mark Actioned
                          </button>
                        </>
                      )}
                      {item.status === 'Reviewed' && (
                        <button onClick={() => handleUpdateStatus(item.id, 'Actioned')}
                          className="px-4 py-2 bg-slate-950 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shadow-md transition-all">
                          Mark Actioned
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )) : (
                <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center shadow-sm text-xs font-bold text-slate-400">
                  {searchQuery ? 'No results match your search.' : 'No pending feedback — all caught up!'}
                </div>
              )
            )}
          </div>

          {/* Right Sidebar */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-bold text-slate-900">Rating Distribution</h3>
                {ratingFilter !== null && (
                  <button onClick={() => setRatingFilter(null)} className="text-[11px] font-bold text-indigo-600">Clear Filter</button>
                )}
              </div>
              <div className="space-y-4">
                {[5, 4, 3, 2, 1].map(stars => {
                  const pct = data.ratingDistribution?.[stars] || 0
                  const isSel = ratingFilter === stars
                  return (
                    <button key={stars} onClick={() => setRatingFilter(isSel ? null : stars)}
                      className={`w-full flex items-center gap-3 text-xs font-bold text-left p-1.5 rounded-lg transition-all hover:bg-slate-50 border border-transparent ${isSel ? 'bg-slate-100/70 border-slate-200 shadow-sm' : ''}`}>
                      <span className="w-6 flex items-center gap-1 text-slate-500 shrink-0">{stars} <Star className="w-3 h-3 fill-amber-400 text-amber-400" /></span>
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-500 ${stars === 5 ? 'bg-emerald-400' : stars === 4 ? 'bg-indigo-400' : stars === 3 ? 'bg-amber-300' : stars === 2 ? 'bg-orange-400' : 'bg-rose-500'}`}
                          style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-8 text-right text-slate-500 font-semibold shrink-0">{pct}%</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-slate-900">Sentiment Keywords</h3>
                <Info className="w-4 h-4 text-slate-400" />
              </div>
              <p className="text-[11px] text-slate-500 mb-6">Common topics appearing in recent feedback (last 30 days).</p>
              <div className="flex flex-wrap gap-2.5">
                {[
                  { label: 'Detailed notes', cls: 'bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100/50', icon: true },
                  { label: 'Doubt clearing', cls: 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100/50', icon: true },
                  { label: 'Pace of teaching', cls: 'bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100/50', icon: true },
                  { label: 'Transport delays', cls: 'bg-slate-50 text-slate-600 border-slate-100 hover:bg-slate-100/50', icon: false },
                  { label: 'Cafeteria menu', cls: 'bg-slate-50 text-slate-600 border-slate-100 hover:bg-slate-100/50', icon: false },
                ].map(kw => {
                  const isActive = searchQuery.toLowerCase() === kw.label.toLowerCase()
                  return (
                    <button key={kw.label} onClick={() => setSearchQuery(isActive ? '' : kw.label)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-all border cursor-pointer ${isActive ? 'bg-slate-800 text-white border-slate-800' : kw.cls}`}>
                      {kw.icon && <TrendingUp className="w-3.5 h-3.5" />}
                      {kw.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Quick legend */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 mb-4">Status Legend</h3>
              <div className="space-y-2.5">
                {Object.entries(STATUS_META).map(([, sm]) => (
                  <div key={sm.label} className="flex items-center gap-2.5">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${sm.color}`}>
                      {sm.icon} {sm.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>

      <div className="mt-8 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
        © 2026 EduAdmin Pro Suite • Secure Feedback Console
      </div>

      {/* Send Feedback to Teachers Modal */}
      {showSendModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">Send Feedback to Teachers</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Management → Teacher · visible to all faculty in this school</p>
              </div>
              <button onClick={() => setShowSendModal(false)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg">
                <XCircle className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSendFeedback} className="p-5 space-y-4">
              {sendError && <p className="text-sm text-rose-600 font-medium bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{sendError}</p>}
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Feedback</label>
                <textarea value={sendContent} onChange={e => setSendContent(e.target.value)} rows={4}
                  placeholder="Share observations, appreciation, or improvement points with your faculty…"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400 focus:bg-white transition-colors resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Rating</label>
                  <div className="flex items-center gap-1 py-2">
                    {[1, 2, 3, 4, 5].map(n => (
                      <button key={n} type="button" onClick={() => setSendRating(n)}>
                        <Star className={`w-6 h-6 transition-colors ${n <= sendRating ? 'fill-amber-400 text-amber-400' : 'text-slate-200 fill-transparent hover:text-amber-200'}`} />
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Category</label>
                  <select value={sendCategory} onChange={e => setSendCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400">
                    {['Academics', 'Discipline', 'Punctuality', 'Teaching Quality', 'Administration', 'General'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowSendModal(false)}
                  className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-bold rounded-lg hover:bg-slate-50 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={sending}
                  className="flex-1 py-2.5 bg-slate-950 hover:bg-slate-800 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {sending && <RefreshCw className="w-4 h-4 animate-spin" />} Send Feedback
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
