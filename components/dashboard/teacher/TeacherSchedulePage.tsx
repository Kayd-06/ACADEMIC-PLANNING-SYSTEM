'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Calendar as CalendarIcon, Clock, MapPin, X, ChevronRight, Trash2, Edit2, AlertCircle, Users } from 'lucide-react'

const STATUS_STYLES: Record<string, string> = {
  Upcoming: 'bg-blue-50 text-blue-700 border-blue-200',
  Pending: 'bg-amber-50 text-amber-700 border-amber-200',
  Completed: 'bg-gray-50 text-gray-700 border-gray-200',
}

function getLocalToday() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().split('T')[0]
}

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
          <h2 className="text-lg font-bold text-slate-900">{initialData ? 'Edit Schedule' : 'Add New Schedule'}</h2>
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
            {initialData ? 'Save Changes' : 'Create Schedule'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

export default function TeacherSchedulePage() {
  const [schedules, setSchedules] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<any>(null)

  const fetchSchedules = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/teacher-portal/schedule')
      const data = await res.json()
      if (!data.error) setSchedules(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSchedules()
  }, [])

  const handleSave = async (data: any) => {
    try {
      if (editingSchedule) {
        await fetch(`/api/teacher-portal/schedule?id=${editingSchedule._id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        })
      } else {
        await fetch('/api/teacher-portal/schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        })
      }
      fetchSchedules()
      setIsModalOpen(false)
      setEditingSchedule(null)
    } catch (err) {
      console.error(err)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this schedule?')) return
    try {
      await fetch(`/api/teacher-portal/schedule?id=${id}`, { method: 'DELETE' })
      fetchSchedules()
    } catch (err) {
      console.error(err)
    }
  }

  // Group schedules by date
  const grouped = schedules.reduce((acc: any, curr: any) => {
    if (!acc[curr.date]) acc[curr.date] = []
    acc[curr.date].push(curr)
    return acc
  }, {})

  const sortedDates = Object.keys(grouped).sort((a, b) => new Date(a).getTime() - new Date(b).getTime())

  return (
    <div className="flex-1 p-6 overflow-auto bg-slate-50 min-h-screen">
      <AnimatePresence>
        {isModalOpen && (
          <ScheduleModal 
            isOpen={isModalOpen} 
            onClose={() => { setIsModalOpen(false); setEditingSchedule(null); }} 
            onSave={handleSave} 
            initialData={editingSchedule} 
          />
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Schedule</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your upcoming classes, sessions, and duties.</p>
        </div>
        <button 
          onClick={() => { setEditingSchedule(null); setIsModalOpen(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#0f172a] hover:bg-slate-800 text-white rounded-lg text-sm font-semibold transition-all shadow-sm hover:shadow"
        >
          <Plus className="w-4 h-4" /> Add Schedule
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12 text-slate-400">Loading schedules...</div>
      ) : sortedDates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <CalendarIcon className="w-12 h-12 mb-4 text-slate-300" />
          <p className="text-lg font-medium text-slate-600">No schedules found</p>
          <p className="text-sm mb-6 text-slate-500">You have no upcoming classes or sessions scheduled.</p>
          <button 
            onClick={() => { setEditingSchedule(null); setIsModalOpen(true); }}
            className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg text-sm font-semibold"
          >
            Create your first schedule
          </button>
        </div>
      ) : (
        <div className="max-w-4xl space-y-8">
          {sortedDates.map((dateStr, dIndex) => {
            const dateObj = new Date(dateStr)
            const isToday = dateStr === getLocalToday()
            const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' })
            const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
            
            return (
              <motion.div 
                key={dateStr}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: dIndex * 0.1 }}
                className="relative pl-8"
              >
                {/* Timeline Line */}
                <div className="absolute left-[11px] top-8 bottom-[-32px] w-0.5 bg-slate-200 last:hidden" />
                
                {/* Date Header */}
                <div className="relative flex items-center gap-4 mb-4">
                  <div className={`absolute left-[-32px] w-6 h-6 rounded-full border-4 border-slate-50 flex items-center justify-center ${isToday ? 'bg-indigo-500' : 'bg-slate-300'}`}>
                    <div className="w-2 h-2 rounded-full bg-white" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    {dayName} 
                    <span className="text-sm font-medium text-slate-500">· {formattedDate}</span>
                    {isToday && <span className="px-2 py-0.5 ml-2 bg-indigo-50 text-indigo-700 text-[10px] font-bold uppercase tracking-wider rounded border border-indigo-100">Today</span>}
                  </h3>
                </div>

                {/* Cards for this date */}
                <div className="space-y-3">
                  {grouped[dateStr].map((schedule: any) => (
                    <div key={schedule._id} className="group bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow transition-shadow flex items-center justify-between">
                      <div className="flex items-center gap-5">
                        <div className="flex flex-col items-center justify-center min-w-[80px] pr-5 border-r border-slate-100">
                          <span className="text-sm font-bold text-slate-900">{schedule.time.split(' ')[0]}</span>
                          <span className="text-xs font-semibold text-slate-500">{schedule.time.split(' ')[1] || ''}</span>
                        </div>
                        <div>
                          <h4 className="text-base font-bold text-slate-900">{schedule.activity}</h4>
                          <div className="flex items-center gap-4 mt-1.5">
                            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500"><Users className="w-3.5 h-3.5"/> {schedule.batch}</span>
                            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500"><MapPin className="w-3.5 h-3.5"/> {schedule.location}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full border ${STATUS_STYLES[schedule.status] || STATUS_STYLES.Pending}`}>
                          {schedule.status}
                        </span>
                        
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setEditingSchedule(schedule); setIsModalOpen(true); }} className="p-1.5 text-slate-400 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 rounded-lg transition-colors">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(schedule._id)} className="p-1.5 text-slate-400 hover:text-red-600 bg-slate-50 hover:bg-red-50 rounded-lg transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
