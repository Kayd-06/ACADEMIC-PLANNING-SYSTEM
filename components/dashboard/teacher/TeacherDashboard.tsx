'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { BookOpen, Users, Calendar, ClipboardList, ChevronRight, Plus, Filter, Building2, Megaphone, Bell } from 'lucide-react'

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, type: 'spring' as const, stiffness: 320, damping: 28 },
})

const scheduleRows = [
  { subject: 'Mathematics — Grade X', time: '09:00 AM', room: 'Room 204', students: 32, status: 'Upcoming' },
  { subject: 'Physics — Grade XI', time: '11:00 AM', room: 'Room 108', students: 28, status: 'Upcoming' },
  { subject: 'Mathematics — Grade IX', time: '02:00 PM', room: 'Room 204', students: 35, status: 'Scheduled' },
]

const STATUS_STYLES: Record<string, string> = {
  Upcoming: 'bg-blue-50 text-blue-700 border border-blue-100',
  Scheduled: 'bg-gray-100 text-gray-600 border border-gray-200',
}

export default function TeacherDashboard({ firstName }: { firstName: string }) {
  const [schoolData, setSchoolData] = useState<any>(null)
  const [announcements, setAnnouncements] = useState<any[]>([])

  useEffect(() => {
    fetch('/api/school')
      .then(res => res.json())
      .then(data => {
        if (!data.error) setSchoolData(data)
      })
    fetch('/api/announcements')
      .then(res => res.json())
      .then(data => {
        if (!data.error) setAnnouncements(data)
      })
  }, [])

  return (
    <div className="flex-1 p-6 overflow-auto">
      <motion.div {...fadeUp(0)} className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-400 mt-0.5">Welcome back, {firstName}. Here's your schedule for today.</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Class Note
        </motion.button>
      </motion.div>

      <div className="grid grid-cols-12 gap-4 mb-6">
        {/* Institutional Info Card — 8 cols */}
        <motion.div {...fadeUp(0.05)} className="col-span-8 bg-indigo-50/50 border border-indigo-100 rounded-xl p-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Institution Information</p>
              <p className="text-sm font-medium text-gray-900">{schoolData?.name || 'Academic Planning System'}</p>
            </div>
          </div>
          <div className="flex items-center gap-8">
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Board</p>
              <p className="text-xs font-medium text-gray-700">{schoolData?.board || '—'}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Active Classes</p>
              <p className="text-xs font-medium text-gray-700">{schoolData?.classes || '—'}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">MOU Status</p>
              <p className="text-xs font-medium text-green-700">{schoolData?.mouStatus || '—'}</p>
            </div>
          </div>
        </motion.div>

        {/* Announcements Card — 4 cols */}
        <motion.div {...fadeUp(0.08)} className="col-span-4 bg-white border border-gray-100 rounded-xl p-5 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Recent Announcements</p>
            <Megaphone className="w-3.5 h-3.5 text-gray-300" />
          </div>
          <div className="space-y-2.5">
            {announcements.length === 0 && <p className="text-[11px] text-gray-400 italic">No announcements.</p>}
            {announcements.slice(0, 2).map(a => (
              <div key={a._id} className="flex gap-2">
                <div className="mt-0.5 shrink-0">
                  {a.urgent 
                    ? <Bell className="w-3.5 h-3.5 text-red-500 animate-pulse" /> 
                    : <Megaphone className="w-3.5 h-3.5 text-indigo-400" />
                  }
                </div>
                <div>
                  <p className="text-[11px] font-medium text-gray-800 leading-tight">{a.label}</p>
                  <p className={`text-[10px] ${a.urgent ? 'text-red-500' : 'text-gray-400'}`}>{a.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        {[
          { icon: <BookOpen className="w-4 h-4" />, label: 'Courses', value: '—' },
          { icon: <Users className="w-4 h-4" />, label: 'Students', value: '—' },
          { icon: <Calendar className="w-4 h-4" />, label: 'Classes today', value: '3' },
          { icon: <ClipboardList className="w-4 h-4" />, label: 'Pending tasks', value: '—' },
        ].map((s, i) => (
          <motion.div key={s.label} {...fadeUp(i * 0.05)} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400">{s.icon}</span>
            </div>
            <p className="text-2xl font-semibold text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Today's schedule table */}
      <motion.div {...fadeUp(0.22)} className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <p className="text-sm font-medium text-gray-900">Today's Schedule</p>
          <div className="flex items-center gap-2">
            <button className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors">
              <Filter className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-50">
              {['Subject', 'Time', 'Room', 'Students', 'Status', ''].map(h => (
                <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {scheduleRows.map((row, i) => (
              <motion.tr
                key={row.subject}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.28 + i * 0.05 }}
                className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors"
              >
                <td className="px-5 py-3.5 text-sm font-medium text-gray-800">{row.subject}</td>
                <td className="px-5 py-3.5 text-sm text-gray-500">{row.time}</td>
                <td className="px-5 py-3.5 text-sm text-gray-500">{row.room}</td>
                <td className="px-5 py-3.5 text-sm text-gray-500">{row.students}</td>
                <td className="px-5 py-3.5">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_STYLES[row.status]}`}>
                    {row.status}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <button className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </motion.div>
    </div>
  )
}
