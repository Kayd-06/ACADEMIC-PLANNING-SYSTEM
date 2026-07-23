'use client'
import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { X, User, Phone, Mail, Loader2, Plus, Pencil, Trash2, MapPin, Briefcase, IndianRupee } from 'lucide-react'
import { getBlobUrl } from '@/lib/blob'
import { formatDate } from '@/lib/date'
import Avatar from '@/components/dashboard/Avatar'
import MessageParentModal from '@/components/dashboard/MessageParentModal'

const inputClass = 'w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400 focus:bg-white transition-colors'
const labelClass = 'block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5'

const EMPTY_GUARDIAN = {
  name: '', relationship: 'Parent', isPrimary: false,
  email: '', phone: '', altPhone: '',
  occupation: '', annualIncome: '', addressLine1: '', city: '', state: '', pincode: '',
}

const EMPTY_ENROLLMENT = { batchName: '', rollNumber: '', enrollmentDate: '', status: 'active' }

const RELATIONSHIPS = ['Parent', 'Father', 'Mother', 'Guardian', 'Grandparent', 'Sibling', 'Other']
const ENROLLMENT_STATUSES = ['active', 'dropped', 'transferred', 'completed']

function Field({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-slate-500 mb-0.5">{label}</p>
      <p className="text-[13px] font-medium text-slate-900 break-words">{value || <span className="text-slate-300">—</span>}</p>
    </div>
  )
}

function GuardianFormModal({ initial, saving, error, onSubmit, onClose }: {
  initial: typeof EMPTY_GUARDIAN
  saving: boolean
  error: string
  onSubmit: (form: typeof EMPTY_GUARDIAN) => void
  onClose: () => void
}) {
  const [form, setForm] = useState(initial)
  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }))

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/30 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 shrink-0">
          <h3 className="text-base font-bold text-slate-900">{initial.name ? 'Edit Guardian' : 'Add Guardian'}</h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && <p className="text-sm text-rose-600 font-medium bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Name *</label>
              <input value={form.name} onChange={set('name')} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Relationship</label>
              <select value={form.relationship} onChange={set('relationship')} className={inputClass}>
                {RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input type="email" value={form.email} onChange={set('email')} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Phone</label>
              <input type="tel" inputMode="numeric" maxLength={10} placeholder="10-digit mobile number" value={form.phone} onChange={set('phone')} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Alt Phone</label>
              <input value={form.altPhone} onChange={set('altPhone')} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Occupation</label>
              <input value={form.occupation} onChange={set('occupation')} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Annual Income</label>
              <input value={form.annualIncome} onChange={set('annualIncome')} className={inputClass} placeholder="e.g. 12,00,000" />
            </div>
            <div>
              <label className={labelClass}>Address Line 1</label>
              <input value={form.addressLine1} onChange={set('addressLine1')} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>City</label>
              <input value={form.city} onChange={set('city')} className={inputClass} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>State</label>
                <input value={form.state} onChange={set('state')} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Pincode</label>
                <input value={form.pincode} onChange={set('pincode')} className={inputClass} maxLength={10} />
              </div>
            </div>
          </div>
          <label className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isPrimary}
              onChange={e => setForm(f => ({ ...f, isPrimary: e.target.checked }))}
              className="w-4 h-4 accent-indigo-600"
            />
            <span className="text-[13px] font-semibold text-slate-700">Primary contact for this student</span>
          </label>
        </div>
        <div className="flex gap-3 p-5 border-t border-slate-100 shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-bold rounded-lg hover:bg-slate-50">Cancel</button>
          <button onClick={() => onSubmit(form)} disabled={saving} className="flex-1 py-2.5 bg-[#0b1320] text-white text-sm font-bold rounded-lg hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save Guardian
          </button>
        </div>
      </div>
    </div>
  )
}

