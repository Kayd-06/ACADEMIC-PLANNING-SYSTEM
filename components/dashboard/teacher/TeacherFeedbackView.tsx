'use client'

import { useState, useEffect } from 'react'
import { Star, Loader2, RefreshCw, AlertCircle } from 'lucide-react'
import { formatDate } from '@/lib/date'

interface FeedbackRow {
  id: string
  senderName: string
  rating: number
  content: string
  status: string
  category?: string | null
  date: string
}

const STATUS_BADGE: Record<string, string> = {
  Submitted: 'bg-slate-100 text-slate-600 border-slate-200',
  Reviewed: 'bg-amber-50 text-amber-700 border-amber-200',
  Actioned: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Dismissed: 'bg-slate-50 text-slate-400 border-slate-100',
}

function formatFeedbackDate(dateStr: string) {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const itemDate = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diffDays = Math.floor((today.getTime() - itemDate.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays > 1 && diffDays < 7) return `${diffDays} days ago`
  return formatDate(d)
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} className={`w-3 h-3 ${i < rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200 fill-transparent'}`} />
      ))}
    </div>
  )
}

export default function TeacherFeedbackView() {
  const [received, setReceived] = useState<FeedbackRow[]>([])
  const [sent, setSent] = useState<FeedbackRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showSend, setShowSend] = useState(false)
  const [content, setContent] = useState('')
  const [rating, setRating] = useState(5)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')

  async function fetchFeedback() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/feedback')
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) {
        setError(data.error || 'Failed to load feedback.')
        return
      }
      setReceived(Array.isArray(data.received) ? data.received : [])
      setSent(Array.isArray(data.sent) ? data.sent : [])
    } catch {
      setError('Network error. Failed to load feedback.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchFeedback() }, [])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) { setSendError('Feedback content is required.'); return }
    setSending(true)
    setSendError('')
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, rating, category: 'General' }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setSendError(data.error || 'Failed to send feedback.')
        return
      }
      setShowSend(false)
      setContent('')
      setRating(5)
      fetchFeedback()
    } catch {
      setSendError('Network error. Please try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex-1 p-6 space-y-6 overflow-y-auto max-h-[calc(100vh-64px)] bg-gray-50 flex flex-col font-sans">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Feedback</h1>
          <p className="text-sm text-slate-500 mt-1">Feedback from management, and feedback you have sent to management</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchFeedback}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-semibold transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button onClick={() => { setSendError(''); setShowSend(v => !v) }}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors">
            {showSend ? 'Close' : 'Send Feedback to Management'}
          </button>
        </div>
      </div>

      {showSend && (
        <form onSubmit={handleSend} className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5 space-y-3">
          {sendError && <p className="text-xs text-rose-600 font-semibold">{sendError}</p>}
          <textarea value={content} onChange={e => setContent(e.target.value)} rows={3}
            placeholder="Suggestions, requests, or concerns for management…"
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400 focus:bg-white resize-none" />
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n} star${n > 1 ? 's' : ''}`}>
                  <Star className={`w-5 h-5 transition-colors ${n <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200 fill-transparent'}`} />
                </button>
              ))}
            </div>
            <button type="submit" disabled={sending}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold disabled:opacity-50 flex items-center gap-1.5">
              {sending && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Submit
            </button>
          </div>
          <p className="text-[11px] text-slate-400">Your name is shown to management with this feedback.</p>
        </form>
      )}

      {error ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 flex flex-col items-center gap-3 text-center">
          <AlertCircle className="w-8 h-8 text-rose-500" />
          <p className="text-sm font-medium text-rose-600">{error}</p>
          <button onClick={fetchFeedback} className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition">
            Retry
          </button>
        </div>
      ) : loading && received.length === 0 && sent.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 flex flex-col items-center text-slate-400 gap-2">
          <RefreshCw className="w-8 h-8 animate-spin" />
          <p className="text-sm font-medium">Loading feedback…</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-3">From Management ({received.length})</p>
            {received.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No feedback from management yet.</p>
            ) : (
              <div className="space-y-2.5 max-h-[32rem] overflow-y-auto pr-1">
                {received.map(f => (
                  <div key={f.id} className="bg-violet-50/50 border border-violet-100 rounded-xl p-3.5">
                    <div className="flex items-center justify-between mb-1.5 gap-2">
                      <span className="text-xs font-bold text-slate-800">{f.senderName || 'Management'}</span>
                      <Stars rating={f.rating} />
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed italic">&ldquo;{f.content}&rdquo;</p>
                    <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-400 font-semibold">
                      {f.category && <span>{f.category}</span>}
                      <span>{f.category ? '· ' : ''}{formatFeedbackDate(f.date)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-3">Sent to Management ({sent.length})</p>
            {sent.length === 0 ? (
              <p className="text-xs text-slate-400 italic">You haven&apos;t sent any feedback yet.</p>
            ) : (
              <div className="space-y-2.5 max-h-[32rem] overflow-y-auto pr-1">
                {sent.map(f => (
                  <div key={f.id} className="bg-slate-50 border border-slate-100 rounded-xl p-3.5">
                    <div className="flex items-center justify-between mb-1.5 gap-2">
                      <Stars rating={f.rating} />
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${STATUS_BADGE[f.status] ?? STATUS_BADGE.Submitted}`}>
                        {f.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed italic">&ldquo;{f.content}&rdquo;</p>
                    <p className="text-[10px] text-slate-400 font-semibold mt-2">{formatFeedbackDate(f.date)}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
