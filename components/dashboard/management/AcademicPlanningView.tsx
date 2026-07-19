'use client'
import { useState, useEffect, useRef } from 'react'
import { Plus, MoreVertical, X, Loader2, CheckCircle, Pencil, Trash2 } from 'lucide-react'
import SchoolsTab from './SchoolsTab'
import BatchesTab from './BatchesTab'
import SyllabusKanbanBoard from '../SyllabusKanbanBoard'
import { SelectTargetExam } from './SchoolFormHelpers'

interface ProgramData {
  _id: string
  name: string
  code: string
  type: string
  targetExam: string
  duration: string
  isActive: boolean
  colorTheme: string
  batches: number
  students: number
  subjects: number
}

const PROGRAM_TYPES = ['JEE', 'NEET', 'Foundational', 'Other']

const EMPTY_FORM = {
  name: '', code: '', type: 'Foundational', targetExam: '', duration: '', colorTheme: 'blue', isActive: true,
}

const inputClass = 'w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#0b1320] outline-none text-sm'
const labelClass = 'text-xs font-bold text-slate-500 uppercase mb-1 block'

function ProgramFormModal({ initial, isEdit, submitting, onSubmit, onClose }: {
  initial: typeof EMPTY_FORM
  isEdit: boolean
  submitting: boolean
  onSubmit: (form: typeof EMPTY_FORM) => void
  onClose: () => void
}) {
  const [form, setForm] = useState(initial)
  const set = (f: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [f]: e.target.value }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h3 className="font-bold text-slate-900">{isEdit ? 'Edit Program' : 'Add New Program'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={e => { e.preventDefault(); onSubmit(form) }} className="p-5 space-y-4">
          <div>
            <label className={labelClass}>Display Name *</label>
            <input required value={form.name} onChange={set('name')} className={inputClass} placeholder="e.g. JEE 2-Year Integrated" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Code</label>
              <input value={form.code} onChange={set('code')} className={inputClass} placeholder="e.g. JEE-2Y" />
            </div>
            <div>
              <label className={labelClass}>Type</label>
              <select value={form.type} onChange={set('type')} className={inputClass}>
                {PROGRAM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={labelClass}>Target Exam</label>
            <SelectTargetExam value={form.targetExam} onChange={val => setForm(prev => ({ ...prev, targetExam: val }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Duration (Years)</label>
              <input value={form.duration} inputMode="numeric" pattern="[0-9]*" maxLength={2}
                onChange={e => setForm(prev => ({ ...prev, duration: e.target.value.replace(/\D/g, '') }))}
                className={inputClass} placeholder="e.g. 2" />
            </div>
            <div>
              <label className={labelClass}>Theme Color</label>
              <select value={form.colorTheme} onChange={set('colorTheme')} className={inputClass}>
                <option value="blue">Blue</option>
                <option value="green">Green</option>
                <option value="purple">Purple</option>
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 cursor-pointer">
            <input type="checkbox" checked={form.isActive}
              onChange={e => setForm(prev => ({ ...prev, isActive: e.target.checked }))}
              className="w-4 h-4 accent-indigo-600" />
            <span className="text-[13px] font-semibold text-slate-700">Program is active</span>
          </label>
          <button disabled={submitting} type="submit" className="w-full mt-2 bg-[#0b1320] text-white font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors disabled:opacity-50">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} {isEdit ? 'Save Changes' : 'Create Program'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function AcademicPlanningView() {
  const [activeTab, setActiveTab] = useState('Schools')
  const [programs, setPrograms] = useState<ProgramData[]>([])
  const [loading, setLoading] = useState(true)

  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; program?: ProgramData } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  // Card 3-dot menu
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Manage → jump to Batches tab filtered by program
  const [programFilter, setProgramFilter] = useState<{ id: string; name: string } | null>(null)

  // Syllabus Tracker: batch list only — SyllabusKanbanBoard owns chapter state itself
  const [batchesList, setBatchesList] = useState<any[]>([])

  useEffect(() => { fetchData() }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenuId(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const fetchData = async () => {
    try {
      const res = await fetch('/api/programs')
      const data = await res.json()
      if (Array.isArray(data)) setPrograms(data)

      // Fetch batches
      const bRes = await fetch('/api/batches')
      const bData = await bRes.json()
      if (Array.isArray(bData)) {
        setBatchesList(bData)
      }
    } catch (err) {
      console.error('Failed to fetch initial data', err)
    } finally {
      setLoading(false)
    }
  }

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  async function saveProgram(form: typeof EMPTY_FORM) {
    if (!form.name.trim()) { showToast('Program name is required'); return }
    setSubmitting(true)
    try {
      const isEdit = modal?.mode === 'edit'
      const url = isEdit ? `/api/programs?id=${modal!.program!._id}` : '/api/programs'
      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { showToast(data.error || 'Failed to save program'); return }
      showToast(isEdit ? 'Program updated' : 'Program successfully added!')
      setModal(null)
      fetchData()
    } finally {
      setSubmitting(false)
    }
  }

  async function deleteProgram(prog: ProgramData) {
    setOpenMenuId(null)
    if (!confirm(`Delete program "${prog.name}"? Its batches will remain but be unlinked.`)) return
    const res = await fetch(`/api/programs?id=${prog._id}`, { method: 'DELETE' })
    if (res.ok) { showToast('Program deleted'); fetchData() }
    else showToast('Failed to delete program')
  }

  function manageProgram(prog: ProgramData) {
    setProgramFilter({ id: prog._id, name: prog.name })
    setActiveTab('Batches')
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

      {/* Add / Edit Program Modal */}
      {modal && (
        <ProgramFormModal
          initial={modal.mode === 'edit' ? {
            name: modal.program!.name ?? '',
            code: modal.program!.code ?? '',
            type: modal.program!.type ?? 'Foundational',
            targetExam: modal.program!.targetExam ?? '',
            duration: (modal.program!.duration ?? '').replace(/\D/g, ''),
            colorTheme: modal.program!.colorTheme ?? 'blue',
            isActive: modal.program!.isActive ?? true,
          } : EMPTY_FORM}
          isEdit={modal.mode === 'edit'}
          submitting={submitting}
          onSubmit={saveProgram}
          onClose={() => setModal(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Academic Planning</h1>
          <p className="text-[13px] text-slate-500 mt-1">
            Manage programs, batches, subjects, and syllabus coverage across the institution
          </p>
        </div>
        {activeTab === 'Programs' && (
          <button onClick={() => setModal({ mode: 'add' })} className="flex items-center gap-2 px-4 py-2 bg-[#0b1320] hover:bg-slate-800 text-white rounded-lg text-sm font-semibold transition-all shadow-sm active:scale-95">
            <Plus className="w-4 h-4" /> New Program
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 mb-8">
        <div className="flex gap-8">
          {['Schools', 'Programs', 'Batches', 'Syllabus Tracker'].map((tab) => (
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
              <button onClick={() => setModal({ mode: 'add' })} className="mt-4 text-sm font-bold text-indigo-600 hover:text-indigo-800">Add First Program</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {programs.map((prog) => (
                <div key={prog._id} className={`bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative hover:shadow-md transition-shadow ${!prog.isActive ? 'opacity-60' : ''}`}>
                  {/* Top color border */}
                  <div className={`h-1.5 w-full ${
                    prog.colorTheme === 'blue' ? 'bg-[#002045]' :
                    prog.colorTheme === 'green' ? 'bg-[#22c55e]' :
                    'bg-[#8b5cf6]'
                  }`} />

                  <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-bold text-slate-900 truncate">{prog.name}</h3>
                          {!prog.isActive && <span className="shrink-0 px-2 py-0.5 text-[9px] font-bold uppercase bg-slate-100 text-slate-500 rounded-full">Inactive</span>}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 rounded-md">{prog.type}</span>
                          {prog.targetExam && (
                            <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 rounded-md">
                              TARGET: {prog.targetExam}
                            </span>
                          )}
                          {prog.duration && (
                            <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 rounded-md">
                              {/^\d+$/.test(prog.duration)
                                ? `${prog.duration} ${prog.duration === '1' ? 'Year' : 'Years'}`
                                : prog.duration}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="relative shrink-0" ref={openMenuId === prog._id ? menuRef : undefined}>
                        <button onClick={() => setOpenMenuId(openMenuId === prog._id ? null : prog._id)} className="p-1 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-50 transition-colors">
                          <MoreVertical className="w-5 h-5" />
                        </button>
                        {openMenuId === prog._id && (
                          <div className="absolute right-0 top-full mt-1 w-32 bg-white rounded-xl shadow-lg border border-slate-200 z-30 py-1 overflow-hidden">
                            <button onClick={() => { setOpenMenuId(null); setModal({ mode: 'edit', program: prog }) }}
                              className="w-full flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
                              <Pencil className="w-3.5 h-3.5" /> Edit
                            </button>
                            <button onClick={() => deleteProgram(prog)}
                              className="w-full flex items-center gap-2 px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" /> Delete
                            </button>
                          </div>
                        )}
                      </div>
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

                    <button onClick={() => manageProgram(prog)} className="w-full py-2.5 border border-slate-200 text-slate-700 text-sm font-bold rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-[0.98]">
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
        <BatchesTab programFilter={programFilter} onClearProgramFilter={() => setProgramFilter(null)} />
      )}

      {activeTab === 'Syllabus Tracker' && (
        <SyllabusKanbanBoard batches={batchesList.map(b => b.name)} />
      )}

      {activeTab === 'Schools' && <SchoolsTab />}
    </div>
  )
}
