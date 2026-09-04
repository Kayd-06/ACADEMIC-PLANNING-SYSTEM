'use client'

import { useState, useEffect } from 'react'
import { Plus, Search, Calendar, Clock, Users, FileText, ChevronRight, CheckCircle2, Circle, AlertCircle, Loader2, Trash2, X, MapPin, Printer, Eye, Download } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { buildMeetingAgendaPDF, buildMeetingMinutesPDF } from '@/lib/pdf/meetingPdfGenerator'

interface AgendaItem {
  id: string
  itemTitle: string
  description: string
  discussion: string
  action: string
  responsibility: string
  targetDate: string
  communicatedTo: string
  communicatedBy: string
  status: 'Not Started' | 'In Progress' | 'Completed'
  priority: 'Low' | 'Medium' | 'High'
}

interface Meeting {
  id: string
  title: string
  date: string
  time: string
  type: string
  venue: string
  attendees: string
  minutesPreparedBy: string
  nextMeetingDate: string
  agendaItems: AgendaItem[]
}

const STATUS_COLORS = {
  'Not Started': 'bg-rose-50 text-rose-600 border-rose-200',
  'In Progress': 'bg-amber-50 text-amber-600 border-amber-200',
  'Completed': 'bg-emerald-50 text-emerald-600 border-emerald-200'
}

const STATUS_ICONS = {
  'Not Started': <AlertCircle className="w-3.5 h-3.5" />,
  'In Progress': <Circle className="w-3.5 h-3.5" />,
  'Completed': <CheckCircle2 className="w-3.5 h-3.5" />
}

const PRIORITY_COLORS = {
  'Low': 'bg-slate-50 text-slate-600 border-slate-200',
  'Medium': 'bg-amber-50 text-amber-600 border-amber-200',
  'High': 'bg-rose-50 text-rose-600 border-rose-200'
}

