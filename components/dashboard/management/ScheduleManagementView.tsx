'use client'
import { useState, useEffect } from 'react'
import { X, Plus, Pencil, Trash2, Loader2, Repeat, Sparkles, ToggleLeft, ToggleRight, Building2 } from 'lucide-react'

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const SPECIAL_TYPES = ['Extra', 'Doubt', 'Revision', 'Makeup', 'Orientation']
const TYPE_BADGE: Record<string, string> = {
  Extra: 'bg-indigo-50 text-indigo-700',
  Doubt: 'bg-blue-50 text-blue-700',
  Revision: 'bg-amber-50 text-amber-700',
  Makeup: 'bg-purple-50 text-purple-700',
  Orientation: 'bg-emerald-50 text-emerald-700',
}

const inputClass = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'
const labelClass = 'block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5'

const EMPTY_SLOT = {
  teacherName: '', teacherEmail: '', subject: '', batch: '',
  dayOfWeek: 1, startTime: '09:00 AM', endTime: '10:00 AM', room: '',
  effectiveFrom: '', effectiveTo: '', isActive: true, schoolId: '',
}

const EMPTY_SPECIAL = {
  title: '', type: 'Extra', subject: '', batch: '',
  date: new Date().toISOString().split('T')[0], startTime: '10:00 AM', endTime: '11:00 AM', room: '',
  notes: '', teacherName: '', teacherEmail: '', schoolId: '',
}

