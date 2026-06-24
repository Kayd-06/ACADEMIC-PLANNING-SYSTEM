'use client'

import { useState, useEffect } from 'react'
import { useAlert } from '@/components/dashboard/AlertProvider'
import {
  Star, MessageSquare, Calendar, Check,
  UserX, Loader2, Filter, AlertCircle, RefreshCw
} from 'lucide-react'

interface FeedbackItem {
  _id: string
  senderName: string
  isAnonymous: boolean
  rating: number
  content: string
  type: string
  status: 'Submitted' | 'In Progress' | 'Resolved' | 'Dismissed'
  subject?: string
  batch?: string
  date: string
  createdAt: string
  updatedAt: string
}

interface StatsData {
  totalFeedback: number
  avgRating: number
  ratingDistribution: Record<number, number>
  thisMonthFeedback: number
  thisMonthChange: string
  feedbackList: FeedbackItem[]
  batches: string[]
}

const AVATAR_BG = [
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

function getInitials(name: string) {
  return name.trim().split(' ').map(n => n[0]?.toUpperCase() || '').slice(0, 2).join('')
}

function formatFeedbackDate(dateStr: string) {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  const now = new Date()
  
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const itemDate = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diffTime = today.getTime() - itemDate.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) {
    return 'Today'
  } else if (diffDays === 1) {
    return 'Yesterday'
  } else if (diffDays < 7) {
    return `${diffDays} days ago`
  }
  
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function TeacherFeedbackView() {
  const { showAlert } = useAlert()
  const [data, setData] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedBatch, setSelectedBatch] = useState('All')
  const [submittingId, setSubmittingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function fetchFeedback(batch = 'All') {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/teacher/feedback?batch=${encodeURIComponent(batch)}`)
      const result = await res.json()
      if (res.ok && !result.error) {
        setData(result)
      } else {
        setError(result.error || 'Failed to load feedback.')
      }
    } catch (err) {
      console.error(err)
      setError('Network error. Failed to load feedback.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFeedback(selectedBatch)
  }, [selectedBatch])

  async function handleAcknowledge(id: string) {
    setSubmittingId(id)
    try {
      const res = await fetch('/api/teacher/feedback', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      })
      const result = await res.json()
      if (res.ok && !result.error) {
        // Update local status of this item to 'Resolved'
        if (data) {
          const updatedList = data.feedbackList.map((item) => {
            if (item._id === id) {
              return { ...item, status: 'Resolved' as const }
            }
            return item
          })
          setData({ ...data, feedbackList: updatedList })
        }
      } else {
        showAlert({
          title: 'Acknowledgment Failed',
          message: result.error || 'Failed to acknowledge feedback.',
          type: 'warning',
          onRetry: () => handleAcknowledge(id),
          retryText: 'Retry'
        })
      }
    } catch (err) {
      console.error(err)
      showAlert({
        title: 'Network Error',
        message: 'A network error occurred. Please try again.',
        type: 'warning',
        onRetry: () => handleAcknowledge(id),
        retryText: 'Retry'
      })
    } finally {
      setSubmittingId(null)
    }
  }

  if (loading && !data) {
    return (
      <div className="flex-1 p-6 flex flex-col items-center justify-center text-slate-400 space-y-3 bg-gray-50 h-[calc(100vh-64px)]">
        <RefreshCw className="w-8 h-8 animate-spin text-slate-500" />
        <p className="text-sm font-medium">Loading feedback data...</p>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="flex-1 p-6 flex flex-col items-center justify-center text-slate-400 space-y-3 bg-gray-50 h-[calc(100vh-64px)]">
        <AlertCircle className="w-8 h-8 text-rose-500" />
        <p className="text-sm font-medium text-rose-600">{error}</p>
        <button 
          onClick={() => fetchFeedback(selectedBatch)}
          className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition"
        >
          Retry
        </button>
      </div>
    )
  }

  const { totalFeedback, avgRating, ratingDistribution, thisMonthFeedback, thisMonthChange, feedbackList, batches } = data || {
    totalFeedback: 0,
    avgRating: 0,
    ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    thisMonthFeedback: 0,
    thisMonthChange: '+0%',
    feedbackList: [],
    batches: []
  }

  // Calculate percentage helper for progress bars
  const getPercentage = (count: number) => {
    if (totalFeedback === 0) return 0
    return Math.round((count / totalFeedback) * 100)
  }

  return (
    <div className="flex-1 p-6 space-y-6 overflow-y-auto max-h-[calc(100vh-64px)] bg-gray-50 flex flex-col font-sans">
      
      {/* Title Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Feedback</h1>
        <p className="text-sm text-slate-500 mt-1">View feedback received from students and respond if needed</p>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* 1. Average Rating */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col justify-between h-44">
          <p className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">Average Rating</p>
          <div className="flex flex-col items-center justify-center my-auto">
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-extrabold text-slate-800">{avgRating.toFixed(1)}</span>
              <span className="text-sm font-semibold text-slate-400">/ 5.0</span>
            </div>
            <div className="flex items-center gap-0.5 mt-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`w-5 h-5 ${
                    star <= Math.round(avgRating)
                      ? 'text-amber-400 fill-amber-400'
                      : 'text-slate-200'
                  }`}
                />
              ))}
            </div>
            <p className="text-xs text-slate-400 font-medium mt-2">Based on {totalFeedback} reviews</p>
          </div>
        </div>

        {/* 2. Rating Distribution */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 col-span-2 flex flex-col justify-between h-44">
          <p className="text-[11px] font-bold text-slate-400 tracking-wider uppercase mb-2">Rating Distribution</p>
          <div className="space-y-1.5 flex-1 flex flex-col justify-center">
            {[5, 4, 3, 2, 1].map((ratingVal) => {
              const count = ratingDistribution[ratingVal] || 0
              const percentage = getPercentage(count)
              return (
                <div key={ratingVal} className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1 w-8 shrink-0 text-slate-500 font-semibold justify-end">
                    <span>{ratingVal}</span>
                    <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                  </div>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-indigo-600 rounded-full transition-all duration-500" 
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-slate-400 font-medium shrink-0">{count}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* 3. Total Feedback & This Month */}
        <div className="flex flex-col gap-4 h-44 justify-between">
          {/* Total Feedback */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center justify-between flex-1">
            <div>
              <p className="text-[9px] font-bold text-slate-400 tracking-wider uppercase">Total Feedback</p>
              <h3 className="text-2xl font-extrabold text-slate-800 mt-1">{totalFeedback}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
              <MessageSquare className="w-5 h-5" />
            </div>
          </div>

          {/* This Month */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center justify-between flex-1">
            <div>
              <p className="text-[9px] font-bold text-slate-400 tracking-wider uppercase">This Month</p>
              <div className="flex items-center gap-2 mt-1">
                <h3 className="text-2xl font-extrabold text-slate-800">{thisMonthFeedback}</h3>
                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600">
                  {thisMonthChange}
                </span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Feedback List */}
      <div className="space-y-4">
        {/* Header Toolbar */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-850">Recent Feedback</h2>
          
          <div className="flex items-center gap-2">
            <select
              value={selectedBatch}
              onChange={(e) => setSelectedBatch(e.target.value)}
              className="text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 pr-8 text-slate-650 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer font-semibold shadow-2xs"
            >
              <option value="All">All Batches</option>
              {batches.map((batch) => (
                <option key={batch} value={batch}>{batch}</option>
              ))}
            </select>
            <button className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold px-3 py-2 rounded-xl transition shadow-2xs cursor-pointer">
              <Filter className="w-3.5 h-3.5" />
              Filter
            </button>
          </div>
        </div>

        {/* Feedback Cards */}
        <div className="space-y-4">
          {feedbackList.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 flex flex-col items-center justify-center text-slate-400">
              <MessageSquare className="w-12 h-12 text-slate-350 mb-3" />
              <p className="text-sm font-medium">No feedback matching the filters.</p>
            </div>
          ) : (
            feedbackList.map((item) => {
              const isAcknowledged = item.status === 'Resolved'
              const isSubmitting = submittingId === item._id
              return (
                <div 
                  key={item._id} 
                  className="bg-white rounded-2xl border border-slate-150 p-5 shadow-2xs flex flex-col md:flex-row justify-between items-start md:items-center gap-5 hover:shadow-xs transition"
                >
                  {/* Left Column: Student identity */}
                  <div className="flex gap-4 items-start min-w-0 md:w-1/4">
                    {item.isAnonymous ? (
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 shrink-0 border border-slate-200 shadow-3xs">
                        <UserX className="w-5 h-5" />
                      </div>
                    ) : (
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 shadow-3xs border border-white ${getAvatarBg(item.senderName)}`}>
                        {getInitials(item.senderName)}
                      </div>
                    )}
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-bold text-slate-800 truncate">
                        {item.isAnonymous ? 'Anonymous' : item.senderName}
                      </p>
                      {(item.batch || item.subject) && (
                        <div className="inline-flex items-center text-[10px] font-bold bg-slate-50 border border-slate-150 text-slate-550 px-2 py-0.5 rounded">
                          {item.batch || 'Any Batch'} | {item.subject || 'Any Subject'}
                        </div>
                      )}
                      <p className="text-[10px] text-slate-400 font-medium">
                        {formatFeedbackDate(item.date)}
                      </p>
                    </div>
                  </div>

                  {/* Middle Column: Star rating and feedback comment */}
                  <div className="flex-1 space-y-2 pr-4 md:w-1/2">
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-3.5 h-3.5 ${
                            star <= item.rating
                              ? 'text-amber-400 fill-amber-400'
                              : 'text-slate-200'
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-sm text-slate-650 font-normal leading-relaxed">
                      "{item.content}"
                    </p>
                  </div>

                  {/* Right Column: Action button */}
                  <div className="shrink-0 flex items-center md:w-1/4 justify-end">
                    {isAcknowledged ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-slate-400 font-semibold select-none">
                        <Check className="w-4 h-4 text-slate-400" />
                        Acknowledged
                      </span>
                    ) : (
                      <button
                        onClick={() => handleAcknowledge(item._id)}
                        disabled={isSubmitting}
                        className="inline-flex items-center gap-2 px-5 py-2 border border-indigo-600 text-indigo-600 hover:bg-indigo-50/50 rounded-xl text-xs font-bold transition shadow-3xs hover:shadow-2xs cursor-pointer disabled:opacity-50 min-w-[110px] justify-center"
                      >
                        {isSubmitting ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          'Acknowledge'
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
      
    </div>
  )
}
