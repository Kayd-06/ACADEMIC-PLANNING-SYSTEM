'use client'
import { useState, useEffect, useRef } from 'react'
import { Plus, MoreVertical, X, Loader2, CheckCircle, Pencil, Trash2, ChevronDown, Clock } from 'lucide-react'
import SchoolsTab from './SchoolsTab'
import BatchesTab from './BatchesTab'

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
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
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
            <input value={form.targetExam} onChange={set('targetExam')} className={inputClass} placeholder="e.g. JEE Main, Advanced, NEET UG, Board" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Duration</label>
              <input value={form.duration} onChange={set('duration')} className={inputClass} placeholder="e.g. 2 Years" />
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
  const [activeTab, setActiveTab] = useState('Programs')
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

  // Syllabus Tracker states
  const [batchesList, setBatchesList] = useState<any[]>([])
  const [selectedBatch, setSelectedBatch] = useState('Grade 11-A')
  const [selectedSubject, setSelectedSubject] = useState('Physics')
  const [chapters, setChapters] = useState<any[]>([])
  const [chaptersLoading, setChaptersLoading] = useState(false)
  const [chapterModal, setChapterModal] = useState<{ mode: 'add' | 'edit'; chapter?: any } | null>(null)
  const [chapterForm, setChapterForm] = useState({
    title: '', estHours: '12 hrs est.', dates: 'Aug 15 - Aug 28', notes: '', status: 'NOT STARTED'
  })

  useEffect(() => { fetchData() }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenuId(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (activeTab === 'Syllabus Tracker') {
      fetchChapters(selectedBatch, selectedSubject)
    }
  }, [activeTab, selectedBatch, selectedSubject])

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
        if (bData.length > 0) {
          setSelectedBatch(bData[0].name)
        }
      }
    } catch (err) {
      console.error('Failed to fetch initial data', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchChapters = async (batchName: string, subjectName: string) => {
    setChaptersLoading(true)
    try {
      const res = await fetch(`/api/teacher-portal/academic-planning/chapters?class=${encodeURIComponent(batchName)}&subject=${encodeURIComponent(subjectName)}`)
      const data = await res.json()
      if (data && Array.isArray(data.chapters)) {
        setChapters(data.chapters)
      } else {
        setChapters([])
      }
    } catch (err) {
      console.error('Failed to fetch chapters', err)
      setChapters([])
    } finally {
      setChaptersLoading(false)
    }
  }

  async function handleUpdateChapterStatus(chapterId: string, newStatus: string) {
    try {
      const res = await fetch('/api/teacher-portal/academic-planning/chapters', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: chapterId, status: newStatus })
      })
      if (res.ok) {
        showToast('Chapter status updated')
        fetchChapters(selectedBatch, selectedSubject)
      } else {
        showToast('Failed to update status')
      }
    } catch (err) {
      console.error(err)
      showToast('Error updating status')
    }
  }

  async function saveChapter(e: React.FormEvent) {
    e.preventDefault()
    if (!chapterForm.title.trim()) { showToast('Chapter title is required'); return }
    
    try {
      const isEdit = chapterModal?.mode === 'edit'
      const url = '/api/teacher-portal/academic-planning/chapters'
      const method = isEdit ? 'PATCH' : 'POST'
      const payload = isEdit
        ? { id: chapterModal!.chapter._id, ...chapterForm }
        : { className: selectedBatch, subject: selectedSubject, ...chapterForm }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        showToast(isEdit ? 'Chapter updated' : 'New chapter added')
        setChapterModal(null)
        fetchChapters(selectedBatch, selectedSubject)
      } else {
        const d = await res.json()
        showToast(d.error || 'Failed to save chapter')
      }
    } catch (err) {
      console.error(err)
      showToast('Error saving chapter')
    }
  }

  async function handleDeleteChapter(chapterId: string) {
    if (!confirm('Are you sure you want to delete this chapter from the syllabus?')) return
    try {
      const res = await fetch(`/api/teacher-portal/academic-planning/chapters?id=${chapterId}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        showToast('Chapter deleted')
        setChapterModal(null)
        fetchChapters(selectedBatch, selectedSubject)
      } else {
        showToast('Failed to delete chapter')
      }
    } catch (err) {
      console.error(err)
      showToast('Error deleting chapter')
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
            duration: modal.program!.duration ?? '',
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
        <button onClick={() => setModal({ mode: 'add' })} className="flex items-center gap-2 px-4 py-2 bg-[#0b1320] hover:bg-slate-800 text-white rounded-lg text-sm font-semibold transition-all shadow-sm active:scale-95">
          <Plus className="w-4 h-4" /> New Program
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 mb-8">
        <div className="flex gap-8">
          {['Programs', 'Batches', 'Syllabus Tracker', 'Schools'].map((tab) => (
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
                            <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 rounded-md">{prog.duration}</span>
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
        <div className="space-y-6">
          {/* Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Select Batch</span>
                <div className="relative w-48">
                  <select
                    value={selectedBatch}
                    onChange={e => setSelectedBatch(e.target.value)}
                    className="w-full text-sm font-bold bg-slate-50 hover:bg-slate-100 text-slate-800 rounded-xl pl-3 pr-8 py-2 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 appearance-none cursor-pointer transition-all"
                  >
                    {batchesList.map(b => (
                      <option key={b._id} value={b.name}>{b.name}</option>
                    ))}
                    {batchesList.length === 0 && <option value="Grade 11-A">Grade 11-A</option>}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Select Subject</span>
                <div className="relative w-40">
                  <select
                    value={selectedSubject}
                    onChange={e => setSelectedSubject(e.target.value)}
                    className="w-full text-sm font-bold bg-slate-50 hover:bg-slate-100 text-slate-800 rounded-xl pl-3 pr-8 py-2 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 appearance-none cursor-pointer transition-all"
                  >
                    {['Physics', 'Chemistry', 'Mathematics', 'Biology', 'English'].map(sub => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                setChapterForm({ title: '', estHours: '10 hrs est.', dates: 'Oct 01 - Oct 15', notes: '', status: 'NOT STARTED' });
                setChapterModal({ mode: 'add' });
              }}
              className="flex items-center gap-2 px-4.5 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-md cursor-pointer transition-all transform active:scale-95 sm:self-end"
            >
              <Plus className="w-4 h-4" /> Add Chapter
            </button>
          </div>

          {/* Kanban Board */}
          {chaptersLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* NOT STARTED */}
              <div className="bg-slate-50/70 rounded-2xl p-4 border border-slate-200 flex flex-col min-h-[500px]">
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200/80">
                  <span className="font-bold text-xs uppercase tracking-wider text-slate-700">Not Started</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-600">
                    {chapters.filter(c => c.status === 'NOT STARTED').length}
                  </span>
                </div>
                <div className="space-y-3 flex-1 overflow-y-auto max-h-[550px] pr-1">
                  {chapters.filter(c => c.status === 'NOT STARTED').length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-slate-200 rounded-xl">
                      <p className="text-xs font-semibold text-slate-400">No chapters in this stage</p>
                    </div>
                  ) : (
                    chapters.filter(c => c.status === 'NOT STARTED').map(chap => (
                      <div
                        key={chap._id}
                        onClick={() => {
                          setChapterForm({
                            title: chap.title,
                            estHours: chap.estHours,
                            dates: chap.dates,
                            notes: chap.notes || '',
                            status: chap.status
                          });
                          setChapterModal({ mode: 'edit', chapter: chap });
                        }}
                        className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:shadow-md hover:border-indigo-200 cursor-pointer transition-all group space-y-3"
                      >
                        <div className="flex items-start justify-between">
                          <span className="px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide bg-slate-50 border border-slate-200/60 rounded text-slate-600">
                            {selectedSubject}
                          </span>
                          <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                        </div>
                        <div>
                          <h4 className="font-bold text-xs text-slate-800 group-hover:text-indigo-600 transition-colors line-clamp-2">
                            {chap.title}
                          </h4>
                          <p className="text-[10px] text-slate-500 mt-1 font-medium">Target: {chap.dates}</p>
                        </div>
                        <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500 border-t border-slate-100 pt-2.5">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            {chap.estHours}
                          </span>
                        </div>
                        <div className="pt-2 border-t border-slate-100" onClick={e => e.stopPropagation()}>
                          <div className="relative w-full">
                            <select
                              value={chap.status}
                              onChange={e => handleUpdateChapterStatus(chap._id, e.target.value)}
                              className="w-full text-[10px] font-bold bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg pl-2 pr-6 py-1 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer appearance-none transition-all"
                            >
                              <option value="NOT STARTED">Not Started</option>
                              <option value="IN PROGRESS">In Progress</option>
                              <option value="COMPLETED">Completed</option>
                            </select>
                            <ChevronDown className="w-3.5 h-3.5 text-slate-450 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* IN PROGRESS */}
              <div className="bg-slate-50/70 rounded-2xl p-4 border border-slate-200 flex flex-col min-h-[500px]">
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200/80">
                  <span className="font-bold text-xs uppercase tracking-wider text-slate-700">In Progress</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                    {chapters.filter(c => c.status === 'IN PROGRESS').length}
                  </span>
                </div>
                <div className="space-y-3 flex-1 overflow-y-auto max-h-[550px] pr-1">
                  {chapters.filter(c => c.status === 'IN PROGRESS').length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-slate-200 rounded-xl">
                      <p className="text-xs font-semibold text-slate-400">No chapters in this stage</p>
                    </div>
                  ) : (
                    chapters.filter(c => c.status === 'IN PROGRESS').map(chap => (
                      <div
                        key={chap._id}
                        onClick={() => {
                          setChapterForm({
                            title: chap.title,
                            estHours: chap.estHours,
                            dates: chap.dates,
                            notes: chap.notes || '',
                            status: chap.status
                          });
                          setChapterModal({ mode: 'edit', chapter: chap });
                        }}
                        className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:shadow-md hover:border-indigo-200 cursor-pointer transition-all group space-y-3"
                      >
                        <div className="flex items-start justify-between">
                          <span className="px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide bg-indigo-50 border border-indigo-200/60 rounded text-indigo-700">
                            {selectedSubject}
                          </span>
                          <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
                        </div>
                        <div>
                          <h4 className="font-bold text-xs text-slate-800 group-hover:text-indigo-600 transition-colors line-clamp-2">
                            {chap.title}
                          </h4>
                          <p className="text-[10px] text-slate-500 mt-1 font-medium">Target: {chap.dates}</p>
                        </div>
                        <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500 border-t border-slate-100 pt-2.5">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            {chap.estHours}
                          </span>
                        </div>
                        <div className="pt-2 border-t border-slate-100" onClick={e => e.stopPropagation()}>
                          <div className="relative w-full">
                            <select
                              value={chap.status}
                              onChange={e => handleUpdateChapterStatus(chap._id, e.target.value)}
                              className="w-full text-[10px] font-bold bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg pl-2 pr-6 py-1 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer appearance-none transition-all"
                            >
                              <option value="NOT STARTED">Not Started</option>
                              <option value="IN PROGRESS">In Progress</option>
                              <option value="COMPLETED">Completed</option>
                            </select>
                            <ChevronDown className="w-3.5 h-3.5 text-slate-455 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* COMPLETED */}
              <div className="bg-slate-50/70 rounded-2xl p-4 border border-slate-200 flex flex-col min-h-[500px]">
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200/80">
                  <span className="font-bold text-xs uppercase tracking-wider text-slate-700">Completed</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                    {chapters.filter(c => c.status === 'COMPLETED').length}
                  </span>
                </div>
                <div className="space-y-3 flex-1 overflow-y-auto max-h-[550px] pr-1">
                  {chapters.filter(c => c.status === 'COMPLETED').length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-slate-200 rounded-xl">
                      <p className="text-xs font-semibold text-slate-400">No chapters in this stage</p>
                    </div>
                  ) : (
                    chapters.filter(c => c.status === 'COMPLETED').map(chap => (
                      <div
                        key={chap._id}
                        onClick={() => {
                          setChapterForm({
                            title: chap.title,
                            estHours: chap.estHours,
                            dates: chap.dates,
                            notes: chap.notes || '',
                            status: chap.status
                          });
                          setChapterModal({ mode: 'edit', chapter: chap });
                        }}
                        className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:shadow-md hover:border-indigo-200 cursor-pointer transition-all group space-y-3 opacity-90"
                      >
                        <div className="flex items-start justify-between">
                          <span className="px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide bg-emerald-50 border border-emerald-200/60 rounded text-emerald-700">
                            {selectedSubject}
                          </span>
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                        </div>
                        <div>
                          <h4 className="font-bold text-xs text-slate-800 group-hover:text-indigo-600 line-through decoration-slate-300 transition-colors line-clamp-2">
                            {chap.title}
                          </h4>
                          <p className="text-[10px] text-slate-400 mt-1 font-medium">Target: {chap.dates}</p>
                        </div>
                        <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500 border-t border-slate-100 pt-2.5">
                          <span className="flex items-center gap-1 text-slate-400">
                            <Clock className="w-3.5 h-3.5 text-slate-350" />
                            {chap.estHours}
                          </span>
                        </div>
                        <div className="pt-2 border-t border-slate-100" onClick={e => e.stopPropagation()}>
                          <div className="relative w-full">
                            <select
                              value={chap.status}
                              onChange={e => handleUpdateChapterStatus(chap._id, e.target.value)}
                              className="w-full text-[10px] font-bold bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg pl-2 pr-6 py-1 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer appearance-none transition-all"
                            >
                              <option value="NOT STARTED">Not Started</option>
                              <option value="IN PROGRESS">In Progress</option>
                              <option value="COMPLETED">Completed</option>
                            </select>
                            <ChevronDown className="w-3.5 h-3.5 text-slate-450 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Chapter Form Modal */}
      {chapterModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="text-lg font-bold text-slate-900">
                {chapterModal.mode === 'edit' ? 'Edit Syllabus Chapter' : 'Add New Chapter'}
              </h3>
              <button onClick={() => setChapterModal(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={saveChapter} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Chapter Title *</label>
                <input
                  type="text"
                  required
                  value={chapterForm.title}
                  onChange={e => setChapterForm({ ...chapterForm, title: e.target.value })}
                  placeholder="e.g. Chapter 01: Physical World"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50/50 hover:bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 font-medium transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Estimated Hours</label>
                  <input
                    type="text"
                    required
                    value={chapterForm.estHours}
                    onChange={e => setChapterForm({ ...chapterForm, estHours: e.target.value })}
                    placeholder="e.g. 12 hrs est."
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50/50 hover:bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 font-medium transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Target Dates</label>
                  <input
                    type="text"
                    required
                    value={chapterForm.dates}
                    onChange={e => setChapterForm({ ...chapterForm, dates: e.target.value })}
                    placeholder="e.g. Aug 15 - Aug 28"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50/50 hover:bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 font-medium transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Status</label>
                <div className="relative w-full">
                  <select
                    value={chapterForm.status}
                    onChange={e => setChapterForm({ ...chapterForm, status: e.target.value })}
                    className="w-full pl-3.5 pr-8 py-2 rounded-xl bg-slate-50/50 hover:bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 font-bold transition-all cursor-pointer appearance-none"
                  >
                    <option value="NOT STARTED">Not Started</option>
                    <option value="IN PROGRESS">In Progress</option>
                    <option value="COMPLETED">Completed</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Teacher Remarks & Notes</label>
                <textarea
                  rows={3}
                  value={chapterForm.notes}
                  onChange={e => setChapterForm({ ...chapterForm, notes: e.target.value })}
                  placeholder="e.g. Introductory concepts clear. Ready for test."
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50/50 hover:bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 font-medium transition-all"
                />
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-slate-200">
                {chapterModal.mode === 'edit' ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteChapter(chapterModal.chapter._id)}
                    className="px-4 py-2 rounded-xl border border-red-200 hover:bg-red-50 text-red-600 text-sm font-semibold cursor-pointer transition-colors"
                  >
                    Delete Chapter
                  </button>
                ) : (
                  <div />
                )}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setChapterModal(null)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-sm font-semibold cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold shadow-md cursor-pointer transition-all transform active:scale-95"
                  >
                    {chapterModal.mode === 'edit' ? 'Save Changes' : 'Create Chapter'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'Schools' && <SchoolsTab />}
    </div>
  )
}