export default function MeetingsView() {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showNewModal, setShowNewModal] = useState(false)
  const [editingMeetingId, setEditingMeetingId] = useState<string | null>(null)
  
  // New Meeting Form
  const [newMeeting, setNewMeeting] = useState({ title: '', date: '', time: '', type: 'General', venue: '', attendees: '', minutesPreparedBy: '', nextMeetingDate: '' })
  const [error, setError] = useState('')

  // Inline Agenda Form
  const [showAgendaForm, setShowAgendaForm] = useState(false)
  const [inlineAgenda, setInlineAgenda] = useState({ itemTitle: '', description: '', discussion: '', action: '', responsibility: '', targetDate: '', communicatedTo: '', communicatedBy: '', status: 'Not Started', priority: 'Medium' })
  const [agendaError, setAgendaError] = useState('')
  const [savingAgenda, setSavingAgenda] = useState(false)

  // Edit Agenda Form
  const [editingAgendaId, setEditingAgendaId] = useState<string | null>(null)
  const [editAgendaData, setEditAgendaData] = useState<any>(null)

  const [pdfPreview, setPdfPreview] = useState<{ doc: any; url: string; filename: string; title: string } | null>(null)
  const [pdfPreviewLoading, setPdfPreviewLoading] = useState<'agenda' | 'minutes' | null>(null)

  useEffect(() => {
    fetchMeetings()
  }, [])

  async function fetchMeetings() {
    try {
      const res = await fetch('/api/meetings')
      const data = await res.json()
      if (Array.isArray(data)) {
        setMeetings(data)
        if (data.length > 0 && !selectedMeetingId) {
          setSelectedMeetingId(data[0].id)
        }
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const selectedMeeting = meetings.find(m => m.id === selectedMeetingId)

  const filteredMeetings = meetings.filter(m => 
    m.title.toLowerCase().includes(search.toLowerCase()) || 
    m.type.toLowerCase().includes(search.toLowerCase())
  )

  async function updateAgendaStatus(agendaId: string, status: string) {
    // Optimistic update
    setMeetings(prev => prev.map(m => 
      m.id === selectedMeetingId 
      ? { ...m, agendaItems: m.agendaItems.map(a => a.id === agendaId ? { ...a, status: status as any } : a) }
      : m
    ))

    await fetch(`/api/meetings?agendaItemId=${agendaId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    })
  }

  async function updateAgendaPriority(agendaId: string, priority: string) {
    // Optimistic update
    setMeetings(prev => prev.map(m =>
      m.id === selectedMeetingId
      ? { ...m, agendaItems: m.agendaItems.map(a => a.id === agendaId ? { ...a, priority: priority as any } : a) }
      : m
    ))

    await fetch(`/api/meetings?agendaItemId=${agendaId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priority })
    })
  }

  async function openPdfPreview(kind: 'agenda' | 'minutes', meeting: Meeting) {
    setPdfPreviewLoading(kind)
    try {
      const { doc, filename } = kind === 'agenda'
        ? await buildMeetingAgendaPDF(meeting)
        : await buildMeetingMinutesPDF(meeting)
      const url = doc.output('bloburl').toString()
      setPdfPreview({ doc, url, filename, title: kind === 'agenda' ? 'Agenda Preview' : 'Minutes Preview' })
    } finally {
      setPdfPreviewLoading(null)
    }
  }

  function closePdfPreview() {
    if (pdfPreview) {
      try { URL.revokeObjectURL(pdfPreview.url) } catch {}
    }
    setPdfPreview(null)
  }

  async function handleUpdateAgendaItem(e: React.FormEvent) {
    e.preventDefault()
    if (!editingAgendaId) return

    setSavingAgenda(true)
    try {
      const res = await fetch(`/api/meetings?agendaItemId=${editingAgendaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editAgendaData)
      })

      if (res.ok) {
        const updated = await res.json()
        setMeetings(prev => prev.map(m => 
          m.id === selectedMeetingId 
          ? { ...m, agendaItems: m.agendaItems.map(a => a.id === updated.id ? updated : a) }
          : m
        ))
        setEditingAgendaId(null)
        setEditAgendaData(null)
      } else {
        const errData = await res.json()
        setAgendaError(errData.error || 'Failed to update agenda item')
      }
    } catch (err: any) {
      setAgendaError(err.message || 'An error occurred')
    } finally {
      setSavingAgenda(false)
    }
  }

  async function handleDeleteAgendaItem(agendaId: string) {
    if (!confirm('Are you sure you want to delete this agenda item?')) return
    try {
      const res = await fetch(`/api/meetings?agendaItemId=${agendaId}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        setMeetings(prev => prev.map(m => 
          m.id === selectedMeetingId 
          ? { ...m, agendaItems: m.agendaItems.filter(a => a.id !== agendaId) }
          : m
        ))
      }
    } catch (err: any) {
      console.error('Failed to delete agenda item', err)
    }
  }

  async function handleCreateMeeting(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    
    try {
      const url = editingMeetingId ? `/api/meetings?id=${editingMeetingId}` : '/api/meetings'
      const method = editingMeetingId ? 'PATCH' : 'POST'
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newMeeting,
          agendaItems: []
        })
      })

      if (res.ok) {
        const saved = await res.json()
        if (editingMeetingId) {
          setMeetings(prev => prev.map(m => m.id === editingMeetingId ? { ...m, ...saved } : m))
        } else {
          setMeetings([saved, ...meetings])
          setSelectedMeetingId(saved.id)
        }
        setShowNewModal(false)
        setEditingMeetingId(null)
        setNewMeeting({ title: '', date: '', time: '', type: 'General', venue: '', attendees: '', minutesPreparedBy: '', nextMeetingDate: '' })
      } else {
        const errData = await res.json()
        setError(errData.error || 'Failed to save meeting')
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    }
  }

  async function handleCreateAgendaItem(e: React.FormEvent) {
    e.preventDefault()
    setAgendaError('')
    if (!selectedMeetingId) return
    if (!inlineAgenda.itemTitle) {
      setAgendaError('Agenda title is required')
      return
    }
    if (!inlineAgenda.discussion || !inlineAgenda.responsibility || !inlineAgenda.targetDate || !inlineAgenda.communicatedTo || !inlineAgenda.communicatedBy) {
      setAgendaError('Discussion, Responsibility, Target Date, Communicated To, and Communicated By are required')
      return
    }

    setSavingAgenda(true)
    try {
      const res = await fetch('/api/meetings/agenda', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...inlineAgenda, meetingId: selectedMeetingId })
      })

      if (res.ok) {
        const created = await res.json()
        setMeetings(prev => prev.map(m => 
          m.id === selectedMeetingId 
          ? { ...m, agendaItems: [...m.agendaItems, created] }
          : m
        ))
        setShowAgendaForm(false)
        setInlineAgenda({ itemTitle: '', description: '', discussion: '', action: '', responsibility: '', targetDate: '', communicatedTo: '', communicatedBy: '', status: 'Not Started', priority: 'Medium' })
      } else {
        const errData = await res.json()
        setAgendaError(errData.error || 'Failed to save agenda item')
      }
    } catch (err: any) {
      setAgendaError(err.message || 'An error occurred')
    } finally {
      setSavingAgenda(false)
    }
  }

  async function handleDeleteMeeting(id: string) {
    if (!confirm('Are you sure you want to delete this meeting?')) return
    
    await fetch(`/api/meetings?id=${id}`, { method: 'DELETE' })
    setMeetings(prev => prev.filter(m => m.id !== id))
    if (selectedMeetingId === id) setSelectedMeetingId(null)
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Left Sidebar - Meeting List */}
      <div className="w-80 bg-white border-r border-slate-200 flex flex-col z-10 shrink-0">
        <div className="p-4 border-b border-slate-100 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Meetings Log</h2>
            <button 
              onClick={() => {
                setEditingMeetingId(null)
                setNewMeeting({ title: '', date: '', time: '', type: 'General', venue: '', attendees: '', minutesPreparedBy: '', nextMeetingDate: '' })
                setShowNewModal(true)
              }}
              className="p-1.5 bg-[#0b1320] text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search meetings..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              suppressHydrationWarning
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:border-indigo-500 outline-none transition-colors"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading ? (
            <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>
          ) : filteredMeetings.length === 0 ? (
            <p className="text-center text-sm text-slate-400 py-8">No meetings found.</p>
          ) : (
            filteredMeetings.map(meeting => (
              <motion.div 
                key={meeting.id}
                whileHover={{ scale: 1.01 }}
                onClick={() => setSelectedMeetingId(meeting.id)}
                className={`group p-3 rounded-xl border cursor-pointer transition-all duration-200 relative overflow-hidden ${
                  selectedMeetingId === meeting.id 
                  ? 'bg-indigo-50 border-indigo-200 shadow-sm' 
                  : 'bg-white border-slate-100 hover:border-slate-200 hover:shadow-sm'
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <h3 className="text-sm font-bold text-slate-800 line-clamp-1 pr-16">{meeting.title}</h3>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity absolute right-2 top-2 bg-white/90 backdrop-blur-sm p-1 rounded-lg shadow-sm border border-slate-100 z-10">
                    <button 
                      type="button"
                      onClick={(e) => { 
                        e.stopPropagation()
                        setEditingMeetingId(meeting.id)
                        setNewMeeting({
                          title: meeting.title,
                          date: meeting.date,
                          time: meeting.time,
                          type: meeting.type,
                          venue: meeting.venue || '',
                          attendees: meeting.attendees || '',
                          minutesPreparedBy: meeting.minutesPreparedBy || '',
                          nextMeetingDate: meeting.nextMeetingDate || ''
                        })
                        setShowNewModal(true)
                      }}
                      className="p-1 text-slate-400 hover:text-indigo-600 rounded transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                    <button 
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleDeleteMeeting(meeting.id); }}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold shrink-0 group-hover:opacity-0 transition-opacity">{meeting.type}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500 mt-2">
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {meeting.date}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {meeting.time}</span>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Right Content - Meeting Details & Agenda */}
      <div className="flex-1 bg-slate-50 overflow-y-auto p-8">
        <AnimatePresence mode="wait">
          {selectedMeeting ? (
            <motion.div 
              key={selectedMeeting.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="max-w-4xl mx-auto space-y-6"
            >
              {/* Header Card */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold uppercase tracking-wider rounded-lg border border-indigo-100">
                        {selectedMeeting.type} Meeting
                      </span>
                    </div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">{selectedMeeting.title}</h1>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openPdfPreview('agenda', selectedMeeting)}
                      disabled={pdfPreviewLoading === 'agenda'}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors disabled:opacity-60"
                    >
                      {pdfPreviewLoading === 'agenda' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />} Print Agenda
                    </button>
                    <button
                      onClick={() => openPdfPreview('minutes', selectedMeeting)}
                      disabled={pdfPreviewLoading === 'minutes'}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors disabled:opacity-60"
                    >
                      {pdfPreviewLoading === 'minutes' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />} Print Minutes
                    </button>
                    <button
                      onClick={() => handleDeleteMeeting(selectedMeeting.id)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-6 mt-6 pt-6 border-t border-slate-100">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Calendar className="w-5 h-5" /></div>
                    <div>
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Date</p>
                      <p className="text-sm font-semibold text-slate-800">{selectedMeeting.date}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><Clock className="w-5 h-5" /></div>
                    <div>
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Time</p>
                      <p className="text-sm font-semibold text-slate-800">{selectedMeeting.time}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-violet-50 text-violet-600 rounded-lg"><MapPin className="w-5 h-5" /></div>
                    <div>
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Venue</p>
                      <p className="text-sm font-semibold text-slate-800">{selectedMeeting.venue || 'Not specified'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><Users className="w-5 h-5" /></div>
                    <div>
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Attendees</p>
                      <p className="text-sm font-semibold text-slate-800">{selectedMeeting.attendees || 'None specified'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><FileText className="w-5 h-5" /></div>
                    <div>
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Minutes Prepared By</p>
                      <p className="text-sm font-semibold text-slate-800">{selectedMeeting.minutesPreparedBy || 'Not specified'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-rose-50 text-rose-600 rounded-lg"><Calendar className="w-5 h-5" /></div>
                    <div>
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Next Meeting Date</p>
                      <p className="text-sm font-semibold text-slate-800">{selectedMeeting.nextMeetingDate || 'Not scheduled'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Agenda Items */}
              <div className="space-y-4">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-500" /> Agenda & Discussion Items
                </h3>
                
                <div className="grid gap-3">
                  {selectedMeeting.agendaItems && selectedMeeting.agendaItems.length > 0 ? (
                    selectedMeeting.agendaItems.map((item, idx) => (
                      <motion.div 
                        key={item.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group"
                      >
                        {editingAgendaId === item.id ? (
                          <form onSubmit={handleUpdateAgendaItem} className="space-y-3">
                            <textarea 
                              required 
                              placeholder="Agenda" 
                              rows={2}
                              value={editAgendaData.itemTitle} 
                              onChange={e => setEditAgendaData({...editAgendaData, itemTitle: e.target.value})}
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400 transition-colors resize-none" 
                            />
                            <textarea
                              required
                              placeholder="Discussion"
                              rows={3}
                              value={editAgendaData.discussion}
                              onChange={e => setEditAgendaData({...editAgendaData, discussion: e.target.value})}
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400 transition-colors resize-none"
                            />
                            <textarea
                              placeholder="Action"
                              rows={2}
                              value={editAgendaData.action}
                              onChange={e => setEditAgendaData({...editAgendaData, action: e.target.value})}
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400 transition-colors resize-none"
                            />
                            <div className="grid grid-cols-2 gap-3">
                              <input
                                required
                                placeholder="Responsibility"
                                value={editAgendaData.responsibility}
                                onChange={e => setEditAgendaData({...editAgendaData, responsibility: e.target.value})}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400 transition-colors"
                              />
                              <input
                                required
                                type="date"
                                placeholder="Target Date"
                                value={editAgendaData.targetDate}
                                onChange={e => setEditAgendaData({...editAgendaData, targetDate: e.target.value})}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400 transition-colors"
                              />
                              <input
                                required
                                placeholder="To be Communicated to"
                                value={editAgendaData.communicatedTo}
                                onChange={e => setEditAgendaData({...editAgendaData, communicatedTo: e.target.value})}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400 transition-colors"
                              />
                              <input
                                required
                                placeholder="To be Communicated by"
                                value={editAgendaData.communicatedBy}
                                onChange={e => setEditAgendaData({...editAgendaData, communicatedBy: e.target.value})}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400 transition-colors"
                              />
                              <select
                                value={editAgendaData.priority || 'Medium'}
                                onChange={e => setEditAgendaData({...editAgendaData, priority: e.target.value})}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400 transition-colors"
                              >
                                <option value="Low">Priority: Low</option>
                                <option value="Medium">Priority: Medium</option>
                                <option value="High">Priority: High</option>
                              </select>
                            </div>
                            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                              <button type="button" onClick={() => { setEditingAgendaId(null); setEditAgendaData(null); }} className="px-4 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors">Cancel</button>
                              <button type="submit" disabled={savingAgenda} className="px-5 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm flex items-center gap-2">
                                {savingAgenda && <Loader2 className="w-3 h-3 animate-spin" />} Save Changes
                              </button>
                            </div>
                          </form>
                        ) : (
                          <div className="flex justify-between items-start gap-4">
                            <div className="flex-1 space-y-4">
                              <div>
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Agenda</h4>
                                <p className="text-base font-bold text-slate-900">{item.itemTitle}</p>
                              </div>
                              {item.discussion && (
                                <div>
                                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Discussion</h4>
                                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{item.discussion}</p>
                                </div>
                              )}
                              {item.action && (
                                <div>
                                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Action</h4>
                                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{item.action}</p>
                                </div>
                              )}
                              <div className="flex items-center gap-8 pt-2 flex-wrap">
                                {item.responsibility && (
                                  <div>
                                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Responsibility</h4>
                                    <p className="text-sm font-medium text-slate-800">{item.responsibility}</p>
                                  </div>
                                )}
                                {item.targetDate && (
                                  <div>
                                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Target Date</h4>
                                    <p className="text-sm font-medium text-slate-800">{item.targetDate}</p>
                                  </div>
                                )}
                                {item.communicatedTo && (
                                  <div>
                                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Communicated To</h4>
                                    <p className="text-sm font-medium text-slate-800">{item.communicatedTo}</p>
                                  </div>
                                )}
                                {item.communicatedBy && (
                                  <div>
                                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Communicated By</h4>
                                    <p className="text-sm font-medium text-slate-800">{item.communicatedBy}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            <div className="shrink-0 flex flex-col items-end gap-3">
                              {/* Action Buttons */}
                              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                  onClick={() => { setEditingAgendaId(item.id); setEditAgendaData(item); }}
                                  className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                  title="Edit Agenda Item"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                </button>
                                <button 
                                  onClick={() => handleDeleteAgendaItem(item.id)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                  title="Delete Agenda Item"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>

                              {/* Status + Priority Dropdowns */}
                              <div className="flex items-center gap-2 mt-auto">
                                <div className="relative">
                                  <select
                                    value={item.status}
                                    onChange={(e) => updateAgendaStatus(item.id, e.target.value)}
                                    className={`appearance-none pl-8 pr-8 py-1.5 rounded-full text-xs font-bold border transition-colors cursor-pointer outline-none ${STATUS_COLORS[item.status as keyof typeof STATUS_COLORS]}`}
                                  >
                                    <option value="Not Started">Not Started</option>
                                    <option value="In Progress">In Progress</option>
                                    <option value="Completed">Completed</option>
                                  </select>
                                  <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                                    {STATUS_ICONS[item.status as keyof typeof STATUS_ICONS]}
                                  </div>
                                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
                                    <ChevronRight className="w-3 h-3 rotate-90" />
                                  </div>
                                </div>
                                <div className="relative">
                                  <select
                                    value={item.priority || 'Medium'}
                                    onChange={(e) => updateAgendaPriority(item.id, e.target.value)}
                                    className={`appearance-none pl-3 pr-7 py-1.5 rounded-full text-xs font-bold border transition-colors cursor-pointer outline-none ${PRIORITY_COLORS[(item.priority || 'Medium') as keyof typeof PRIORITY_COLORS]}`}
                                    title="Priority"
                                  >
                                    <option value="Low">Low</option>
                                    <option value="Medium">Medium</option>
                                    <option value="High">High</option>
                                  </select>
                                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
                                    <ChevronRight className="w-3 h-3 rotate-90" />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    ))
                  ) : (
                    <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300">
                      <p className="text-slate-400 text-sm">No agenda items for this meeting.</p>
                    </div>
                  )}
                </div>

                {showAgendaForm ? (
                  <div className="bg-white p-5 rounded-xl border border-indigo-200 shadow-sm mt-4">
                    <h4 className="text-sm font-bold text-indigo-900 mb-4">Add Agenda Item</h4>
                    {agendaError && <p className="text-rose-500 text-xs font-bold mb-3">{agendaError}</p>}
                    <form onSubmit={handleCreateAgendaItem} className="space-y-3">
                      <textarea 
                        required 
                        placeholder="Agenda" 
                        rows={2}
                        value={inlineAgenda.itemTitle} 
                        onChange={e => setInlineAgenda({...inlineAgenda, itemTitle: e.target.value})}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400 transition-colors resize-none" 
                      />
                      <textarea
                        required
                        placeholder="Discussion"
                        rows={3}
                        value={inlineAgenda.discussion}
                        onChange={e => setInlineAgenda({...inlineAgenda, discussion: e.target.value})}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400 transition-colors resize-none"
                      />
                      <textarea
                        placeholder="Action"
                        rows={2}
                        value={inlineAgenda.action}
                        onChange={e => setInlineAgenda({...inlineAgenda, action: e.target.value})}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400 transition-colors resize-none"
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          required
                          placeholder="Responsibility"
                          value={inlineAgenda.responsibility}
                          onChange={e => setInlineAgenda({...inlineAgenda, responsibility: e.target.value})}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400 transition-colors"
                        />
                        <input
                          required
                          type="date"
                          placeholder="Target Date"
                          value={inlineAgenda.targetDate}
                          onChange={e => setInlineAgenda({...inlineAgenda, targetDate: e.target.value})}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400 transition-colors"
                        />
                        <input
                          required
                          placeholder="To be Communicated to"
                          value={inlineAgenda.communicatedTo}
                          onChange={e => setInlineAgenda({...inlineAgenda, communicatedTo: e.target.value})}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400 transition-colors"
                        />
                        <input
                          required
                          placeholder="To be Communicated by"
                          value={inlineAgenda.communicatedBy}
                          onChange={e => setInlineAgenda({...inlineAgenda, communicatedBy: e.target.value})}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400 transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Priority</label>
                        <select
                          value={inlineAgenda.priority}
                          onChange={e => setInlineAgenda({...inlineAgenda, priority: e.target.value})}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400 transition-colors"
                        >
                          <option value="Low">Low</option>
                          <option value="Medium">Medium</option>
                          <option value="High">High</option>
                        </select>
                      </div>
                      <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                        <button type="button" onClick={() => setShowAgendaForm(false)} className="px-4 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors">Cancel</button>
                        <button type="submit" disabled={savingAgenda} className="px-5 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm flex items-center gap-2">
                          {savingAgenda && <Loader2 className="w-3 h-3 animate-spin" />} Save Item
                        </button>
                      </div>
                    </form>
                  </div>
                ) : (
                  <button 
                    onClick={() => setShowAgendaForm(true)}
                    className="w-full py-3 mt-4 border-2 border-dashed border-slate-200 rounded-xl text-slate-500 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50/50 transition-colors flex items-center justify-center gap-2 text-sm font-bold"
                  >
                    <Plus className="w-4 h-4" /> Add Agenda Item
                  </button>
                )}
              </div>
            </motion.div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3">
              <Calendar className="w-12 h-12 opacity-20" />
              <p>Select a meeting to view details</p>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* New Meeting Modal */}
      <AnimatePresence>
        {showNewModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h3 className="text-lg font-black text-slate-900 tracking-tight">
                {editingMeetingId ? 'Edit Meeting' : 'Log New Meeting'}
              </h3>
              <button onClick={() => setShowNewModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
              
              <div className="p-6 overflow-y-auto flex-1">
                {error && (
                  <div className="mb-4 p-3 bg-rose-50 text-rose-600 text-sm font-bold rounded-lg border border-rose-200">
                    {error}
                  </div>
                )}
                <form id="meetingForm" onSubmit={handleCreateMeeting} className="space-y-6">
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Meeting Details</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Title</label>
                        <input required value={newMeeting.title} onChange={e => setNewMeeting(prev => ({...prev, title: e.target.value}))} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400 focus:bg-white transition-colors" placeholder="e.g. Weekly Management Alignment" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Date</label>
                        <input type="date" required value={newMeeting.date} onChange={e => setNewMeeting(prev => ({...prev, date: e.target.value}))} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400 focus:bg-white transition-colors" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Time</label>
                        <input type="time" required value={newMeeting.time} onChange={e => setNewMeeting(prev => ({...prev, time: e.target.value}))} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400 focus:bg-white transition-colors" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Type</label>
                        <select value={newMeeting.type} onChange={e => setNewMeeting(prev => ({...prev, type: e.target.value}))} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400 focus:bg-white transition-colors">
                          <option>General</option>
                          <option>Management</option>
                          <option>Parent-Teacher</option>
                          <option>Staff</option>
                          <option>Disciplinary</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Venue</label>
                        <input value={newMeeting.venue} onChange={e => setNewMeeting(prev => ({...prev, venue: e.target.value}))} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400 focus:bg-white transition-colors" placeholder="e.g. Conference Room" />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Attendees (CSV)</label>
                        <input value={newMeeting.attendees} onChange={e => setNewMeeting(prev => ({...prev, attendees: e.target.value}))} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400 focus:bg-white transition-colors" placeholder="e.g. Principal, HODs" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Minutes Prepared By</label>
                        <input value={newMeeting.minutesPreparedBy} onChange={e => setNewMeeting(prev => ({...prev, minutesPreparedBy: e.target.value}))} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400 focus:bg-white transition-colors" placeholder="e.g. Office Secretary" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Next Meeting Date</label>
                        <input type="date" value={newMeeting.nextMeetingDate} onChange={e => setNewMeeting(prev => ({...prev, nextMeetingDate: e.target.value}))} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400 focus:bg-white transition-colors" />
                      </div>
                    </div>
                  </div>
                </form>
              </div>
              
                <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 rounded-b-2xl">
                  <button type="button" onClick={() => setShowNewModal(false)} className="px-5 py-2 text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors">Cancel</button>
                  <button type="submit" form="meetingForm" className="px-6 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm">
                    {editingMeetingId ? 'Save Changes' : 'Create Meeting'}
                  </button>
                </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {pdfPreview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-3xl h-[85vh] flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-sm font-bold text-slate-800">{pdfPreview.title}</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => pdfPreview.doc.save(pdfPreview.filename)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" /> Download PDF
                  </button>
                  <button
                    onClick={closePdfPreview}
                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <iframe src={pdfPreview.url} title={pdfPreview.title} className="flex-1 w-full" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
