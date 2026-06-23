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
  Search
} from 'lucide-react'

// Helper to format due date into human readable form (e.g., Oct 24, 2023)
function formatShortDate(dateStr: string) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function FeedbackManagementView() {
  const [data, setData] = useState<any>({
    totalCount: 124,
    avgRating: 4.2,
    pendingCount: 18,
    actionedCount: 106,
    ratingDistribution: { 5: 65, 4: 20, 3: 10, 2: 3, 1: 2 },
    feedbackList: []
  })
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'All' | 'Student -> Teacher' | 'Parent -> School' | 'Teacher -> Management'>('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [ratingFilter, setRatingFilter] = useState<number | null>(null)

  async function fetchFeedback() {
    setLoading(true)
    try {
      const url = `/api/feedback?type=${encodeURIComponent(activeTab)}`
      const res = await fetch(url)
      const resData = await res.json()
      if (!resData.error) {
        setData(resData)
      }
    } catch (err) {
      console.error('Error fetching feedback:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFeedback()
    setSearchQuery('')
    setRatingFilter(null)
  }, [activeTab])

  // Update status (e.g., Dismiss or Resolve or Mark Reviewed)
  async function handleUpdateStatus(id: string, newStatus: 'Resolved' | 'Dismissed' | 'In Progress') {
    try {
      const res = await fetch('/api/feedback', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus })
      })
      const updatedRecord = await res.json()
      if (!updatedRecord.error) {
        // Refetch to update overview metrics dynamically
        fetchFeedback()
      }
    } catch (err) {
      console.error('Error updating status:', err)
    }
  }

  // Generate star icons helper
  function renderStars(rating: number) {
    const stars = []
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Star 
          key={i} 
          className={`w-3.5 h-3.5 ${
            i <= rating 
              ? 'fill-amber-400 text-amber-400' 
              : 'text-slate-200 fill-transparent'
          }`} 
        />
      )
    }
    return stars
  }

  // Get sender profile icon / color helper
  function getProfileIcon(name: string, isAnon: boolean) {
    if (isAnon) {
      return (
        <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 border border-slate-200/50 shrink-0">
          <User className="w-4 h-4" />
        </div>
      )
    }
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    return (
      <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-extrabold text-xs shadow-sm border border-emerald-200/50 shrink-0">
        {initials}
      </div>
    )
  }
  // Local filtering by search query & rating
  const filteredList = (data.feedbackList || []).filter((item: any) => {
    const query = searchQuery.toLowerCase()
    const matchesSearch = !searchQuery ? true : (
      item.content.toLowerCase().includes(query) ||
      (item.isAnonymous ? 'anonymous' : item.senderName.toLowerCase()).includes(query) ||
      (item.subject && item.subject.toLowerCase().includes(query)) ||
      (item.batch && item.batch.toLowerCase().includes(query)) ||
      (item.category && item.category.toLowerCase().includes(query)) ||
      item.status.toLowerCase().includes(query) ||
      item.type.toLowerCase().includes(query)
    )
    const matchesRating = ratingFilter === null ? true : item.rating === ratingFilter
    return matchesSearch && matchesRating
  })

  return (
    <div className="flex-1 p-8 overflow-y-auto bg-slate-50 flex flex-col justify-between min-h-[calc(100vh-72px)]">
      
      <div>
        {/* Header Block */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Feedback Management</h1>
            <p className="text-[13px] text-slate-500 mt-1">
              Review feedback from students, parents, and staff
            </p>
          </div>
          
          <button 
            onClick={fetchFeedback}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-semibold shadow-sm transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          
          {/* Card 1: Total Feedback */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Total Feedback This Month</span>
            <span className="text-3xl font-extrabold text-slate-900 mt-2">{data.totalCount}</span>
          </div>

          {/* Card 2: Average Rating */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Average Rating</span>
            <div className="flex items-center gap-1 mt-2">
              <span className="text-3xl font-extrabold text-slate-900">{data.avgRating}</span>
              <Star className="w-5 h-5 fill-amber-400 text-amber-400 ml-1.5" />
            </div>
          </div>

          {/* Card 3: Pending Review */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Pending Review</span>
            <span className="text-3xl font-extrabold text-amber-500 mt-2">{data.pendingCount}</span>
          </div>

          {/* Card 4: Actioned */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Actioned</span>
            <span className="text-3xl font-extrabold text-emerald-600 mt-2">{data.actionedCount}</span>
          </div>

        </div>

        {/* Filters Tabs */}
        <div className="flex items-center gap-1 border-b border-slate-200 mb-8 overflow-x-auto whitespace-nowrap">
          {([
            { id: 'All', label: 'All' },
            { id: 'Student -> Teacher', label: 'Student → Teacher' },
            { id: 'Parent -> School', label: 'Parent → School' },
            { id: 'Teacher -> Management', label: 'Teacher → Management' }
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-xs font-bold transition-all relative ${
                activeTab === tab.id 
                  ? 'text-slate-900 border-b-2 border-slate-950 font-extrabold' 
                  : 'text-slate-400 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Main Grid: Feed (Left 8) + Sidebar Widgets (Right 4) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Feedback Feed (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            {/* Search Input Bar */}
            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search feedback content, sender name, subject, batch, category..."
                className="w-full pl-10 pr-12 py-3 bg-white border border-slate-200/90 rounded-2xl text-xs font-semibold outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 transition-all shadow-sm"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  Clear
                </button>
              )}
            </div>

            {loading ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center shadow-sm">
                <RefreshCw className="w-8 h-8 text-slate-400 animate-spin mx-auto mb-2" />
                <span className="text-xs font-bold text-slate-400">Loading feedback entries...</span>
              </div>
            ) : data.feedbackList.length > 0 ? (
              filteredList.length > 0 ? (
                filteredList.map((item: any) => (
                  <div 
                    key={item._id}
                    className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between min-h-[220px]"
                  >
                    <div>
                      {/* Card Header */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          {getProfileIcon(item.senderName, item.isAnonymous)}
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span className="text-[13px] font-bold text-slate-800">
                                {item.isAnonymous ? 'Anonymous' : item.senderName}
                              </span>
                              
                              <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold border ${
                                item.type === 'Student -> Teacher' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                item.type === 'Parent -> School' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                'bg-indigo-50 text-indigo-700 border-indigo-100'
                              }`}>
                                {item.type}
                              </span>
                            </div>
                            
                            {/* Stars */}
                            <div className="flex items-center gap-0.5 mt-1">
                              {renderStars(item.rating)}
                            </div>
                          </div>
                        </div>

                        {/* Status badge */}
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                          item.status === 'Submitted' ? 'bg-slate-100 text-slate-600 border-slate-200' :
                          item.status === 'In Progress' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                          item.status === 'Resolved' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                          'bg-slate-50 text-slate-400 border-slate-100'
                        }`}>
                          {item.status}
                        </span>
                      </div>

                      {/* Card Content Text */}
                      <p className="text-xs font-medium text-slate-600 leading-relaxed italic mb-5 pl-0.5">
                        "{item.content}"
                      </p>
                    </div>

                    <div>
                      {/* Metadata tags & actions row */}
                      <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-50">
                        
                        {/* Meta Tags */}
                        <div className="flex flex-wrap items-center gap-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          {item.type === 'Student -> Teacher' ? (
                            <>
                              <span className="flex items-center gap-1 bg-slate-50 border border-slate-100 px-2 py-1 rounded-md text-slate-500 font-semibold">
                                <BookOpen className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                Subject: {item.subject}
                              </span>
                              <span className="flex items-center gap-1 bg-slate-50 border border-slate-100 px-2 py-1 rounded-md text-slate-500 font-semibold">
                                <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                Batch: {item.batch}
                              </span>
                            </>
                          ) : (
                            <span className="flex items-center gap-1 bg-slate-50 border border-slate-100 px-2 py-1 rounded-md text-slate-500 font-semibold">
                              <Folder className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              Category: {item.category}
                            </span>
                          )}
                          <span className="flex items-center gap-1 bg-slate-50 border border-slate-100 px-2 py-1 rounded-md text-slate-400 font-semibold">
                            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            Date: {formatShortDate(item.date)}
                          </span>
                        </div>

                        {/* Card Action buttons */}
                        <div className="flex items-center gap-2">
                          {item.status !== 'Resolved' && item.status !== 'Dismissed' && (
                            <button 
                              onClick={() => handleUpdateStatus(item._id, 'Dismissed')}
                              className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-50 rounded-lg transition-colors border border-transparent"
                            >
                              Dismiss
                            </button>
                          )}
                          
                          {item.status === 'Submitted' && (
                            <>
                              <button 
                                onClick={() => handleUpdateStatus(item._id, 'In Progress')}
                                className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 bg-white rounded-lg text-xs font-bold shadow-sm transition-all"
                              >
                                Investigate
                              </button>
                              <button 
                                onClick={() => handleUpdateStatus(item._id, 'Resolved')}
                                className="px-4 py-2 bg-slate-950 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shadow-md transition-all"
                              >
                                Mark Reviewed
                              </button>
                            </>
                          )}

                          {item.status === 'In Progress' && (
                            <button 
                              onClick={() => handleUpdateStatus(item._id, 'Resolved')}
                              className="px-4 py-2 bg-slate-950 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shadow-md transition-all"
                            >
                              Resolve Ticket
                            </button>
                          )}
                        </div>

                      </div>
                    </div>

                  </div>
                ))
              ) : (
                <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center shadow-sm text-xs font-bold text-slate-400">
                  No feedback reviews match your search query or rating filter.
                </div>
              )
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center shadow-sm text-xs font-bold text-slate-400">
                No feedback reviews match active filters.
              </div>
            )}
          </div>

          {/* Right Sidebar Widgets (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Widget 1: Rating Distribution */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-bold text-slate-900">Rating Distribution</h3>
                {ratingFilter !== null && (
                  <button 
                    onClick={() => setRatingFilter(null)}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
                  >
                    Clear Filter
                  </button>
                )}
              </div>
              
              <div className="space-y-4">
                {[5, 4, 3, 2, 1].map(stars => {
                  const percentage = data.ratingDistribution[stars] || 0
                  const isSelected = ratingFilter === stars
                  return (
                    <button 
                      key={stars} 
                      onClick={() => setRatingFilter(isSelected ? null : stars)}
                      className={`w-full flex items-center gap-3 text-xs font-bold text-left p-1.5 rounded-lg transition-all hover:bg-slate-50 border border-transparent ${
                        isSelected ? 'bg-slate-100/70 border-slate-200 shadow-sm' : ''
                      }`}
                    >
                      <span className="w-6 flex items-center gap-1 text-slate-500 shrink-0">
                        {stars} <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      </span>
                      
                      {/* Progress bar */}
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${
                            stars === 5 ? 'bg-emerald-400' :
                            stars === 4 ? 'bg-indigo-400' :
                            stars === 3 ? 'bg-amber-300' :
                            stars === 2 ? 'bg-orange-400' :
                            'bg-rose-500'
                          }`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      
                      <span className="w-8 text-right text-slate-500 font-semibold shrink-0">{percentage}%</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Widget 2: Sentiment Keywords */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-slate-900">Sentiment Keywords</h3>
                <Info className="w-4 h-4 text-slate-400" />
              </div>
              <p className="text-[11px] text-slate-500 mb-6">
                Common topics appearing in recent feedback (last 30 days).
              </p>

              <div className="flex flex-wrap gap-2.5">
                {[
                  { label: 'Detailed notes', bg: 'bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100/50', activeBg: 'bg-blue-600 text-white border-blue-600', icon: true },
                  { label: 'Doubt clearing', bg: 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100/50', activeBg: 'bg-emerald-600 text-white border-emerald-600', icon: true },
                  { label: 'Pace of teaching', bg: 'bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100/50', activeBg: 'bg-amber-600 text-white border-amber-600', icon: true },
                  { label: 'Transport delays', bg: 'bg-slate-50 text-slate-600 border-slate-100 hover:bg-slate-100/50', activeBg: 'bg-slate-800 text-white border-slate-800', icon: false },
                  { label: 'Cafeteria menu', bg: 'bg-slate-50 text-slate-600 border-slate-100 hover:bg-slate-100/50', activeBg: 'bg-slate-800 text-white border-slate-800', icon: false },
                ].map(kw => {
                  const isActive = searchQuery.toLowerCase() === kw.label.toLowerCase()
                  return (
                    <button
                      key={kw.label}
                      onClick={() => setSearchQuery(isActive ? '' : kw.label)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-all border cursor-pointer ${
                        isActive ? kw.activeBg : kw.bg
                      }`}
                    >
                      {kw.icon && <TrendingUp className={`w-3.5 h-3.5 ${isActive ? 'text-white' : ''}`} />}
                      {kw.label}
                    </button>
                  )
                })}
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* Footer copyright */}
      <div className="mt-8 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
        © 2026 EduAdmin Pro Suite • Secure Feedback Console
      </div>

    </div>
  )
}
