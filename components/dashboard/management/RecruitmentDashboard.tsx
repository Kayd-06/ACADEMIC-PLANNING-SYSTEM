'use client'
import { useState, useEffect } from 'react'
import { useAlert } from '@/components/dashboard/AlertProvider'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users,
  Filter,
  Download,
  MoreHorizontal,
  Megaphone,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  Play,
  MapPin,
  Clock,
  Loader2,
  Star,
  CalendarCheck,
  Plus,
  X,
  Save,
  Trash2,
  Pencil
} from 'lucide-react'
import { formatDate } from '@/lib/date'

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, type: 'spring' as const, stiffness: 320, damping: 28 },
})

const getStatusColor = (status: string) => {
  switch (status) {
    case 'Interview Scheduled': return 'bg-amber-100 text-amber-700'
    case 'Shortlisted': return 'bg-blue-100 text-blue-700'
    case 'Offer Extended': return 'bg-[#002045]/10 text-[#002045]'
    case 'Under Review': return 'bg-gray-100 text-gray-600'
    default: return 'bg-gray-100 text-gray-700'
  }
}

const getRatingStyle = (rating: string) => {
  switch (rating) {
    case 'Excellent': return 'bg-blue-50 text-[#002045] border border-blue-100'
    case 'Outstanding': return 'bg-emerald-50 text-emerald-700 border border-emerald-100'
    case 'Satisfactory': return 'bg-[#002045]/5 text-[#1a365d] border border-[#002045]/10'
    case 'Needs Improvement': return 'bg-amber-50 text-amber-700 border border-amber-100'
    default: return 'bg-gray-50 text-gray-700 border border-gray-100'
  }
}

