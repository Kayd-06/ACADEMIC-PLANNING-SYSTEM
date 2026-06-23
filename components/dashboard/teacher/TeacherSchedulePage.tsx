'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, MapPin, Plus, MoreVertical, X } from 'lucide-react'

// --- Mock Data ---
const MOCK_EVENTS = [
  { day: 'MON', startHour: 8, duration: 2, title: 'Physics 101', batch: 'Batch A - Year 1', room: 'Room 302', type: 'regular', colorTheme: 'blue' },
  { day: 'TUE', startHour: 9, duration: 2, title: 'Chemistry ...', batch: 'Batch C - Yea...', room: 'Lab 2', type: 'regular', colorTheme: 'purple' },
  { day: 'WED', startHour: 10, duration: 1, title: 'Calcul...', batch: 'Doubt Clearing', room: 'Library Rm B', type: 'extra', colorTheme: 'dashed' },
  { day: 'THU', startHour: 8, duration: 2, title: 'Linear Alge...', batch: 'Batch B - Year 2', room: 'Room 105', type: 'regular', colorTheme: 'blue' },
  { day: 'FRI', startHour: 11, duration: 2, title: 'Physics 101', batch: 'Batch B - Year 1', room: 'Room 304', type: 'regular', colorTheme: 'blue' },
]

const SPECIAL_CLASSES = [
  { date: 'Oct 18, Wed', time: '10:00 AM - 11:00 AM', type: 'Doubt', typeTheme: 'blue', batch: 'Calculus III', sub: 'Open to all Year 2', notes: 'Focus on partial derivatives and multiple ...' },
  { date: 'Oct 20, Fri', time: '02:00 PM - 04:00 PM', type: 'Revision', typeTheme: 'yellow', batch: 'Physics 101', sub: 'Batch A & B', notes: 'Mid-term preparation session.' },
  { date: 'Oct 24, Tue', time: '08:00 AM - 09:30 AM', type: 'Makeup', typeTheme: 'purple', batch: 'Chemistry Adv', sub: 'Batch C', notes: 'Covering missed lab from Oct 10th.' },
]

const DAYS = [
  { name: 'MON', date: '16' },
  { name: 'TUE', date: '17' },
  { name: 'WED', date: '18', active: true },
  { name: 'THU', date: '19' },
  { name: 'FRI', date: '20' },
  { name: 'SAT', date: '21' },
  { name: 'SUN', date: '22' }
]

const TIMES = ['08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '01:00 PM']

function getLocalToday() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().split('T')[0]
}

