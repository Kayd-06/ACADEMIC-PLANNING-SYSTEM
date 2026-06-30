'use client'
import { useState, useEffect } from 'react'
import { Plus, User, GraduationCap, FileText, MessageSquare, Filter, MoreVertical, FileIcon, MessageCircle, Loader2, X, ExternalLink, Edit2, Save } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

type FacultyMember = { _id: string; name: string; sub: string; spec: string; specTheme: string; batches: number; exp: string; status: string; initials: string; color: string }
type Material = { _id: string; title: string; type: string; fileUrl: string; spec: string; specTheme: string; author: string; time: string; iconColor: string; iconBg: string }
type CounselingLog = { _id: string; student: string; teacher: string; date: string; notes?: string; status?: string; type?: string; counselor?: string; time?: string; duration?: string; flagged?: boolean }

export default function TeacherPortalView() {
  const [data, setData] = useState<{ kpis: any; faculty: FacultyMember[]; materials: Material[]; counseling: CounselingLog[] } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)

  // Add Faculty modal
  const [showAddFaculty, setShowAddFaculty] = useState(false)
  const [facultyForm, setFacultyForm] = useState({ name: '', subject: '', specialization: '', batches: '0', experience: '', status: 'ACTIVE', email: '', phone: '' })
  const [savingFaculty, setSavingFaculty] = useState(false)

  // Material preview modal
  const [previewMaterial, setPreviewMaterial] = useState<Material | null>(null)

  // Counseling detail/edit modal
  const [editCounseling, setEditCounseling] = useState<CounselingLog | null>(null)
  const [counselingForm, setCounselingForm] = useState({ notes: '', status: '', date: '', time: '', duration: '' })
  const [savingCounseling, setSavingCounseling] = useState(false)

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/teacher-portal/dashboard')
      if (res.ok) setData(await res.json())
    } catch (e) { console.error(e) } finally { setIsLoading(false) }
  }

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000) }

  const handleAddFaculty = async () => {
    if (!facultyForm.name || !facultyForm.subject || !facultyForm.specialization) {
      showToast('Name, subject, and specialization are required'); return
    }
    setSavingFaculty(true)
    try {
      const res = await fetch('/api/teacher-portal/faculty', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...facultyForm, batches: Number(facultyForm.batches) }) })
      if (res.ok) {
        showToast('Faculty member added successfully')
        setShowAddFaculty(false)
        setFacultyForm({ name: '', subject: '', specialization: '', batches: '0', experience: '', status: 'ACTIVE', email: '', phone: '' })
        fetchData()
      } else {
        const err = await res.json()
        showToast(err.error || 'Failed to add faculty')
      }
    } catch { showToast('Failed to add faculty') } finally { setSavingFaculty(false) }
  }

  const openEditCounseling = (log: CounselingLog) => {
    setEditCounseling(log)
    setCounselingForm({ notes: log.notes || '', status: log.status || 'Scheduled', date: log.date || '', time: log.time || '', duration: log.duration || '30 mins' })
  }

  const handleSaveCounseling = async () => {
    if (!editCounseling) return
    setSavingCounseling(true)
    try {
      const res = await fetch('/api/teacher-portal/counseling', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editCounseling._id, ...counselingForm })
      })
      if (res.ok) {
        showToast('Counseling session updated')
        setEditCounseling(null)
        fetchData()
      } else showToast('Failed to update session')
    } catch { showToast('Failed to update session') } finally { setSavingCounseling(false) }
  }

  if (isLoading) return (
    <div className="flex-1 p-8 bg-slate-50 min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin mb-4" />
        <p className="text-sm font-medium">Loading Teacher Portal...</p>
      </div>
    </div>
  )

  const KPIS = data ? [
    { label: 'Total Faculty', value: data.kpis.totalFaculty.toString(), icon: User },
    { label: 'Active Batches Covered', value: data.kpis.activeBatches.toString(), icon: GraduationCap },
    { label: 'Materials Uploaded', value: data.kpis.materialsThisWeek.toString(), icon: FileText },
    { label: 'Counseling Sessions Logged', value: data.kpis.counselingSessions.toString(), icon: MessageSquare },
  ] : []

  return (
    <div className="flex-1 p-8 overflow-auto bg-slate-50 min-h-screen relative">

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 right-6 bg-[#0b1320] text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 z-[100]">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            <span className="text-sm font-medium">{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Faculty Modal */}
      <AnimatePresence>
        {showAddFaculty && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-slate-900">Add Faculty Member</h2>
                <button onClick={() => setShowAddFaculty(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Full Name *</label>
                    <input value={facultyForm.name} onChange={e => setFacultyForm(f => ({ ...f, name: e.target.value }))}
                      className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" placeholder="Dr. John Smith" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Subject *</label>
                    <input value={facultyForm.subject} onChange={e => setFacultyForm(f => ({ ...f, subject: e.target.value }))}
                      className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" placeholder="Physics" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Specialization *</label>
                  <input value={facultyForm.specialization} onChange={e => setFacultyForm(f => ({ ...f, specialization: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" placeholder="JEE Advanced" />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Batches</label>
                    <input type="number" min="0" value={facultyForm.batches} onChange={e => setFacultyForm(f => ({ ...f, batches: e.target.value }))}
                      className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Experience</label>
                    <input value={facultyForm.experience} onChange={e => setFacultyForm(f => ({ ...f, experience: e.target.value }))}
                      className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" placeholder="5 years" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</label>
                    <select value={facultyForm.status} onChange={e => setFacultyForm(f => ({ ...f, status: e.target.value }))}
                      className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900">
                      <option value="ACTIVE">Active</option>
                      <option value="ON_LEAVE">On Leave</option>
                      <option value="INACTIVE">Inactive</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Email</label>
                    <input type="email" value={facultyForm.email} onChange={e => setFacultyForm(f => ({ ...f, email: e.target.value }))}
                      className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" placeholder="john@school.edu" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Phone</label>
                    <input value={facultyForm.phone} onChange={e => setFacultyForm(f => ({ ...f, phone: e.target.value }))}
                      className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" placeholder="+91 98765 43210" />
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowAddFaculty(false)} className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors">Cancel</button>
                <button onClick={handleAddFaculty} disabled={savingFaculty}
                  className="flex-1 px-4 py-2.5 bg-[#0b1320] text-white rounded-lg text-sm font-semibold hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {savingFaculty ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Add Faculty
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Material Preview Modal */}
      <AnimatePresence>
        {previewMaterial && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl h-[80vh] flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-slate-100">
                <div>
                  <h2 className="text-base font-bold text-slate-900">{previewMaterial.title}</h2>
                  <p className="text-xs text-slate-500">{previewMaterial.type} · {previewMaterial.author}</p>
                </div>
                <div className="flex items-center gap-2">
                  {previewMaterial.fileUrl && (
                    <a href={previewMaterial.fileUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors">
                      <ExternalLink className="w-3.5 h-3.5" /> Open in new tab
                    </a>
                  )}
                  <button onClick={() => setPreviewMaterial(null)} className="text-slate-400 hover:text-slate-600 ml-1"><X className="w-5 h-5" /></button>
                </div>
              </div>
              <div className="flex-1 overflow-hidden p-2">
                {previewMaterial.fileUrl ? (
                  <iframe src={previewMaterial.fileUrl} className="w-full h-full rounded-lg border border-slate-100" title={previewMaterial.title} />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400">
                    <FileIcon className="w-12 h-12 mb-3 text-slate-300" />
                    <p className="text-sm font-medium">No file URL attached to this material.</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Counseling Edit Modal */}
      <AnimatePresence>
        {editCounseling && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{editCounseling.student}</h2>
                  <p className="text-sm text-slate-500">{editCounseling.teacher} · {editCounseling.type}</p>
                </div>
                <button onClick={() => setEditCounseling(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</label>
                    <input type="date" value={counselingForm.date} onChange={e => setCounselingForm(f => ({ ...f, date: e.target.value }))}
                      className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Time</label>
                    <input value={counselingForm.time} onChange={e => setCounselingForm(f => ({ ...f, time: e.target.value }))}
                      className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" placeholder="10:00 AM" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Duration</label>
                    <input value={counselingForm.duration} onChange={e => setCounselingForm(f => ({ ...f, duration: e.target.value }))}
                      className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" placeholder="30 mins" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</label>
                  <select value={counselingForm.status} onChange={e => setCounselingForm(f => ({ ...f, status: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900">
                    <option value="Scheduled">Scheduled</option>
                    <option value="Completed">Completed</option>
                    <option value="No-Show">No-Show</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Notes</label>
                  <textarea value={counselingForm.notes} onChange={e => setCounselingForm(f => ({ ...f, notes: e.target.value }))} rows={4}
                    className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none"
                    placeholder="Session notes..." />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setEditCounseling(null)} className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50">Cancel</button>
                <button onClick={handleSaveCounseling} disabled={savingCounseling}
                  className="flex-1 px-4 py-2.5 bg-[#0b1320] text-white rounded-lg text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center gap-2">
                  {savingCounseling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Changes
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
        <button onClick={() => setShowAddFaculty(true)} className="flex items-center gap-2 px-5 py-2.5 bg-[#0b1320] hover:bg-slate-800 text-white rounded-lg text-sm font-semibold transition-all shadow-sm">
          <Plus className="w-4 h-4" /> Add Faculty
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {KPIS.map((kpi, idx) => (
          <div key={idx} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-start gap-4">
            <div className="p-3 bg-slate-100 rounded-xl"><kpi.icon className="w-5 h-5 text-slate-600" /></div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500 mb-1 leading-tight">{kpi.label}</p>
              <p className="text-2xl font-bold text-slate-900">{kpi.value}</p>
            </div>
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
                <Filter className="w-4 h-4" />
                <MoreVertical className="w-4 h-4" />
              </div>
            </div>
            {!data?.faculty.length ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-400">
                <User className="w-12 h-12 mb-4 text-slate-300" />
                <p className="text-base font-bold text-slate-600 mb-1">No Faculty Members</p>
                <p className="text-sm font-medium">Click "Add Faculty" to build your directory.</p>
              </div>
            ) : (
              <>
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                      {['Faculty Name', 'Specialization', 'Batches', 'Experience', 'Status'].map(h => (
                        <th key={h} className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data?.faculty.map((fac, idx) => (
                      <tr key={fac._id || idx} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-sm ${fac.color}`}>{fac.initials}</div>
                            <div>
                              <h4 className="text-[13px] font-bold text-slate-900">{fac.name}</h4>
                              <p className="text-[11px] text-slate-500">{fac.sub}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 text-[10px] font-bold rounded border uppercase tracking-wider ${fac.specTheme === 'green' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : fac.specTheme === 'purple' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>{fac.spec}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[11px] font-bold mx-auto">{fac.batches}</div>
                        </td>
                        <td className="px-6 py-4 text-[13px] font-medium text-slate-600">{fac.exp}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full border uppercase tracking-wider ${fac.status === 'ACTIVE' ? 'border-emerald-200 text-emerald-700 bg-emerald-50' : fac.status === 'ON_LEAVE' ? 'border-amber-200 text-amber-700 bg-amber-50' : 'border-slate-200 text-slate-700 bg-slate-50'}`}>{fac.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {/* Study Materials */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">Recent Study Material Uploads</h2>
            </div>
            {!data?.materials.length ? (
              <div className="p-8 text-center text-slate-400">
                <FileText className="w-8 h-8 mx-auto mb-3 text-slate-300" />
                <p className="text-sm font-medium">No materials uploaded yet.</p>
              </div>
            ) : (
              <div className="p-2">
                {data?.materials.map((mat, idx) => (
                  <div key={mat._id || idx} onClick={() => setPreviewMaterial(mat)}
                    className="flex items-start gap-4 p-4 hover:bg-slate-50 rounded-xl transition-colors border-b border-slate-50 last:border-0 cursor-pointer">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${mat.iconBg}`}>
                      <FileIcon className={`w-5 h-5 ${mat.iconColor}`} />
                    </div>
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
              <div className="p-8 text-center text-slate-400">
                <MessageSquare className="w-8 h-8 mx-auto mb-3 text-slate-300" />
                <p className="text-sm font-medium">No counseling logs found.</p>
              </div>
            ) : (
              <div className="p-2">
                {data?.counseling.map((log, idx) => (
                  <div key={log._id || idx} onClick={() => openEditCounseling(log)}
                    className="flex items-center justify-between p-4 hover:bg-slate-50 rounded-xl transition-colors border-b border-slate-50 last:border-0 cursor-pointer group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                        <MessageCircle className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-[13px] font-bold text-slate-900 leading-tight">{log.student}</h4>
                        <p className="text-[11px] text-slate-500">{log.teacher}</p>
                      </div>
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
