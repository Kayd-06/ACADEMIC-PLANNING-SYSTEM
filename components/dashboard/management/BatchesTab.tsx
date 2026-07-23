'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { X, Plus, Pencil, Trash2, Loader2, Users, GraduationCap, CalendarDays, UserCheck } from 'lucide-react'

const CLASS_LEVELS = ['', '9', '10', '11', '12', 'Dropper']

const EMPTY_FORM = {
  name: '', classLevel: '', capacity: '60',
  startDate: '', endDate: '', programId: '', teacherId: '',
}

const inputClass = 'w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400 focus:bg-white transition-colors'
const labelClass = 'text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5'

function BatchFormModal({ initial, isEdit, programs, teachers, saving, error, onSubmit, onClose }: {
  initial: typeof EMPTY_FORM
  isEdit: boolean
  programs: any[]
  teachers: any[]
  saving: boolean
  error: string
  onSubmit: (form: typeof EMPTY_FORM) => void
  onClose: () => void
}) {
  const [form, setForm] = useState(initial)
  const set = (f: 'name' | 'classLevel' | 'capacity' | 'startDate' | 'endDate' | 'teacherId' | 'programId') =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [f]: e.target.value }))

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 shrink-0">
          <h2 className="text-lg font-bold text-slate-900">{isEdit ? 'Edit Batch' : 'Create New Batch'}</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && <p className="text-sm text-rose-600 font-medium bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Batch Name *</label>
              <input value={form.name} onChange={set('name')} placeholder="e.g. Batch A / Grade 11-A" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Class Level</label>
              <select value={form.classLevel} onChange={set('classLevel')} className={inputClass}>
                {CLASS_LEVELS.map(c => <option key={c} value={c}>{c || 'Select…'}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Capacity</label>
              <input type="number" min={1} value={form.capacity} onChange={set('capacity')} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Start Date *</label>
              <input type="date" required value={form.startDate} onChange={set('startDate')} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>End Date</label>
              <input type="date" min={form.startDate || undefined} value={form.endDate} onChange={set('endDate')} className={inputClass} />
            </div>
          </div>

          <div>
            <label className={labelClass}>Program</label>
            <select value={form.programId} onChange={set('programId')} className={inputClass}>
              <option value="">Unassigned</option>
              {programs.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
            {programs.length === 0 && (
              <p className="text-[10px] text-slate-400 mt-1.5">No programs yet — create one in the Programs tab first.</p>
            )}
          </div>

          <div>
            <label className={labelClass}>Coordinator (Faculty)</label>
            <select value={form.teacherId} onChange={set('teacherId')} className={inputClass}>
              <option value="">Unassigned</option>
              {teachers.map(t => <option key={t.id} value={t.id}>{t.name}{t.subject ? ` — ${t.subject}` : ''}</option>)}
            </select>
            <p className="text-[10px] text-slate-400 mt-1">Assigning a coordinator also adds this batch to the teacher's own assignments.</p>
          </div>
        </div>
        <div className="flex gap-3 p-5 border-t border-slate-100 shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-bold rounded-lg hover:bg-slate-50">Cancel</button>
          <button onClick={() => onSubmit(form)} disabled={saving}
            className="flex-1 py-2.5 bg-[#0b1320] text-white text-sm font-bold rounded-lg hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} {isEdit ? 'Save Changes' : 'Create Batch'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function BatchesTab({ programFilter, onClearProgramFilter }: {
  programFilter?: { id: string; name: string } | null
  onClearProgramFilter?: () => void
}) {
  const router = useRouter()
  const [batches, setBatches] = useState<any[]>([])
  const [programs, setPrograms] = useState<any[]>([])
  const [teachers, setTeachers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; batch?: any } | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000) }

  const fetchAll = useCallback(async () => {
    try {
      const [bRes, pRes, tRes] = await Promise.all([
        fetch(programFilter ? `/api/batches?programId=${programFilter.id}` : '/api/batches'),
        fetch('/api/programs'),
        fetch('/api/teacher-portal/faculty'),
      ])
      if (bRes.ok) setBatches(await bRes.json())
      if (pRes.ok) { const d = await pRes.json(); if (Array.isArray(d)) setPrograms(d) }
      if (tRes.ok) { const d = await tRes.json(); if (Array.isArray(d)) setTeachers(d) }
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }, [programFilter])

  useEffect(() => { setLoading(true); fetchAll() }, [fetchAll])

  async function saveBatch(form: typeof EMPTY_FORM) {
    if (!form.name.trim()) { setError('Batch name is required.'); return }
    if (!form.startDate.trim()) { setError('Start date is required.'); return }
    if (form.endDate && form.endDate < form.startDate) { setError('End date cannot be before start date.'); return }
    setSaving(true)
    setError('')
    try {
      const isEdit = modal?.mode === 'edit'
      const url = isEdit ? `/api/batches?id=${modal!.batch._id}` : '/api/batches'
      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to save batch.'); return }
      setModal(null)
      showToast(isEdit ? 'Batch updated' : `Batch "${data.name}" created`)
      fetchAll()
      window.dispatchEvent(new Event('batchesUpdated'))
    } finally { setSaving(false) }
  }

  async function deleteBatch(batch: any) {
    if (!confirm(`Delete batch "${batch.name}"?`)) return
    const res = await fetch(`/api/batches?id=${batch._id}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) { showToast(data.error || 'Failed to delete batch'); return }
    showToast('Batch deleted')
    fetchAll()
    window.dispatchEvent(new Event('batchesUpdated'))
  }

  function viewStudents(batch: any) {
    localStorage.setItem('selectedBatch', batch.name)
    window.dispatchEvent(new Event('batchChanged'))
    router.push('/management/students')
  }

  return (
    <div>
      {toast && (
        <div className="fixed bottom-6 right-6 bg-[#0b1320] text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 z-[300]">
          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          <span className="text-sm font-medium">{toast}</span>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <p className="text-sm text-slate-500">Student groups per year — capacity, schedule, and faculty coordination.</p>
          {programFilter && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full text-[11px] font-bold">
              Program: {programFilter.name}
              <button onClick={onClearProgramFilter} className="hover:text-indigo-900"><X className="w-3 h-3" /></button>
            </span>
          )}
        </div>
        <button onClick={() => { setError(''); setModal({ mode: 'add' }) }}
          className="flex items-center gap-2 px-4 py-2 bg-[#0b1320] hover:bg-slate-800 text-white rounded-lg text-sm font-semibold transition-all shadow-sm">
          <Plus className="w-4 h-4" /> New Batch
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-slate-400 animate-spin" /></div>
      ) : batches.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-200">
          <Users className="w-12 h-12 text-slate-300 mb-3" />
          <p className="text-slate-600 font-bold mb-1">No batches yet</p>
          <p className="text-sm text-slate-400">Create a batch to start organizing students.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {batches.map(b => {
            const pct = b.capacity > 0 ? Math.min(100, Math.round((b.enrolledCount / b.capacity) * 100)) : 0
            return (
              <div key={b._id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                <div className={`h-1.5 w-full ${pct >= 100 ? 'bg-rose-500' : pct >= 80 ? 'bg-amber-400' : 'bg-indigo-600'}`} />
                <div className="p-5">
                  <div className="flex items-start justify-between mb-1">
                    <div className="min-w-0">
                      <h3 className="text-[15px] font-bold text-slate-900 truncate">{b.name}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">{b.classLevel ? `Class ${b.classLevel}` : 'No class level'}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <button onClick={() => { setError(''); setModal({ mode: 'edit', batch: b }) }}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => deleteBatch(b)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>

                  {/* Program */}
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {b.programName ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-indigo-50 text-indigo-700 border-indigo-100">{b.programName}</span>
                    ) : (
                      <span className="text-[11px] text-slate-300 italic">No program assigned</span>
                    )}
                  </div>

                  {/* Enrollment meter */}
                  <div className="mt-4">
                    <div className="flex justify-between text-[11px] font-bold text-slate-600 mb-1">
                      <span className="flex items-center gap-1"><Users className="w-3 h-3 text-slate-400" /> {b.enrolledCount} / {b.capacity} students</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${pct >= 100 ? 'bg-rose-500' : pct >= 80 ? 'bg-amber-400' : 'bg-indigo-600'}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <div className="flex items-center gap-2 text-[11px] text-slate-600">
                      <UserCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate font-semibold">{b.teacherName ?? 'No coordinator'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-600">
                      <CalendarDays className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{b.startDate || '—'} → {b.endDate || '—'}</span>
                    </div>
                  </div>

                  <button onClick={() => viewStudents(b)}
                    className="w-full mt-4 py-2 border border-slate-200 text-slate-700 text-sm font-bold rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center justify-center gap-2">
                    <GraduationCap className="w-4 h-4" /> View Students
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modal && (
        <BatchFormModal
          initial={modal.mode === 'edit' ? {
            name: modal.batch.name ?? '',
            classLevel: modal.batch.classLevel ?? '',
            capacity: String(modal.batch.capacity ?? 60),
            startDate: modal.batch.startDate ?? '',
            endDate: modal.batch.endDate ?? '',
            programId: modal.batch.programId ?? '',
            teacherId: modal.batch.teacherId ?? '',
          } : { ...EMPTY_FORM, programId: programFilter?.id ?? '' }}
          isEdit={modal.mode === 'edit'}
          programs={programs}
          teachers={teachers}
          saving={saving}
          error={error}
          onSubmit={saveBatch}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
