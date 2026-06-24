'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bell, Plus, Trash2, Edit3, X, Calendar, Clock,
  Pin, Loader2, RefreshCw, AlertCircle, CheckCircle, User
} from 'lucide-react'

interface Announcement {
  _id: string
  title: string
  content: string
  type: 'General' | 'Academic' | 'Exam' | 'Holiday' | 'Urgent' | 'Fee'
  scope: string
  pinned: boolean
  urgent: boolean
  authorName: string
  authorRole: string
  expiryDate?: string
  createdAt: string
  updatedAt: string
}

const CATEGORY_COLORS: Record<Announcement['type'], { border: string; bg: string; text: string }> = {
  Urgent:   { border: 'border-l-4 border-rose-500', bg: 'bg-rose-50 border-rose-100', text: 'text-rose-700' },
  Holiday:  { border: 'border-l-4 border-emerald-500', bg: 'bg-emerald-50 border-emerald-100', text: 'text-emerald-700' },
  Academic: { border: 'border-l-4 border-indigo-500', bg: 'bg-indigo-50 border-indigo-100', text: 'text-indigo-700' },
  Exam:     { border: 'border-l-4 border-violet-500', bg: 'bg-violet-50 border-violet-100', text: 'text-violet-700' },
  Fee:      { border: 'border-l-4 border-blue-500', bg: 'bg-blue-50 border-blue-100', text: 'text-blue-700' },
  General:  { border: 'border-l-4 border-slate-400', bg: 'bg-slate-50 border-slate-150', text: 'text-slate-700' }
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

function formatTimeAgo(dateStr: string | Date) {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffHrs = Math.floor(diffMs / (1000 * 60 * 60))
  
  if (diffHrs < 24) {
    if (diffHrs <= 0) return 'Just now'
    return `Posted ${diffHrs}h ago`
  }
  
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatDate(dateStr: string) {
  if (!dateStr) return '—'
  const dateObj = new Date(dateStr)
  if (isNaN(dateObj.getTime())) return dateStr
  return dateObj.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
}

const FILTERS: (Announcement['type'] | 'All')[] = ['All', 'General', 'Academic', 'Exam', 'Holiday', 'Urgent', 'Fee']

export default function AnnouncementsView() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<'All' | Announcement['type']>('All')
  
  // Modal states
  const [showCreate, setShowCreate] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [selected, setSelected] = useState<Announcement | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Form fields
  const [formTitle, setFormTitle] = useState('')
  const [formContent, setFormContent] = useState('')
  const [formType, setFormType] = useState<Announcement['type']>('General')
  const [formScope, setFormScope] = useState('All')
  const [formPinned, setFormPinned] = useState(false)
  const [formAuthorName, setFormAuthorName] = useState('')
  const [formAuthorRole, setFormAuthorRole] = useState('')
  const [formExpiryDate, setFormExpiryDate] = useState('')

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function fetchAnnouncements() {
    setLoading(true)
    try {
      const res = await fetch('/api/announcements')
      const data = await res.json()
      if (Array.isArray(data)) {
        setAnnouncements(data)
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to load announcements.' })
      }
    } catch (err) {
      console.error(err)
      setMessage({ type: 'error', text: 'Network error. Failed to load announcements.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAnnouncements()
  }, [])

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [message])

  // Handle create submit
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!formTitle.trim() || !formContent.trim()) return

    setSubmitting(true)
    try {
      const res = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formTitle,
          content: formContent,
          type: formType,
          scope: formScope,
          pinned: formPinned,
          authorName: formAuthorName || undefined,
          authorRole: formAuthorRole || undefined,
          expiryDate: formExpiryDate || undefined
        })
      })

      const data = await res.json()
      if (res.ok && !data.error) {
        setMessage({ type: 'success', text: `Announcement "${formTitle}" published successfully!` })
        setShowCreate(false)
        resetForm()
        fetchAnnouncements()
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to publish announcement.' })
      }
    } catch (err) {
      console.error(err)
      setMessage({ type: 'error', text: 'Network error. Please try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  // Handle edit submit
  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!selected || !formTitle.trim() || !formContent.trim()) return

    setSubmitting(true)
    try {
      const res = await fetch(`/api/announcements/${selected._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formTitle,
          content: formContent,
          type: formType,
          scope: formScope,
          pinned: formPinned,
          authorName: formAuthorName,
          authorRole: formAuthorRole,
          expiryDate: formExpiryDate || ''
        })
      })

      const data = await res.json()
      if (res.ok && !data.error) {
        setMessage({ type: 'success', text: 'Announcement updated successfully!' })
        setShowEdit(false)
        fetchAnnouncements()
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to update announcement.' })
      }
    } catch (err) {
      console.error(err)
      setMessage({ type: 'error', text: 'Network error. Please try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  // Handle delete
  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this announcement?')) return

    try {
      const res = await fetch(`/api/announcements/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setMessage({ type: 'success', text: 'Announcement deleted.' })
        setShowEdit(false)
        fetchAnnouncements()
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
    setFormTitle('')
    setFormContent('')
    setFormType('General')
    setFormScope('All')
    setFormPinned(false)
    setFormAuthorName('')
    setFormAuthorRole('')
    setFormExpiryDate('')
  }

  const openEditModal = (a: Announcement) => {
    setSelected(a)
    setFormTitle(a.title)
    setFormContent(a.content)
    setFormType(a.type)
    setFormScope(a.scope)
    setFormPinned(a.pinned)
    setFormAuthorName(a.authorName || '')
    setFormAuthorRole(a.authorRole || '')
    setFormExpiryDate(a.expiryDate || '')
    setShowEdit(true)
  }

  // Filter local state list
  const filteredAnnouncements = announcements.filter(a => {
    if (activeFilter === 'All') return true
    return a.type === activeFilter
  })

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
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Announcements</h1>
          <p className="text-sm text-slate-500 mt-1">Broadcast updates to staff, students, and parents</p>
        </div>
        
        <button
          onClick={() => { resetForm(); setShowCreate(true) }}
          className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition shadow-sm cursor-pointer border-none self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          New Announcement
        </button>
      </div>

      {/* Category Filter Chips */}
      <div className="flex flex-wrap items-center gap-2 py-1">
        {FILTERS.map((filter) => {
          const isActive = activeFilter === filter
          return (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition shadow-2xs cursor-pointer ${
                isActive 
                  ? 'bg-slate-950 border-slate-950 text-white' 
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {filter}
            </button>
          )
        })}
      </div>

      {/* Feed List Section */}
      <div className="space-y-4 flex-1">
        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-20 flex flex-col items-center justify-center text-slate-400 space-y-2">
            <RefreshCw className="w-8 h-8 animate-spin text-slate-500" />
            <p className="text-sm font-medium">Loading announcements...</p>
          </div>
        ) : filteredAnnouncements.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-20 flex flex-col items-center justify-center text-slate-400">
            <Bell className="w-12 h-12 text-slate-300 mb-3" />
            <p className="text-sm font-medium">No announcements published.</p>
          </div>
        ) : (
          filteredAnnouncements.map((ann) => {
            const colors = CATEGORY_COLORS[ann.type] || CATEGORY_COLORS.General
            return (
              <div 
                key={ann._id} 
                className={`bg-white rounded-2xl border border-slate-150/70 p-5 shadow-2xs flex flex-col justify-between relative hover:shadow-xs transition ${colors.border}`}
              >
                {/* Edit Icon Overlay */}
                <button
                  onClick={() => openEditModal(ann)}
                  className="absolute right-4 top-4 p-1.5 text-slate-400 hover:bg-slate-50 rounded-lg hover:text-slate-700 transition border-none bg-transparent"
                  title="Edit Announcement"
                >
                  <Edit3 className="w-4.5 h-4.5" />
                </button>

                {/* Top Row: Title, Scope, Pin indicator */}
                <div className="space-y-1.5 pr-8">
                  <div className="flex items-center gap-2 flex-wrap">
                    {ann.pinned && (
                      <Pin className="w-4 h-4 text-slate-500 fill-slate-500 shrink-0" />
                    )}
                    <h3 className="text-base font-bold text-slate-800 tracking-tight leading-snug">
                      {ann.title}
                    </h3>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 mt-1">
                    <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded border tracking-wider uppercase ${colors.bg} ${colors.text}`}>
                      {ann.type}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">
                      • Scope: {ann.scope}
                    </span>
                  </div>
                </div>

                {/* Body Content */}
                <p className="text-sm text-slate-600 mt-4 leading-relaxed font-normal whitespace-pre-wrap">
                  {ann.content}
                </p>

                {/* Bottom Row: Author details, Date, Expiry date */}
                <div className="border-t border-slate-100/80 mt-5 pt-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-400">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${getAvatarBg(ann.authorName)}`}>
                      {getInitials(ann.authorName)}
                    </div>
                    <div>
                      <span className="font-bold text-slate-700">{ann.authorName}</span>
                      <span className="text-slate-400 ml-1.5 font-medium">({ann.authorRole})</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-slate-400 font-medium">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      {formatTimeAgo(ann.createdAt)}
                    </span>
                    
                    {ann.expiryDate && (
                      <span className="flex items-center gap-1.5 text-slate-400">
                        <Calendar className="w-3.5 h-3.5" />
                        Exp: {formatDate(ann.expiryDate)}
                      </span>
                    )}
                  </div>
                </div>

              </div>
            )
          })
        )}
      </div>

      {/* New Announcement Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl max-w-lg w-full p-6 space-y-5 relative">
            <button
              onClick={() => setShowCreate(false)}
              className="absolute right-4 top-4 p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-slate-800">Publish Announcement</h3>
            
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Announcement Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Thanksgiving Break Schedule"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-700 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Category Type</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none"
                  >
                    <option value="General">General</option>
                    <option value="Academic">Academic</option>
                    <option value="Exam">Exam</option>
                    <option value="Holiday">Holiday</option>
                    <option value="Urgent">Urgent</option>
                    <option value="Fee">Fee</option>
                  </select>
                </div>
                
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Scope Audience</label>
                  <input
                    type="text"
                    placeholder="e.g. All Staff & Students"
                    value={formScope}
                    onChange={(e) => setFormScope(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Author Name (Opt)</label>
                  <input
                    type="text"
                    placeholder="e.g. David Chen"
                    value={formAuthorName}
                    onChange={(e) => setFormAuthorName(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-700"
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Author Role (Opt)</label>
                  <input
                    type="text"
                    placeholder="e.g. Admin"
                    value={formAuthorRole}
                    onChange={(e) => setFormAuthorRole(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 items-center">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Expiry Date (Opt)</label>
                  <input
                    type="date"
                    value={formExpiryDate}
                    onChange={(e) => setFormExpiryDate(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-700"
                  />
                </div>
                
                <label className="flex items-center gap-2 mt-5 text-sm text-slate-600 font-semibold cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formPinned}
                    onChange={(e) => setFormPinned(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4.5 h-4.5"
                  />
                  Pin Announcement at Top
                </label>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Announcement Content</label>
                <textarea
                  placeholder="Describe details of the announcements..."
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  rows={4}
                  required
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-700 font-normal leading-relaxed"
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
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Publish Announcement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Announcement Modal */}
      {showEdit && selected && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl max-w-lg w-full p-6 space-y-5 relative">
            <button
              onClick={() => setShowEdit(false)}
              className="absolute right-4 top-4 p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex justify-between items-center pr-8">
              <h3 className="text-lg font-bold text-slate-800">Edit Announcement</h3>
              <button
                type="button"
                onClick={() => handleDelete(selected._id)}
                className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition cursor-pointer border-none bg-transparent"
                title="Delete Announcement"
              >
                <Trash2 className="w-4.5 h-4.5" />
              </button>
            </div>
            
            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Announcement Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Thanksgiving Break Schedule"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-700 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Category Type</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none"
                  >
                    <option value="General">General</option>
                    <option value="Academic">Academic</option>
                    <option value="Exam">Exam</option>
                    <option value="Holiday">Holiday</option>
                    <option value="Urgent">Urgent</option>
                    <option value="Fee">Fee</option>
                  </select>
                </div>
                
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Scope Audience</label>
                  <input
                    type="text"
                    placeholder="e.g. All Staff & Students"
                    value={formScope}
                    onChange={(e) => setFormScope(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Author Name</label>
                  <input
                    type="text"
                    placeholder="e.g. David Chen"
                    value={formAuthorName}
                    onChange={(e) => setFormAuthorName(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-700"
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Author Role</label>
                  <input
                    type="text"
                    placeholder="e.g. Admin"
                    value={formAuthorRole}
                    onChange={(e) => setFormAuthorRole(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 items-center">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Expiry Date (Opt)</label>
                  <input
                    type="date"
                    value={formExpiryDate}
                    onChange={(e) => setFormExpiryDate(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-700"
                  />
                </div>
                
                <label className="flex items-center gap-2 mt-5 text-sm text-slate-600 font-semibold cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formPinned}
                    onChange={(e) => setFormPinned(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4.5 h-4.5"
                  />
                  Pin Announcement at Top
                </label>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Announcement Content</label>
                <textarea
                  placeholder="Describe details of the announcements..."
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  rows={4}
                  required
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-700 font-normal leading-relaxed"
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
                  {submitting && <Loader2 className="w-4.5 h-4.5 animate-spin" />}
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