function EnrollmentFormModal({ initial, saving, error, onSubmit, onClose }: {
  initial: typeof EMPTY_ENROLLMENT
  saving: boolean
  error: string
  onSubmit: (form: typeof EMPTY_ENROLLMENT) => void
  onClose: () => void
}) {
  const [form, setForm] = useState(initial)
  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }))

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/30 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-900">{initial.batchName ? 'Edit Enrollment' : 'Add Batch Enrollment'}</h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          {error && <p className="text-sm text-rose-600 font-medium bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{error}</p>}
          <div>
            <label className={labelClass}>Batch Name *</label>
            <input value={form.batchName} onChange={set('batchName')} className={inputClass} placeholder="e.g. Grade 11-A" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Roll Number</label>
              <input value={form.rollNumber} onChange={set('rollNumber')} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Enrollment Date</label>
              <input type="date" value={form.enrollmentDate} onChange={set('enrollmentDate')} className={inputClass} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Status</label>
            <select value={form.status} onChange={set('status')} className={inputClass}>
              {ENROLLMENT_STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-3 p-5 border-t border-slate-100">
          <button onClick={onClose} className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-bold rounded-lg hover:bg-slate-50">Cancel</button>
          <button onClick={() => onSubmit(form)} disabled={saving} className="flex-1 py-2.5 bg-[#0b1320] text-white text-sm font-bold rounded-lg hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save
          </button>
        </div>
      </div>
    </div>
  )
}

const enrollmentStatusStyle: Record<string, string> = {
  active: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  dropped: 'text-rose-700 bg-rose-50 border-rose-200',
  transferred: 'text-amber-700 bg-amber-50 border-amber-200',
  completed: 'text-indigo-700 bg-indigo-50 border-indigo-200',
}

interface StudentProfileDrawerProps {
  studentRow: any // roster row (has initials/color for the avatar)
  onClose: () => void
  onEdit: (student: any) => void
  onDelete: (student: any) => void
  showToast: (msg: string) => void
}

