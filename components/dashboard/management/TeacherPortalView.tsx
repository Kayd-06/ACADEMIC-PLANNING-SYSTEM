'use client'
import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Plus, User, GraduationCap, FileText, MessageSquare, Filter, MoreVertical, FileIcon, MessageCircle, Loader2, X, ExternalLink, Edit2, Save, Pencil, Trash2, ChevronDown, Download, Upload } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import FacultyProfileModal from './FacultyProfileModal'
import FacultyCsvUploadModal from './FacultyCsvUploadModal'
import Avatar from '../Avatar'
import { getBlobUrl } from '@/lib/blob'
import { isValidPhone, PHONE_FORMAT_ERROR } from '@/lib/validation/phone'
import { isValidEmail, EMAIL_FORMAT_ERROR } from '@/lib/validation/email'

type FacultyMember = { _id: string; name: string; sub: string; spec: string; specTheme: string; batches: number; exp: string; status: string; initials: string; color: string; profileImgUrl?: string | null }
type Material = { _id: string; title: string; type: string; fileUrl: string; spec: string; specTheme: string; author: string; time: string; iconColor: string; iconBg: string }
type CounselingLog = { _id: string; student: string; teacher: string; date: string; rawDate?: string; notes?: string; status?: string; type?: string; counselor?: string; time?: string; duration?: string; flagged?: boolean }

const EMPTY_FACULTY_FORM = {
  name: '', subject: '', specialization: '', batches: '0', experience: '', status: 'ACTIVE', email: '', phone: '',
  employeeId: '', dob: '', gender: '', bio: '', profileImgUrl: '',
  altPhone: '', addressLine1: '', city: '', state: '', pincode: '',
  qualification: '', experienceYears: '', primaryStream: '', joiningDate: '',
}

const fieldInput = 'mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900'
const fieldLabel = 'text-xs font-semibold text-slate-500 uppercase tracking-wide'