export default function RecruitmentDashboard() {
  const { showAlert } = useAlert()
  const [candidates, setCandidates] = useState<any[]>([])
  const [orientations, setOrientations] = useState<any[]>([])
  const [appraisals, setAppraisals] = useState<any[]>([])
  const [requirements, setRequirements] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAppraisalForm, setShowAppraisalForm] = useState(false)
  const [appraisalForm, setAppraisalForm] = useState({
    facultyName: '', department: '', reviewType: '', rating: 'Satisfactory',
    notes: '', scheduledDate: '', scheduledTime: '', isCompleted: false, avatarInitials: ''
  })
  const [showCandidateForm, setShowCandidateForm] = useState(false)
  const [candidateForm, setCandidateForm] = useState<any>({
    name: '', roleApplied: '', department: '', status: 'Under Review', nextStep: 'Initial Review'
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { 
    fetchData() 
    const handleReqUpdate = () => fetchData()
    if (typeof window !== 'undefined') {
      window.addEventListener('requirementsUpdated', handleReqUpdate)
      return () => window.removeEventListener('requirementsUpdated', handleReqUpdate)
    }
  }, [])

  async function fetchData() {
    try {
      const [candRes, orientRes, apprRes, reqRes] = await Promise.all([
        fetch('/api/recruitment/candidates'),
        fetch('/api/recruitment/orientations'),
        fetch('/api/recruitment/appraisals'),
        fetch('/api/recruitment/requirements')
      ])
      const [candData, orientData, apprData, reqData] = await Promise.all([
        candRes.json(), orientRes.json(), apprRes.json(), reqRes.json()
      ])
      if (!candData.error) setCandidates(candData)
      if (!orientData.error) setOrientations(orientData)
      if (!apprData.error) setAppraisals(apprData)
      if (!reqData.error) setRequirements(reqData)
    } catch (err) {
      console.error('Failed to fetch recruitment data:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleAddAppraisal(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    const initials = appraisalForm.facultyName
      .split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    await fetch('/api/recruitment/appraisals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...appraisalForm, avatarInitials: initials })
    })
    setAppraisalForm({ facultyName: '', department: '', reviewType: '', rating: 'Satisfactory', notes: '', scheduledDate: '', scheduledTime: '', isCompleted: false, avatarInitials: '' })
    setShowAppraisalForm(false)
    await fetchData()
    setSubmitting(false)
  }

  async function handleAddCandidate(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    
    if (candidateForm.id) {
      await fetch('/api/recruitment/candidates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(candidateForm)
      })
    } else {
      await fetch('/api/recruitment/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(candidateForm)
      })
    }
    
    setCandidateForm({ name: '', roleApplied: '', department: '', status: 'Under Review', nextStep: 'Initial Review' })
    setShowCandidateForm(false)
    await fetchData()
    setSubmitting(false)
  }

  async function deleteCandidate(id: string) {
    try {
      const res = await fetch(`/api/recruitment/candidates?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        await fetchData()
      } else {
        const data = await res.json()
        const candidate = candidates.find(c => c._id === id)
        const name = candidate ? candidate.name : 'candidate'
        showAlert({
          title: 'Failed to Delete Candidate',
          message: `Could not delete candidate ${name}. ${data.error || 'Failed to delete candidate.'}`,
          type: 'user-x',
          onRetry: () => deleteCandidate(id)
        })
      }
    } catch (err) {
      console.error(err)
      showAlert({
        title: 'Error Deleting Candidate',
        message: 'Network error. Could not delete candidate.',
        type: 'user-x',
        onRetry: () => deleteCandidate(id)
      })
    }
  }

  async function handleDeleteCandidate(id: string) {
    if (!confirm('Are you sure you want to delete this candidate?')) return
    await deleteCandidate(id)
  }

  async function handleStatusChange(id: string, newStatus: string) {
    await fetch('/api/recruitment/candidates', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: newStatus })
    })
    await fetchData()
  }

  async function deleteAppraisal(id: string) {
    try {
      const res = await fetch(`/api/recruitment/appraisals?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        await fetchData()
      } else {
        const data = await res.json()
        const appraisal = appraisals.find(a => a._id === id)
        const name = appraisal ? appraisal.facultyName : 'appraisal'
        showAlert({
          title: 'Failed to Delete Appraisal',
          message: `Could not delete appraisal for ${name}. ${data.error || 'Failed to delete appraisal.'}`,
          type: 'trash',
          onRetry: () => deleteAppraisal(id)
        })
      }
    } catch (err) {
      console.error(err)
      showAlert({
        title: 'Error Deleting Appraisal',
        message: 'Network error. Could not delete appraisal.',
        type: 'trash',
        onRetry: () => deleteAppraisal(id)
      })
    }
  }

  async function handleDeleteAppraisal(id: string) {
    if (!confirm('Are you sure you want to delete this appraisal?')) return
    await deleteAppraisal(id)
  }

  const totalOpenRoles = requirements.reduce((sum, req) => sum + (req.openPositions || 1), 0).toString()

  const pipelineStats = [
    { label: 'REQUIREMENT ANNOUNCEMENT', icon: <Megaphone className="w-5 h-5" />, count: totalOpenRoles, sub: 'Open Roles', color: 'bg-[#002045]/5', iconColor: 'text-[#002045]', tagColor: 'bg-[#002045]/10' },
    { label: 'SHORTLISTING', icon: <Filter className="w-5 h-5" />, count: candidates.filter(c => c.status === 'Shortlisted').length.toString().padStart(2, '0'), sub: 'Candidates', color: 'bg-amber-50', iconColor: 'text-amber-600', tagColor: 'bg-amber-100' },
    { label: 'INTERVIEWS', icon: <Users className="w-5 h-5" />, count: candidates.filter(c => c.status === 'Interview Scheduled').length.toString().padStart(2, '0'), sub: 'Scheduled', color: 'bg-blue-50', iconColor: 'text-blue-600', tagColor: 'bg-blue-100' },
    { label: 'JOINING PROCESS', icon: <UserCheck className="w-5 h-5" />, count: candidates.filter(c => c.status === 'Offer Extended' || c.status === 'Pending').length.toString().padStart(2, '0'), sub: 'Pending', color: 'bg-slate-50', iconColor: 'text-slate-600', tagColor: 'bg-slate-100' },
  ]

  const completedAppraisals = appraisals.filter(a => a.isCompleted)
  const upcomingAppraisals = appraisals.filter(a => !a.isCompleted)

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50/50">
        <Loader2 className="w-8 h-8 text-[#002045] animate-spin" />
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
            <button className="text-sm font-medium text-[#002045] hover:text-[#1a365d]">View All</button>
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
                <div className={`${step.iconColor} mb-4 relative z-10`}>{step.icon}</div>
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
            <img src="/recruitment-thumbnail.png" alt="Faculty Orientation" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors flex items-center justify-center">
              <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center shadow-lg transition-transform group-hover:scale-110">
                <Play className="w-5 h-5 text-[#002045] fill-[#002045]" />
              </div>
            </div>
            <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-sm px-2 py-1 rounded text-[10px] font-bold text-gray-900 shadow-sm">Next Session</div>
          </div>
          <div className="space-y-4">
            {orientations.map((session, idx) => (
              <div key={idx} className="flex gap-4">
                <div className="w-12 h-12 bg-[#002045]/5 rounded-lg flex flex-col items-center justify-center shrink-0 border border-[#002045]/10">
                  <span className="text-[10px] font-bold text-[#002045] uppercase leading-none">{session.date.split(' ')[0]}</span>
                  <span className="text-lg font-bold text-[#002045] leading-none mt-0.5">{session.date.split(' ')[1]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{session.title}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <div className="flex items-center gap-1 text-[11px] text-gray-500"><MapPin className="w-3 h-3" /> {session.location}</div>
                    <div className="flex items-center gap-1 text-[11px] text-gray-500"><Clock className="w-3 h-3" /> {session.time}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button className="w-full mt-6 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">View Full Schedule</button>
        </motion.div>
      </div>

      {/* Active Candidates Table */}
      <motion.div {...fadeUp(0.15)} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-8">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Active Candidates</h2>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              <Filter className="w-4 h-4" /> Filter
            </button>
            <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              <Download className="w-4 h-4" /> Export
            </button>
            <button onClick={() => setShowCandidateForm(!showCandidateForm)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#002045] text-white text-sm font-bold shadow-sm hover:bg-[#1a365d] transition-colors">
              <Plus className="w-4 h-4" /> Add Candidate
            </button>
          </div>
        </div>
        
        <AnimatePresence>
          {showCandidateForm && (
            <motion.form
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              onSubmit={handleAddCandidate}
              className="px-6 py-4 border-b border-gray-100 bg-[#002045]/5 overflow-hidden"
            >
              <div className="grid grid-cols-5 gap-3 mb-3">
                <input required value={candidateForm.name} onChange={e => setCandidateForm((f: any) => ({ ...f, name: e.target.value }))} placeholder="Candidate Name" className="px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#002045]/20" />
                <input required value={candidateForm.roleApplied} onChange={e => setCandidateForm((f: any) => ({ ...f, roleApplied: e.target.value }))} placeholder="Role Applied" className="px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#002045]/20" />
                <input required value={candidateForm.department} onChange={e => setCandidateForm((f: any) => ({ ...f, department: e.target.value }))} placeholder="Department" className="px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#002045]/20" />
                <select value={candidateForm.status} onChange={e => setCandidateForm((f: any) => ({ ...f, status: e.target.value }))} className="px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#002045]/20">
                  <option>Requirement Announcement</option>
                  <option>Shortlisted</option>
                  <option>Interview Scheduled</option>
                  <option>Offer Extended</option>
                  <option>Under Review</option>
                  <option>Pending</option>
                </select>
                <input required value={candidateForm.nextStep} onChange={e => setCandidateForm((f: any) => ({ ...f, nextStep: e.target.value }))} placeholder="Next Step" className="px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#002045]/20" />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowCandidateForm(false)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">Cancel</button>
                <button type="submit" disabled={submitting} className="px-4 py-2 text-sm font-bold bg-[#002045] text-white rounded-lg hover:bg-[#1a365d] transition-colors flex items-center gap-2">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50">
                {['Candidate Name', 'Role Applied', 'Department', 'Status', 'Next Steps', 'Actions'].map(h => (
                  <th key={h} className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {candidates.map((candidate, idx) => (
                <tr key={idx} className="hover:bg-gray-50/40 transition-colors group">
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900">{candidate.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{candidate.roleApplied}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{candidate.department}</td>
                  <td className="px-6 py-4">
                    <select
                      value={candidate.status}
                      onChange={(e) => handleStatusChange(candidate._id, e.target.value)}
                      className={`px-3 py-1 rounded-full text-[11px] font-bold appearance-none cursor-pointer outline-none border border-transparent hover:border-gray-300 ${getStatusColor(candidate.status)}`}
                    >
                      <option>Requirement Announcement</option>
                      <option>Shortlisted</option>
                      <option>Interview Scheduled</option>
                      <option>Offer Extended</option>
                      <option>Under Review</option>
                      <option>Pending</option>
                    </select>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{candidate.nextStep}</td>
                  <td className="px-6 py-4 flex items-center gap-1">
                    <button 
                      onClick={() => {
                        setCandidateForm({ ...candidate, id: candidate._id })
                        setShowCandidateForm(true)
                      }} 
                      className="p-1.5 rounded-lg text-gray-400 hover:text-[#002045] hover:bg-gray-100 transition-colors" 
                      title="Edit Candidate"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDeleteCandidate(candidate._id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete Candidate">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          <p className="text-xs text-gray-500">
            Showing {candidates.length > 0 ? 1 : 0} to {candidates.length} of {candidates.length} entries
          </p>
          <div className="flex items-center gap-1">
            <button className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50 disabled:opacity-50" disabled>
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button className="w-8 h-8 rounded-lg bg-[#002045] text-white text-xs font-bold">1</button>
            <button className="w-8 h-8 rounded-lg border border-gray-200 text-gray-600 text-xs font-bold hover:bg-gray-50">2</button>
            <button className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>

      {/* Appraisals Row */}
      <div className="grid grid-cols-12 gap-6">
        {/* Recent Appraisals — 6 cols */}
        <motion.div {...fadeUp(0.2)} className="col-span-6 bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-[#002045]" />
              <h2 className="text-lg font-semibold text-gray-900">Recent Appraisals</h2>
            </div>
            <button className="text-sm font-medium text-[#002045] hover:text-[#1a365d]">View History</button>
          </div>
          <div className="space-y-4">
            {completedAppraisals.slice(0, 3).map((a, idx) => (
              <div key={a._id || idx} className="flex items-start gap-4 p-4 border border-gray-100 rounded-xl bg-gray-50/50 group hover:border-gray-200 transition-all">
                <div className="w-11 h-11 rounded-full bg-[#002045]/10 flex items-center justify-center text-sm font-bold text-[#002045] shrink-0">
                  {a.avatarInitials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <h4 className="text-sm font-bold text-gray-900">{a.facultyName}</h4>
                      <p className="text-xs text-gray-500 mt-0.5">{a.department}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded shrink-0 ${getRatingStyle(a.rating)}`}>{a.rating}</span>
                  </div>
                  {a.notes && <p className="text-xs text-gray-500 mt-2 leading-relaxed line-clamp-2">{a.notes}</p>}
                </div>
                <button onClick={() => handleDeleteAppraisal(a._id)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-red-400 hover:text-red-600 shrink-0">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {completedAppraisals.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-6">No completed appraisals yet.</p>
            )}
          </div>
        </motion.div>

        {/* Upcoming Appraisals — 6 cols */}
        <motion.div {...fadeUp(0.25)} className="col-span-6 bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <CalendarCheck className="w-5 h-5 text-[#002045]" />
              <h2 className="text-lg font-semibold text-gray-900">Upcoming Appraisals</h2>
            </div>
            <button
              onClick={() => setShowAppraisalForm(f => !f)}
              className="flex items-center gap-1.5 text-sm font-semibold text-[#002045] hover:text-[#1a365d] transition-colors"
            >
              <Plus className="w-4 h-4" /> Schedule
            </button>
          </div>

          {/* Inline Add Form */}
          <AnimatePresence>
            {showAppraisalForm && (
              <motion.form
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                onSubmit={handleAddAppraisal}
                className="overflow-hidden mb-4 p-4 rounded-xl border border-[#002045]/20 bg-[#002045]/5 space-y-3"
              >
                <p className="text-xs font-bold text-[#002045] uppercase tracking-wider">New Appraisal</p>
                <div className="grid grid-cols-2 gap-2">
                  <input required value={appraisalForm.facultyName} onChange={e => setAppraisalForm(f => ({ ...f, facultyName: e.target.value }))}
                    placeholder="Faculty Name" className="px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#002045]/20 outline-none" />
                  <input required value={appraisalForm.department} onChange={e => setAppraisalForm(f => ({ ...f, department: e.target.value }))}
                    placeholder="Department" className="px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#002045]/20 outline-none" />
                  <input required value={appraisalForm.reviewType} onChange={e => setAppraisalForm(f => ({ ...f, reviewType: e.target.value }))}
                    placeholder="Review Type" className="px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#002045]/20 outline-none" />
                  <select value={appraisalForm.isCompleted ? 'true' : 'false'} onChange={e => setAppraisalForm(f => ({ ...f, isCompleted: e.target.value === 'true' }))}
                    className="px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#002045]/20 outline-none">
                    <option value="false">Upcoming</option>
                    <option value="true">Completed</option>
                  </select>
                  {appraisalForm.isCompleted ? (
                    <>
                      <select value={appraisalForm.rating} onChange={e => setAppraisalForm(f => ({ ...f, rating: e.target.value }))}
                        className="px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#002045]/20 outline-none">
                        {['Excellent', 'Outstanding', 'Satisfactory', 'Needs Improvement'].map(r => <option key={r}>{r}</option>)}
                      </select>
                      <input value={appraisalForm.notes} onChange={e => setAppraisalForm(f => ({ ...f, notes: e.target.value }))}
                        placeholder="Notes (optional)" className="px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#002045]/20 outline-none" />
                    </>
                  ) : (
                    <>
                      <input required value={appraisalForm.scheduledDate} onChange={e => setAppraisalForm(f => ({ ...f, scheduledDate: e.target.value }))}
                        placeholder="Date (e.g. Oct 28)" className="px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#002045]/20 outline-none" />
                      <input required value={appraisalForm.scheduledTime} onChange={e => setAppraisalForm(f => ({ ...f, scheduledTime: e.target.value }))}
                        placeholder="Time (e.g. 10:00 AM)" className="px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#002045]/20 outline-none" />
                    </>
                  )}
                </div>
                <button type="submit" disabled={submitting}
                  className="w-full bg-[#002045] text-white text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-[#1a365d] transition-colors">
                  {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save Appraisal
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          <ul className="divide-y divide-gray-100">
            {upcomingAppraisals.slice(0, 4).map((a, idx) => (
              <li key={a._id || idx} className="py-3.5 flex justify-between items-center group hover:bg-gray-50/60 -mx-2 px-2 rounded-lg transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#002045]/5 flex items-center justify-center text-sm font-bold text-[#002045] border border-[#002045]/10 shrink-0">
                    {a.avatarInitials}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">{a.facultyName}</p>
                    <p className="text-xs text-gray-500">{a.reviewType}</p>
                  </div>
                </div>
                <div className="text-right flex items-center gap-3">
                  <div>
                    <p className="text-sm font-bold text-gray-900">{formatDate(a.scheduledDate)}</p>
                    <p className="text-xs text-gray-500">{a.scheduledTime}</p>
                  </div>
                  <button onClick={() => handleDeleteAppraisal(a._id)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-red-400 hover:text-red-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </li>
            ))}
            {upcomingAppraisals.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-6">No upcoming appraisals scheduled.</p>
            )}
          </ul>
        </motion.div>
      </div>
    </div>
  )
}
