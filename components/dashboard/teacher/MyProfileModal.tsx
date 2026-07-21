'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Loader2, Pencil, Save, ArrowLeft, Upload } from 'lucide-react'
import { getBlobUrl } from '@/lib/blob'
import Avatar from '@/components/dashboard/Avatar'

const GENDERS = ['', 'Male', 'Female', 'Other']
const STREAMS = ['', 'Science', 'Mathematics', 'Commerce', 'Humanities', 'Languages', 'Computer Science', 'Arts', 'Physical Education']

const EMPTY_FORM = {
  name: '', employeeId: '', dob: '', gender: '', bio: '', profileImgUrl: '',
  phone: '', altPhone: '', addressLine1: '', city: '', state: '', pincode: '',
  subject: '', specialization: '', qualification: '', primaryStream: '',
  experienceYears: '', joiningDate: '', batches: '0',
}

function formFromProfile(p: any): typeof EMPTY_FORM {
  return {
    name: p.name ?? '', employeeId: p.employeeId ?? '', dob: p.dob ?? '', gender: p.gender ?? '',
    bio: p.bio ?? '', profileImgUrl: p.profileImgUrl ?? '',
    phone: p.phone ?? '', altPhone: p.altPhone ?? '', addressLine1: p.addressLine1 ?? '',
    city: p.city ?? '', state: p.state ?? '', pincode: p.pincode ?? '',
    subject: p.subject ?? '', specialization: p.specialization ?? '', qualification: p.qualification ?? '',
    primaryStream: p.primaryStream ?? '', experienceYears: p.experienceYears != null ? String(p.experienceYears) : '',
    joiningDate: p.joiningDate ?? '', batches: String(p.batches ?? 0),
  }
}

const inputClass = 'w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400 focus:bg-white transition-colors'
const labelClass = 'text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5'
const sectionClass = 'text-[11px] font-extrabold text-slate-400 uppercase tracking-widest pt-1'