function FacultyFormFields({ form, setForm }: { form: typeof EMPTY_FACULTY_FORM; setForm: (f: typeof EMPTY_FACULTY_FORM) => void }) {
  return (
    <div className="space-y-4">
      <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pt-1">Identity</p>
      <div className="grid grid-cols-2 gap-4">
        <div><label className={fieldLabel}>Full Name *</label>
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={fieldInput} placeholder="Dr. John Smith" /></div>
        <div><label className={fieldLabel}>Employee ID</label>
          <input value={form.employeeId} onChange={e => setForm({ ...form, employeeId: e.target.value })} className={fieldInput} placeholder="EMP-0042" /></div>
        <div><label className={fieldLabel}>Date of Birth</label>
          <input type="date" value={form.dob} onChange={e => setForm({ ...form, dob: e.target.value })} className={fieldInput} /></div>
        <div><label className={fieldLabel}>Gender</label>
          <select value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })} className={fieldInput}>
            <option value="">Select…</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option>
          </select></div>
      </div>
      <div><label className={fieldLabel}>Bio</label>
        <textarea value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} rows={2} className={fieldInput + ' resize-none'} placeholder="Short introduction…" /></div>
      <div><label className={fieldLabel}>Profile Image URL</label>
        <input value={form.profileImgUrl} onChange={e => setForm({ ...form, profileImgUrl: e.target.value })} className={fieldInput} placeholder="https://…" /></div>

      <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pt-1">Contact Information</p>
      <div className="grid grid-cols-2 gap-4">
        <div><label className={fieldLabel}>Email</label>
          <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className={fieldInput} placeholder="john@school.edu" /></div>
        <div><label className={fieldLabel}>Phone</label>
          <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })} className={fieldInput} placeholder="9876543210" maxLength={10} inputMode="numeric" /></div>
        <div><label className={fieldLabel}>Alt Phone</label>
          <input value={form.altPhone} onChange={e => setForm({ ...form, altPhone: e.target.value.replace(/\D/g, '').slice(0, 10) })} className={fieldInput} placeholder="Alternate phone" maxLength={10} inputMode="numeric" /></div>
        <div><label className={fieldLabel}>Address Line 1</label>
          <input value={form.addressLine1} onChange={e => setForm({ ...form, addressLine1: e.target.value })} className={fieldInput} /></div>
        <div><label className={fieldLabel}>City</label>
          <input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} className={fieldInput} /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className={fieldLabel}>State</label>
            <input value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} className={fieldInput} /></div>
          <div><label className={fieldLabel}>Pincode</label>
            <input value={form.pincode} onChange={e => setForm({ ...form, pincode: e.target.value })} className={fieldInput} maxLength={10} /></div>
        </div>
      </div>

      <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pt-1">Professional Profile</p>
      <div className="grid grid-cols-2 gap-4">
        <div><label className={fieldLabel}>Subject *</label>
          {['Physics', 'Chemistry', 'Maths', 'Biology', 'English', 'Science', 'Social Science', 'Mental Ability', ''].includes(form.subject) || form.subject === undefined ? (
            <select
              value={form.subject}
              onChange={e => {
                if (e.target.value === 'CUSTOM') setForm({ ...form, subject: ' ' })
                else setForm({ ...form, subject: e.target.value })
              }}
              className={fieldInput}
            >
              <option value="">Select…</option>
              {['Physics', 'Chemistry', 'Maths', 'Biology', 'English', 'Science', 'Social Science', 'Mental Ability'].map(s => <option key={s} value={s}>{s}</option>)}
              <option value="CUSTOM">Custom...</option>
            </select>
          ) : (
            <div className="flex items-center gap-2">
              <input value={form.subject.trim()} onChange={e => setForm({ ...form, subject: e.target.value })} className={fieldInput} placeholder="Enter custom subject" autoFocus />
              <button type="button" onClick={() => setForm({ ...form, subject: '' })} className="mt-1 p-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 flex-shrink-0 transition-colors" title="Back to presets">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
        <div><label className={fieldLabel}>Specialization *</label>
          <select value={form.specialization} onChange={e => setForm({ ...form, specialization: e.target.value })} className={fieldInput}>
            <option value="">Select…</option>
            {Array.from(new Set(['JEE Main', 'JEE Advanced', 'NEET UG', 'BITSAT', 'NTSE', 'CUET', 'Science Olympiad', 'Maths Olympiad', form.specialization].filter(Boolean))).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div><label className={fieldLabel}>Qualification</label>
          <input value={form.qualification} onChange={e => setForm({ ...form, qualification: e.target.value })} className={fieldInput} placeholder="M.Sc., B.Ed." /></div>
        <div><label className={fieldLabel}>Primary Stream</label>
          <input value={form.primaryStream} onChange={e => setForm({ ...form, primaryStream: e.target.value })} className={fieldInput} placeholder="e.g. Science" /></div>
        <div><label className={fieldLabel}>Experience (Years)</label>
          <input type="number" min="0" value={form.experienceYears} onChange={e => setForm({ ...form, experienceYears: e.target.value, experience: e.target.value ? `${e.target.value} years` : form.experience })} className={fieldInput} /></div>
        <div><label className={fieldLabel}>Joining Date</label>
          <input type="date" value={form.joiningDate} onChange={e => setForm({ ...form, joiningDate: e.target.value })} className={fieldInput} /></div>
        <div><label className={fieldLabel}>Batches</label>
          <input type="number" min="0" value={form.batches} onChange={e => setForm({ ...form, batches: e.target.value })} className={fieldInput} /></div>
        <div><label className={fieldLabel}>Status</label>
          <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className={fieldInput}>
            <option value="ACTIVE">Active</option><option value="ON_LEAVE">On Leave</option><option value="INACTIVE">Inactive</option>
          </select></div>
      </div>
    </div>
  )
}

function formFromFaculty(f: any): typeof EMPTY_FACULTY_FORM {
  return {
    name: f.name ?? '', subject: f.subject ?? '', specialization: f.specialization ?? '',
    batches: String(f.batches ?? 0), experience: f.experience ?? '', status: f.status ?? 'ACTIVE',
    email: f.email ?? '', phone: f.phone ?? '',
    employeeId: f.employeeId ?? '', dob: f.dob ?? '', gender: f.gender ?? '', bio: f.bio ?? '', profileImgUrl: f.profileImgUrl ?? '',
    altPhone: f.altPhone ?? '', addressLine1: f.addressLine1 ?? '', city: f.city ?? '', state: f.state ?? '', pincode: f.pincode ?? '',
    qualification: f.qualification ?? '', experienceYears: f.experienceYears != null ? String(f.experienceYears) : '',
    primaryStream: f.primaryStream ?? '', joiningDate: f.joiningDate ?? '',
  }
}

export default function TeacherPortalView() {
  const [data, setData] = useState<{ kpis: any; faculty: FacultyMember[]; materials: Material[]; counseling: CounselingLog[] } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)

  // Faculty filter
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [showFilter, setShowFilter] = useState(false)
  const filterRef = useRef<HTMLDivElement>(null)

  // Row 3-dot menu — rendered via portal so it's never clipped by the
  // Faculty Directory card's scroll container
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null)
  const menuRef = useRef<HTMLTableSectionElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const MENU_WIDTH = 128
  const MENU_HEIGHT_ESTIMATE = 130

  function toggleRowMenu(e: React.MouseEvent<HTMLButtonElement>, id: string) {
    if (openMenuId === id) { setOpenMenuId(null); setMenuPos(null); return }
    const rect = e.currentTarget.getBoundingClientRect()
    const openUp = window.innerHeight - rect.bottom < MENU_HEIGHT_ESTIMATE
    setMenuPos({
      top: openUp ? rect.top - MENU_HEIGHT_ESTIMATE : rect.bottom + 4,
      left: rect.right - MENU_WIDTH,
    })
    setOpenMenuId(id)
  }

  // Import Faculty modal
  const [showImportModal, setShowImportModal] = useState(false)

  // Edit Faculty modal
  const [editFaculty, setEditFaculty] = useState<FacultyMember | null>(null)
  const [editForm, setEditForm] = useState(EMPTY_FACULTY_FORM)
  const [savingEdit, setSavingEdit] = useState(false)

  // Material preview modal
  const [previewMaterial, setPreviewMaterial] = useState<Material | null>(null)

  // Counseling edit modal
  const [editCounseling, setEditCounseling] = useState<CounselingLog | null>(null)
  const [counselingForm, setCounselingForm] = useState({ notes: '', status: '', date: '', time: '', duration: '' })
  const [savingCounseling, setSavingCounseling] = useState(false)

  useEffect(() => { fetchData() }, [])

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setShowFilter(false)
      const insideTrigger = menuRef.current && menuRef.current.contains(e.target as Node)
      const insideDropdown = dropdownRef.current && dropdownRef.current.contains(e.target as Node)
      if (!insideTrigger && !insideDropdown) { setOpenMenuId(null); setMenuPos(null) }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const fetchData = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/teacher-portal/dashboard')
      if (res.ok) setData(await res.json())
    } catch (e) { console.error(e) } finally { setIsLoading(false) }
  }

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000) }

  const filteredFaculty = (data?.faculty ?? []).filter(f => statusFilter === 'ALL' || f.status === statusFilter)

  const openEditFaculty = async (fac: FacultyMember) => {
    setOpenMenuId(null)
    // Pull the full record so every profile field is editable
    try {
      const res = await fetch('/api/teacher-portal/faculty')
      if (res.ok) {
        const list = await res.json()
        const full = Array.isArray(list) ? list.find((f: any) => f.id === fac._id) : null
        if (full) {
          setEditFaculty(fac)
          setEditForm(formFromFaculty(full))
          return
        }
      }
    } catch { /* fall through */ }
    setEditFaculty(fac)
    setEditForm({ ...EMPTY_FACULTY_FORM, name: fac.name, subject: fac.sub, specialization: fac.spec, batches: String(fac.batches), experience: fac.exp, status: fac.status })
  }

  // Full profile viewer
  const [profileFaculty, setProfileFaculty] = useState<any>(null)

  const openProfile = async (fac: FacultyMember) => {
    setOpenMenuId(null)
    try {
      const res = await fetch('/api/teacher-portal/faculty')
      if (res.ok) {
        const list = await res.json()
        const full = Array.isArray(list) ? list.find((f: any) => f.id === fac._id) : null
        if (full) setProfileFaculty(full)
        else showToast('Could not load profile')
      }
    } catch { showToast('Could not load profile') }
  }

  const handleEditFaculty = async () => {
    if (!editFaculty) return
    if (!isValidPhone(editForm.phone)) { showToast(PHONE_FORMAT_ERROR); return }
    if (!isValidPhone(editForm.altPhone)) { showToast('Alt phone number must be exactly 10 digits'); return }
    if (!isValidEmail(editForm.email)) { showToast(EMAIL_FORMAT_ERROR); return }
    setSavingEdit(true)
    try {
      const res = await fetch('/api/teacher-portal/faculty', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editFaculty._id, ...editForm, batches: Number(editForm.batches) }) })
      if (res.ok) { showToast('Faculty updated'); setEditFaculty(null); fetchData() }
      else showToast((await res.json()).error || 'Failed to update')
    } catch { showToast('Failed to update') } finally { setSavingEdit(false) }
  }

  const handleDeleteFaculty = async (id: string) => {
    setOpenMenuId(null)
    if (!confirm('Delete this faculty member?')) return
    try {
      const res = await fetch(`/api/teacher-portal/faculty?id=${id}`, { method: 'DELETE' })
      if (res.ok) { showToast('Faculty member deleted'); fetchData() }
      else showToast('Failed to delete')
    } catch { showToast('Failed to delete') }
  }

  const openEditCounseling = (log: CounselingLog) => {
    setEditCounseling(log)
    setCounselingForm({ notes: log.notes || '', status: log.status || 'Scheduled', date: log.rawDate || log.date || '', time: log.time || '', duration: log.duration || '30 mins' })
  }

  const handleSaveCounseling = async () => {
    if (!editCounseling) return
    setSavingCounseling(true)
    try {
      const res = await fetch('/api/teacher-portal/counseling', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editCounseling._id, ...counselingForm }) })
      if (res.ok) { showToast('Session updated'); setEditCounseling(null); fetchData() }
      else showToast('Failed to update')
    } catch { showToast('Failed to update') } finally { setSavingCounseling(false) }
  }

  if (isLoading) return (
    <div className="flex-1 p-8 bg-slate-50 min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center text-slate-400"><Loader2 className="w-8 h-8 animate-spin mb-4" /><p className="text-sm font-medium">Loading Teacher Portal...</p></div>
    </div>
  )

  const KPIS = data ? [
    { label: 'Total Faculty', value: data.kpis.totalFaculty.toString(), icon: User },
    { label: 'Active Batches Covered', value: data.kpis.activeBatches.toString(), icon: GraduationCap },
    { label: 'Materials Uploaded', value: data.kpis.materialsThisWeek.toString(), icon: FileText },
    { label: 'Counseling Sessions Logged', value: data.kpis.counselingSessions.toString(), icon: MessageSquare },
  ] : []

  const handleExport = async () => {
    if (!data?.faculty || data.faculty.length === 0) {
      showToast('No faculty data to export')
      return
    }
    
    const exportData = filteredFaculty
    if (exportData.length === 0) {
      showToast('No faculty match the current filter')
      return
    }

    showToast('Preparing export...')
    try {
      const res = await fetch('/api/teacher-portal/faculty')
      if (!res.ok) {
        showToast('Failed to fetch full faculty data')
        return
      }
      const fullFacultyList = await res.json()

      const headers = [
        'Full Name', 'Employee ID', 'Date of Birth', 'Gender', 'Bio', 'Profile Image URL',
        'Email', 'Phone', 'Alt Phone', 'Address Line 1', 'City', 'State', 'Pincode',
        'Subject', 'Specialization', 'Qualification', 'Primary Stream', 'Experience (Years)', 'Joining Date', 'Batches', 'Status'
      ]
      const csvRows = [headers.join(',')]
      
      for (const listFac of exportData) {
        const fullFac = fullFacultyList.find((f: any) => f.id === listFac._id) || {}
        const escape = (str: any) => `"${String(str || '').replace(/"/g, '""')}"`
        const row = [
          escape(fullFac.name || listFac.name),
          escape(fullFac.employeeId),
          escape(fullFac.dob),
          escape(fullFac.gender),
          escape(fullFac.bio),
          escape(fullFac.profileImgUrl),
          escape(fullFac.email),
          escape(fullFac.phone),
          escape(fullFac.altPhone),
          escape(fullFac.addressLine1),
          escape(fullFac.city),
          escape(fullFac.state),
          escape(fullFac.pincode),
          escape(fullFac.subject || listFac.sub),
          escape(fullFac.specialization || listFac.spec),
          escape(fullFac.qualification),
          escape(fullFac.primaryStream),
          escape(fullFac.experienceYears != null ? fullFac.experienceYears : fullFac.experience),
          escape(fullFac.joiningDate),
          escape(fullFac.batches || listFac.batches),
          escape(fullFac.status || listFac.status)
        ]
        csvRows.push(row.join(','))
      }
      
      const csvString = csvRows.join('\n')
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `faculty_export_${new Date().toISOString().split('T')[0]}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (e) {
      showToast('Error generating export')
    }
  }

  return (
    <div className="flex-1 p-8 overflow-auto bg-slate-50 min-h-screen relative">

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 right-6 bg-[#0b1320] text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 z-[100]">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" /><span className="text-sm font-medium">{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Faculty Full Profile Modal */}
      {profileFaculty && (
        <FacultyProfileModal teacher={profileFaculty} onClose={() => setProfileFaculty(null)} showToast={showToast} />
      )}

      {/* Import Modal */}
      <AnimatePresence>
        {showImportModal && (
          <FacultyCsvUploadModal
            onClose={() => setShowImportModal(false)}
            onImported={() => { setShowImportModal(false); fetchData() }}
          />
        )}
      </AnimatePresence>

      {/* Edit Faculty Modal */}
      <AnimatePresence>
        {editFaculty && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between mb-6 shrink-0">
                <h2 className="text-lg font-bold text-slate-900">Edit Faculty Member</h2>
                <button onClick={() => setEditFaculty(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
              </div>
              <div className="overflow-y-auto flex-1 pr-1">
                <FacultyFormFields form={editForm} setForm={setEditForm} />
              </div>
              <div className="flex gap-3 mt-6 shrink-0">
                <button onClick={() => setEditFaculty(null)} className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50">Cancel</button>
                <button onClick={handleEditFaculty} disabled={savingEdit} className="flex-1 px-4 py-2.5 bg-[#0b1320] text-white rounded-lg text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center gap-2">
                  {savingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Changes
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Material Preview Modal */}
      <AnimatePresence>
        {previewMaterial && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl h-[80vh] flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-slate-100">
                <div><h2 className="text-base font-bold text-slate-900">{previewMaterial.title}</h2><p className="text-xs text-slate-500">{previewMaterial.type} · {previewMaterial.author}</p></div>
                <div className="flex items-center gap-2">
                  {previewMaterial.fileUrl && <a href={getBlobUrl(previewMaterial.fileUrl)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"><ExternalLink className="w-3.5 h-3.5" /> Open in new tab</a>}
                  <button onClick={() => setPreviewMaterial(null)} className="text-slate-400 hover:text-slate-600 ml-1"><X className="w-5 h-5" /></button>
                </div>
              </div>
              <div className="flex-1 overflow-hidden p-2">
                {previewMaterial.fileUrl
                  ? <iframe src={getBlobUrl(previewMaterial.fileUrl)} className="w-full h-full rounded-lg border border-slate-100" title={previewMaterial.title} />
                  : <div className="flex flex-col items-center justify-center h-full text-slate-400"><FileIcon className="w-12 h-12 mb-3 text-slate-300" /><p className="text-sm font-medium">No file attached.</p></div>}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Counseling Edit Modal */}
      <AnimatePresence>
        {editCounseling && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <div><h2 className="text-lg font-bold text-slate-900">{editCounseling.student}</h2><p className="text-sm text-slate-500">{editCounseling.teacher} · {editCounseling.type}</p></div>
                <button onClick={() => setEditCounseling(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div><label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</label>
                    <input type="date" value={counselingForm.date} onChange={e => setCounselingForm(f => ({ ...f, date: e.target.value }))} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" /></div>
                  <div><label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Time</label>
                    <input value={counselingForm.time} onChange={e => setCounselingForm(f => ({ ...f, time: e.target.value }))} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" placeholder="10:00 AM" /></div>
                  <div><label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Duration</label>
                    <input value={counselingForm.duration} onChange={e => setCounselingForm(f => ({ ...f, duration: e.target.value }))} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" placeholder="30 mins" /></div>
                </div>
                <div><label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</label>
                  <select value={counselingForm.status} onChange={e => setCounselingForm(f => ({ ...f, status: e.target.value }))} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900">
                    <option value="Scheduled">Scheduled</option><option value="Completed">Completed</option><option value="No-Show">No-Show</option><option value="Cancelled">Cancelled</option>
                  </select></div>
                <div><label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Notes</label>
                  <textarea value={counselingForm.notes} onChange={e => setCounselingForm(f => ({ ...f, notes: e.target.value }))} rows={4} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none" placeholder="Session notes..." /></div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setEditCounseling(null)} className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50">Cancel</button>
                <button onClick={handleSaveCounseling} disabled={savingCounseling} className="flex-1 px-4 py-2.5 bg-[#0b1320] text-white rounded-lg text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center gap-2">
                  {savingCounseling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Changes
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Teacher Portal</h1>
          <p className="text-[13px] text-slate-500 mt-1">Monitor faculty schedules, materials, and counseling activity</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {KPIS.map((kpi, idx) => (
          <div key={idx} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-start gap-4">
            <div className="p-3 bg-slate-100 rounded-xl"><kpi.icon className="w-5 h-5 text-slate-600" /></div>
            <div><p className="text-[11px] font-semibold text-slate-500 mb-1">{kpi.label}</p><p className="text-2xl font-bold text-slate-900">{kpi.value}</p></div>
          </div>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[400px]">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Faculty Directory</h2>
              <div className="flex items-center gap-3 text-slate-400">

                {/* Export button */}
                <button onClick={handleExport} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                  <Download className="w-3.5 h-3.5" />
                  <span>Export</span>
                </button>

                {/* Import button */}
                <button onClick={() => setShowImportModal(true)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Import CSV</span>
                </button>

                {/* Filter dropdown */}
                <div className="relative" ref={filterRef}>
                  <button onClick={() => setShowFilter(v => !v)} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${statusFilter !== 'ALL' ? 'bg-slate-900 text-white' : 'hover:bg-slate-100 text-slate-500'}`}>
                    <Filter className="w-3.5 h-3.5" />
                    {statusFilter !== 'ALL' && <span>{statusFilter}</span>}
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  <AnimatePresence>
                    {showFilter && (
                      <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                        className="absolute right-0 top-full mt-1 w-36 bg-white rounded-xl shadow-lg border border-slate-200 z-20 py-1 overflow-hidden">
                        {['ALL', 'ACTIVE', 'ON_LEAVE', 'INACTIVE'].map(s => (
                          <button key={s} onClick={() => { setStatusFilter(s); setShowFilter(false) }}
                            className={`w-full text-left px-4 py-2 text-xs font-semibold transition-colors ${statusFilter === s ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50'}`}>
                            {s === 'ALL' ? 'All Status' : s === 'ON_LEAVE' ? 'On Leave' : s.charAt(0) + s.slice(1).toLowerCase()}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {filteredFaculty.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-400">
                <User className="w-12 h-12 mb-4 text-slate-300" />
                <p className="text-base font-bold text-slate-600 mb-1">{data?.faculty.length === 0 ? 'No Faculty Members' : 'No results for this filter'}</p>
                <p className="text-sm font-medium">{data?.faculty.length === 0 ? 'No faculty members found.' : 'Try a different status filter.'}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                      {['Faculty Name', 'Specialization', 'Batches', 'Experience', 'Status', ''].map(h => (
                        <th key={h} className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100" ref={menuRef}>
                    {filteredFaculty.map((fac, idx) => (
                      <tr key={fac._id || idx} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <Avatar src={fac.profileImgUrl ? getBlobUrl(fac.profileImgUrl) : null} name={fac.name} initials={fac.initials}
                              size="w-10 h-10" shapeClassName="rounded-full shadow-sm" colorClassName={fac.color} textClassName="text-sm font-bold" />
                            <div><h4 className="text-[13px] font-bold text-slate-900">{fac.name}</h4><p className="text-[11px] text-slate-500">{fac.sub}</p></div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {fac.spec ? (
                            <span className={`px-2.5 py-1 text-[10px] font-bold rounded border uppercase tracking-wider ${fac.specTheme === 'green' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : fac.specTheme === 'purple' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>{fac.spec}</span>
                          ) : (
                            <span className="text-[12px] text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[11px] font-bold mx-auto">{fac.batches}</div>
                        </td>
                        <td className="px-6 py-4 text-[13px] font-medium text-slate-600">{fac.exp}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full border uppercase tracking-wider ${fac.status === 'ACTIVE' ? 'border-emerald-200 text-emerald-700 bg-emerald-50' : fac.status === 'ON_LEAVE' ? 'border-amber-200 text-amber-700 bg-amber-50' : 'border-slate-200 text-slate-700 bg-slate-50'}`}>{fac.status}</span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="relative">
                            <button onClick={(e) => toggleRowMenu(e, fac._id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {typeof document !== 'undefined' && createPortal(
            <AnimatePresence>
              {openMenuId && menuPos && (() => {
                const activeFac = filteredFaculty.find(f => f._id === openMenuId)
                if (!activeFac) return null
                return (
                  <motion.div ref={dropdownRef}
                    initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                    style={{ position: 'fixed', top: menuPos.top, left: menuPos.left }}
                    className="w-32 bg-white rounded-xl shadow-lg border border-slate-200 z-[999] py-1 overflow-hidden">
                    <button onClick={() => { openProfile(activeFac); setOpenMenuId(null); setMenuPos(null) }} className="w-full flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
                      <User className="w-3.5 h-3.5" /> Profile
                    </button>
                    <button onClick={() => { openEditFaculty(activeFac); setOpenMenuId(null); setMenuPos(null) }} className="w-full flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button onClick={() => { handleDeleteFaculty(activeFac._id); setOpenMenuId(null); setMenuPos(null) }} className="w-full flex items-center gap-2 px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </motion.div>
                )
              })()}
            </AnimatePresence>,
            document.body
          )}
        </div>

        <div className="space-y-6">
          {/* Study Materials */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100"><h2 className="text-base font-bold text-slate-900">Recent Study Material Uploads</h2></div>
            {!data?.materials.length ? (
              <div className="p-8 text-center text-slate-400"><FileText className="w-8 h-8 mx-auto mb-3 text-slate-300" /><p className="text-sm font-medium">No materials uploaded yet.</p></div>
            ) : (
              <div className="p-2">
                {data?.materials.map((mat, idx) => (
                  <div key={mat._id || idx} onClick={() => setPreviewMaterial(mat)}
                    className="flex items-start gap-4 p-4 hover:bg-slate-50 rounded-xl transition-colors border-b border-slate-50 last:border-0 cursor-pointer">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${mat.iconBg}`}><FileIcon className={`w-5 h-5 ${mat.iconColor}`} /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-1">
                        <h4 className="text-[13px] font-bold text-slate-900 truncate">{mat.title}</h4>
                        <span className="text-[10px] font-semibold text-slate-400 whitespace-nowrap ml-2">{mat.time}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded border uppercase tracking-wider ${mat.specTheme === 'green' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>{mat.spec}</span>
                        <span className="text-[11px] text-slate-500 truncate">{mat.author}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Counseling Logs */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Recent Counseling Logs</h2>
              <MoreVertical className="w-4 h-4 text-slate-400" />
            </div>
            {!data?.counseling.length ? (
              <div className="p-8 text-center text-slate-400"><MessageSquare className="w-8 h-8 mx-auto mb-3 text-slate-300" /><p className="text-sm font-medium">No counseling logs found.</p></div>
            ) : (
              <div className="p-2">
                {data?.counseling.map((log, idx) => (
                  <div key={log._id || idx} onClick={() => openEditCounseling(log)}
                    className="flex items-center justify-between p-4 hover:bg-slate-50 rounded-xl transition-colors border-b border-slate-50 last:border-0 cursor-pointer group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500"><MessageCircle className="w-5 h-5" /></div>
                      <div><h4 className="text-[13px] font-bold text-slate-900">{log.student}</h4><p className="text-[11px] text-slate-500">{log.teacher}</p></div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold text-slate-500">{log.date}</span>
                      <Edit2 className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
