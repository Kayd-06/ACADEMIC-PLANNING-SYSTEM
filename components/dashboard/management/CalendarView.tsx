'use client'

import { useState, useEffect, useMemo } from 'react'
import { isValidDateRange, DATE_RANGE_ERROR } from '@/lib/validation/date'
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Trash2, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  CalendarDays, 
  MapPin, 
  Users, 
  Building2, 
  BookOpen
} from 'lucide-react'

// Legend and Event Type Mapping
const EVENT_TYPES = [
  { name: 'Holiday', color: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500' },
  { name: 'Exam/Test', color: 'bg-indigo-50 text-indigo-700 border-indigo-200', dot: 'bg-indigo-500' },
  { name: 'Event', color: 'bg-white text-slate-700 border-slate-200 border shadow-2xs', dot: 'bg-slate-400' },
  { name: 'Parent Meeting', color: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' }
]

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const WEEK_DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']

export default function CalendarView() {
  // Navigation & View States
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear())
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth() + 1) // 1-indexed
  const [activeTab, setActiveTab] = useState<'Month' | 'Week' | 'List'>('Month')
  
  // Database Events States
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Modal States
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedEvent, setSelectedEvent] = useState<any>(null)

  // Form Fields
  const [formTitle, setFormTitle] = useState('')
  const [formDate, setFormDate] = useState('')
  const [formEndDate, setFormEndDate] = useState('')
  const [formType, setFormType] = useState('Event')
  const [formScope, setFormScope] = useState('School-wide')
  const [formDescription, setFormDescription] = useState('')
  const [formSubmitting, setFormSubmitting] = useState(false)

  // Fetch all events from API
  async function fetchEvents() {
    setLoading(true)
    try {
      const res = await fetch('/api/calendar')
      const data = await res.json()
      if (Array.isArray(data)) {
        setEvents(data)
      }
    } catch (err) {
      console.error('Failed to fetch events:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEvents()
  }, [])

  // Auto-clear messages
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [message])

  // Month navigation helpers
  const handlePrevMonth = () => {
    setCurrentMonth(prev => {
      if (prev === 1) {
        setCurrentYear(y => y - 1)
        return 12
      }
      return prev - 1
    })
  }

  const handleNextMonth = () => {
    setCurrentMonth(prev => {
      if (prev === 12) {
        setCurrentYear(y => y + 1)
        return 1
      }
      return prev + 1
    })
  }

  const handleToday = () => {
    const today = new Date()
    setCurrentYear(today.getFullYear())
    setCurrentMonth(today.getMonth() + 1)
  }

  // Get matching events for a specific cell date
  const getEventsForDate = (dateStr: string) => {
    return events.filter(evt => {
      if (evt.date === dateStr) return true
      if (evt.endDate) {
        return dateStr >= evt.date && dateStr <= evt.endDate
      }
      return false
    })
  }

  // Cell Background Highlight Calculator based on day events
  const getCellBgClass = (dateStr: string, isCurrentMonth: boolean) => {
    if (!isCurrentMonth) return 'bg-slate-50/30 text-slate-300'
    const dayEvents = getEventsForDate(dateStr)
    if (dayEvents.length === 0) return 'bg-white'
    
    // Check types prioritized: Holiday > Exam/Test > Parent Meeting > Event
    if (dayEvents.some(e => e.type === 'Holiday')) return 'bg-rose-50/20'
    if (dayEvents.some(e => e.type === 'Exam/Test')) return 'bg-indigo-50/20'
    if (dayEvents.some(e => e.type === 'Parent Meeting')) return 'bg-amber-50/20'
    
    return 'bg-slate-50/40' // Standard event background
  }

  // Calendar cells generation logic (Month view)
  const calendarCells = useMemo(() => {
    const cells: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = []
    
    const firstDay = new Date(currentYear, currentMonth - 1, 1).getDay()
    const firstDayIndex = (firstDay + 6) % 7

    const prevMonthDays = new Date(currentYear, currentMonth - 1, 0).getDate()
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = prevMonthDays - i
      const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1
      const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear
      cells.push({
        dateStr: `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        dayNum: d,
        isCurrentMonth: false
      })
    }

    const activeDaysCount = new Date(currentYear, currentMonth, 0).getDate()
    for (let d = 1; d <= activeDaysCount; d++) {
      cells.push({
        dateStr: `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        dayNum: d,
        isCurrentMonth: true
      })
    }

    const remaining = 42 - cells.length
    for (let d = 1; d <= remaining; d++) {
      const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1
      const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear
      cells.push({
        dateStr: `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        dayNum: d,
        isCurrentMonth: false
      })
    }

    return cells
  }, [currentYear, currentMonth])

  // Upcoming events selection sorted chronologically (active month and later)
  const upcomingEvents = useMemo(() => {
    const activeMonthStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`
    return events
      .filter(evt => evt.date >= activeMonthStr || (evt.endDate && evt.endDate >= activeMonthStr))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 8)
  }, [events, currentYear, currentMonth])

  // Event modal openers
  const openAddModal = (dateStr: string) => {
    setSelectedDate(dateStr)
    setFormTitle('')
    setFormDate(dateStr)
    setFormEndDate('')
    setFormType('Event')
    setFormScope('School-wide')
    setFormDescription('')
    setShowAddModal(true)
  }

  const openEditModal = (event: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedEvent(event)
    setFormTitle(event.title)
    setFormDate(event.date)
    setFormEndDate(event.endDate || '')
    setFormType(event.type)
    setFormScope(event.scope)
    setFormDescription(event.description || '')
    setShowEditModal(true)
  }

  // Create Event Action
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formTitle.trim() || !formDate || !formType || !formScope.trim()) return
    if (!isValidDateRange(formDate, formEndDate)) {
      setMessage({ type: 'error', text: DATE_RANGE_ERROR })
      return
    }

    setFormSubmitting(true)
    try {
      const res = await fetch('/api/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formTitle,
          date: formDate,
          endDate: formEndDate || undefined,
          type: formType,
          scope: formScope,
          description: formDescription
        })
      })
      const data = await res.json()
      if (res.ok) {
        setMessage({ type: 'success', text: `Event "${formTitle}" created successfully!` })
        setEvents(prev => [...prev, data].sort((a, b) => a.date.localeCompare(b.date)))
        setShowAddModal(false)
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to create event.' })
      }
    } catch (err) {
      console.error(err)
      setMessage({ type: 'error', text: 'Network error. Please try again.' })
    } finally {
      setFormSubmitting(false)
    }
  }

  // Edit Event Action
  const handleUpdateEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedEvent || !formTitle.trim() || !formDate || !formType || !formScope.trim()) return
    if (!isValidDateRange(formDate, formEndDate)) {
      setMessage({ type: 'error', text: DATE_RANGE_ERROR })
      return
    }

    setFormSubmitting(true)
    try {
      const res = await fetch('/api/calendar', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedEvent._id,
          title: formTitle,
          date: formDate,
          endDate: formEndDate || undefined,
          type: formType,
          scope: formScope,
          description: formDescription
        })
      })
      const data = await res.json()
      if (res.ok) {
        setMessage({ type: 'success', text: 'Event updated successfully!' })
        setEvents(prev => prev.map(evt => evt._id === selectedEvent._id ? data : evt).sort((a, b) => a.date.localeCompare(b.date)))
        setShowEditModal(false)
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to update event.' })
      }
    } catch (err) {
      console.error(err)
      setMessage({ type: 'error', text: 'Network error. Please try again.' })
    } finally {
      setFormSubmitting(false)
    }
  }

  // Delete Event Action
  const handleDeleteEvent = async () => {
    if (!selectedEvent) return
    if (!confirm('Are you sure you want to delete this event?')) return

    setFormSubmitting(true)
    try {
      const res = await fetch(`/api/calendar?id=${selectedEvent._id}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        setMessage({ type: 'success', text: 'Event deleted successfully.' })
        setEvents(prev => prev.filter(evt => evt._id !== selectedEvent._id))
        setShowEditModal(false)
      } else {
        const data = await res.json()
        setMessage({ type: 'error', text: data.error || 'Failed to delete event.' })
      }
    } catch (err) {
      console.error(err)
      setMessage({ type: 'error', text: 'Network error. Please try again.' })
    } finally {
      setFormSubmitting(false)
    }
  }


  // Date box details helper
  const getEventCardStyle = (type: string) => {
    if (type === 'Holiday') return { bg: 'bg-rose-50 text-rose-600 border border-rose-100', label: 'HOLIDAY', icon: <Building2 className="w-3.5 h-3.5" /> }
    if (type === 'Exam/Test') return { bg: 'bg-indigo-50 text-indigo-600 border border-indigo-100', label: 'EXAM', icon: <Users className="w-3.5 h-3.5" /> }
    if (type === 'Event') return { bg: 'bg-slate-50 text-slate-600 border border-slate-100', label: 'EVENT', icon: <Building2 className="w-3.5 h-3.5" /> }
    return { bg: 'bg-amber-50 text-amber-600 border border-amber-100', label: 'MEETING', icon: <BookOpen className="w-3.5 h-3.5" /> }
  }

  return (
    <div className="flex-1 min-w-0 p-6 space-y-6 overflow-y-auto max-h-[calc(100vh-64px)] bg-gray-50 flex flex-col 2xl:flex-row 2xl:items-start gap-6">
      
      {/* Calendar Main Section */}
      <div className="flex-1 min-w-0 flex flex-col space-y-6">
        
        {/* Header toolbar */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Academic Calendar</h1>
            <p className="text-sm text-slate-500 mt-1">Manage holidays, exam dates, and institutional events.</p>
          </div>
          
          <div className="flex items-center gap-3 self-end md:self-auto">
            {/* View Tab Selectors */}
            <div className="bg-white border border-slate-200 p-1 rounded-xl flex items-center shadow-sm">
              {(['Month', 'Week', 'List'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                    activeTab === tab 
                      ? 'bg-slate-100 text-slate-800 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
            
            {/* Add Event Button */}
            <button
              onClick={() => openAddModal(new Date().toISOString().split('T')[0])}
              className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition shadow-sm cursor-pointer border-none"
            >
              <Plus className="w-4 h-4" />
              Add Event
            </button>
          </div>
        </div>

        {/* Toast Notification Container */}
        {message && (
          <div className={`p-4 rounded-xl flex items-start gap-3 border shadow-sm ${
            message.type === 'success' 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            )}
            <span className="text-sm font-medium">{message.text}</span>
          </div>
        )}

        {/* View renderers */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col min-h-[500px]">
          
          {/* Calendar Header with Navigation */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-5 mb-5">
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevMonth}
                className="p-2 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 text-slate-600 transition cursor-pointer"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h2 className="text-lg font-bold text-slate-800 min-w-[140px] text-center">
                {MONTH_NAMES[currentMonth - 1]} {currentYear}
              </h2>
              <button
                onClick={handleNextMonth}
                className="p-2 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 text-slate-600 transition cursor-pointer"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            
            <button
              onClick={handleToday}
              className="px-4 py-2 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm transition cursor-pointer"
            >
              Today
            </button>
          </div>

          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-400 space-y-2">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              <p className="text-sm font-medium">Loading calendar events...</p>
            </div>
          ) : activeTab === 'Month' ? (
            /* Month Calendar Grid View */
            <div className="flex flex-col overflow-x-auto custom-scrollbar">
              <div className="min-w-[750px] flex flex-col">
                {/* Day Titles Header */}
                <div className="grid grid-cols-7 border-b border-slate-100 pb-2 mb-2 text-center text-xs font-bold text-slate-400 tracking-wider">
                  {WEEK_DAYS.map((day) => (
                    <div key={day}>{day}</div>
                  ))}
                </div>
                
                {/* Days Cell Grid */}
                <div className="grid grid-cols-7 border-t border-l border-slate-100/50">
                  {calendarCells.map((cell, index) => {
                    const dayEvents = getEventsForDate(cell.dateStr)
                    const cellBg = getCellBgClass(cell.dateStr, cell.isCurrentMonth)
                    
                    return (
                      <div
                        key={index}
                        onClick={() => openAddModal(cell.dateStr)}
                        className={`min-h-[105px] p-2 border-r border-b border-slate-100 flex flex-col justify-start hover:bg-slate-50/50 transition cursor-pointer select-none relative ${cellBg}`}
                      >
                        {/* Day Number and dot container */}
                        <div className="flex items-center justify-between mb-1.5">
                          <span className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${
                            !cell.isCurrentMonth 
                              ? 'text-slate-300' 
                              : cell.dateStr === new Date().toISOString().split('T')[0]
                                ? 'bg-blue-600 text-white font-bold shadow-sm'
                                : 'text-slate-600'
                          }`}>
                            {cell.dayNum}
                          </span>
                        </div>

                        {/* Event Badges list with scroll overflow if many events */}
                        <div className="space-y-1 overflow-y-auto max-h-[70px] pr-0.5 custom-scrollbar">
                          {dayEvents.map((evt) => {
                            const conf = EVENT_TYPES.find(t => t.name === evt.type)
                            return (
                              <div
                                key={evt._id}
                                onClick={(e) => openEditModal(evt, e)}
                                className={`text-[9px] font-bold px-1.5 py-0.5 rounded border truncate max-w-full block leading-snug ${
                                  conf ? conf.color : 'bg-slate-100 text-slate-700'
                                } transition hover:scale-102 hover:shadow-2xs`}
                                title={`${evt.title} (${evt.scope})`}
                              >
                                {evt.title}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          ) : activeTab === 'Week' ? (
            /* Week View list of days */
            <div className="space-y-4">
              {Array.from({ length: 7 }).map((_, i) => {
                const start = new Date(currentYear, currentMonth - 1, 1)
                const dayOffset = (start.getDay() + 6) % 7
                const mondayDate = new Date(currentYear, currentMonth - 1, 1 - dayOffset + i * 7)
                const dateStr = mondayDate.toISOString().split('T')[0]
                const dayEvents = getEventsForDate(dateStr)

                return (
                  <div key={i} className="flex border-b border-slate-100 pb-4 items-start gap-4">
                    <div className="w-24 shrink-0">
                      <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                        {mondayDate.toLocaleDateString('en-US', { weekday: 'short' })}
                      </span>
                      <span className="text-xl font-extrabold text-slate-800">
                        {mondayDate.getDate()}
                      </span>
                    </div>
                    
                    <div className="flex-1 space-y-2">
                      {dayEvents.length === 0 ? (
                        <span className="text-xs text-slate-400 italic">No events scheduled.</span>
                      ) : (
                        dayEvents.map(evt => (
                          <div
                            key={evt._id}
                            onClick={(e) => openEditModal(evt, e)}
                            className="bg-white border border-slate-200 hover:border-slate-300 p-3 rounded-xl flex items-center justify-between cursor-pointer transition shadow-xs"
                          >
                            <div>
                              <h4 className="text-sm font-bold text-slate-800">{evt.title}</h4>
                              <p className="text-xs text-slate-400 mt-1">{evt.description || 'No description.'}</p>
                            </div>
                            <span className="text-xs font-semibold px-2.5 py-1 rounded bg-slate-50 border border-slate-200 text-slate-600">
                              {evt.scope}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            /* List View */
            <div className="space-y-3">
              {events
                .filter(evt => evt.date.startsWith(`${currentYear}-${String(currentMonth).padStart(2, '0')}`))
                .map((evt) => (
                  <div
                    key={evt._id}
                    onClick={(e) => openEditModal(evt, e)}
                    className="p-4 rounded-xl border border-slate-150 hover:bg-slate-50 transition flex items-center justify-between gap-4 cursor-pointer shadow-xs bg-white"
                  >
                    <div className="flex items-start gap-4">
                      <div className="text-center bg-slate-100 rounded-lg p-2 min-w-[50px]">
                        <span className="block text-[10px] font-bold text-slate-400 uppercase">
                          {new Date(evt.date).toLocaleDateString('en-US', { month: 'short' })}
                        </span>
                        <span className="block text-lg font-bold text-slate-700">
                          {new Date(evt.date).getDate()}
                        </span>
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-800">{evt.title}</h4>
                        <p className="text-xs text-slate-500 mt-1">{evt.description || 'No description.'}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 font-mono">
                        {evt.type}
                      </span>
                      <span className="text-xs text-slate-400 font-semibold">{evt.scope}</span>
                    </div>
                  </div>
                ))}
              {events.filter(evt => evt.date.startsWith(`${currentYear}-${String(currentMonth).padStart(2, '0')}`)).length === 0 && (
                <div className="py-20 text-center text-slate-400 italic">
                  No events scheduled for this month.
                </div>
              )}
            </div>
          )}

          {/* Calendar Footer Legend */}
          <div className="border-t border-slate-100 pt-5 mt-auto flex flex-wrap items-center gap-5 text-xs text-slate-500 font-semibold">
            <span className="text-slate-400 uppercase tracking-wider mr-2 text-[10px]">Legend:</span>
            {EVENT_TYPES.map((type) => (
              <span key={type.name} className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${type.dot}`} />
                {type.name === 'Exam/Test' ? 'Exam/Test' : type.name}
              </span>
            ))}
          </div>

        </div>
      </div>

      {/* Right Column Panel: Upcoming Events */}
      <div className="w-full 2xl:w-96 shrink-0 flex flex-col space-y-6">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col flex-1">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
            <h2 className="text-lg font-bold text-slate-800">Upcoming Events</h2>
            <button
              onClick={() => setActiveTab('List')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition cursor-pointer"
            >
              View All
            </button>
          </div>
          
          {/* Expanded height to fit all cards cleanly and avoid cuts */}
          <div className="flex-1 space-y-4 overflow-y-auto max-h-[600px] pr-1">
            {loading ? (
              <div className="py-12 text-center text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-500 mb-2" />
                <span>Loading events...</span>
              </div>
            ) : upcomingEvents.length === 0 ? (
              <div className="py-12 text-center text-slate-400 italic text-sm">
                No upcoming events.
              </div>
            ) : (
              upcomingEvents.map((evt) => {
                const details = getEventCardStyle(evt.type)
                const evtDate = new Date(evt.date)
                
                return (
                  <div
                    key={evt._id}
                    onClick={(e) => openEditModal(evt, e)}
                    className="flex border border-slate-100 rounded-xl p-3.5 gap-4 hover:bg-slate-50/50 transition cursor-pointer bg-white shadow-xs"
                  >
                    {/* Date Badge Box */}
                    <div className={`w-14 h-14 shrink-0 rounded-xl flex flex-col items-center justify-center font-bold ${details.bg}`}>
                      <span className="text-[10px] uppercase opacity-75">
                        {evtDate.toLocaleDateString('en-US', { month: 'short' })}
                      </span>
                      <span className="text-lg leading-tight mt-0.5">
                        {evtDate.getDate()}
                      </span>
                    </div>

                    {/* Event Content */}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-slate-800 truncate">{evt.title}</h4>
                      
                      <div className="flex flex-wrap items-center gap-3 mt-2">
                        <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-md ${
                          evt.type === 'Holiday' ? 'bg-rose-50 text-rose-600 border border-rose-100' :
                          evt.type === 'Exam/Test' ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' :
                          evt.type === 'Event' ? 'bg-slate-50 text-slate-600 border border-slate-100' :
                          'bg-amber-50 text-amber-600 border border-amber-100'
                        }`}>
                          {details.label}
                        </span>
                        
                        <span className="flex items-center gap-1 text-[11px] text-slate-400 font-semibold truncate">
                          {details.icon}
                          {evt.scope}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

        </div>
      </div>


      {/* Add Event Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl max-w-md w-full p-6 space-y-6">
            <h3 className="text-lg font-bold text-slate-800">Add Academic Event</h3>
            
            <form onSubmit={handleCreateEvent} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Event Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dussehra Holiday"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Event Type</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                  >
                    <option value="Holiday">Holiday</option>
                    <option value="Exam/Test">Exam/Test</option>
                    <option value="Event">Event</option>
                    <option value="Parent Meeting">Parent Meeting</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Scope</label>
                  <select
                    value={formScope}
                    onChange={(e) => setFormScope(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                  >
                    <option value="School-wide">School-wide</option>
                    <option value="Batch A">Batch A</option>
                    <option value="Batch B">Batch B</option>
                    <option value="Grade 11">Grade 11</option>
                    <option value="Grade 12">Grade 12</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Start Date</label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">End Date (Opt)</label>
                  <input
                    type="date"
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Description</label>
                <textarea
                  placeholder="Additional details..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={3}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-5 py-2.5 border border-slate-200 rounded-xl text-slate-700 font-semibold text-sm hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2.5 bg-slate-900 text-white rounded-xl font-semibold text-sm hover:bg-slate-800 transition flex items-center gap-2 cursor-pointer disabled:opacity-50 border-none"
                >
                  {formSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Event Modal */}
      {showEditModal && selectedEvent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl max-w-md w-full p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">Edit Academic Event</h3>
              <button
                type="button"
                onClick={handleDeleteEvent}
                className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition cursor-pointer border-none"
                title="Delete Event"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleUpdateEvent} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Event Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dussehra Holiday"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Event Type</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                  >
                    <option value="Holiday">Holiday</option>
                    <option value="Exam/Test">Exam/Test</option>
                    <option value="Event">Event</option>
                    <option value="Parent Meeting">Parent Meeting</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Scope</label>
                  <select
                    value={formScope}
                    onChange={(e) => setFormScope(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                  >
                    <option value="School-wide">School-wide</option>
                    <option value="Batch A">Batch A</option>
                    <option value="Batch B">Batch B</option>
                    <option value="Grade 11">Grade 11</option>
                    <option value="Grade 12">Grade 12</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Start Date</label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">End Date (Opt)</label>
                  <input
                    type="date"
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Description</label>
                <textarea
                  placeholder="Additional details..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={3}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-5 py-2.5 border border-slate-200 rounded-xl text-slate-700 font-semibold text-sm hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2.5 bg-slate-900 text-white rounded-xl font-semibold text-sm hover:bg-slate-800 transition flex items-center gap-2 cursor-pointer disabled:opacity-50 border-none"
                >
                  {formSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
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
