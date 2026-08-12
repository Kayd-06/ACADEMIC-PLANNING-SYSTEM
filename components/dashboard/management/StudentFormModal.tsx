'use client'
import { useState } from 'react'
import { X, Loader2, Upload } from 'lucide-react'
import { getBlobUrl } from '@/lib/blob'
import { isValidPhone, PHONE_FORMAT_ERROR } from '@/lib/validation/phone'
import { isValidEmail, EMAIL_FORMAT_ERROR } from '@/lib/validation/email'

interface StudentFormValues {
  // Identification
  name: string
  admissionNumber: string
  aadharNumber: string
  rollNo: string
  // Contact & Address
  email: string
  phone: string
  parentContact: string
  addressLine1: string
  city: string
  state: string
  pincode: string
  // Personal Details
  dob: string
  gender: string
  bloodGroup: string
  profileImgUrl: string
  // Academic History
  previousSchool: string
  previousPercentage: string
  class: string
  program: string
  batch: string
  // Status & Metadata
  admissionDate: string
  status: string
  notes: string
}

const EMPTY_FORM: StudentFormValues = {
  name: '', admissionNumber: '', aadharNumber: '', rollNo: '',
  email: '', phone: '', parentContact: '', addressLine1: '', city: '', state: '', pincode: '',
  dob: '', gender: '', bloodGroup: '', profileImgUrl: '',
  previousSchool: '', previousPercentage: '', class: '', program: '', batch: '',
  admissionDate: '', status: 'active', notes: '',
}

const GENDERS = ['', 'Male', 'Female', 'Other']
const BLOOD_GROUPS = ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
const STATUSES = ['active', 'inactive', 'transferred', 'completed']

interface StudentFormModalProps {
  mode: 'add' | 'edit'
  student?: any
  defaultBatch?: string
  defaultProgram?: string
  onClose: () => void
  onSaved: () => void
}

function clean(v: any, fallback = ''): string {
  if (v === null || v === undefined) return fallback
  const s = String(v)
  return s === 'N/A' || s === 'Unassigned' ? fallback : s
}

function valuesFromStudent(student: any): StudentFormValues {
  // Accepts either the roster row shape (roll/rawClass/contact) or the full DB shape
  return {
    name: clean(student.name),
    admissionNumber: clean(student.admissionNumber),
    aadharNumber: clean(student.aadharNumber),
    rollNo: clean(student.rollNo ?? student.roll),
    email: clean(student.email),
    phone: clean(student.phone),
    parentContact: clean(student.parentContact ?? student.contact),
    addressLine1: clean(student.addressLine1),
    city: clean(student.city),
    state: clean(student.state),
    pincode: clean(student.pincode),
    dob: clean(student.dob),
    gender: clean(student.gender),
    bloodGroup: clean(student.bloodGroup),
    profileImgUrl: clean(student.profileImgUrl),
    previousSchool: clean(student.previousSchool),
    previousPercentage: clean(student.previousPercentage),
    class: clean(student.rawClass ?? student.class),
    program: clean(student.program),
    batch: clean(student.batch),
    admissionDate: clean(student.admissionDate),
    status: clean(student.status, 'active') || 'active',
    notes: clean(student.notes),
  }
}