// --- Schedule Modal Component ---
function ScheduleModal({ isOpen, onClose, onSave, initialData }: any) {
  const [formData, setFormData] = useState({
    date: getLocalToday(),
    time: '09:00 AM',
    activity: '',
    batch: '',
    location: '',
    status: 'Upcoming'
  })

  useEffect(() => {
    if (initialData) setFormData(initialData)
    else setFormData({
      date: getLocalToday(),
      time: '09:00 AM',
      activity: '',
      batch: '',
      location: '',
      status: 'Upcoming'
    })
  }, [initialData, isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
      >
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">{initialData ? 'Edit Schedule' : 'Schedule Class'}</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Date</label>
              <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Time</label>
              <input type="time" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Activity</label>
            <input type="text" placeholder="e.g. Physics Mid-Term" value={formData.activity} onChange={e => setFormData({...formData, activity: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Batch / Class</label>
            <input type="text" placeholder="e.g. Batch A1" value={formData.batch} onChange={e => setFormData({...formData, batch: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Location</label>
              <input type="text" placeholder="e.g. Hall B" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Status</label>
              <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                <option value="Upcoming">Upcoming</option>
                <option value="Pending">Pending</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
          </div>
        </div>
        <div className="p-5 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 transition-colors">Cancel</button>
          <button onClick={() => onSave(formData)} className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm">
            {initialData ? 'Save Changes' : 'Schedule Class'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// --- Main Page Component ---
export default function TeacherSchedulePage() {
  const [viewMode, setViewMode] = useState('Week')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [schedules, setSchedules] = useState<any[]>([])

  const fetchSchedules = async () => {
    try {
      const res = await fetch('/api/teacher-portal/schedule')
      const data = await res.json()
      if (!data.error) setSchedules(data)
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    fetchSchedules()
  }, [])

  const handleSave = async (data: any) => {
    try {
      await fetch('/api/teacher-portal/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      fetchSchedules()
      setIsModalOpen(false)
    } catch (err) {
      console.error(err)
    }
  }

  // Combine Mock Events with fetched schedules to show on the grid
  const allEvents = [...MOCK_EVENTS]
  schedules.forEach((sch) => {
    const d = new Date(sch.date)
    const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
    const day = dayNames[d.getDay()]
    if (!day) return
    
    // Extract hour from e.g. "09:00 AM" or "14:00"
    let hour = 9 // default
    if (sch.time) {
      const [timeStr, period] = sch.time.split(' ')
      let parsedHour = parseInt(timeStr.split(':')[0])
      if (period === 'PM' && parsedHour !== 12) parsedHour += 12
      if (period === 'AM' && parsedHour === 12) parsedHour = 0
      hour = parsedHour
    }

    allEvents.push({
      day: day,
      startHour: hour,
      duration: 1, // Default duration 1 hr
      title: sch.activity,
      batch: sch.batch,
      room: sch.location,
      type: 'regular',
      colorTheme: 'blue'
    })
  })

  return (
    <div className="flex-1 p-8 overflow-auto bg-slate-50 min-h-screen">
      
      <AnimatePresence>
        {isModalOpen && (
          <ScheduleModal 
            isOpen={isModalOpen} 
            onClose={() => setIsModalOpen(false)} 
            onSave={handleSave} 
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Schedule</h1>
          <p className="text-[13px] text-slate-500 mt-1">
            Your weekly class timetable and special sessions
          </p>
        </div>
        <div className="flex bg-white rounded-lg border border-slate-200 p-1 shadow-sm">
          {['Week', 'Day'].map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-6 py-1.5 text-sm font-semibold rounded-md transition-all ${
                viewMode === mode ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar Area */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-8">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-50 transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-[13px] font-bold text-slate-900">Oct 16 - Oct 22, 2023</span>
            <button className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-50 transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <button className="px-4 py-1.5 border border-slate-200 text-indigo-600 text-[13px] font-semibold rounded-md hover:bg-slate-50 transition-colors">
            Today
          </button>
        </div>

        <div className="grid grid-cols-8 border-b border-slate-100">
          <div className="col-span-1 p-4 flex flex-col items-center justify-center border-r border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">TIME</span>
          </div>
          {DAYS.map((day) => (
            <div key={day.name} className={`col-span-1 relative p-3 flex flex-col items-center justify-center border-r border-slate-100 last:border-0 ${day.active ? 'bg-indigo-50/50' : ''}`}>
              <span className={`text-[10px] font-bold tracking-widest mb-1 ${day.active ? 'text-indigo-600' : 'text-slate-400'}`}>{day.name}</span>
              <span className={`text-[15px] font-bold ${day.active ? 'text-indigo-700' : 'text-slate-900'}`}>{day.date}</span>
              {day.active && <div className="h-0.5 w-full bg-indigo-600 absolute bottom-0 left-0" />}
            </div>
          ))}
        </div>

        <div className="relative">
          {TIMES.map((time, idx) => (
            <div key={time} className="grid grid-cols-8 border-b border-slate-100 border-dashed last:border-0 h-24">
              <div className="col-span-1 flex justify-end pr-4 pt-2 border-r border-slate-100">
                <span className="text-[11px] font-semibold text-slate-500">{time}</span>
              </div>
              {[1, 2, 3, 4, 5, 6, 7].map((col) => (
                <div key={col} className={`col-span-1 border-r border-slate-100 border-dashed last:border-0 ${col === 3 ? 'bg-indigo-50/10' : ''}`} />
              ))}
            </div>
          ))}

          <div className="absolute top-[40%] left-0 right-0 z-20 pointer-events-none">
            <div className="w-full h-px bg-red-500 flex items-center">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 -ml-[3px]" />
            </div>
          </div>

          <div className="absolute inset-0 pl-[12.5%] pointer-events-none">
            <div className="relative w-full h-full">
              {allEvents.map((evt, idx) => {
                const dayIndex = DAYS.findIndex(d => d.name === evt.day)
                if (dayIndex === -1) return null
                
                const topPercent = ((evt.startHour - 8) / 6) * 100
                const heightPercent = (evt.duration / 6) * 100
                const leftPercent = (dayIndex / 7) * 100
                const widthPercent = 100 / 7

                let bgClass = ''
                let borderClass = ''
                if (evt.colorTheme === 'blue') {
                  bgClass = 'bg-[#eef2ff]'
                  borderClass = 'border-l-4 border-l-[#312e81]'
                } else if (evt.colorTheme === 'purple') {
                  bgClass = 'bg-[#f3e8ff]'
                  borderClass = 'border-l-4 border-l-[#6b21a8]'
                } else if (evt.colorTheme === 'dashed') {
                  bgClass = 'bg-white border-2 border-dashed border-[#e2e8f0]'
                  borderClass = ''
                }

                return (
                  <div 
                    key={idx}
                    className={`absolute p-2.5 rounded-lg shadow-sm pointer-events-auto cursor-pointer hover:shadow-md transition-all overflow-hidden ${bgClass} ${borderClass}`}
                    style={{
                      top: `${Math.max(0, topPercent)}%`,
                      height: `calc(${heightPercent}% - 8px)`,
                      left: `calc(${leftPercent}% + 4px)`,
                      width: `calc(${widthPercent}% - 8px)`,
                      marginTop: '4px'
                    }}
                  >
                    {evt.type === 'extra' && (
                      <span className="absolute top-2 right-2 px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-[8px] font-black tracking-widest rounded uppercase">Extra</span>
                    )}
                    <h4 className="text-[11px] font-bold text-slate-900 leading-tight mb-0.5 truncate pr-8">{evt.title}</h4>
                    <p className="text-[10px] text-slate-600 mb-2 truncate">{evt.batch}</p>
                    <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 mt-auto absolute bottom-2.5 left-2.5">
                      <MapPin className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{evt.room}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Upcoming Classes Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CalendarIcon className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-900">Upcoming Classes</h2>
          </div>
          <button className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition-colors">
            View All
          </button>
        </div>
        
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50/50">
              <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Date & Time</th>
              <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Type</th>
              <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Batch / Subject</th>
              <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Notes</th>
              <th className="px-6 py-4 text-right">
                <button 
                  onClick={() => setIsModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0b1320] text-white text-[11px] font-bold rounded-lg hover:bg-slate-800 transition-all shadow-sm"
                >
                  <Plus className="w-3 h-3" /> Schedule Class
                </button>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {SPECIAL_CLASSES.map((sc, idx) => (
              <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4">
                  <p className="text-[13px] font-bold text-slate-900">{sc.date}</p>
                  <p className="text-[12px] font-medium text-slate-500">{sc.time}</p>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full ${
                    sc.typeTheme === 'blue' ? 'bg-indigo-50 text-indigo-700' :
                    sc.typeTheme === 'yellow' ? 'bg-amber-50 text-amber-700' :
                    'bg-purple-50 text-purple-700'
                  }`}>
                    {sc.type}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <p className="text-[13px] font-bold text-slate-900">{sc.batch}</p>
                  <p className="text-[12px] font-medium text-slate-500">{sc.sub}</p>
                </td>
                <td className="px-6 py-4 max-w-xs truncate text-[13px] text-slate-600">
                  {sc.notes}
                </td>
                <td className="px-6 py-4 text-right">
                  <button className="p-1.5 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-100 transition-colors">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  )
}