function SlotFormModal({ initial, isEdit, onClose, onSubmit, saving, error, adminSchools }: {
  initial: typeof EMPTY_SLOT
  isEdit: boolean
  onClose: () => void
  onSubmit: (form: typeof EMPTY_SLOT) => void
  saving: boolean
  error: string
  adminSchools: any[]
}) {
  const [form, setForm] = useState(initial)
  const set = (f: string) => (e: React.ChangeEvent<any>) =>
    setForm(prev => ({ ...prev, [f]: f === 'dayOfWeek' ? Number(e.target.value) : e.target.value }))

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">{isEdit ? 'Edit Schedule Slot' : 'Add Schedule Slot'}</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto">
          {error && <p className="text-sm text-rose-600 font-medium bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Teacher Name</label>
              <input value={form.teacherName} onChange={set('teacherName')} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Teacher Email *</label>
              <input value={form.teacherEmail} onChange={set('teacherEmail')} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Subject *</label>
              <input value={form.subject} onChange={set('subject')} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Batch *</label>
              <input value={form.batch} onChange={set('batch')} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Day of Week</label>
              <select value={form.dayOfWeek} onChange={set('dayOfWeek')} className={inputClass + ' bg-white'}>
                {DAY_LABELS.map((d, i) => <option key={d} value={i}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Room</label>
              <input value={form.room} onChange={set('room')} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Start Time *</label>
              <input value={form.startTime} onChange={set('startTime')} placeholder="09:00 AM" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>End Time *</label>
              <input value={form.endTime} onChange={set('endTime')} placeholder="10:00 AM" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Effective From</label>
              <input type="date" value={form.effectiveFrom || ''} onChange={set('effectiveFrom')} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Effective To</label>
              <input type="date" value={form.effectiveTo || ''} onChange={set('effectiveTo')} className={inputClass} />
            </div>
            {adminSchools && adminSchools.length > 0 && (
              <div className="col-span-2">
                <label className={labelClass}>Connected School (Visibility)</label>
                <select
                  value={form.schoolId || ''}
                  onChange={set('schoolId')}
                  className={inputClass + ' bg-white font-semibold text-indigo-900 border-indigo-200'}
                >
                  <option value="">General / All Schools</option>
                  {adminSchools.map((s: any) => (
                    <option key={s.id || s._id} value={s.id || s._id}>
                      {s.name || `School (${(s.id || s._id)?.slice(0, 8)})`} {s.board ? `— ${s.board}` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">Only faculty belonging to the selected school will see this slot.</p>
              </div>
            )}
          </div>
          <label className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 cursor-pointer">
            <input type="checkbox" checked={form.isActive}
              onChange={e => setForm(prev => ({ ...prev, isActive: e.target.checked }))}
              className="w-4 h-4 accent-indigo-600" />
            <span className="text-[13px] font-semibold text-slate-700">Slot is active</span>
          </label>
        </div>
        <div className="p-5 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800">Cancel</button>
          <button onClick={() => onSubmit(form)} disabled={saving}
            className="px-4 py-2 bg-[#0b1320] text-white text-sm font-bold rounded-lg hover:bg-slate-800 shadow-sm disabled:opacity-50 flex items-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} {isEdit ? 'Save Changes' : 'Add Slot'}
          </button>
        </div>
      </div>
    </div>
  )
}

function SpecialFormModal({ initial, isEdit, onClose, onSubmit, saving, error, adminSchools }: {
  initial: typeof EMPTY_SPECIAL
  isEdit: boolean
  onClose: () => void
  onSubmit: (form: typeof EMPTY_SPECIAL) => void
  saving: boolean
  error: string
  adminSchools: any[]
}) {
  const [form, setForm] = useState(initial)
  const set = (f: string) => (e: React.ChangeEvent<any>) =>
    setForm(prev => ({ ...prev, [f]: e.target.value }))

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">{isEdit ? 'Edit Special Class' : 'Add Special Class'}</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto">
          {error && <p className="text-sm text-rose-600 font-medium bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Title *</label>
              <input value={form.title} onChange={set('title')} placeholder="e.g. Revision Session" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Class Type</label>
              <select value={form.type} onChange={set('type')} className={inputClass + ' bg-white'}>
                {SPECIAL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Subject</label>
              <input value={form.subject} onChange={set('subject')} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Batch</label>
              <input value={form.batch} onChange={set('batch')} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Date *</label>
              <input type="date" value={form.date} onChange={set('date')} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Room</label>
              <input value={form.room} onChange={set('room')} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Start Time *</label>
              <input value={form.startTime} onChange={set('startTime')} placeholder="10:00 AM" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>End Time *</label>
              <input value={form.endTime} onChange={set('endTime')} placeholder="11:00 AM" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Teacher Name</label>
              <input value={form.teacherName} onChange={set('teacherName')} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Teacher Email</label>
              <input value={form.teacherEmail} onChange={set('teacherEmail')} className={inputClass} />
            </div>
            {adminSchools && adminSchools.length > 0 && (
              <div className="col-span-2">
                <label className={labelClass}>Connected School (Visibility)</label>
                <select
                  value={form.schoolId || ''}
                  onChange={set('schoolId')}
                  className={inputClass + ' bg-white font-semibold text-indigo-900 border-indigo-200'}
                >
                  <option value="">General / All Schools</option>
                  {adminSchools.map((s: any) => (
                    <option key={s.id || s._id} value={s.id || s._id}>
                      {s.name || `School (${(s.id || s._id)?.slice(0, 8)})`} {s.board ? `— ${s.board}` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">Only faculty belonging to this school will see this special class.</p>
              </div>
            )}
            <div className="col-span-2">
              <label className={labelClass}>Notes / Description</label>
              <input value={form.notes} onChange={set('notes')} placeholder="Any preparation instructions..." className={inputClass} />
            </div>
          </div>
        </div>
        <div className="p-5 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800">Cancel</button>
          <button onClick={() => onSubmit(form)} disabled={saving}
            className="px-4 py-2 bg-[#0b1320] text-white text-sm font-bold rounded-lg hover:bg-slate-800 shadow-sm disabled:opacity-50 flex items-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} {isEdit ? 'Save Changes' : 'Add Special Class'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ScheduleManagementView({ onUpdate }: { onUpdate?: () => void }) {
  const [schedules, setSchedules] = useState<any[]>([])
  const [specials, setSpecials] = useState<any[]>([])
  const [adminSchools, setAdminSchools] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [slotModal, setSlotModal] = useState<{ mode: 'add' | 'edit'; slot?: any } | null>(null)
  const [specialModal, setSpecialModal] = useState<{ mode: 'add' | 'edit'; special?: any } | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const fetchAll = async () => {
    try {
      const [schedRes, specRes, schoolsRes] = await Promise.all([
        fetch('/api/schedule'),
        fetch('/api/special-classes'),
        fetch('/api/admin/schools'),
      ])
      if (schedRes.ok) setSchedules(await schedRes.json())
      if (specRes.ok) setSpecials(await specRes.json())
      if (schoolsRes.ok) setAdminSchools(await schoolsRes.json())
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

  function getSchoolBadge(schoolId: string | null | undefined) {
    if (!schoolId) return <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full font-medium">All Schools</span>
    const found = adminSchools.find((s: any) => (s.id || s._id) === schoolId)
    if (!found) return <span className="text-[10px] text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full font-medium">Assigned</span>
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full font-medium truncate max-w-[140px]">
        <Building2 className="w-2.5 h-2.5 shrink-0" />
        <span className="truncate">{found.name || `School (${schoolId.slice(0, 6)})`}</span>
      </span>
    )
  }

  async function saveSlot(form: typeof EMPTY_SLOT) {
    if (!form.teacherEmail.trim() || !form.subject.trim() || !form.batch.trim()) {
      setError('Teacher email, subject and batch are required.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const isEdit = slotModal?.mode === 'edit'
      const url = isEdit ? `/api/schedule?id=${slotModal!.slot._id}` : '/api/schedule'
      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Failed to save slot.')
        return
      }
      setSlotModal(null)
      fetchAll()
      onUpdate?.()
    } finally { setSaving(false) }
  }

  async function saveSpecial(form: typeof EMPTY_SPECIAL) {
    if (!form.title.trim() || !form.date || !form.startTime || !form.endTime) {
      setError('Title, date, start time and end time are required.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const isEdit = specialModal?.mode === 'edit'
      const url = isEdit ? `/api/special-classes?id=${specialModal!.special._id}` : '/api/special-classes'
      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Failed to save special class.')
        return
      }
      setSpecialModal(null)
      fetchAll()
      onUpdate?.()
    } finally { setSaving(false) }
  }

  async function toggleActive(slot: any) {
    await fetch(`/api/schedule?id=${slot._id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !slot.isActive }),
    })
    fetchAll()
    onUpdate?.()
  }

  async function deleteSlot(slot: any) {
    if (!confirm(`Delete ${slot.subject} (${slot.batch}) on ${DAY_LABELS[slot.dayOfWeek]}?`)) return
    await fetch(`/api/schedule?id=${slot._id}`, { method: 'DELETE' })
    fetchAll()
    onUpdate?.()
  }

  async function deleteSpecial(sc: any) {
    if (!confirm(`Delete special class "${sc.title}"?`)) return
    await fetch(`/api/special-classes?id=${sc._id}`, { method: 'DELETE' })
    fetchAll()
    onUpdate?.()
  }

  return (
    <div className="space-y-8">
      {/* Class Schedules */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Repeat className="w-5 h-5 text-indigo-600" />
            <div>
              <h2 className="text-base font-bold text-slate-900">Class Schedules</h2>
              <p className="text-[11px] text-slate-400">Weekly recurring timetable across all faculty</p>
            </div>
          </div>
          <button onClick={() => { setError(''); setSlotModal({ mode: 'add' }) }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#0b1320] text-white text-xs font-bold rounded-lg hover:bg-slate-800 shadow-sm cursor-pointer">
            <Plus className="w-3.5 h-3.5" /> Add Slot
          </button>
        </div>
        {loading ? (
          <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 text-slate-400 animate-spin" /></div>
        ) : schedules.length === 0 ? (
          <p className="p-6 text-sm text-slate-400 italic">No timetable slots yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px]">
              <thead>
                <tr className="bg-slate-50/50">
                  {['Day', 'Time', 'Subject / Batch', 'Teacher', 'School', 'Room', 'Effective', 'Status', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {schedules.map(s => (
                  <tr key={s._id} className={`hover:bg-slate-50/50 ${!s.isActive ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3.5 text-[13px] font-bold text-slate-900">{DAY_LABELS[s.dayOfWeek]?.slice(0, 3)}</td>
                    <td className="px-4 py-3.5 text-[12px] font-medium text-slate-600 whitespace-nowrap">{s.startTime} – {s.endTime}</td>
                    <td className="px-4 py-3.5">
                      <p className="text-[13px] font-bold text-slate-900">{s.subject}</p>
                      <p className="text-[12px] text-slate-500">{s.batch}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-[12px] font-semibold text-slate-700">{s.teacherName || '—'}</p>
                      <p className="text-[11px] text-slate-400">{s.teacherEmail}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      {getSchoolBadge(s.schoolId)}
                    </td>
                    <td className="px-4 py-3.5 text-[12px] text-slate-600">{s.room || '—'}</td>
                    <td className="px-4 py-3.5 text-[11px] text-slate-500 whitespace-nowrap">{s.effectiveFrom || '∞'} → {s.effectiveTo || '∞'}</td>
                    <td className="px-4 py-3.5">
                      <button onClick={() => toggleActive(s)} title={s.isActive ? 'Deactivate' : 'Activate'}
                        className={`flex items-center gap-1 text-[11px] font-bold ${s.isActive ? 'text-emerald-600' : 'text-slate-400'} cursor-pointer`}>
                        {s.isActive ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                        {s.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <button onClick={() => { setError(''); setSlotModal({ mode: 'edit', slot: s }) }} className="p-1.5 text-slate-400 hover:text-indigo-600 rounded hover:bg-indigo-50 cursor-pointer"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => deleteSlot(s)} className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Special Classes */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <div>
              <h2 className="text-base font-bold text-slate-900">Special Classes</h2>
              <p className="text-[11px] text-slate-400">One-off sessions scheduled by faculty (Extra, Doubt, Revision, Makeup, Orientation)</p>
            </div>
          </div>
          <button onClick={() => { setError(''); setSpecialModal({ mode: 'add' }) }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#0b1320] text-white text-xs font-bold rounded-lg hover:bg-slate-800 shadow-sm cursor-pointer">
            <Plus className="w-3.5 h-3.5" /> Add Special Class
          </button>
        </div>
        {loading ? (
          <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 text-slate-400 animate-spin" /></div>
        ) : specials.length === 0 ? (
          <p className="p-6 text-sm text-slate-400 italic">No special classes scheduled.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr className="bg-slate-50/50">
                  {['Date & Time', 'Type', 'Title / Batch', 'Teacher', 'School', 'Notes', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {specials.map(sc => (
                  <tr key={sc._id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3.5">
                      <p className="text-[13px] font-bold text-slate-900">{sc.date}</p>
                      <p className="text-[12px] text-slate-500">{sc.startTime} - {sc.endTime}{sc.room ? ` • ${sc.room}` : ''}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full ${TYPE_BADGE[sc.type] ?? 'bg-slate-50 text-slate-600'}`}>{sc.type}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-[13px] font-bold text-slate-900">{sc.title}</p>
                      <p className="text-[12px] text-slate-500">{[sc.batch, sc.subject].filter(Boolean).join(' • ') || '—'}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-[12px] font-semibold text-slate-700">{sc.teacherName || '—'}</p>
                      <p className="text-[11px] text-slate-400">{sc.teacherEmail}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      {getSchoolBadge(sc.schoolId)}
                    </td>
                    <td className="px-4 py-3.5 max-w-[200px] truncate text-[12px] text-slate-600">{sc.notes || '—'}</td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <button onClick={() => { setError(''); setSpecialModal({ mode: 'edit', special: sc }) }} className="p-1.5 text-slate-400 hover:text-indigo-600 rounded hover:bg-indigo-50 cursor-pointer"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => deleteSpecial(sc)} className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {slotModal && (
        <SlotFormModal
          initial={slotModal.mode === 'edit' ? {
            teacherName: slotModal.slot.teacherName ?? '',
            teacherEmail: slotModal.slot.teacherEmail ?? '',
            subject: slotModal.slot.subject ?? '',
            batch: slotModal.slot.batch ?? '',
            dayOfWeek: slotModal.slot.dayOfWeek ?? 1,
            startTime: slotModal.slot.startTime ?? '09:00 AM',
            endTime: slotModal.slot.endTime ?? '10:00 AM',
            room: slotModal.slot.room ?? '',
            effectiveFrom: slotModal.slot.effectiveFrom ?? '',
            effectiveTo: slotModal.slot.effectiveTo ?? '',
            isActive: slotModal.slot.isActive ?? true,
            schoolId: slotModal.slot.schoolId ?? '',
          } : EMPTY_SLOT}
          isEdit={slotModal.mode === 'edit'}
          onClose={() => setSlotModal(null)}
          onSubmit={saveSlot}
          saving={saving}
          error={error}
          adminSchools={adminSchools}
        />
      )}

      {specialModal && (
        <SpecialFormModal
          initial={specialModal.mode === 'edit' ? {
            title: specialModal.special.title ?? '',
            type: specialModal.special.type ?? 'Extra',
            subject: specialModal.special.subject ?? '',
            batch: specialModal.special.batch ?? '',
            date: specialModal.special.date ?? new Date().toISOString().split('T')[0],
            startTime: specialModal.special.startTime ?? '10:00 AM',
            endTime: specialModal.special.endTime ?? '11:00 AM',
            room: specialModal.special.room ?? '',
            notes: specialModal.special.notes ?? '',
            teacherName: specialModal.special.teacherName ?? '',
            teacherEmail: specialModal.special.teacherEmail ?? '',
            schoolId: specialModal.special.schoolId ?? '',
          } : EMPTY_SPECIAL}
          isEdit={specialModal.mode === 'edit'}
          onClose={() => setSpecialModal(null)}
          onSubmit={saveSpecial}
          saving={saving}
          error={error}
          adminSchools={adminSchools}
        />
      )}
    </div>
  )
}
