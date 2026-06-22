'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Download, 
  Plus, 
  Calendar, 
  TrendingUp, 
  FileText, 
  MessageSquare,
  Layout,
  Layers,
  Edit2,
  Trash2,
  X,
  Save,
  Loader2
} from 'lucide-react'

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, type: 'spring' as const, stiffness: 320, damping: 28 },
})

export default function AcademicPlanning({ role }: { role: 'management' | 'teacher' }) {
  const [view, setView] = useState<'macro' | 'micro'>('macro')
  const [toast, setToast] = useState<string | null>(null)
  const [data, setData] = useState<{ milestones: any[], logs: any[], metrics: any[] }>({
    milestones: [],
    logs: [],
    metrics: []
  })
  const [loading, setLoading] = useState(true)
  
  // Modal State
  const [modalType, setModalType] = useState<'milestone' | 'log' | 'metric' | null>(null)
  const [editingItem, setEditingItem] = useState<any>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    fetchData()
  }, [role])

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/academic-planning?role=${role}`)
      const resData = await res.json()
      if (!resData.error) {
        setData(resData)
      } else {
        showToast(resData.error)
      }
    } catch (err) {
      showToast('Connection error')
    } finally {
      setLoading(false)
    }
  }

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A'
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })
    } catch (e) {
      return dateStr
    }
  }

  // CRUD Handlers
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    const formData = new FormData(e.currentTarget)
    const body: any = Object.fromEntries(formData.entries())
    body.role = role
    body.modelType = modalType

    try {
      const method = editingItem ? 'PATCH' : 'POST'
      if (editingItem) body.id = editingItem._id

      const res = await fetch('/api/academic-planning', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const result = await res.json()
      if (res.ok) {
        showToast(editingItem ? 'Updated successfully' : 'Created successfully')
        setModalType(null)
        setEditingItem(null)
        fetchData()
      } else {
        showToast(result.error || 'Failed to save')
      }
    } catch (err) {
      showToast('Network error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string, type: 'milestone' | 'log') => {
    if (!confirm('Are you sure you want to delete this item?')) return
    
    try {
      const res = await fetch(`/api/academic-planning?id=${id}&type=${type}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        showToast('Deleted successfully')
        fetchData()
      }
    } catch (err) {
      showToast('Error deleting item')
    }
  }

  const currentAssessments = data.milestones
  const currentLogs = data.logs
  const headerStats = data.metrics.filter(m => m.category === 'header_stat')
  const qualityStats = data.metrics.filter(m => m.category === 'quality_stat')

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50/50 min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-bold text-gray-500 uppercase tracking-widest animate-pulse">Synchronizing Live Data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 p-6 overflow-auto bg-gray-50/50 relative">
      <AnimatePresence>
        {modalType && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">
                  {editingItem ? 'Edit' : 'Create New'} {modalType.charAt(0).toUpperCase() + modalType.slice(1)}
                </h3>
                <button onClick={() => { setModalType(null); setEditingItem(null); }} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {modalType === 'milestone' && (
                  <>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Name</label>
                      <input name="name" defaultValue={editingItem?.name} required className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Type</label>
                        <input name="type" defaultValue={editingItem?.type} placeholder="e.g. Institutional" required className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Status</label>
                        <select name="status" defaultValue={editingItem?.status} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm appearance-none">
                          <option>Pending</option>
                          <option>Scheduled</option>
                          <option>Draft</option>
                          <option>Completed</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Date</label>
                        <input type="date" name="date" defaultValue={editingItem?.date} required className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Department/Subject</label>
                        <input name="subject" defaultValue={editingItem?.subject} required className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
                      </div>
                    </div>
                  </>
                )}
                {modalType === 'log' && (
                  <>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Title</label>
                      <input name="title" defaultValue={editingItem?.title} required className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Focus</label>
                      <input name="focus" defaultValue={editingItem?.focus} required className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Measure Label</label>
                        <input name="measureLabel" defaultValue={editingItem?.measureLabel} placeholder="e.g. Budget Allocation:" required className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Log Type</label>
                        <select name="type" defaultValue={editingItem?.type} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm">
                          <option value="review">Review</option>
                          <option value="sync">Sync</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Measure Content</label>
                      <textarea name="measure" defaultValue={editingItem?.measure} required rows={3} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm resize-none" />
                    </div>
                  </>
                )}
                {modalType === 'metric' && (
                   <>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Value</label>
                      <input name="value" defaultValue={editingItem?.value} required className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Trend</label>
                      <input name="trend" defaultValue={editingItem?.trend} placeholder="+0.2%" required className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
                    </div>
                  </>
                )}
                <div className="pt-4">
                  <button 
                    disabled={isSubmitting}
                    className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {editingItem ? 'Save Changes' : 'Create Entry'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast */}
      {toast && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-8 right-8 bg-gray-900 text-white px-6 py-3 rounded-2xl shadow-2xl z-50 flex items-center gap-3 font-bold text-sm"
        >
          <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
          {toast}
        </motion.div>
      )}

      {/* Header */}
      <motion.div {...fadeUp(0)} className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            {role === 'management' ? 'Institutional Planning & Oversight' : 'Academic Scheduling & Quality'}
          </h1>
          <p className="text-gray-500 mt-1 font-medium">
            {role === 'management' 
              ? 'High-level academic strategy, resource management, and institutional audits.' 
              : 'Manage term calendars, monitor student performance, and track quality metrics.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => showToast('Generating academic report...')}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition-all active:scale-95"
          >
            <Download className="w-4 h-4 text-gray-400" />
            {role === 'management' ? 'Export Audit' : 'Export Report'}
          </button>
          <button 
            onClick={() => setModalType('milestone')}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold shadow-md shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            {role === 'management' ? 'Create Milestone' : 'Schedule Event'}
          </button>
        </div>
      </motion.div>

      <div className="grid grid-cols-12 gap-6">
        {/* Left Column */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
          
          {/* Admin Specific Stats (Management only) */}
          {headerStats.length > 0 && (
            <motion.div {...fadeUp(0.02)} className="grid grid-cols-3 gap-4">
              {headerStats.map((stat, i) => (
                <div key={i} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm relative group">
                  <button 
                    onClick={() => { setModalType('metric'); setEditingItem(stat); }}
                    className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-gray-100 rounded-lg text-indigo-600"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{stat.label}</p>
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-bold text-gray-900">{stat.value}</span>
                    <span className={`text-[10px] font-bold ${stat.trend.startsWith('+') ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {stat.trend}
                    </span>
                  </div>
                  <div className="w-full h-1 bg-gray-100 rounded-full mt-3 overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: stat.value.includes('%') ? stat.value : '75%' }}
                      className="h-full bg-indigo-500"
                    />
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {/* Term Schedule Overview */}
          <motion.div {...fadeUp(0.05)} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                  <Calendar className="w-5 h-5" />
                </div>
                <h2 className="font-bold text-gray-900">
                  {role === 'management' ? 'Institutional Master Timeline' : 'Term Schedule Overview'}
                </h2>
              </div>
              <div className="flex p-1 bg-gray-100 rounded-lg">
                <button 
                  onClick={() => setView('macro')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${view === 'macro' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Macro View
                </button>
                <button 
                  onClick={() => setView('micro')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${view === 'micro' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Micro View
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="relative aspect-[16/8] bg-gray-900 rounded-2xl shadow-2xl group border border-white/5">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(99,102,241,0.08),transparent)] pointer-events-none rounded-2xl overflow-hidden" />
                <div className="absolute inset-0 flex flex-col p-8">
                  {/* Timeline Header */}
                  <div className="flex items-center justify-between mb-12">
                    <div className="flex gap-1.5">
                      {[1,2,3,4].map(i => (
                        <div key={i} className="w-10 h-1.5 rounded-full bg-white/5 overflow-hidden">
                          <motion.div 
                            initial={{ x: '-100%' }}
                            animate={{ x: '0%' }}
                            transition={{ delay: i * 0.1, duration: 0.8 }}
                            className="w-full h-full bg-indigo-500/20"
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                        <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Critical Path</span>
                      </div>
                      <div className="flex items-center gap-4 text-white/60 text-[10px] font-bold tracking-[0.2em] uppercase bg-white/5 px-4 py-2 rounded-full border border-white/5">
                        <span>{role === 'management' ? 'Yearly Strategy 2024' : 'Term 2 Schedule'}</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Dynamic Timeline Grid */}
                  <div className="flex-1 relative mb-12">
                    {/* Month Grid Lines */}
                    <div className="absolute inset-0 flex pointer-events-none">
                      {Array.from({ length: view === 'macro' ? 12 : 4 }).map((_, i) => (
                        <div 
                          key={i} 
                          style={{ left: `${(i / (view === 'macro' ? 12 : 4)) * 100}%` }}
                          className="absolute h-full w-px bg-white/5"
                        >
                          <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[8px] font-bold text-white/20 uppercase whitespace-nowrap">
                            {view === 'macro' 
                              ? ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][i]
                              : `Week ${i + 1}`}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Milestone Markers */}
                    <div className="absolute inset-0 py-8">
                      {data.milestones.slice(0, 12).map((m, i) => {
                        const date = new Date(m.date)
                        if (isNaN(date.getTime())) return null

                        const month = date.getMonth()
                        const day = date.getDate()
                        const left = view === 'macro' 
                          ? ((month + day/31) / 12) * 100 
                          : ((day % 28) / 28) * 100
                        
                        // Vary vertical position to avoid overlap
                        const topOffsets = [10, 45, 25, 60, 15, 50]
                        const top = topOffsets[i % topOffsets.length]
                        
                        return (
                          <motion.div 
                            key={m._id}
                            initial={{ opacity: 0, scale: 0.5, x: '-50%' }}
                            animate={{ opacity: 1, scale: 1, x: '-50%' }}
                            transition={{ delay: 0.2 + i * 0.05 }}
                            style={{ left: `${left}%`, top: `${top}%` }}
                            className="absolute z-10 group/marker"
                          >
                            <div className="relative flex flex-col items-center">
                              {/* Tooltip (Positioned above marker) */}
                              <div className="absolute bottom-full mb-3 opacity-0 group-hover/marker:opacity-100 transition-all translate-y-2 group-hover/marker:translate-y-0 pointer-events-none whitespace-nowrap z-30">
                                <div className="bg-gray-800 border border-white/10 p-3 rounded-xl shadow-2xl backdrop-blur-md">
                                  <p className="text-[9px] font-bold text-white/40 uppercase mb-1">{formatDate(m.date)}</p>
                                  <p className="text-xs font-bold text-white">{m.name}</p>
                                  <p className="text-[10px] font-medium text-white/60 mt-1">{m.subject}</p>
                                </div>
                                <div className="w-2 h-2 bg-gray-800 border-b border-r border-white/10 rotate-45 mx-auto -mt-1" />
                              </div>

                              <div className={`w-3 h-3 rounded-full border-2 ${
                                role === 'management' ? 'bg-amber-500 border-gray-900' : 'bg-indigo-500 border-gray-900'
                              } shadow-[0_0_15px_rgba(99,102,241,0.3)] group-hover/marker:scale-125 transition-transform cursor-pointer relative z-10`} />
                              
                              <div className="mt-2 w-px h-16 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
                              
                              <div className="absolute top-full mt-4 flex flex-col items-center pointer-events-none">
                                <div className="text-[8px] font-bold text-white/30 uppercase tracking-tighter truncate max-w-[70px] bg-white/5 px-1.5 py-0.5 rounded">
                                  {m.name}
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Progress Card */}
                  <div className="mt-auto bg-white/5 backdrop-blur-xl rounded-2xl p-5 border border-white/10 shadow-xl overflow-hidden relative">
                    <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500/50" />
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                          <TrendingUp className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-white text-xs font-bold block leading-none">
                            {role === 'management' ? 'Institutional KPI Target' : 'Academic Velocity'}
                          </span>
                          <span className="text-white/40 text-[10px] font-bold uppercase tracking-wider">
                            {role === 'management' ? 'Quarterly Audit Phase' : 'Mid-Term Assessment Cycle'}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-white text-lg font-black tracking-tight">
                          {role === 'management' ? '72%' : '45%'}
                        </span>
                        <span className="text-[8px] font-bold text-white/30 uppercase block -mt-1">Completion</span>
                      </div>
                    </div>
                    <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden border border-white/5">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: role === 'management' ? '72%' : '45%' }}
                        className={`h-full ${role === 'management' ? 'bg-amber-500' : 'bg-indigo-500'} shadow-[0_0_15px_rgba(99,102,241,0.4)]`}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Institutional Milestones */}
          <motion.div {...fadeUp(0.1)} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                  <FileText className="w-5 h-5" />
                </div>
                <h2 className="font-bold text-gray-900">
                  {role === 'management' ? 'Institutional Milestones' : 'Upcoming Assessments'}
                </h2>
              </div>
              <button onClick={() => setModalType('milestone')} className="text-sm font-bold text-indigo-600 hover:text-indigo-700">Add New</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50/50">
                    <th className="px-6 py-4 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-4 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-4 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-4 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">Department</th>
                    <th className="px-6 py-4 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {currentAssessments.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <span className="text-sm font-bold text-gray-900">{item.name}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 ${role === 'management' ? 'bg-amber-50 text-amber-600' : 'bg-indigo-50 text-indigo-600'} text-[10px] font-bold rounded-md uppercase tracking-wide`}>
                          {item.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-500">{formatDate(item.date)}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-700">{item.subject}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide ${
                          item.status === 'Scheduled' || item.status === 'Pending' || item.status === 'Completed'
                            ? 'bg-emerald-50 text-emerald-600' 
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button onClick={() => { setModalType('milestone'); setEditingItem(item); }} className="text-indigo-500 hover:text-indigo-700 p-1">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(item._id, 'milestone')} className="text-red-400 hover:text-red-600 p-1">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>

        </div>

        {/* Right Column */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          
          {/* Quality Monitoring */}
          <motion.div {...fadeUp(0.15)} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                <TrendingUp className="w-5 h-5" />
              </div>
              <h2 className="font-bold text-gray-900">
                {role === 'management' ? 'Institutional Quality' : 'Quality Monitoring'}
              </h2>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {qualityStats.slice(0, 2).map((stat, i) => (
                  <div key={i} className="bg-gray-50 rounded-xl p-4 border border-gray-100 relative group">
                    <button 
                      onClick={() => { setModalType('metric'); setEditingItem(stat); }}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg text-indigo-600"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{stat.label}</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-bold text-gray-900">{stat.value}</span>
                      <span className={`text-[10px] font-bold ${stat.trend.startsWith('+') ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {stat.trend}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Chart */}
              {qualityStats.length > 0 && (
                <div className="relative h-48 bg-gray-50 rounded-xl overflow-hidden p-4 border border-gray-100">
                  <div className="absolute inset-0 flex items-end justify-between px-6 pb-4">
                    {(qualityStats[0].chartData || [40, 70, 45, 90, 65, 80, 50]).map((h: number, i: number) => (
                      <motion.div 
                        key={i}
                        initial={{ height: 0 }}
                        animate={{ height: `${h}%` }}
                        transition={{ delay: 0.5 + i * 0.1 }}
                        className={`w-4 ${role === 'management' ? 'bg-amber-500/20' : 'bg-indigo-500/20'} rounded-t-sm relative group`}
                      >
                        <motion.div 
                          initial={{ height: 0 }}
                          animate={{ height: `${h * 0.8}%` }}
                          className={`absolute bottom-0 left-0 right-0 ${role === 'management' ? 'bg-amber-600' : 'bg-indigo-600'} rounded-t-sm`}
                        />
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* Institutional Logs */}
          <motion.div {...fadeUp(0.2)} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
            <div className="p-5 border-b border-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                  <Layout className="w-5 h-5" />
                </div>
                <h2 className="font-bold text-gray-900">
                  {role === 'management' ? 'Institutional Logs' : 'Review Logs'}
                </h2>
              </div>
              <button onClick={() => setModalType('log')} className="p-1.5 hover:bg-gray-50 rounded-lg text-indigo-600">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-8 flex-1">
              {currentLogs.map((log, idx) => (
                <div key={idx} className="relative pl-10 group">
                  {/* Stem */}
                  {idx !== currentLogs.length - 1 && (
                    <div className="absolute left-[15px] top-8 bottom-[-32px] w-[2px] bg-gray-100 group-hover:bg-indigo-100 transition-colors" />
                  )}
                  
                  {/* Icon Wrapper */}
                  <div className={`absolute left-0 top-0 w-8 h-8 rounded-xl flex items-center justify-center shadow-md z-10 transition-transform group-hover:scale-110 ${
                    log.type === 'review' ? (role === 'management' ? 'bg-amber-600 text-white' : 'bg-indigo-600 text-white') : 'bg-white border border-gray-100 text-indigo-600'
                  }`}>
                    {log.type === 'review' ? <Layers className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
                  </div>

                  <div className="flex flex-col">
                    <div className="flex items-center justify-between group/title">
                      <h3 className="text-sm font-bold text-gray-900 group-hover/title:text-indigo-600 transition-colors">{log.title}</h3>
                      <div className="opacity-0 group-hover/title:opacity-100 transition-opacity flex gap-2">
                        <button onClick={() => { setModalType('log'); setEditingItem(log); }} className="p-1 text-indigo-400 hover:text-indigo-600">
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button onClick={() => handleDelete(log._id, 'log')} className="p-1 text-red-300 hover:text-red-500">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1.5 font-medium leading-relaxed">Focus: {log.focus}</p>
                    
                    <motion.div 
                      initial={{ opacity: 0, x: 10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      className={`mt-4 p-4 rounded-2xl border ${
                        log.type === 'review' ? 'bg-red-50/30 border-red-100/50' : 'bg-indigo-50/30 border-indigo-100/50'
                      }`}
                    >
                      <p className={`text-[9px] font-black uppercase tracking-widest mb-1.5 ${
                        log.type === 'review' ? 'text-red-500' : 'text-indigo-500'
                      }`}>{log.measureLabel}</p>
                      <p className="text-[11px] font-bold text-gray-800 leading-normal">{log.measure}</p>
                    </motion.div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

        </div>
      </div>
      
      {/* Footer */}
      <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
        <p className="text-[11px] font-medium text-gray-400">
          EduAdmin Pro © 2024 EduAdmin Management System. Institutional Grade Security.
        </p>
      </div>
    </div>
  )
}
