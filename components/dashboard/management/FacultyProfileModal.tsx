'use client'
import { useState, useEffect, useCallback } from 'react'
import { X, Plus, Trash2, Loader2, Mail, Phone, MapPin, GraduationCap, BookOpen, Users } from 'lucide-react'

const BATCH_ROLES = ['primary', 'substitute', 'assistant']
const ROLE_BADGE: Record<string, string> = {
  primary: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  substitute: 'bg-amber-50 text-amber-700 border-amber-100',
  assistant: 'bg-emerald-50 text-emerald-700 border-emerald-100',
}

function Field({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">{label}</p>
      <p className="text-[13px] font-medium text-slate-900 break-words">{value || <span className="text-slate-300">—</span>}</p>
    </div>
  )
}

export default function FacultyProfileModal({ teacher, onClose, showToast }: {
  teacher: any
  onClose: () => void
  showToast: (msg: string) => void
}) {
  const [subjects, setSubjects] = useState<any[]>(teacher.subjects ?? [])
  const [batches, setBatches] = useState<any[]>(teacher.batchAssignments ?? [])

  const [newSubject, setNewSubject] = useState({ subjectName: '', programName: '', isPrimary: true })
  const [newBatch, setNewBatch] = useState({ batchName: '', subjectName: '', role: 'primary' })
  const [savingSubject, setSavingSubject] = useState(false)
  const [savingBatch, setSavingBatch] = useState(false)

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/teacher-portal/faculty/${teacher.id}/assignments`)
    if (res.ok) {
      const data = await res.json()
      setSubjects(data.subjects ?? [])
      setBatches(data.batches ?? [])
    }
  }, [teacher.id])

  useEffect(() => { refresh() }, [refresh])

  async function addSubject() {
    if (!newSubject.subjectName.trim()) { showToast('Subject name is required'); return }
    setSavingSubject(true)
    try {
      const res = await fetch(`/api/teacher-portal/faculty/${teacher.id}/assignments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'subject', ...newSubject }),
      })
      if (res.ok) { setNewSubject({ subjectName: '', programName: '', isPrimary: true }); refresh() }
      else showToast('Failed to add subject')
    } finally { setSavingSubject(false) }
  }

  async function addBatch() {
    if (!newBatch.batchName.trim()) { showToast('Batch name is required'); return }
    setSavingBatch(true)
    try {
      const res = await fetch(`/api/teacher-portal/faculty/${teacher.id}/assignments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'batch', ...newBatch }),
      })
      if (res.ok) { setNewBatch({ batchName: '', subjectName: '', role: 'primary' }); refresh() }
      else showToast('Failed to assign batch')
    } finally { setSavingBatch(false) }
  }

  async function removeAssignment(type: 'subject' | 'batch', id: string) {
    const res = await fetch(`/api/teacher-portal/faculty/${teacher.id}/assignments?type=${type}&assignmentId=${id}`, { method: 'DELETE' })
    if (res.ok) refresh()
    else showToast('Failed to remove')
  }

  const t = teacher
  const inputClass = 'px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900'

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-4">
            {t.profileImgUrl ? (
              <img src={t.profileImgUrl} alt={t.name} className="w-14 h-14 rounded-full object-cover ring-2 ring-slate-100" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-[#0b1320] text-white flex items-center justify-center text-lg font-bold">
                {t.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
              </div>
            )}
            <div>
              <h2 className="text-lg font-bold text-slate-900">{t.name}</h2>
              <p className="text-xs text-slate-500">
                {t.employeeId ? `Employee ID: ${t.employeeId} · ` : ''}{t.subject}{t.primaryStream ? ` · ${t.primaryStream}` : ''}
                <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold ${t.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {t.isActive ? 'ACTIVE' : 'INACTIVE'}
                </span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-7">
          {t.bio && <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 border border-slate-100 rounded-xl p-4">{t.bio}</p>}

          {/* Personal & Contact */}
          <div>
            <h3 className="text-[12px] font-extrabold text-slate-900 uppercase tracking-widest pb-2 border-b border-slate-100 mb-4 flex items-center gap-2">
              <Mail className="w-3.5 h-3.5 text-slate-400" /> Personal &amp; Contact
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-4">
              <Field label="Email" value={t.email} />
              <Field label="Phone" value={t.phone} />
              <Field label="Alt Phone" value={t.altPhone} />
              <Field label="Date of Birth" value={t.dob} />
              <Field label="Gender" value={t.gender} />
              <div className="col-span-2 md:col-span-1">
                <Field label="Address" value={[t.addressLine1, t.city, t.state, t.pincode].filter(Boolean).join(', ')} />
              </div>
            </div>
          </div>

          {/* Professional Profile */}
          <div>
            <h3 className="text-[12px] font-extrabold text-slate-900 uppercase tracking-widest pb-2 border-b border-slate-100 mb-4 flex items-center gap-2">
              <GraduationCap className="w-3.5 h-3.5 text-slate-400" /> Professional Profile
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-4">
              <Field label="Qualification" value={t.qualification} />
              <Field label="Experience" value={t.experienceYears != null ? `${t.experienceYears} years` : t.experience} />
              <Field label="Primary Stream" value={t.primaryStream} />
              <Field label="Joining Date" value={t.joiningDate} />
              <Field label="Specialization" value={t.specialization} />
              <Field label="Linked User Account" value={t.userId ? 'Linked ✓' : 'Not linked'} />
            </div>
          </div>

          {/* Subjects */}
          <div>
            <h3 className="text-[12px] font-extrabold text-slate-900 uppercase tracking-widest pb-2 border-b border-slate-100 mb-4 flex items-center gap-2">
              <BookOpen className="w-3.5 h-3.5 text-slate-400" /> Subjects Taught
            </h3>
            <div className="flex flex-wrap gap-2 mb-3">
              {subjects.length === 0 && <p className="text-xs text-slate-400 italic">No subjects assigned.</p>}
              {subjects.map(s => (
                <span key={s.id} className={`inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-full text-xs font-bold border ${s.isPrimary ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                  {s.subjectName}{s.programName ? ` · ${s.programName}` : ''}{s.isPrimary ? ' ★' : ''}
                  <button onClick={() => removeAssignment('subject', s.id)} className="p-0.5 hover:text-rose-600 rounded-full"><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input value={newSubject.subjectName} onChange={e => setNewSubject({ ...newSubject, subjectName: e.target.value })} placeholder="Subject name" className={inputClass + ' w-40'} />
              <input value={newSubject.programName} onChange={e => setNewSubject({ ...newSubject, programName: e.target.value })} placeholder="Program (opt)" className={inputClass + ' w-40'} />
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 cursor-pointer">
                <input type="checkbox" checked={newSubject.isPrimary} onChange={e => setNewSubject({ ...newSubject, isPrimary: e.target.checked })} className="accent-indigo-600" /> Primary
              </label>
              <button onClick={addSubject} disabled={savingSubject} className="flex items-center gap-1 px-3 py-2 bg-[#0b1320] text-white text-xs font-bold rounded-lg hover:bg-slate-800 disabled:opacity-50">
                {savingSubject ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} Add
              </button>
            </div>
          </div>

          {/* Batch Assignments */}
          <div>
            <h3 className="text-[12px] font-extrabold text-slate-900 uppercase tracking-widest pb-2 border-b border-slate-100 mb-4 flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-slate-400" /> Batch Assignments
            </h3>
            {batches.length === 0 ? (
              <p className="text-xs text-slate-400 italic mb-3">No batches assigned.</p>
            ) : (
              <div className="space-y-2 mb-3">
                {batches.map(b => (
                  <div key={b.id} className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5">
                    <div>
                      <p className="text-[13px] font-bold text-slate-900">{b.batchName}{b.subjectName ? ` · ${b.subjectName}` : ''}</p>
                      <p className="text-[11px] text-slate-500">Assigned {b.assignedAt || '—'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${ROLE_BADGE[b.role] ?? 'bg-slate-50 text-slate-600 border-slate-200'}`}>{b.role}</span>
                      <button onClick={() => removeAssignment('batch', b.id)} className="p-1 text-slate-400 hover:text-rose-600 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <input value={newBatch.batchName} onChange={e => setNewBatch({ ...newBatch, batchName: e.target.value })} placeholder="Batch name" className={inputClass + ' w-40'} />
              <input value={newBatch.subjectName} onChange={e => setNewBatch({ ...newBatch, subjectName: e.target.value })} placeholder="Subject (opt)" className={inputClass + ' w-36'} />
              <select value={newBatch.role} onChange={e => setNewBatch({ ...newBatch, role: e.target.value })} className={inputClass}>
                {BATCH_ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
              </select>
              <button onClick={addBatch} disabled={savingBatch} className="flex items-center gap-1 px-3 py-2 bg-[#0b1320] text-white text-xs font-bold rounded-lg hover:bg-slate-800 disabled:opacity-50">
                {savingBatch ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} Assign
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
