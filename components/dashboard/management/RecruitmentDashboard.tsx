'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  Users, 
  Search, 
  Filter, 
  Download, 
  MoreHorizontal, 
  Megaphone, 
  UserCheck, 
  Calendar, 
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  Play,
  MapPin,
  Clock,
  Loader2
} from 'lucide-react'

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, type: 'spring' as const, stiffness: 320, damping: 28 },
})

const getStatusColor = (status: string) => {
  switch (status) {
    case 'Interview Scheduled': return 'bg-orange-100 text-orange-700'
    case 'Shortlisted': return 'bg-blue-100 text-blue-700'
    case 'Offer Extended': return 'bg-indigo-100 text-indigo-700'
    default: return 'bg-gray-100 text-gray-700'
  }
}

export default function RecruitmentDashboard() {
  const [candidates, setCandidates] = useState<any[]>([])
  const [orientations, setOrientations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      const [candRes, orientRes] = await Promise.all([
        fetch('/api/recruitment/candidates'),
        fetch('/api/recruitment/orientations')
      ])
      const candData = await candRes.json()
      const orientData = await orientRes.json()
      
      if (!candData.error) setCandidates(candData)
      if (!orientData.error) setOrientations(orientData)
    } catch (err) {
      console.error('Failed to fetch recruitment data:', err)
    } finally {
      setLoading(false)
    }
  }

  // Calculate pipeline stats
  const pipelineStats = [
    { 
      label: 'REQUIREMENT ANNOUNCEMENT', 
      icon: <Megaphone className="w-5 h-5" />, 
      count: '12', // Static for now as it's role-based, not candidate-based
      sub: 'Open Roles',
      color: 'bg-indigo-50',
      iconColor: 'text-indigo-600',
      tagColor: 'bg-indigo-100'
    },
    { 
      label: 'SHORTLISTING', 
      icon: <Filter className="w-5 h-5" />, 
      count: candidates.filter(c => c.status === 'Shortlisted').length.toString().padStart(2, '0'), 
      sub: 'Candidates',
      color: 'bg-orange-50',
      iconColor: 'text-orange-600',
      tagColor: 'bg-orange-100'
    },
    { 
      label: 'INTERVIEWS', 
      icon: <Users className="w-5 h-5" />, 
      count: candidates.filter(c => c.status === 'Interview Scheduled').length.toString().padStart(2, '0'), 
      sub: 'Scheduled',
      color: 'bg-blue-50',
      iconColor: 'text-blue-600',
      tagColor: 'bg-blue-100'
    },
    { 
      label: 'JOINING PROCESS', 
      icon: <UserCheck className="w-5 h-5" />, 
      count: candidates.filter(c => c.status === 'Offer Extended' || c.status === 'Pending').length.toString().padStart(2, '0'), 
      sub: 'Pending',
      color: 'bg-slate-50',
      iconColor: 'text-slate-600',
      tagColor: 'bg-slate-100'
    },
  ]

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50/50">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex-1 p-8 overflow-auto bg-gray-50/50">
      {/* Header Section */}
      <motion.div {...fadeUp(0)} className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Faculty Recruitment</h1>
        <p className="text-gray-500 mt-1">Manage active hiring pipelines and upcoming academic schedules.</p>
      </motion.div>

      <div className="grid grid-cols-12 gap-6 mb-8">
        {/* Recruitment Pipeline */}
        <motion.div {...fadeUp(0.05)} className="col-span-8 bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Recruitment Pipeline</h2>
            <button className="text-sm font-medium text-indigo-600 hover:text-indigo-700">View All</button>
          </div>
          
          <div className="grid grid-cols-4 gap-4">
            {pipelineStats.map((step, idx) => (
              <motion.div 
                key={step.label}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + idx * 0.05 }}
                className={`${step.color} rounded-xl p-5 border border-transparent hover:border-gray-200 transition-all cursor-pointer group relative overflow-hidden`}
              >
                <div className={`absolute top-0 right-0 w-12 h-12 ${step.tagColor} opacity-50 rounded-bl-3xl -mr-4 -mt-4 transition-transform group-hover:scale-110`} />
                <div className={`${step.iconColor} mb-4 relative z-10`}>
                  {step.icon}
                </div>
                <p className="text-[10px] font-bold text-gray-400 tracking-wider mb-8 relative z-10">{step.label}</p>
                <div className="relative z-10">
                  <span className="text-2xl font-bold text-gray-900">{step.count}</span>
                  <span className="text-xs text-gray-500 ml-1.5">{step.sub}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Faculty Orientation */}
        <motion.div {...fadeUp(0.1)} className="col-span-4 bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Faculty Orientation</h2>
            <button className="text-gray-400 hover:text-gray-600">
              <MoreHorizontal className="w-5 h-5" />
            </button>
          </div>

          <div className="relative rounded-xl overflow-hidden aspect-video mb-6 group cursor-pointer border border-gray-100">
            <img 
              src="/recruitment-thumbnail.png" 
              alt="Faculty Orientation" 
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors flex items-center justify-center">
              <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center shadow-lg transition-transform group-hover:scale-110">
                <Play className="w-5 h-5 text-indigo-600 fill-indigo-600" />
              </div>
            </div>
            <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-sm px-2 py-1 rounded text-[10px] font-bold text-gray-900 shadow-sm">
              Next Session
            </div>
          </div>

          <div className="space-y-4">
            {orientations.map((session, idx) => (
              <div key={idx} className="flex gap-4">
                <div className="w-12 h-12 bg-indigo-50 rounded-lg flex flex-col items-center justify-center shrink-0 border border-indigo-100">
                  <span className="text-[10px] font-bold text-indigo-400 uppercase leading-none">{session.date.split(' ')[0]}</span>
                  <span className="text-lg font-bold text-indigo-700 leading-none mt-0.5">{session.date.split(' ')[1]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{session.title}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <div className="flex items-center gap-1 text-[11px] text-gray-500">
                      <MapPin className="w-3 h-3" /> {session.location}
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-gray-500">
                      <Clock className="w-3 h-3" /> {session.time}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button className="w-full mt-6 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
            View Full Schedule
          </button>
        </motion.div>
      </div>

      {/* Active Candidates Table */}
      <motion.div {...fadeUp(0.15)} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Active Candidates</h2>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              <Filter className="w-4 h-4" /> Filter
            </button>
            <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              <Download className="w-4 h-4" /> Export
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Candidate Name</th>
                <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Role Applied</th>
                <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Department</th>
                <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Next Steps</th>
                <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {candidates.map((candidate, idx) => (
                <tr key={idx} className="hover:bg-gray-50/40 transition-colors group">
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900">{candidate.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{candidate.roleApplied}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{candidate.department}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-[11px] font-bold ${getStatusColor(candidate.status)}`}>
                      {candidate.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{candidate.nextStep}</td>
                  <td className="px-6 py-4">
                    <button className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                      <MoreHorizontal className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          <p className="text-xs text-gray-500">Showing 1 to {candidates.length} of 45 entries</p>
          <div className="flex items-center gap-1">
            <button className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50 disabled:opacity-50" disabled>
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button className="w-8 h-8 rounded-lg bg-indigo-600 text-white text-xs font-bold">1</button>
            <button className="w-8 h-8 rounded-lg border border-gray-200 text-gray-600 text-xs font-bold hover:bg-gray-50">2</button>
            <button className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

