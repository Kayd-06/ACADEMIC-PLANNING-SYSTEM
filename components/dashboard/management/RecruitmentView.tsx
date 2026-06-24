'use client'
import { useState, useEffect } from 'react'
import { Briefcase, Users, Calendar, CheckCircle2, Filter, Plus, Clock, CheckCircle, X, Loader2 } from 'lucide-react'

// Map icon strings to components
const IconMap: Record<string, any> = {
  'Briefcase': Briefcase,
  'Users': Users,
  'Calendar': Calendar,
  'CheckCircle2': CheckCircle2
}

interface CandidateData {
  _id?: string
  avatarInitials: string
  name: string
  roleApplied: string
  department: string
  theme: string
  status: string
  schedule?: string
}

interface KPIData {
  _id: string
  label: string
  value: string
  subtext: string
  iconName: string
  subcolor: string
  subbg: string
}

interface AppraisalData {
  _id: string
  avatarInitials: string
  facultyName: string
  department: string
  reviewType: string
  rating: string
  scheduledDate: string
  isCompleted: boolean
}

export default function RecruitmentView() {
  const [kpis, setKpis] = useState<KPIData[]>([])
  const [candidates, setCandidates] = useState<CandidateData[]>([])
  const [appraisals, setAppraisals] = useState<AppraisalData[]>([])
  const [loading, setLoading] = useState(true)
  
  // Interaction states
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    roleApplied: '',
    department: '',
    status: 'Requirement'
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const res = await fetch('/api/recruitment/dashboard')
      const data = await res.json()
      if (!data.error) {
        setKpis(data.kpis || [])
        setCandidates(data.candidates || [])
        setAppraisals(data.appraisals || [])
      }
    } catch (err) {
      console.error('Failed to fetch recruitment data', err)
    } finally {
      setLoading(false)
    }
  }

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const handleAddRequirement = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    
    // Auto-generate initials
    const initials = formData.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    
    const newCandidate = {
      ...formData,
      avatarInitials: initials || 'XX',
      theme: 'blue'
    }

    try {
      // In a real app, we'd POST to an API. Here we'll simulate the optimistic update 
      // since the dashboard API is GET only, or we can use the candidates API!
      const res = await fetch('/api/recruitment/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCandidate)
      })
      
      if (res.ok) {
        showToast('Requirement successfully added!')
        setShowModal(false)
        setFormData({ name: '', roleApplied: '', department: '', status: 'Requirement' })
        fetchData()
      } else {
        // Fallback for visual update if API doesn't support POST
        setCandidates(prev => [...prev, { ...newCandidate, _id: Date.now().toString() }])
        showToast('Requirement added locally.')
        setShowModal(false)
      }
    } catch (err) {
      showToast('Error adding requirement.')
    } finally {
      setSubmitting(false)
    }
  }

  // Group candidates by status
  const pipeline = candidates.reduce((acc, cand) => {
    if (!acc[cand.status]) acc[cand.status] = []
    acc[cand.status].push(cand)
    return acc
  }, { 'Requirement': [], 'Shortlisted': [], 'Interview Scheduled': [] } as Record<string, CandidateData[]>)

  return (
    <div className="flex-1 p-8 overflow-auto bg-slate-50 min-h-screen relative">
      
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-8 right-8 bg-slate-900 text-white px-6 py-3 rounded-xl shadow-2xl z-50 flex items-center gap-3 font-medium animate-in slide-in-from-bottom-5">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          {toast}
        </div>
      )}

      {/* Add Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="font-bold text-slate-900">Add New Requirement</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddRequirement} className="p-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Candidate Name</label>
                <input required value={formData.name} onChange={e => setFormData(f => ({...f, name: e.target.value}))} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#0b1320] outline-none text-sm" placeholder="e.g. John Doe" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Role Applied</label>
                <input required value={formData.roleApplied} onChange={e => setFormData(f => ({...f, roleApplied: e.target.value}))} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#0b1320] outline-none text-sm" placeholder="e.g. Physics Teacher" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Department</label>
                <input required value={formData.department} onChange={e => setFormData(f => ({...f, department: e.target.value}))} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#0b1320] outline-none text-sm" placeholder="e.g. SCIENCE" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Status</label>
                <select value={formData.status} onChange={e => setFormData(f => ({...f, status: e.target.value}))} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#0b1320] outline-none text-sm">
                  <option value="Requirement">Requirement</option>
                  <option value="Shortlisted">Shortlisted</option>
                  <option value="Interview Scheduled">Interview Scheduled</option>
                </select>
              </div>
              <button disabled={submitting} type="submit" className="w-full mt-4 bg-[#0b1320] text-white font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Save Requirement
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Recruitment</h1>
          <p className="text-[13px] text-slate-500 mt-1">
            Track open positions, candidates, and interview pipeline.
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 bg-[#0b1320] hover:bg-slate-800 text-white rounded-lg text-sm font-semibold transition-all shadow-sm active:scale-95">
          <Plus className="w-4 h-4" /> New Requirement
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            {kpis.map((kpi) => {
              const IconComponent = IconMap[kpi.iconName] || Briefcase
              return (
                <div key={kpi._id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[13px] font-semibold text-slate-600">{kpi.label}</span>
                    <div className="p-2 bg-slate-50 rounded-lg">
                      <IconComponent className="w-4 h-4 text-slate-700" />
                    </div>
                  </div>
                  <div className="flex items-baseline gap-3">
                    <span className="text-3xl font-bold text-slate-900">{kpi.value}</span>
                    <span className={`px-2 py-0.5 text-[11px] font-bold rounded-full ${kpi.subbg} ${kpi.subcolor}`}>
                      {kpi.subtext}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Pipeline */}
          <div className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">Pipeline</h2>
              <button onClick={() => showToast('Filters opened')} className="flex items-center gap-2 px-4 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors shadow-sm active:scale-95">
                <Filter className="w-4 h-4" /> Filter
              </button>
            </div>

            <div className="flex gap-6 overflow-x-auto pb-4">
              {Object.entries(pipeline).map(([columnName, items]) => (
                <div key={columnName} className="min-w-[320px] max-w-[320px] flex flex-col gap-3">
                  <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl shadow-sm">
                    <span className="text-sm font-bold text-slate-900">{columnName}</span>
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-bold rounded-md">{items.length}</span>
                  </div>

                  {items.map((item) => (
                    <div key={item._id} onClick={() => showToast(`View details for ${item.name}`)} className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer hover:border-slate-300">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-[#0b1320] flex items-center justify-center text-white text-sm font-bold">
                          {item.avatarInitials}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-900">{item.name}</h4>
                          <p className="text-[12px] text-slate-500">{item.roleApplied}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-4">
                        <span className="px-2 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-bold uppercase tracking-wider rounded-md border border-indigo-100">
                          {item.department}
                        </span>
                      </div>
                      {item.schedule && (
                        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-[11px] font-semibold text-indigo-600 bg-indigo-50 w-fit px-2 py-1 rounded-md">
                          <Calendar className="w-3.5 h-3.5" />
                          {item.schedule}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
              {/* Empty column placeholder */}
              <div className="min-w-[320px] max-w-[320px] flex flex-col gap-3 opacity-50">
                 <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl shadow-sm">
                    <span className="text-sm font-bold text-slate-900">Under Review</span>
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-bold rounded-md">0</span>
                  </div>
              </div>
            </div>
          </div>

          {/* Teacher Appraisals */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-8">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Teacher Appraisals</h2>
              <button onClick={() => showToast('Opening all appraisals...')} className="text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors">
                View All
              </button>
            </div>
            
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Faculty Name</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Department</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Review Type</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Rating</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Scheduled Date</th>
                  <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">Completed</th>
                  <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {appraisals.map((app) => (
                  <tr key={app._id} className="hover:bg-slate-50/80 transition-colors cursor-pointer" onClick={() => showToast(`View appraisal for ${app.facultyName}`)}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#0b1320] flex items-center justify-center text-white text-xs font-bold">
                          {app.avatarInitials}
                        </div>
                        <span className="text-[13px] font-bold text-slate-900">{app.facultyName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[13px] font-semibold text-slate-700">{app.department}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[13px] text-slate-600">{app.reviewType}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full border ${
                        app.rating === 'Outstanding' ? 'bg-green-50 text-green-700 border-green-200' :
                        app.rating === 'Excellent' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                        app.rating === 'Satisfactory' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                        'bg-red-50 text-red-700 border-red-200'
                      }`}>
                        {app.rating}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[13px] text-slate-600">{app.scheduledDate}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {app.isCompleted ? (
                        <CheckCircle className="w-5 h-5 text-green-500 mx-auto" />
                      ) : (
                        <div className="w-5 h-5 rounded-full border-2 border-slate-300 mx-auto" />
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={(e) => { e.stopPropagation(); showToast('Edit appraisal'); }} className="text-xs font-bold text-indigo-600 hover:text-indigo-800">Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

