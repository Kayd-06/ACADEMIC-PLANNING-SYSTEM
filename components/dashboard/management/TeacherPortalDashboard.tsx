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
  Trash,
  Edit2,
  ArrowLeft
} from 'lucide-react'

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, type: 'spring' as const, stiffness: 320, damping: 28 },
})

import LogEntryModal from './LogEntryModal'
import UploadMaterialModal from './UploadMaterialModal'
import ScheduleModal from './ScheduleModal'
import StudentReportUpload from '../teacher/StudentReportUpload'

function getLocalToday() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().split('T')[0]
}

function formatDateHeading(dateStr: string) {
  try {
    const dateObj = new Date(dateStr.replace(/-/g, '/'))
    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' })
    const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    return { dayName, formattedDate }
  } catch (err) {
    return { dayName: '', formattedDate: dateStr }
  }
}

export default function TeacherPortalDashboard({ teacherName }: { teacherName: string }) {
  const [view, setView] = useState<'dashboard' | 'schedule' | 'results'>('dashboard')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Modals
  const [isLogModalOpen, setIsLogModalOpen] = useState(false)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false)
  
  // Dropdown States
  const [counselingMenuOpen, setCounselingMenuOpen] = useState(false)
  const [materialsMenuOpen, setMaterialsMenuOpen] = useState(false)
  
  // Schedule View States
  const [allSchedules, setAllSchedules] = useState<any[]>([])
  const [loadingAllSchedules, setLoadingAllSchedules] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<any>(null)

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    function handleClickOutside() {
      setCounselingMenuOpen(false)
      setMaterialsMenuOpen(false)
    }
    window.addEventListener('click', handleClickOutside)
    return () => window.removeEventListener('click', handleClickOutside)
  }, [])

  async function fetchData() {
    try {
      const res = await fetch('/api/teacher-portal')
      const d = await res.json()
      if (d.error) {
        setError(d.error)
      } else {
        setData(d)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function fetchAllSchedules() {
    setLoadingAllSchedules(true)
    try {
      const res = await fetch('/api/teacher-portal/schedule')
      const d = await res.json()
      if (!d.error) {
        setAllSchedules(d)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingAllSchedules(false)
    }
  }

  function handleSetView(newView: 'dashboard' | 'schedule' | 'results') {
    setView(newView)
    if (newView === 'schedule') {
      fetchAllSchedules()
    }
  }

  function handleScheduleSuccess() {
    fetchData()
    if (view === 'schedule') {
      fetchAllSchedules()
    }
  }

  async function handleDeleteSchedule(id: string) {
    if (!confirm('Are you sure you want to delete this schedule?')) return
    try {
      await fetch(`/api/teacher-portal/schedule?id=${id}`, { method: 'DELETE' })
      handleScheduleSuccess()
    } catch (err) {
      console.error(err)
    }
  }

  async function handleDeleteCounseling(id: string) {
    if (!confirm('Are you sure you want to delete this counseling log?')) return
    try {
      const res = await fetch(`/api/teacher-portal/counseling?id=${id}`, { method: 'DELETE' })
      if (res.ok) fetchData()
    } catch (err) {
      console.error(err)
    }
  }

  async function handleDeleteMaterial(id: string) {
    if (!confirm('Are you sure you want to delete this study material?')) return
    try {
      const res = await fetch(`/api/teacher-portal/materials?id=${id}`, { method: 'DELETE' })
      if (res.ok) fetchData()
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

  if (error || !data) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50/50 p-8">
        <div className="bg-red-50 text-red-600 p-6 rounded-2xl max-w-lg border border-red-100 text-center">
          <h3 className="font-bold text-lg mb-2">Failed to load dashboard</h3>
          <p className="text-sm opacity-80">{error || 'Unknown error occurred.'}</p>
          <button onClick={fetchData} className="mt-4 px-4 py-2 bg-red-100 hover:bg-red-200 rounded-lg text-sm font-semibold transition-colors">
            Try Again
          </button>
        </div>
      </div>
    )
  }

  // Group schedules by date for the schedule tab
  const groupedSchedules = allSchedules.reduce((acc: any, curr: any) => {
    if (!acc[curr.date]) acc[curr.date] = []
    acc[curr.date].push(curr)
    return acc
  }, {})

  const sortedDates = Object.keys(groupedSchedules).sort((a, b) => new Date(a.replace(/-/g, '/')).getTime() - new Date(b.replace(/-/g, '/')).getTime())

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
        onClose={() => { setIsScheduleModalOpen(false); setEditingSchedule(null); }} 
        onSuccess={handleScheduleSuccess} 
        initialData={editingSchedule}
      />
      
      {view !== 'dashboard' && (
        <motion.div {...fadeUp(0)} className="mb-6">
          <button 
            onClick={() => setView('dashboard')}
            className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-white border border-gray-200 px-3 py-1.5 rounded-lg shadow-sm hover:shadow transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
          </button>
        </motion.div>
      )}

      {view === 'dashboard' && (
        <>
          {/* Header */}
          <motion.div {...fadeUp(0)} className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Teacher Dashboard</h1>
              <p className="text-gray-500 mt-1">Welcome back, {teacherName}. Here is your academic overview.</p>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => handleSetView('schedule')}
                className="px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg text-sm font-semibold transition-all shadow-sm flex items-center gap-2"
              >
                <Calendar className="w-4 h-4 text-indigo-600" /> My Schedule
              </button>
              <button 
                onClick={() => handleSetView('results')}
                className="px-4 py-2 bg-[#002045] hover:bg-[#1a365d] text-white rounded-lg text-sm font-semibold transition-all shadow-sm flex items-center gap-2"
              >
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
                  <button onClick={() => { setEditingSchedule(null); setIsScheduleModalOpen(true); }} className="text-sm font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                    <Plus className="w-4 h-4" /> Add Schedule
                  </button>
                  <button onClick={() => handleSetView('schedule')} className="text-sm font-medium text-gray-500 hover:text-gray-700">View Full</button>
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
                    {data.schedule.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-sm text-gray-400 italic">No schedule items today</td>
                      </tr>
                    )}
                    {data.schedule.map((row: any, i: number) => (
                      <tr key={i} className="group">
                        <td className="py-4 text-sm font-bold text-gray-900">{row.time}</td>
                        <td className="py-4 text-sm text-gray-600">{row.activity}</td>
                        <td className="py-4 text-sm text-gray-500">{row.batch} • {row.location}</td>
                        <td className="py-4">
                          <div className="flex items-center justify-between gap-2">
                            <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                              row.status === 'Upcoming' ? 'bg-indigo-50 text-indigo-600 flex items-center gap-1.5 w-fit' : 
                              row.status === 'Pending' ? 'bg-amber-50 text-amber-700' :
                              'bg-emerald-50 text-emerald-700'
                            }`}>
                              {row.status === 'Upcoming' && <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-pulse" />}
                              {row.status}
                            </span>
                            <div className="flex items-center gap-1 opacity-50 group-hover:opacity-100 transition-all">
                              <button 
                                onClick={() => { setEditingSchedule(row); setIsScheduleModalOpen(true); }}
                                className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button 
                                onClick={() => handleDeleteSchedule(row._id)}
                                className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                              >
                                <Trash className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>

            {/* Student Counseling */}
            <motion.div {...fadeUp(0.1)} className="col-span-4 bg-white rounded-2xl border border-gray-200 shadow-sm p-6 relative">
              <div className="flex items-center justify-between mb-6 relative">
                <div className="flex items-center gap-2 font-semibold text-gray-900">
                  <User className="w-5 h-5 text-indigo-500" />
                  Student Counseling
                </div>
                <div className="relative">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation()
                      setCounselingMenuOpen(!counselingMenuOpen)
                      setMaterialsMenuOpen(false)
                    }}
                    className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    <MoreHorizontal className="w-5 h-5" />
                  </button>
                  {counselingMenuOpen && (
                    <div className="absolute right-0 mt-1 w-44 bg-white border border-gray-200 rounded-xl shadow-lg py-1.5 z-[100] origin-top-right">
                      <button 
                        onClick={() => {
                          setIsLogModalOpen(true)
                          setCounselingMenuOpen(false)
                        }}
                        className="w-full text-left px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors flex items-center gap-2"
                      >
                        <Plus className="w-3.5 h-3.5" /> Log New Entry
                      </button>
                      <button 
                        onClick={async () => {
                          setCounselingMenuOpen(false)
                          setLoading(true)
                          await fetchData()
                        }}
                        className="w-full text-left px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors flex items-center gap-2"
                      >
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Refresh Records
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4 mb-6">
                {data.counseling.length === 0 && (
                  <p className="text-sm text-gray-400 italic text-center py-6">No counseling records</p>
                )}
                {data.counseling.map((item: any, i: number) => (
                  <div key={i} className="group/item relative p-4 bg-gray-50/50 border border-gray-100 rounded-xl hover:border-red-100 hover:bg-red-50/5 transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-gray-900">{item.studentName}</span>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          item.category === 'Attendance' ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'
                        }`}>{item.category}</span>
                        <button
                          onClick={() => handleDeleteCounseling(item._id)}
                          className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                        >
                          <Trash className="w-3.5 h-3.5" />
                        </button>
                      </div>
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
            <motion.div {...fadeUp(0.15)} className="col-span-7 bg-white rounded-2xl border border-gray-200 shadow-sm p-6 relative">
              <div className="flex items-center justify-between mb-6 relative">
                <div className="flex items-center gap-2 font-semibold text-gray-900">
                  <FileText className="w-5 h-5 text-indigo-500" />
                  Study Material Repository
                </div>
                <div className="relative">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation()
                      setMaterialsMenuOpen(!materialsMenuOpen)
                      setCounselingMenuOpen(false)
                    }}
                    className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    <MoreHorizontal className="w-5 h-5" />
                  </button>
                  {materialsMenuOpen && (
                    <div className="absolute right-0 mt-1 w-44 bg-white border border-gray-200 rounded-xl shadow-lg py-1.5 z-[100] origin-top-right">
                      <button 
                        onClick={() => {
                          setIsUploadModalOpen(true)
                          setMaterialsMenuOpen(false)
                        }}
                        className="w-full text-left px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors flex items-center gap-2"
                      >
                        <Upload className="w-3.5 h-3.5" /> Upload Resource
                      </button>
                      <button 
                        onClick={async () => {
                          setMaterialsMenuOpen(false)
                          setLoading(true)
                          await fetchData()
                        }}
                        className="w-full text-left px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors flex items-center gap-2"
                      >
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Refresh Repository
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {data.materials.map((m: any, i: number) => (
                  <div key={i} className="p-4 border border-gray-100 rounded-2xl flex items-center justify-between hover:border-indigo-200 transition-colors group/mat relative">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center text-sm font-bold text-gray-500 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                        {m.initials}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">{m.provider}</p>
                        <p className="text-[11px] text-gray-400">{m.count} {m.type} • {m.subject}</p>
                        {m.fileName && (
                          m.fileUrl ? (
                            <a href={m.fileUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-indigo-500 hover:text-indigo-600 font-medium flex items-center gap-1 mt-1 hover:underline w-fit">
                              <FileText className="w-3 h-3" /> {m.fileName} {m.fileSize && `(${m.fileSize})`}
                            </a>
                          ) : (
                            <p className="text-[10px] text-indigo-500 font-medium flex items-center gap-1 mt-1">
                              <FileText className="w-3 h-3" /> {m.fileName} {m.fileSize && `(${m.fileSize})`}
                            </p>
                          )
                        )}
                      </div>
                    </div>
                    <button 
                      onClick={() => handleDeleteMaterial(m._id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button 
                  onClick={() => setIsUploadModalOpen(true)}
                  className="p-4 border border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-indigo-50/30 hover:border-indigo-200 transition-all group min-h-[82px]"
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
        </>
      )}

      {view === 'schedule' && (
        <motion.div {...fadeUp(0)} className="max-w-4xl">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Schedule Management</h1>
              <p className="text-sm text-gray-500 mt-1">Manage and organize all upcoming classes, supervision shifts, and reviews.</p>
            </div>
            <button 
              onClick={() => { setEditingSchedule(null); setIsScheduleModalOpen(true); }}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#002045] hover:bg-[#1a365d] text-white rounded-xl text-sm font-semibold transition-all shadow-sm hover:shadow"
            >
              <Plus className="w-4 h-4" /> Add Schedule
            </button>
          </div>

          {loadingAllSchedules ? (
            <div className="flex items-center justify-center py-20 text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-600 mr-2" /> Loading all schedules...
            </div>
          ) : sortedDates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
              <Calendar className="w-12 h-12 text-gray-300 mb-4" />
              <p className="text-lg font-bold text-gray-800">No Schedule Found</p>
              <p className="text-sm text-gray-400 max-w-sm mt-1 mb-6">Create a schedule to help teachers stay organized and track their classes.</p>
              <button 
                onClick={() => { setEditingSchedule(null); setIsScheduleModalOpen(true); }}
                className="px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-bold text-sm rounded-xl transition-all"
              >
                Create First Entry
              </button>
            </div>
          ) : (
            <div className="space-y-8 pl-4 border-l border-gray-200 ml-4">
              {sortedDates.map((dateStr, dIdx) => {
                const { dayName, formattedDate } = formatDateHeading(dateStr)
                const isToday = dateStr === getLocalToday()
                return (
                  <div key={dateStr} className="relative">
                    {/* Dot on line */}
                    <div className={`absolute -left-[25px] top-1.5 w-4.5 h-4.5 rounded-full border-4 border-gray-50 flex items-center justify-center ${isToday ? 'bg-indigo-600' : 'bg-gray-300'}`}>
                      <div className="w-1.5 h-1.5 bg-white rounded-full" />
                    </div>

                    <h3 className="text-base font-bold text-gray-800 flex items-center gap-2 mb-4">
                      {dayName}
                      <span className="text-xs font-semibold text-gray-400">· {formattedDate}</span>
                      {isToday && (
                        <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-600 text-[10px] font-bold uppercase tracking-wider rounded-md">Today</span>
                      )}
                    </h3>

                    <div className="space-y-3">
                      {groupedSchedules[dateStr].map((schedule: any) => (
                        <div key={schedule._id} className="group bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex items-center justify-between">
                          <div className="flex items-center gap-5">
                            <div className="flex flex-col items-center justify-center min-w-[80px] pr-5 border-r border-gray-100">
                              <span className="text-sm font-bold text-gray-900">{schedule.time.split(' ')[0]}</span>
                              <span className="text-xs font-semibold text-gray-500">{schedule.time.split(' ')[1] || ''}</span>
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-gray-900">{schedule.activity}</h4>
                              <div className="flex items-center gap-4 mt-2">
                                <span className="flex items-center gap-1 text-xs font-semibold text-gray-500"><User className="w-3.5 h-3.5 text-gray-400"/> {schedule.batch}</span>
                                <span className="flex items-center gap-1 text-xs font-semibold text-gray-500"><MapPin className="w-3.5 h-3.5 text-gray-400"/> {schedule.location}</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4">
                            <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full border ${
                              schedule.status === 'Upcoming' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                              schedule.status === 'Pending' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                              'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}>
                              {schedule.status}
                            </span>
                            
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => { setEditingSchedule(schedule); setIsScheduleModalOpen(true); }}
                                className="p-1.5 text-gray-400 hover:text-indigo-600 bg-gray-50 hover:bg-indigo-50 rounded-lg transition-colors"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleDeleteSchedule(schedule._id)}
                                className="p-1.5 text-gray-400 hover:text-red-600 bg-gray-50 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                <Trash className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </motion.div>
      )}

      {view === 'results' && (
        <motion.div {...fadeUp(0)}>
          <StudentReportUpload firstName={teacherName} />
        </motion.div>
      )}

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
