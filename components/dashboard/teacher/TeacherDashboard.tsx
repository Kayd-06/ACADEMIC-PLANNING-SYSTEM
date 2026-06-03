'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { BookOpen, Users, Calendar, ClipboardList, ChevronRight, Plus, Filter, Building2, ShieldCheck, CheckCircle2, AlertTriangle, Clock } from 'lucide-react'

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, type: 'spring' as const, stiffness: 320, damping: 28 },
})

const STATUS_STYLES: Record<string, string> = {
  Upcoming: 'bg-blue-50 text-blue-700 border-blue-200',
  Scheduled: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Pending: 'bg-amber-50 text-amber-700 border-amber-200',
  Completed: 'bg-gray-50 text-gray-700 border-gray-200',
}

export default function TeacherDashboard({ firstName }: { firstName: string }) {
  const [schoolData, setSchoolData] = useState<any>(null)
  const [protocols, setProtocols] = useState<any[]>([])
  const [schedules, setSchedules] = useState<any[]>([])

  useEffect(() => {
    fetch('/api/school')
      .then(res => res.json())
      .then(data => {
        if (!data.error) setSchoolData(data)
      })
    fetch('/api/protocols')
      .then(res => res.json())
      .then(data => {
        if (!data.error) setProtocols(data)
      })
    fetch('/api/teacher-portal')
      .then(res => res.json())
      .then(data => {
        if (!data.error && data.schedule) setSchedules(data.schedule)
      })
  }, [])

  async function handleStatusChange(id: string, newStatus: string) {
    const original = [...schedules]
    setSchedules(schedules.map(s => s._id === id ? { ...s, status: newStatus } : s))
    try {
      const res = await fetch(`/api/teacher-portal/schedule?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })
      if (!res.ok) throw new Error('Failed to update status')
    } catch (err) {
      console.error(err)
      setSchedules(original)
    }
  }

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
          className="flex items-center gap-1.5 bg-[#002045] hover:bg-[#1a365d] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Class Note
        </motion.button>
      </motion.div>

      <div className="grid grid-cols-12 gap-4 mb-6">
        {/* Institutional Info Card — 8 cols */}
        <motion.div {...fadeUp(0.05)} className="col-span-8 bg-[#002045]/5 border border-[#002045]/10 rounded-xl p-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-white border border-[#002045]/20 flex items-center justify-center text-[#002045] shadow-sm">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[#002045] uppercase tracking-wider">Institution Information</p>
              <p className="text-sm font-bold text-gray-900">{schoolData?.name || 'Polaris School of Technology'}</p>
            </div>
          </div>
          <div className="flex items-center gap-8">
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Board</p>
              <p className="text-xs font-bold text-gray-800">{schoolData?.board || 'CBSE Affiliated'}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Active Classes</p>
              <p className="text-xs font-bold text-gray-800">{schoolData?.classes || 'Nursery – XII'}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">MOU Status</p>
              <p className="text-xs font-bold text-emerald-700">{schoolData?.mouStatus || 'Active (2025)'}</p>
            </div>
          </div>
        </motion.div>

        {/* Protocols Card — 4 cols */}
        <motion.div {...fadeUp(0.08)} className="col-span-4 bg-white border border-gray-100 rounded-xl p-5 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Protocols</p>
            <ShieldCheck className="w-4 h-4 text-gray-400" />
          </div>
          <div className="space-y-3 mt-4">
            {protocols.length === 0 && <p className="text-[11px] text-gray-400 italic">Loading...</p>}
            {protocols.slice(0, 3).map(p => (
              <div key={p._id} className="flex gap-2.5">
                <div className="mt-0.5 shrink-0">
                  {p.status === 'completed' ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> :
                   p.status === 'overdue' ? <AlertTriangle className="w-4 h-4 text-red-500" /> :
                   <Clock className="w-4 h-4 text-[#1a365d]" />}
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-800 leading-tight">{p.label}</p>
                  <p className={`text-[11px] mt-0.5 ${p.status === 'overdue' ? 'text-red-500' : 'text-gray-400'}`}>{p.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        {[
          { icon: <BookOpen className="w-5 h-5" />, label: 'Courses', value: '4', color: 'bg-emerald-50', iconColor: 'text-emerald-600' },
          { icon: <Users className="w-5 h-5" />, label: 'Students', value: '142', color: 'bg-blue-50', iconColor: 'text-blue-600' },
          { icon: <Calendar className="w-5 h-5" />, label: 'Classes today', value: '3', color: 'bg-amber-50', iconColor: 'text-amber-600' },
          { icon: <ClipboardList className="w-5 h-5" />, label: 'Pending tasks', value: '2', color: 'bg-red-50', iconColor: 'text-red-600' },
        ].map((s, i) => (
          <motion.div key={s.label} {...fadeUp(i * 0.05)} className={`${s.color} border border-transparent hover:border-gray-200 transition-colors rounded-xl p-5 shadow-sm`}>
            <div className="flex items-center justify-between mb-4">
              <span className={`${s.iconColor}`}>{s.icon}</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 leading-none mb-1">{s.value}</p>
            <p className="text-xs font-medium text-gray-600">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Today's schedule table */}
      <motion.div {...fadeUp(0.22)} className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <p className="text-sm font-bold text-gray-900">Today's Schedule</p>
          <div className="flex items-center gap-2">
            <button className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors">
              <Filter className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-50">
              {['Activity', 'Time', 'Batch', 'Location', 'Status', ''].map(h => (
                <th key={h} className="px-5 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {schedules.map((row, i) => (
              <motion.tr
                key={row._id || i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.28 + i * 0.05 }}
                className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors"
              >
                <td className="px-5 py-3.5 text-sm font-bold text-gray-800">{row.activity}</td>
                <td className="px-5 py-3.5 text-sm text-gray-500">{row.time}</td>
                <td className="px-5 py-3.5 text-sm text-gray-500">{row.batch}</td>
                <td className="px-5 py-3.5 text-sm text-gray-500">{row.location}</td>
                <td className="px-5 py-3.5">
                  <select
                    value={row.status}
                    onChange={(e) => handleStatusChange(row._id, e.target.value)}
                    className={`text-[11px] font-bold uppercase px-2.5 py-1 rounded-full border cursor-pointer outline-none appearance-none text-center transition-colors ${STATUS_STYLES[row.status] || 'bg-gray-50 text-gray-600 border-gray-200'}`}
                  >
                    <option value="Upcoming">Upcoming</option>
                    <option value="Pending">Pending</option>
                    <option value="Completed">Completed</option>
                  </select>
                </td>
                <td className="px-5 py-3.5 text-right">
                  <button className="p-1.5 rounded-lg text-gray-400 hover:text-[#002045] hover:bg-gray-100 transition-colors">
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
