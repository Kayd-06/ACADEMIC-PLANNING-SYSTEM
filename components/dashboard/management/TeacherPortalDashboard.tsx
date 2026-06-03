'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  Calendar, 
  BarChart3, 
  MessageSquare, 
  FileText, 
  Plus, 
  MoreHorizontal, 
  Loader2,
  Clock,
  MapPin,
  Upload,
  User,
  GraduationCap,
  Trash
} from 'lucide-react'

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, type: 'spring' as const, stiffness: 320, damping: 28 },
})

import LogEntryModal from './LogEntryModal'
import UploadMaterialModal from './UploadMaterialModal'
import ScheduleModal from './ScheduleModal'

export default function TeacherPortalDashboard() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isLogModalOpen, setIsLogModalOpen] = useState(false)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    const res = await fetch('/api/teacher-portal')
    const d = await res.json()
    if (!d.error) setData(d)
    setLoading(false)
  }

  async function handleDeleteSchedule(id: string) {
    if (!confirm('Are you sure you want to delete this schedule?')) return
    try {
      await fetch(`/api/teacher-portal/schedule?id=${id}`, { method: 'DELETE' })
      fetchData()
    } catch (err) {
      console.error(err)
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50/50">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex-1 p-8 overflow-auto bg-gray-50/50">
      <LogEntryModal 
        isOpen={isLogModalOpen} 
        onClose={() => setIsLogModalOpen(false)} 
        onSuccess={fetchData} 
      />
      <UploadMaterialModal 
        isOpen={isUploadModalOpen} 
        onClose={() => setIsUploadModalOpen(false)} 
        onSuccess={fetchData} 
      />
      <ScheduleModal 
        isOpen={isScheduleModalOpen} 
        onClose={() => setIsScheduleModalOpen(false)} 
        onSuccess={fetchData} 
      />
      
      {/* Header */}
      <motion.div {...fadeUp(0)} className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Teacher Dashboard</h1>
          <p className="text-gray-500 mt-1">Welcome back, Dr. Sarah Jenkins. Here is your academic overview.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2">
            <Calendar className="w-4 h-4" /> My Schedule
          </button>
          <button className="px-4 py-2 bg-[#0a192f] hover:bg-gray-800 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2">
            <BarChart3 className="w-4 h-4" /> My Results Compilation
          </button>
        </div>
      </motion.div>

      <div className="grid grid-cols-12 gap-6 mb-8">
        {/* Upcoming Schedule */}
        <motion.div {...fadeUp(0.05)} className="col-span-8 bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2 font-semibold text-gray-900">
              <Calendar className="w-5 h-5 text-indigo-500" />
              Upcoming Schedule
            </div>
            <div className="flex gap-4">
              <button onClick={() => setIsScheduleModalOpen(true)} className="text-sm font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                <Plus className="w-4 h-4" /> Add Schedule
              </button>
              <button className="text-sm font-medium text-gray-500 hover:text-gray-700">View Full</button>
            </div>
          </div>

          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-50">
                  <th className="pb-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Time</th>
                  <th className="pb-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Activity</th>
                  <th className="pb-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Batch/Location</th>
                  <th className="pb-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.schedule.map((row: any, i: number) => (
                  <tr key={i} className="group">
                    <td className="py-4 text-sm font-bold text-gray-900">{row.time}</td>
                    <td className="py-4 text-sm text-gray-600">{row.activity}</td>
                    <td className="py-4 text-sm text-gray-500">{row.batch} • {row.location}</td>
                    <td className="py-4">
                      <div className="flex items-center justify-between">
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          row.status === 'Upcoming' ? 'bg-indigo-50 text-indigo-600 flex items-center gap-1.5 w-fit' : 'bg-gray-50 text-gray-500'
                        }`}>
                          {row.status === 'Upcoming' && <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-pulse" />}
                          {row.status}
                        </span>
                        <button 
                          onClick={() => handleDeleteSchedule(row._id)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Student Counseling */}
        <motion.div {...fadeUp(0.1)} className="col-span-4 bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2 font-semibold text-gray-900">
              <User className="w-5 h-5 text-indigo-500" />
              Student Counseling
            </div>
            <button className="text-gray-400 hover:text-gray-600">
              <MoreHorizontal className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4 mb-6">
            {data.counseling.map((item: any, i: number) => (
              <div key={i} className="p-4 bg-gray-50/50 border border-gray-100 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-gray-900">{item.studentName}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    item.category === 'Attendance' ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'
                  }`}>{item.category}</span>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed truncate-2-lines">{item.description}</p>
              </div>
            ))}
          </div>

          <button 
            onClick={() => setIsLogModalOpen(true)}
            className="w-full py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" /> Log New Entry
          </button>
        </motion.div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Study Material */}
        <motion.div {...fadeUp(0.15)} className="col-span-7 bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2 font-semibold text-gray-900">
              <FileText className="w-5 h-5 text-indigo-500" />
              Study Material Repository
            </div>
            <button className="text-gray-400 hover:text-gray-600">
              <MoreHorizontal className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {data.materials.map((m: any, i: number) => (
              <div key={i} className="p-4 border border-gray-100 rounded-2xl flex items-center gap-4 hover:border-indigo-200 transition-colors cursor-pointer group">
                <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center text-sm font-bold text-gray-500 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                  {m.initials}
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">{m.provider}</p>
                  <p className="text-[11px] text-gray-400">{m.count} {m.type} • {m.subject}</p>
                </div>
              </div>
            ))}
            <button 
              onClick={() => setIsUploadModalOpen(true)}
              className="p-4 border border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-indigo-50/30 hover:border-indigo-200 transition-all group"
            >
              <Upload className="w-5 h-5 text-gray-400 group-hover:text-indigo-600" />
              <span className="text-xs font-bold text-gray-400 group-hover:text-indigo-600">Upload Resource</span>
            </button>
          </div>
        </motion.div>

        {/* Recent Feedback */}
        <motion.div {...fadeUp(0.2)} className="col-span-5 bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center gap-2 font-semibold text-gray-900 mb-6">
            <MessageSquare className="w-5 h-5 text-indigo-500" />
            Recent Feedback
          </div>

          <div className="space-y-6">
            {data.feedback.map((f: any, i: number) => (
              <div key={i} className="flex gap-4">
                <div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center ${
                  f.type === 'student' ? 'bg-indigo-50 text-indigo-600' : 'bg-orange-50 text-orange-600'
                }`}>
                  {f.type === 'student' ? <GraduationCap className="w-5 h-5" /> : <BarChart3 className="w-5 h-5" />}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-bold text-gray-900">{f.from}</span>
                    <span className="text-[10px] text-gray-400">{f.context}</span>
                  </div>
                  <p className="text-xs text-gray-500 italic leading-relaxed">{f.content}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Footer */}
      <footer className="mt-12 py-8 border-t border-gray-200 flex flex-col md:flex-row items-center justify-between gap-6 text-gray-400">
        <div className="flex items-center gap-4 text-xs">
          <span className="font-bold text-gray-900">EduAdmin Pro</span>
          <span>© 2024 EduAdmin Management System. Institutional Grade Security.</span>
        </div>
        <div className="flex items-center gap-6 text-xs font-medium">
          <button className="hover:text-indigo-600">Privacy Policy</button>
          <button className="hover:text-indigo-600">Terms of Service</button>
          <button className="hover:text-indigo-600">Accessibility</button>
          <button className="hover:text-indigo-600">Contact Support</button>
        </div>
      </footer>
    </div>
  )
}