export default function MyProfileModal({ isOpen, onClose, onSaved }: { isOpen: boolean; onClose: () => void; onSaved?: (profile: any) => void }) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<any>(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [uploadingBlob, setUploadingBlob] = useState(false)

  async function handlePhotoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingBlob(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('folder', 'profiles')
      const res = await fetch('/api/blob/upload', { method: 'POST', body: formData })
      const resData = await res.json()
      if (!res.ok) {
        setError(resData.error || 'Upload failed')
        return
      }
      setForm(f => ({ ...f, profileImgUrl: resData.url }))
    } catch {
      setError('Network error uploading file')
    } finally {
      setUploadingBlob(false)
    }
  }

  useEffect(() => {
    if (!isOpen) { setEditing(false); setError(''); return }
    setLoading(true)
    fetch('/api/teacher/profile')
      .then(r => r.json())
      .then(d => setData(d))
      .finally(() => setLoading(false))
  }, [isOpen])

  function startEdit() {
    if (!data?.profile) return
    setForm(formFromProfile(data.profile))
    setError('')
    setEditing(true)
  }

  const set = (field: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }))

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (false) {}
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/teacher/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const result = await res.json()
      if (!res.ok) { setError(result.error || 'Failed to save changes.'); return }
      setData((prev: any) => ({ ...prev, profile: result }))
      setEditing(false)
      onSaved?.(result)
    } finally {
      setSaving(false)
    }
  }

  const p = data?.profile
  const label = 'text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5'
  const value = 'text-[13px] font-medium text-slate-900 break-words'

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className={`bg-white rounded-2xl shadow-2xl w-full border border-slate-100 overflow-hidden flex flex-col max-h-[85vh] ${editing ? 'max-w-xl' : 'max-w-lg'}`}
          >
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                {editing && (
                  <button onClick={() => setEditing(false)} className="text-slate-400 hover:text-slate-600 p-1 -ml-1 rounded-lg hover:bg-slate-50">
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                )}
                <h3 className="text-base font-bold text-slate-900">{editing ? 'Edit My Profile' : 'My Profile'}</h3>
              </div>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-50 transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {loading ? (
                <div className="flex flex-col items-center py-10 text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin mb-2" />
                  <p className="text-xs">Loading your profile…</p>
                </div>
              ) : !p ? (
                <p className="text-sm text-slate-500 text-center py-8">
                  No faculty profile found yet. Your school administration hasn't added your record — ask them to add you in the Teacher Portal.
                </p>
              ) : editing ? (
                <form onSubmit={handleSave} className="space-y-4">
                  {error && <p className="text-sm text-rose-600 font-medium bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{error}</p>}

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className={labelClass + ' mb-0'}>Profile Image URL or File</label>
                      <label className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer flex items-center gap-1">
                        {uploadingBlob ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                        {uploadingBlob ? 'Uploading...' : 'Upload File'}
                        <input type="file" accept="image/*" onChange={handlePhotoFileChange} className="hidden" disabled={uploadingBlob} />
                      </label>
                    </div>
                    <input value={form.profileImgUrl} onChange={set('profileImgUrl')} className={inputClass} placeholder="https://… or click Upload File" />
                  </div>

                  <p className={sectionClass}>Contact Information</p>
                  <div className="grid grid-cols-2 gap-3 mb-2">
                    <div><label className={labelClass}>Phone</label><input value={form.phone} onChange={set('phone')} className={inputClass} /></div>
                    <div><label className={labelClass}>Alt Phone</label><input value={form.altPhone} onChange={set('altPhone')} className={inputClass} /></div>
                    <div><label className={labelClass}>Address Line 1</label><input value={form.addressLine1} onChange={set('addressLine1')} className={inputClass} /></div>
                    <div><label className={labelClass}>City</label><input value={form.city} onChange={set('city')} className={inputClass} /></div>
                    <div><label className={labelClass}>State</label><input value={form.state} onChange={set('state')} className={inputClass} /></div>
                    <div><label className={labelClass}>Pincode</label><input value={form.pincode} onChange={set('pincode')} className={inputClass} maxLength={10} /></div>
                  </div>
                  
                  <p className="text-xs text-slate-500 italic mb-4">Professional details and identity can only be edited by the school administration.</p>

                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => setEditing(false)} className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-bold rounded-lg hover:bg-slate-50 transition-colors">
                      Cancel
                    </button>
                    <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-[#002045] hover:bg-[#1a365d] text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Changes
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Avatar src={p.profileImgUrl ? getBlobUrl(p.profileImgUrl) : null} name={p.name}
                        size="w-14 h-14" shapeClassName="rounded-full ring-2 ring-slate-100" colorClassName="bg-[#002045] text-white" textClassName="text-lg font-bold" />
                      <div>
                        <p className="text-base font-bold text-slate-900">{p.name}</p>
                        <p className="text-xs text-slate-500">
                          {p.employeeId ? `Employee ID: ${p.employeeId} · ` : ''}{p.subject}
                          <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold ${p.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                            {p.isActive ? 'ACTIVE' : 'INACTIVE'}
                          </span>
                        </p>
                      </div>
                    </div>
                    <button onClick={startEdit} className="shrink-0 flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded-lg px-3 py-1.5 transition-colors border border-indigo-100">
                      <Pencil className="w-3 h-3" /> Edit
                    </button>
                  </div>
                  {p.bio && <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 border border-slate-100 rounded-xl p-3.5">{p.bio}</p>}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">
                    <div><p className={label}>Email</p><p className={value}>{p.email || '—'}</p></div>
                    <div><p className={label}>Phone</p><p className={value}>{p.phone || '—'}{p.altPhone ? ` / ${p.altPhone}` : ''}</p></div>
                    <div><p className={label}>Date of Birth</p><p className={value}>{p.dob || '—'}</p></div>
                    <div><p className={label}>Gender</p><p className={value}>{p.gender || '—'}</p></div>
                    <div className="col-span-2"><p className={label}>Address</p><p className={value}>{[p.addressLine1, p.city, p.state, p.pincode].filter(Boolean).join(', ') || '—'}</p></div>
                    <div><p className={label}>Qualification</p><p className={value}>{p.qualification || '—'}</p></div>
                    <div><p className={label}>Experience</p><p className={value}>{p.experienceYears != null ? `${p.experienceYears} years` : (p.experience || '—')}</p></div>
                    <div><p className={label}>Primary Stream</p><p className={value}>{p.primaryStream || '—'}</p></div>
                    <div><p className={label}>Joining Date</p><p className={value}>{p.joiningDate || '—'}</p></div>
                  </div>
                  {(data.subjects?.length > 0) && (
                    <div>
                      <p className={label + ' mb-2'}>Subjects Taught</p>
                      <div className="flex flex-wrap gap-1.5">
                        {data.subjects.map((s: any) => (
                          <span key={s.id} className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${s.isPrimary ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                            {s.subjectName}{s.programName ? ` · ${s.programName}` : ''}{s.isPrimary ? ' ★' : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {(data.batches?.length > 0) && (
                    <div>
                      <p className={label + ' mb-2'}>Batch Assignments</p>
                      <div className="space-y-1.5">
                        {data.batches.map((b: any) => (
                          <div key={b.id} className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                            <span className="text-[12px] font-bold text-slate-800">{b.batchName}{b.subjectName ? ` · ${b.subjectName}` : ''}</span>
                            <span className="text-[10px] font-bold text-slate-500 uppercase">{b.role}{b.assignedAt ? ` · since ${b.assignedAt}` : ''}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <p className="text-[10px] text-slate-400 text-center pt-2">Batch and subject assignments are managed by your school administration.</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