export default function StudentFormModal({ mode, student, defaultBatch, defaultProgram, onClose, onSaved }: StudentFormModalProps) {
  const [form, setForm] = useState<StudentFormValues>(
    mode === 'edit' && student
      ? valuesFromStudent(student)
      : { ...EMPTY_FORM, batch: defaultBatch ?? '', program: defaultProgram ?? '' }
  )
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
      formData.append('folder', 'students')
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

  const set = (field: keyof StudentFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) {
      setError('Student name is required.')
      return
    }
    if (!isValidPhone(form.phone)) {
      setError('Phone number must be exactly 10 digits.')
      return
    }
    if (!isValidPhone(form.parentContact)) {
      setError('Parent contact number must be exactly 10 digits.')
      return
    }
    if (!isValidEmail(form.email)) {
      setError(EMAIL_FORMAT_ERROR)
      return
    }
    setSaving(true)
    setError('')
    try {
      const url = mode === 'add' ? '/api/students' : `/api/students?id=${student._id}`
      const method = mode === 'add' ? 'POST' : 'PATCH'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Something went wrong. Please try again.')
        return
      }
      onSaved()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const inputClass = 'w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400 focus:bg-white transition-colors'
  const labelClass = 'block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5'
  const sectionClass = 'text-[12px] font-extrabold text-slate-900 uppercase tracking-widest pb-2 border-b border-slate-100'

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/30 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 shrink-0">
          <h2 className="text-lg font-bold text-slate-900">{mode === 'add' ? 'Add Student' : 'Edit Student'}</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && <p className="text-sm text-rose-600 font-medium bg-rose-50 border border-rose-100 rounded-lg px-4 py-2.5">{error}</p>}

          {/* Identification */}
          <div className="space-y-4">
            <h3 className={sectionClass}>Identification</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Full Name *</label>
                <input value={form.name} onChange={set('name')} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Admission Number</label>
                <input value={form.admissionNumber} onChange={set('admissionNumber')} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Aadhar Number</label>
                <input value={form.aadharNumber} onChange={set('aadharNumber')} className={inputClass} maxLength={14} />
              </div>
              <div>
                <label className={labelClass}>Roll No</label>
                <input value={form.rollNo} onChange={set('rollNo')} className={inputClass} />
              </div>
            </div>
          </div>

          {/* Contact & Address */}
          <div className="space-y-4">
            <h3 className={sectionClass}>Contact &amp; Address</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Email</label>
                <input type="email" value={form.email} onChange={set('email')} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Phone</label>
                <input type="tel" inputMode="numeric" maxLength={10} value={form.phone} onChange={set('phone')} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Parent Contact</label>
                <input type="tel" inputMode="numeric" maxLength={10} value={form.parentContact} onChange={set('parentContact')} className={inputClass} />
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
          </div>

          {/* Personal Details */}
          <div className="space-y-4">
            <h3 className={sectionClass}>Personal Details</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Date of Birth</label>
                <input type="date" value={form.dob} onChange={set('dob')} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Gender</label>
                <select value={form.gender} onChange={set('gender')} className={inputClass}>
                  {GENDERS.map(g => <option key={g} value={g}>{g || 'Select…'}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Blood Group</label>
                <select value={form.bloodGroup} onChange={set('bloodGroup')} className={inputClass}>
                  {BLOOD_GROUPS.map(b => <option key={b} value={b}>{b || 'Select…'}</option>)}
                </select>
              </div>
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
            </div>
          </div>

          {/* Academic History */}
          <div className="space-y-4">
            <h3 className={sectionClass}>Academic History</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Previous School</label>
                <input value={form.previousSchool} onChange={set('previousSchool')} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Previous Percentage</label>
                <input value={form.previousPercentage} onChange={set('previousPercentage')} className={inputClass} placeholder="e.g. 87%" />
              </div>
              <div>
                <label className={labelClass}>Current Class</label>
                <input value={form.class} onChange={set('class')} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Program</label>
                <input value={form.program} onChange={set('program')} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Batch</label>
                <input value={form.batch} onChange={set('batch')} className={inputClass} />
              </div>
            </div>
          </div>

          {/* Status & Metadata */}
          <div className="space-y-4">
            <h3 className={sectionClass}>Status &amp; Metadata</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Admission Date</label>
                <input type="date" value={form.admissionDate} onChange={set('admissionDate')} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Status</label>
                <select value={form.status} onChange={set('status')} className={inputClass}>
                  {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className={labelClass}>Notes</label>
                <textarea value={form.notes} onChange={set('notes')} rows={3} className={inputClass + ' resize-none'} />
              </div>
            </div>
          </div>
        </form>
        <div className="flex gap-3 p-6 border-t border-slate-100 shrink-0">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-bold rounded-lg hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={saving} className="flex-1 py-2.5 bg-[#0b1320] text-white text-sm font-bold rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === 'add' ? 'Add Student' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
