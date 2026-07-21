'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, MapPin, Plus, Trash2, X, Loader2, Repeat } from 'lucide-react'
import { formatDate, formatDateWithWeekday } from '@/lib/date'

const DAY_NAMES = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
const TIMES = ['08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '01:00 PM']
const GRID_START = 8
const GRID_HOURS = 6

const SPECIAL_TYPES = ['Extra', 'Doubt', 'Revision', 'Makeup', 'Orientation']
const TYPE_BADGE: Record<string, string> = {
  Extra: 'bg-indigo-50 text-indigo-700',
  Doubt: 'bg-blue-50 text-blue-700',
  Revision: 'bg-amber-50 text-amber-700',
  Makeup: 'bg-purple-50 text-purple-700',
  Orientation: 'bg-emerald-50 text-emerald-700',
}

function getLocalToday() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().split('T')[0]
}

function getMonday(d: Date) {
  const dt = new Date(d)
  const day = dt.getDay()
  dt.setDate(dt.getDate() + (day === 0 ? -6 : 1 - day))
  dt.setHours(0, 0, 0, 0)
  return dt
}

function dateStr(d: Date) {
  const dt = new Date(d)
  dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset())
  return dt.toISOString().split('T')[0]
}

function parseHour(t: string): number {
  if (!t) return 9
  const m = t.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i)
  if (!m) return 9
  let h = parseInt(m[1])
  const min = parseInt(m[2])
  const period = m[3]?.toUpperCase()
  if (period === 'PM' && h !== 12) h += 12
  if (period === 'AM' && h === 12) h = 0
  return h + min / 60
}

function fmtDateLabel(iso: string) {
  return formatDateWithWeekday(iso) || iso
}

const inputClass = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'
const labelClass = 'block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5'

