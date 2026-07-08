'use client'
import { useState, useEffect } from 'react'
import { X, Plus, Pencil, Trash2, Loader2, Repeat, Sparkles, ToggleLeft, ToggleRight } from 'lucide-react'

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
  effectiveFrom: '', effectiveTo: '', isActive: true,
}

function SlotFormModal({ initial, isEdit, onClose, onSubmit, saving, error }: {
  initial: typeof EMPTY_SLOT
  isEdit: boolean
  onClose: () => void
  onSubmit: (form: typeof EMPTY_SLOT) => void
  saving: boolean
  error: string
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

export default function ScheduleManagementView() {
  const [schedules, setSchedules] = useState<any[]>([])
  const [specials, setSpecials] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [slotModal, setSlotModal] = useState<{ mode: 'add' | 'edit'; slot?: any } | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const fetchAll = async () => {
    try {
      const [schedRes, specRes] = await Promise.all([
        fetch('/api/schedule'),
        fetch('/api/special-classes'),
      ])
      if (schedRes.ok) setSchedules(await schedRes.json())
      if (specRes.ok) setSpecials(await specRes.json())
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

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
    } finally { setSaving(false) }
  }

  async function toggleActive(slot: any) {
    await fetch(`/api/schedule?id=${slot._id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !slot.isActive }),
    })
    fetchAll()
  }

  async function deleteSlot(slot: any) {
    if (!confirm(`Delete ${slot.subject} (${slot.batch}) on ${DAY_LABELS[slot.dayOfWeek]}?`)) return
    await fetch(`/api/schedule?id=${slot._id}`, { method: 'DELETE' })
    fetchAll()
  }

  async function deleteSpecial(sc: any) {
    if (!confirm(`Delete special class "${sc.title}"?`)) return
    await fetch(`/api/special-classes?id=${sc._id}`, { method: 'DELETE' })
    fetchAll()
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
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#0b1320] text-white text-xs font-bold rounded-lg hover:bg-slate-800 shadow-sm">
            <Plus className="w-3.5 h-3.5" /> Add Slot
          </button>
        </div>
        {loading ? (
          <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 text-slate-400 animate-spin" /></div>
        ) : schedules.length === 0 ? (
          <p className="p-6 text-sm text-slate-400 italic">No timetable slots yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px]">
              <thead>
                <tr className="bg-slate-50/50">
                  {['Day', 'Time', 'Subject / Batch', 'Teacher', 'Room', 'Effective', 'Status', ''].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {schedules.map(s => (
                  <tr key={s._id} className={`hover:bg-slate-50/50 ${!s.isActive ? 'opacity-50' : ''}`}>
                    <td className="px-5 py-3.5 text-[13px] font-bold text-slate-900">{DAY_LABELS[s.dayOfWeek]?.slice(0, 3)}</td>
                    <td className="px-5 py-3.5 text-[12px] font-medium text-slate-600 whitespace-nowrap">{s.startTime} – {s.endTime}</td>
                    <td className="px-5 py-3.5">
                      <p className="text-[13px] font-bold text-slate-900">{s.subject}</p>
                      <p className="text-[12px] text-slate-500">{s.batch}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-[12px] font-semibold text-slate-700">{s.teacherName || '—'}</p>
                      <p className="text-[11px] text-slate-400">{s.teacherEmail}</p>
                    </td>
                    <td className="px-5 py-3.5 text-[12px] text-slate-600">{s.room || '—'}</td>
                    <td className="px-5 py-3.5 text-[11px] text-slate-500 whitespace-nowrap">{s.effectiveFrom || '∞'} → {s.effectiveTo || '∞'}</td>
                    <td className="px-5 py-3.5">
                      <button onClick={() => toggleActive(s)} title={s.isActive ? 'Deactivate' : 'Activate'}
                        className={`flex items-center gap-1 text-[11px] font-bold ${s.isActive ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {s.isActive ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                        {s.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <button onClick={() => { setError(''); setSlotModal({ mode: 'edit', slot: s }) }} className="p-1.5 text-slate-400 hover:text-indigo-600 rounded hover:bg-indigo-50"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => deleteSlot(s)} className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50"><Trash2 className="w-4 h-4" /></button>
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
        <div className="p-5 border-b border-slate-100 flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-amber-500" />
          <div>
            <h2 className="text-base font-bold text-slate-900">Special Classes</h2>
            <p className="text-[11px] text-slate-400">One-off sessions scheduled by faculty (Extra, Doubt, Revision, Makeup, Orientation)</p>
          </div>
        </div>
        {loading ? (
          <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 text-slate-400 animate-spin" /></div>
        ) : specials.length === 0 ? (
          <p className="p-6 text-sm text-slate-400 italic">No special classes scheduled.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr className="bg-slate-50/50">
                  {['Date & Time', 'Type', 'Title / Batch', 'Teacher', 'Notes', ''].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {specials.map(sc => (
                  <tr key={sc._id} className="hover:bg-slate-50/50">
                    <td className="px-5 py-3.5">
                      <p className="text-[13px] font-bold text-slate-900">{sc.date}</p>
                      <p className="text-[12px] text-slate-500">{sc.startTime} - {sc.endTime}{sc.room ? ` • ${sc.room}` : ''}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full ${TYPE_BADGE[sc.type] ?? 'bg-slate-50 text-slate-600'}`}>{sc.type}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-[13px] font-bold text-slate-900">{sc.title}</p>
                      <p className="text-[12px] text-slate-500">{[sc.batch, sc.subject].filter(Boolean).join(' • ') || '—'}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-[12px] font-semibold text-slate-700">{sc.teacherName || '—'}</p>
                      <p className="text-[11px] text-slate-400">{sc.teacherEmail}</p>
                    </td>
                    <td className="px-5 py-3.5 max-w-[200px] truncate text-[12px] text-slate-600">{sc.notes || '—'}</td>
                    <td className="px-5 py-3.5 text-right">
                      <button onClick={() => deleteSpecial(sc)} className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50"><Trash2 className="w-4 h-4" /></button>
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
          } : EMPTY_SLOT}
          isEdit={slotModal.mode === 'edit'}
          onClose={() => setSlotModal(null)}
          onSubmit={saveSlot}
          saving={saving}
          error={error}
        />
      )}
    </div>
  )
}
