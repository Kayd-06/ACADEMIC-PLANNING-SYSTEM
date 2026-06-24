'use client'
import { useState, useEffect } from 'react'
import { Plus, MoreVertical, X, Loader2, CheckCircle } from 'lucide-react'

interface ProgramData {
  _id?: string
  title: string
  target: string
  batches: number
  students: number
  subjects: number
  colorTheme: string
}

export default function AcademicPlanningView() {
  const [activeTab, setActiveTab] = useState('Programs')
  const [programs, setPrograms] = useState<ProgramData[]>([])
  const [loading, setLoading] = useState(true)

  // Interaction states
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    title: '',
    target: '',
    batches: 1,
    students: 30,
    subjects: 3,
    colorTheme: 'blue'
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const res = await fetch('/api/programs')
      const data = await res.json()
      if (!data.error) {
        setPrograms(data)
      }
    } catch (err) {
      console.error('Failed to fetch programs', err)
    } finally {
      setLoading(false)
    }
  }

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const handleAddProgram = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    
    try {
      const res = await fetch('/api/programs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      
      if (res.ok) {
        showToast('Program successfully added!')
        setShowModal(false)
        setFormData({ title: '', target: '', batches: 1, students: 30, subjects: 3, colorTheme: 'blue' })
        fetchData()
      } else {
        // Fallback for visual update
        setPrograms(prev => [...prev, { ...formData, _id: Date.now().toString() }])
        showToast('Program added locally.')
        setShowModal(false)
      }
    } catch (err) {
      showToast('Error adding program.')
    } finally {
      setSubmitting(false)
    }
  }

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
              <h3 className="font-bold text-slate-900">Add New Program</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddProgram} className="p-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Program Title</label>
                <input required value={formData.title} onChange={e => setFormData(f => ({...f, title: e.target.value}))} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#0b1320] outline-none text-sm" placeholder="e.g. JEE 2-Year Integrated" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Target Goal</label>
                <input required value={formData.target} onChange={e => setFormData(f => ({...f, target: e.target.value}))} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#0b1320] outline-none text-sm" placeholder="e.g. JEE ADVANCED 2026" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">No. of Batches</label>
                  <input required type="number" value={formData.batches} onChange={e => setFormData(f => ({...f, batches: Number(e.target.value)}))} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#0b1320] outline-none text-sm" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Total Students</label>
                  <input required type="number" value={formData.students} onChange={e => setFormData(f => ({...f, students: Number(e.target.value)}))} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#0b1320] outline-none text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Subjects</label>
                  <input required type="number" value={formData.subjects} onChange={e => setFormData(f => ({...f, subjects: Number(e.target.value)}))} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#0b1320] outline-none text-sm" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Theme Color</label>
                  <select value={formData.colorTheme} onChange={e => setFormData(f => ({...f, colorTheme: e.target.value}))} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#0b1320] outline-none text-sm">
                    <option value="blue">Blue</option>
                    <option value="green">Green</option>
                    <option value="purple">Purple</option>
                  </select>
                </div>
              </div>
              <button disabled={submitting} type="submit" className="w-full mt-4 bg-[#0b1320] text-white font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Create Program
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Academic Planning</h1>
          <p className="text-[13px] text-slate-500 mt-1">
            Manage programs, batches, subjects, and syllabus coverage across the institution
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 bg-[#0b1320] hover:bg-slate-800 text-white rounded-lg text-sm font-semibold transition-all shadow-sm active:scale-95">
          <Plus className="w-4 h-4" /> New Program
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 mb-8">
        <div className="flex gap-8">
          {['Programs', 'Batches', 'Syllabus Tracker'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-4 text-sm font-bold transition-colors relative ${
                activeTab === tab ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {tab}
              {activeTab === tab && (
                <div className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-slate-900" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {activeTab === 'Programs' && (
        <>
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
            </div>
          ) : programs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
              <p className="text-sm">No programs found.</p>
              <button onClick={() => setShowModal(true)} className="mt-4 text-sm font-bold text-indigo-600 hover:text-indigo-800">Add First Program</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {programs.map((prog) => (
                <div key={prog._id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative hover:shadow-md transition-shadow">
                  {/* Top color border */}
                  <div className={`h-1.5 w-full ${
                    prog.colorTheme === 'blue' ? 'bg-[#002045]' : 
                    prog.colorTheme === 'green' ? 'bg-[#22c55e]' : 
                    'bg-[#8b5cf6]'
                  }`} />
                  
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-slate-900 mb-2">{prog.title}</h3>
                        <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 rounded-md">
                          TARGET: {prog.target}
                        </span>
                      </div>
                      <button onClick={() => showToast(`More options for ${prog.title}`)} className="p-1 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-50 transition-colors">
                        <MoreVertical className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-6 mt-8">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Batches</p>
                        <p className="text-base font-bold text-slate-900">{prog.batches}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Students</p>
                        <p className="text-base font-bold text-slate-900">{prog.students}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Subjects</p>
                        <p className="text-base font-bold text-slate-900">{prog.subjects}</p>
                      </div>
                    </div>

                    <button onClick={() => showToast(`Managing ${prog.title}`)} className="w-full py-2.5 border border-slate-200 text-slate-700 text-sm font-bold rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-[0.98]">
                      Manage
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      
      {activeTab === 'Batches' && (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-200">
          <p className="text-slate-500 font-medium">Batch Management module coming soon.</p>
          <button onClick={() => showToast('Feature in development')} className="mt-4 px-4 py-2 bg-slate-100 text-slate-700 text-sm font-bold rounded-lg hover:bg-slate-200">Notify Me</button>
        </div>
      )}
      
      {activeTab === 'Syllabus Tracker' && (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-200">
          <p className="text-slate-500 font-medium">Syllabus tracking integration required.</p>
          <button onClick={() => showToast('Syncing syllabus...')} className="mt-4 px-4 py-2 bg-slate-100 text-slate-700 text-sm font-bold rounded-lg hover:bg-slate-200">Sync Now</button>
        </div>
      )}
    </div>
  )
}