// Modal: create a one-off special class
function SpecialClassModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    title: '', type: 'Extra', subject: '', batch: '',
    date: getLocalToday(), startTime: '10:00 AM', endTime: '11:00 AM', room: '', notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (f: string) => (e: React.ChangeEvent<any>) => setForm(prev => ({ ...prev, [f]: e.target.value }))

  async function save() {
    if (!form.title.trim()) { setError('Title is required.'); return }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/special-classes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Failed to schedule class.')
        return
      }
      onSaved()
      onClose()
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">Schedule Special Class</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto">
          {error && <p className="text-sm text-rose-600 font-medium bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{error}</p>}
          <div>
            <label className={labelClass}>Title *</label>
            <input value={form.title} onChange={set('title')} placeholder="e.g. Calculus Doubt Clearing" className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Type</label>
              <select value={form.type} onChange={set('type')} className={inputClass + ' bg-white'}>
                {SPECIAL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Date *</label>
              <input type="date" value={form.date} onChange={set('date')} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Start Time *</label>
              <input value={form.startTime} onChange={set('startTime')} placeholder="10:00 AM" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>End Time *</label>
              <input value={form.endTime} onChange={set('endTime')} placeholder="11:00 AM" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Subject</label>
              <input value={form.subject} onChange={set('subject')} placeholder="e.g. Mathematics" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Batch</label>
              <input value={form.batch} onChange={set('batch')} placeholder="e.g. Grade 11-A" className={inputClass} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Room</label>
            <input value={form.room} onChange={set('room')} placeholder="e.g. Library Rm B" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Notes</label>
            <textarea value={form.notes} onChange={set('notes')} rows={2} placeholder="Session focus or instructions…" className={inputClass + ' resize-none'} />
          </div>
        </div>
        <div className="p-5 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800">Cancel</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 shadow-sm disabled:opacity-50 flex items-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Schedule Class
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// Modal: create a weekly recurring timetable slot
function WeeklySlotModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    subject: '', batch: '', dayOfWeek: 1,
    startTime: '09:00 AM', endTime: '10:00 AM', room: '',
    effectiveFrom: '', effectiveTo: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (f: string) => (e: React.ChangeEvent<any>) =>
    setForm(prev => ({ ...prev, [f]: f === 'dayOfWeek' ? Number(e.target.value) : e.target.value }))

  async function save() {
    if (!form.subject.trim() || !form.batch.trim()) { setError('Subject and batch are required.'); return }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/schedule', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Failed to add slot.')
        return
      }
      onSaved()
      onClose()
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">Add Weekly Slot</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          {error && <p className="text-sm text-rose-600 font-medium bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{error}</p>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Subject *</label>
              <input value={form.subject} onChange={set('subject')} placeholder="e.g. Physics 101" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Batch *</label>
              <input value={form.batch} onChange={set('batch')} placeholder="e.g. Grade 11-A" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Day of Week</label>
              <select value={form.dayOfWeek} onChange={set('dayOfWeek')} className={inputClass + ' bg-white'}>
                {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d, i) => (
                  <option key={d} value={i}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Room</label>
              <input value={form.room} onChange={set('room')} placeholder="e.g. Room 302" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Start Time *</label>
              <input value={form.startTime} onChange={set('startTime')} placeholder="09:00 AM" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>End Time *</label>
              <input value={form.endTime} onChange={set('endTime')} placeholder="10:00 AM" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Effective From</label>
              <input type="date" value={form.effectiveFrom} onChange={set('effectiveFrom')} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Effective To</label>
              <input type="date" value={form.effectiveTo} onChange={set('effectiveTo')} className={inputClass} />
            </div>
          </div>
        </div>
        <div className="p-5 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800">Cancel</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 bg-[#0b1320] text-white text-sm font-bold rounded-lg hover:bg-slate-800 shadow-sm disabled:opacity-50 flex items-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Add Slot
          </button>
        </div>
      </motion.div>
    </div>
  )
}

export default function TeacherSchedulePage() {
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()))
  const [schedules, setSchedules] = useState<any[]>([])
  const [specials, setSpecials] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showSpecialModal, setShowSpecialModal] = useState(false)
  const [showSlotModal, setShowSlotModal] = useState(false)

  const fetchAll = async () => {
    try {
      const [schedRes, specRes] = await Promise.all([
        fetch('/api/schedule?mine=true&activeOnly=true'),
        fetch('/api/special-classes?mine=true'),
      ])
      if (schedRes.ok) setSchedules(await schedRes.json())
      if (specRes.ok) setSpecials(await specRes.json())
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

  async function deleteSpecial(id: string) {
    if (!confirm('Delete this special class?')) return
    const res = await fetch(`/api/special-classes?id=${id}`, { method: 'DELETE' })
    if (res.ok) fetchAll()
  }

  async function deleteSlot(id: string) {
    if (!confirm('Remove this weekly slot from your timetable?')) return
    const res = await fetch(`/api/schedule?id=${id}`, { method: 'DELETE' })
    if (res.ok) fetchAll()
  }

  const todayStr = getLocalToday()

  // Days of the shown week (MON..SUN)
  const days = DAY_NAMES.map((name, i) => {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    const iso = dateStr(d)
    return { name, date: d.getDate(), iso, active: iso === todayStr }
  })

  // Build grid events: recurring slots + this week's special classes
  const events: any[] = []
  days.forEach((day, colIdx) => {
    const jsDay = (colIdx + 1) % 7 // MON=1 … SAT=6, SUN=0
    schedules.forEach(s => {
      if (s.dayOfWeek !== jsDay) return
      if (s.effectiveFrom && day.iso < s.effectiveFrom) return
      if (s.effectiveTo && day.iso > s.effectiveTo) return
      events.push({
        col: colIdx, start: parseHour(s.startTime), end: parseHour(s.endTime),
        title: s.subject, sub: s.batch, room: s.room, kind: 'regular', id: s._id,
      })
    })
    specials.forEach(sc => {
      if (sc.date !== day.iso) return
      events.push({
        col: colIdx, start: parseHour(sc.startTime), end: parseHour(sc.endTime),
        title: sc.title, sub: sc.batch || sc.subject || sc.type, room: sc.room, kind: 'special', type: sc.type, id: sc._id,
      })
    })
  })

  const upcomingSpecials = specials.filter(sc => sc.date >= todayStr)
  const weekLabel = `${formatDate(weekStart)} - ${days[6] ? formatDate(days[6].iso) : ''}`

  function shiftWeek(delta: number) {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + delta * 7)
    setWeekStart(d)
  }

  return (
    <div className="flex-1 p-8 overflow-auto bg-slate-50 min-h-screen">
      <AnimatePresence>
        {showSpecialModal && <SpecialClassModal onClose={() => setShowSpecialModal(false)} onSaved={fetchAll} />}
        {showSlotModal && <WeeklySlotModal onClose={() => setShowSlotModal(false)} onSaved={fetchAll} />}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Schedule</h1>
          <p className="text-[13px] text-slate-500 mt-1">Your weekly class timetable and special sessions</p>
        </div>
        <button onClick={() => setShowSlotModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors shadow-sm">
          <Repeat className="w-4 h-4" /> Add Weekly Slot
        </button>
      </div>

      {/* Calendar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-8">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => shiftWeek(-1)} className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-50"><ChevronLeft className="w-5 h-5" /></button>
            <span className="text-[13px] font-bold text-slate-900">{weekLabel}</span>
            <button onClick={() => shiftWeek(1)} className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-50"><ChevronRight className="w-5 h-5" /></button>
          </div>
          <button onClick={() => setWeekStart(getMonday(new Date()))}
            className="px-4 py-1.5 border border-slate-200 text-indigo-600 text-[13px] font-semibold rounded-md hover:bg-slate-50">
            Today
          </button>
        </div>

        <div className="grid grid-cols-8 border-b border-slate-100">
          <div className="col-span-1 p-4 flex flex-col items-center justify-center border-r border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">TIME</span>
          </div>
          {days.map(day => (
            <div key={day.name} className={`col-span-1 relative p-3 flex flex-col items-center justify-center border-r border-slate-100 last:border-0 ${day.active ? 'bg-indigo-50/50' : ''}`}>
              <span className={`text-[10px] font-bold tracking-widest mb-1 ${day.active ? 'text-indigo-600' : 'text-slate-400'}`}>{day.name}</span>
              <span className={`text-[15px] font-bold ${day.active ? 'text-indigo-700' : 'text-slate-900'}`}>{day.date}</span>
              {day.active && <div className="h-0.5 w-full bg-indigo-600 absolute bottom-0 left-0" />}
            </div>
          ))}
        </div>

        <div className="relative">
          {TIMES.map(time => (
            <div key={time} className="grid grid-cols-8 border-b border-slate-100 border-dashed last:border-0 h-24">
              <div className="col-span-1 flex justify-end pr-4 pt-2 border-r border-slate-100">
                <span className="text-[11px] font-semibold text-slate-500">{time}</span>
              </div>
              {[1, 2, 3, 4, 5, 6, 7].map(col => (
                <div key={col} className="col-span-1 border-r border-slate-100 border-dashed last:border-0" />
              ))}
            </div>
          ))}

          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/60 z-30">
              <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
            </div>
          )}

          <div className="absolute inset-0 pl-[12.5%] pointer-events-none">
            <div className="relative w-full h-full">
              {events.map((evt, idx) => {
                const start = Math.max(evt.start, GRID_START)
                const end = Math.min(Math.max(evt.end, start + 0.5), GRID_START + GRID_HOURS)
                if (start >= GRID_START + GRID_HOURS) return null
                const topPercent = ((start - GRID_START) / GRID_HOURS) * 100
                const heightPercent = ((end - start) / GRID_HOURS) * 100
                const leftPercent = (evt.col / 7) * 100
                const widthPercent = 100 / 7

                const isSpecial = evt.kind === 'special'
                return (
                  <div key={`${evt.id}-${idx}`}
                    className={`absolute p-2.5 rounded-lg shadow-sm pointer-events-auto cursor-pointer hover:shadow-md transition-all overflow-hidden ${
                      isSpecial ? 'bg-white border-2 border-dashed border-slate-200' : 'bg-[#eef2ff] border-l-4 border-l-[#312e81]'
                    }`}
                    style={{
                      top: `${Math.max(0, topPercent)}%`,
                      height: `calc(${heightPercent}% - 8px)`,
                      left: `calc(${leftPercent}% + 4px)`,
                      width: `calc(${widthPercent}% - 8px)`,
                      marginTop: '4px',
                    }}>
                    {isSpecial && (
                      <span className={`absolute top-2 right-2 px-1.5 py-0.5 text-[8px] font-black tracking-widest rounded uppercase ${TYPE_BADGE[evt.type] ?? 'bg-indigo-100 text-indigo-700'}`}>{evt.type}</span>
                    )}
                    <h4 className="text-[11px] font-bold text-slate-900 leading-tight mb-0.5 truncate pr-8">{evt.title}</h4>
                    <p className="text-[10px] text-slate-600 mb-2 truncate">{evt.sub}</p>
                    {evt.room && (
                      <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 mt-auto absolute bottom-2.5 left-2.5">
                        <MapPin className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{evt.room}</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* My Weekly Slots */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-8">
        <div className="p-5 border-b border-slate-100 flex items-center gap-3">
          <Repeat className="w-5 h-5 text-indigo-600" />
          <h2 className="text-base font-bold text-slate-900">My Weekly Slots</h2>
        </div>
        {schedules.length === 0 ? (
          <p className="p-6 text-sm text-slate-400 italic">No recurring slots yet — add your weekly timetable.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Day</th>
                <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Time</th>
                <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Subject / Batch</th>
                <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Room</th>
                <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Effective</th>
                <th className="px-6 py-3 text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {schedules.map(s => (
                <tr key={s._id} className="hover:bg-slate-50/50">
                  <td className="px-6 py-3.5 text-[13px] font-bold text-slate-900">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][s.dayOfWeek]}</td>
                  <td className="px-6 py-3.5 text-[12px] font-medium text-slate-600">{s.startTime} – {s.endTime}</td>
                  <td className="px-6 py-3.5">
                    <p className="text-[13px] font-bold text-slate-900">{s.subject}</p>
                    <p className="text-[12px] text-slate-500">{s.batch}</p>
                  </td>
                  <td className="px-6 py-3.5 text-[12px] text-slate-600">{s.room || '—'}</td>
                  <td className="px-6 py-3.5 text-[11px] text-slate-500">
                    {s.effectiveFrom || '∞'} → {s.effectiveTo || '∞'}
                  </td>
                  <td className="px-6 py-3.5 text-right">
                    <button onClick={() => deleteSlot(s._id)} className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Upcoming Special Classes */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CalendarIcon className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-900">Upcoming Special Classes</h2>
          </div>
          <button onClick={() => setShowSpecialModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0b1320] text-white text-[11px] font-bold rounded-lg hover:bg-slate-800 transition-all shadow-sm">
            <Plus className="w-3 h-3" /> Schedule Class
          </button>
        </div>
        {upcomingSpecials.length === 0 ? (
          <p className="p-6 text-sm text-slate-400 italic">No upcoming special classes.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Date & Time</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Type</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Title / Batch</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Notes</th>
                <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {upcomingSpecials.map(sc => (
                <tr key={sc._id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="text-[13px] font-bold text-slate-900">{fmtDateLabel(sc.date)}</p>
                    <p className="text-[12px] font-medium text-slate-500">{sc.startTime} - {sc.endTime}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full ${TYPE_BADGE[sc.type] ?? 'bg-slate-50 text-slate-600'}`}>{sc.type}</span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-[13px] font-bold text-slate-900">{sc.title}</p>
                    <p className="text-[12px] font-medium text-slate-500">{[sc.batch, sc.subject].filter(Boolean).join(' • ') || '—'}{sc.room ? ` • ${sc.room}` : ''}</p>
                  </td>
                  <td className="px-6 py-4 max-w-xs truncate text-[13px] text-slate-600">{sc.notes || '—'}</td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => deleteSpecial(sc._id)} className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