export default function StudentProfileDrawer({ studentRow, onClose, onEdit, onDelete, showToast }: StudentProfileDrawerProps) {
  const [detail, setDetail] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Guardian CRUD state
  const [guardianModal, setGuardianModal] = useState<{ mode: 'add' | 'edit'; guardian?: any } | null>(null)
  const [guardianSaving, setGuardianSaving] = useState(false)
  const [guardianError, setGuardianError] = useState('')

  // Enrollment CRUD state
  const [enrollmentModal, setEnrollmentModal] = useState<{ mode: 'add' | 'edit'; enrollment?: any } | null>(null)
  const [enrollmentSaving, setEnrollmentSaving] = useState(false)
  const [enrollmentError, setEnrollmentError] = useState('')

  const [messageModalOpen, setMessageModalOpen] = useState(false)

  const studentId = studentRow._id

  const fetchDetail = useCallback(async () => {
    try {
      const res = await fetch(`/api/students/${studentId}`)
      if (res.ok) setDetail(await res.json())
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }, [studentId])

  useEffect(() => { setLoading(true); setDetail(null); fetchDetail() }, [fetchDetail])

  async function saveGuardian(form: typeof EMPTY_GUARDIAN) {
    if (!form.name.trim()) { setGuardianError('Guardian name is required.'); return }
    if (form.phone.trim() && !/^\d{10}$/.test(form.phone.trim())) {
      setGuardianError('Phone number must be exactly 10 digits.')
      return
    }
    setGuardianSaving(true)
    setGuardianError('')
    try {
      const isEdit = guardianModal?.mode === 'edit'
      const url = isEdit
        ? `/api/students/${studentId}/guardians?guardianId=${guardianModal!.guardian.id}`
        : `/api/students/${studentId}/guardians`
      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setGuardianError(data.error || 'Failed to save guardian')
        return
      }
      setGuardianModal(null)
      showToast(isEdit ? 'Guardian updated' : 'Guardian added')
      fetchDetail()
    } finally {
      setGuardianSaving(false)
    }
  }

  async function deleteGuardian(guardian: any) {
    if (!confirm(`Remove ${guardian.name} from guardians?`)) return
    const res = await fetch(`/api/students/${studentId}/guardians?guardianId=${guardian.id}`, { method: 'DELETE' })
    if (res.ok) { showToast('Guardian removed'); fetchDetail() } else { showToast('Failed to remove guardian') }
  }

  async function saveEnrollment(form: typeof EMPTY_ENROLLMENT) {
    if (!form.batchName.trim()) { setEnrollmentError('Batch name is required.'); return }
    setEnrollmentSaving(true)
    setEnrollmentError('')
    try {
      const isEdit = enrollmentModal?.mode === 'edit'
      const url = isEdit
        ? `/api/students/${studentId}/enrollments?enrollmentId=${enrollmentModal!.enrollment.id}`
        : `/api/students/${studentId}/enrollments`
      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setEnrollmentError(data.error || 'Failed to save enrollment')
        return
      }
      setEnrollmentModal(null)
      showToast(isEdit ? 'Enrollment updated' : 'Enrollment added')
      fetchDetail()
    } finally {
      setEnrollmentSaving(false)
    }
  }

  async function deleteEnrollment(enrollment: any) {
    if (!confirm(`Remove enrollment in ${enrollment.batchName}?`)) return
    const res = await fetch(`/api/students/${studentId}/enrollments?enrollmentId=${enrollment.id}`, { method: 'DELETE' })
    if (res.ok) { showToast('Enrollment removed'); fetchDetail() } else { showToast('Failed to remove enrollment') }
  }

  const s = detail?.student
  const guardians = detail?.guardians ?? []
  const enrollments = detail?.enrollments ?? []
  const sectionHeader = 'text-[13px] font-bold text-slate-900'

  return (
    <>
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="absolute right-0 top-0 bottom-0 w-[450px] bg-white shadow-2xl border-l border-slate-200 z-50 flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">Student Profile</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Identity */}
          <div className="flex flex-col items-center mb-8">
            <Avatar src={s?.profileImgUrl ? getBlobUrl(s.profileImgUrl) : null} name={studentRow.name} initials={studentRow.initials}
              size="w-24 h-24" shapeClassName="rounded-full mb-4 shadow-sm border-4 border-white ring-2 ring-slate-100" colorClassName={studentRow.color} textClassName="text-3xl font-bold" />
            <h3 className="text-xl font-bold text-slate-900 mb-1">{studentRow.name}</h3>
            <p className="text-[13px] text-slate-500 font-medium mb-4">
              Roll No: {studentRow.roll}{s?.admissionNumber ? ` • Adm. No: ${s.admissionNumber}` : ''}
            </p>
            <div className="flex items-center gap-2 flex-wrap justify-center">
              <span className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full border border-blue-200 text-blue-700 bg-blue-50/50">
                {studentRow.batch} BATCH
              </span>
              <span className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full border border-indigo-200 text-indigo-700 bg-indigo-50/50">
                CLASS {studentRow.class}
              </span>
              {s?.status && (
                <span className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full border ${enrollmentStatusStyle[s.status] ?? 'border-slate-200 text-slate-600 bg-slate-50'}`}>
                  {s.status}
                </span>
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center py-12 text-slate-400">
              <Loader2 className="w-7 h-7 animate-spin mb-3" />
              <p className="text-sm">Loading full profile…</p>
            </div>
          ) : !s ? (
            <p className="text-sm text-slate-400 text-center py-8">Could not load profile details.</p>
          ) : (
            <>
              {/* Identification */}
              <div className="mb-8">
                <h4 className={`${sectionHeader} mb-4 pb-2 border-b border-slate-100`}>Identification</h4>
                <div className="grid grid-cols-2 gap-y-4 gap-x-4">
                  <Field label="Admission Number" value={s.admissionNumber} />
                  <Field label="Aadhar Number" value={s.aadharNumber} />
                  <Field label="Roll No" value={s.rollNo} />
                  <div className="col-span-2">
                    <Field label="Database ID" value={<span className="font-mono text-slate-500">{s.id}</span>} />
                  </div>
                </div>
              </div>

              {/* Contact & Address */}
              <div className="mb-8">
                <h4 className={`${sectionHeader} mb-4 pb-2 border-b border-slate-100`}>Contact &amp; Address</h4>
                <div className="grid grid-cols-2 gap-y-4 gap-x-4">
                  <Field label="Email" value={s.email} />
                  <Field label="Phone" value={s.phone} />
                  <div className="col-span-2">
                    <Field label="Address" value={[s.addressLine1, s.city, s.state, s.pincode].filter(Boolean).join(', ')} />
                  </div>
                </div>
              </div>

              {/* Personal Details */}
              <div className="mb-8">
                <h4 className={`${sectionHeader} mb-4 pb-2 border-b border-slate-100`}>Personal Details</h4>
                <div className="grid grid-cols-2 gap-y-4 gap-x-4">
                  <Field label="Date of Birth" value={formatDate(s.dob)} />
                  <Field label="Gender" value={s.gender} />
                  <Field label="Blood Group" value={s.bloodGroup} />
                </div>
              </div>

              {/* Academic History */}
              <div className="mb-8">
                <h4 className={`${sectionHeader} mb-4 pb-2 border-b border-slate-100`}>Academic History</h4>
                <div className="grid grid-cols-2 gap-y-4 gap-x-4">
                  <Field label="Previous School" value={s.previousSchool} />
                  <Field label="Previous Percentage" value={s.previousPercentage} />
                  <Field label="Current Class" value={s.class || '—'} />
                  <Field label="Program" value={s.program} />
                </div>
              </div>

              {/* Status & Metadata */}
              <div className="mb-8">
                <h4 className={`${sectionHeader} mb-4 pb-2 border-b border-slate-100`}>Status &amp; Metadata</h4>
                <div className="grid grid-cols-2 gap-y-4 gap-x-4">
                  <Field label="Admission Date" value={formatDate(s.admissionDate)} />
                  <Field label="Status" value={s.status} />
                  <div className="col-span-2">
                    <Field label="Notes" value={s.notes} />
                  </div>
                </div>
              </div>

              {/* Batch Enrollments */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                  <h4 className={sectionHeader}>Batch Enrollments</h4>
                  <button
                    onClick={() => { setEnrollmentError(''); setEnrollmentModal({ mode: 'add' }) }}
                    className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:underline"
                  >
                    <Plus className="w-3 h-3" /> Add
                  </button>
                </div>
                {enrollments.length === 0 ? (
                  <p className="text-[12px] text-slate-400 italic">No batch enrollments recorded.</p>
                ) : (
                  <div className="space-y-2">
                    {enrollments.map((e: any) => (
                      <div key={e.id} className="bg-slate-50 rounded-xl p-3.5 border border-slate-100 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[13px] font-bold text-slate-900 truncate">{e.batchName}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {e.rollNumber ? `Roll ${e.rollNumber}` : 'No roll'}{e.enrollmentDate ? ` • Enrolled ${formatDate(e.enrollmentDate)}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-full border ${enrollmentStatusStyle[e.status] ?? 'border-slate-200 text-slate-600 bg-white'}`}>
                            {e.status}
                          </span>
                          <button onClick={() => { setEnrollmentError(''); setEnrollmentModal({ mode: 'edit', enrollment: e }) }} className="p-1 text-slate-400 hover:text-indigo-600 rounded"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={() => deleteEnrollment(e)} className="p-1 text-slate-400 hover:text-rose-600 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Parents / Guardians */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                  <h4 className={sectionHeader}>Parents / Guardians</h4>
                  <button
                    onClick={() => { setGuardianError(''); setGuardianModal({ mode: 'add' }) }}
                    className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:underline"
                  >
                    <Plus className="w-3 h-3" /> Add
                  </button>
                </div>
                {guardians.length === 0 ? (
                  <p className="text-[12px] text-slate-400 italic">No guardians added yet.</p>
                ) : (
                  <div className="space-y-3">
                    {guardians.map((g: any) => (
                      <div key={g.id} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 flex-shrink-0">
                            <User className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1 gap-2">
                              <h5 className="text-[14px] font-bold text-slate-900 truncate">{g.name}</h5>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {g.isPrimary && (
                                  <span className="text-[9px] font-bold text-emerald-700 uppercase tracking-widest bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">Primary</span>
                                )}
                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest bg-white px-2 py-0.5 rounded border border-slate-200">{g.relationship}</span>
                              </div>
                            </div>
                            <div className="space-y-1 mt-2">
                              {g.phone && <p className="text-[12px] text-slate-600 flex items-center gap-2"><Phone className="w-3 h-3 shrink-0" /> {g.phone}{g.altPhone ? ` / ${g.altPhone}` : ''}</p>}
                              {g.email && <p className="text-[12px] text-slate-600 flex items-center gap-2"><Mail className="w-3 h-3 shrink-0" /> <span className="truncate">{g.email}</span></p>}
                              {g.occupation && <p className="text-[12px] text-slate-600 flex items-center gap-2"><Briefcase className="w-3 h-3 shrink-0" /> {g.occupation}</p>}
                              {g.annualIncome && <p className="text-[12px] text-slate-600 flex items-center gap-2"><IndianRupee className="w-3 h-3 shrink-0" /> {g.annualIncome} / year</p>}
                              {(g.addressLine1 || g.city) && (
                                <p className="text-[12px] text-slate-600 flex items-center gap-2"><MapPin className="w-3 h-3 shrink-0" /> <span className="truncate">{[g.addressLine1, g.city, g.state, g.pincode].filter(Boolean).join(', ')}</span></p>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-3">
                              <button onClick={() => { setGuardianError(''); setGuardianModal({ mode: 'edit', guardian: g }) }} className="text-[11px] font-semibold text-indigo-600 hover:underline flex items-center gap-1">
                                <Pencil className="w-3 h-3" /> Edit
                              </button>
                              <button onClick={() => deleteGuardian(g)} className="text-[11px] font-semibold text-rose-600 hover:underline flex items-center gap-1">
                                <Trash2 className="w-3 h-3" /> Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-6 border-t border-slate-100 bg-white grid grid-cols-3 gap-3">
          <button onClick={() => onEdit(s ? { ...s, _id: s.id } : studentRow)} className="py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-bold rounded-lg hover:bg-slate-50 transition-colors shadow-sm">
            Edit Profile
          </button>
          <button onClick={() => onDelete(studentRow)} className="py-2.5 bg-white border border-rose-200 text-rose-600 text-sm font-bold rounded-lg hover:bg-rose-50 transition-colors shadow-sm">
            Remove
          </button>
          <button
            onClick={() => guardians.length === 0 ? showToast('No guardian contact on file') : setMessageModalOpen(true)}
            className="py-2.5 bg-[#0b1320] text-white text-sm font-bold rounded-lg hover:bg-slate-800 transition-colors shadow-sm"
          >
            Message Parent
          </button>
        </div>

        {messageModalOpen && (
          <MessageParentModal
            guardians={guardians}
            studentName={s?.name ?? studentRow.name ?? 'this student'}
            onClose={() => setMessageModalOpen(false)}
          />
        )}
      </motion.div>

      {guardianModal && (
        <GuardianFormModal
          initial={guardianModal.mode === 'edit' ? {
            name: guardianModal.guardian.name ?? '',
            relationship: guardianModal.guardian.relationship ?? 'Parent',
            isPrimary: !!guardianModal.guardian.isPrimary,
            email: guardianModal.guardian.email ?? '',
            phone: guardianModal.guardian.phone ?? '',
            altPhone: guardianModal.guardian.altPhone ?? '',
            occupation: guardianModal.guardian.occupation ?? '',
            annualIncome: guardianModal.guardian.annualIncome ?? '',
            addressLine1: guardianModal.guardian.addressLine1 ?? '',
            city: guardianModal.guardian.city ?? '',
            state: guardianModal.guardian.state ?? '',
            pincode: guardianModal.guardian.pincode ?? '',
          } : EMPTY_GUARDIAN}
          saving={guardianSaving}
          error={guardianError}
          onSubmit={saveGuardian}
          onClose={() => setGuardianModal(null)}
        />
      )}

      {enrollmentModal && (
        <EnrollmentFormModal
          initial={enrollmentModal.mode === 'edit' ? {
            batchName: enrollmentModal.enrollment.batchName ?? '',
            rollNumber: enrollmentModal.enrollment.rollNumber ?? '',
            enrollmentDate: enrollmentModal.enrollment.enrollmentDate ?? '',
            status: enrollmentModal.enrollment.status ?? 'active',
          } : EMPTY_ENROLLMENT}
          saving={enrollmentSaving}
          error={enrollmentError}
          onSubmit={saveEnrollment}
          onClose={() => setEnrollmentModal(null)}
        />
      )}
    </>
  )
}
