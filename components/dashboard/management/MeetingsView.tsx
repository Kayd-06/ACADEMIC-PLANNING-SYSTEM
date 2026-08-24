'use client'

import { useState, useEffect } from 'react'
import { Plus, Search, Calendar, Clock, Users, FileText, ChevronRight, CheckCircle2, Circle, AlertCircle, Loader2, Trash2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface AgendaItem {
  id: string
  itemTitle: string
  description: string
  status: 'Not Started' | 'In Progress' | 'Completed'
}

interface Meeting {
  id: string
  title: string
  date: string
  time: string
  type: string
  attendees: string
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

export default function MeetingsView() {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showNewModal, setShowNewModal] = useState(false)
  
  // New Meeting Form
  const [newMeeting, setNewMeeting] = useState({ title: '', date: '', time: '', type: 'General', attendees: '' })
  const [newAgenda, setNewAgenda] = useState<{itemTitle: string, description: string, status: string}[]>([])

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

  async function handleCreateMeeting(e: React.FormEvent) {
    e.preventDefault()
    if (!newMeeting.title || !newMeeting.date || !newMeeting.time) return
    
    const res = await fetch('/api/meetings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...newMeeting,
        agendaItems: newAgenda.filter(a => a.itemTitle.trim() !== '')
      })
    })

    if (res.ok) {
      const created = await res.json()
      setMeetings([created, ...meetings])
      setSelectedMeetingId(created.id)
      setShowNewModal(false)
      setNewMeeting({ title: '', date: '', time: '', type: 'General', attendees: '' })
      setNewAgenda([])
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
              onClick={() => setShowNewModal(true)}
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
                className={`p-3 rounded-xl border cursor-pointer transition-all duration-200 ${
                  selectedMeetingId === meeting.id 
                  ? 'bg-indigo-50 border-indigo-200 shadow-sm' 
                  : 'bg-white border-slate-100 hover:border-slate-200 hover:shadow-sm'
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <h3 className="text-sm font-bold text-slate-800 line-clamp-1">{meeting.title}</h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold shrink-0">{meeting.type}</span>
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
                  <button 
                    onClick={() => handleDeleteMeeting(selectedMeeting.id)}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="grid grid-cols-3 gap-6 mt-6 pt-6 border-t border-slate-100">
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
                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><Users className="w-5 h-5" /></div>
                    <div>
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Attendees</p>
                      <p className="text-sm font-semibold text-slate-800">{selectedMeeting.attendees || 'None specified'}</p>
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
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex-1">
                            <h4 className="text-base font-bold text-slate-900">{item.itemTitle}</h4>
                            {item.description && <p className="text-sm text-slate-500 mt-1">{item.description}</p>}
                          </div>
                          
                          {/* Status Dropdown */}
                          <div className="shrink-0 relative">
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
                        </div>
                      </motion.div>
                    ))
                  ) : (
                    <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300">
                      <p className="text-slate-400 text-sm">No agenda items for this meeting.</p>
                    </div>
                  )}
                </div>
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
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="text-lg font-black text-slate-900">Log New Meeting</h3>
                <button onClick={() => setShowNewModal(false)} className="text-slate-400 hover:text-slate-600">
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto flex-1">
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
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Attendees (CSV)</label>
                        <input value={newMeeting.attendees} onChange={e => setNewMeeting(prev => ({...prev, attendees: e.target.value}))} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400 focus:bg-white transition-colors" placeholder="e.g. Principal, HODs" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Agenda Items</h4>
                      <button 
                        type="button" 
                        onClick={() => setNewAgenda([...newAgenda, { itemTitle: '', description: '', status: 'Not Started' }])}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Item
                      </button>
                    </div>
                    
                    {newAgenda.map((item, idx) => (
                      <div key={idx} className="p-4 bg-slate-50 border border-slate-200 rounded-xl relative group">
                        <button type="button" onClick={() => setNewAgenda(newAgenda.filter((_, i) => i !== idx))} className="absolute top-2 right-2 p-1 text-slate-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <div className="grid gap-3 pr-6">
                          <input 
                            required 
                            placeholder="Agenda Item Title" 
                            value={item.itemTitle} 
                            onChange={e => {
                              const updated = [...newAgenda]; updated[idx].itemTitle = e.target.value; setNewAgenda(updated);
                            }}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400 transition-colors" 
                          />
                          <textarea 
                            placeholder="Description (Optional)" 
                            rows={2}
                            value={item.description}
                            onChange={e => {
                              const updated = [...newAgenda]; updated[idx].description = e.target.value; setNewAgenda(updated);
                            }}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400 transition-colors resize-none" 
                          />
                        </div>
                      </div>
                    ))}
                    {newAgenda.length === 0 && (
                      <p className="text-sm text-slate-400 italic">No agenda items added yet.</p>
                    )}
                  </div>
                </form>
              </div>
              
              <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                <button type="button" onClick={() => setShowNewModal(false)} className="px-4 py-2 text-sm font-bold text-slate-600 hover:text-slate-800 transition-colors">Cancel</button>
                <button type="submit" form="meetingForm" className="px-6 py-2 bg-[#0b1320] text-white text-sm font-bold rounded-lg hover:bg-slate-800 transition-colors shadow-sm">
                  Save Meeting Log
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
