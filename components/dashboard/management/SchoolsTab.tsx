'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Plus, X, Loader2, Copy, Check, Building2, Pencil, Trash2, LogOut, Hash, CheckCircle2, ArrowRightLeft, AlertTriangle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import ClearDataModal from './ClearDataModal'

type SchoolEntry = {
  id: string; name: string; board: string; classes: string; programs: string
  mouStatus: string; joinCode: string | null; isActive: boolean; role: 'owner' | 'member'
}

const EMPTY_FORM = { name: '', board: 'CBSE Affiliated', classes: 'Nursery – XII', programs: 'STEM, Humanities, Arts', mouStatus: 'Active (2025)' }

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      className="flex items-center gap-1 px-2 py-1 rounded bg-amber-100 hover:bg-amber-200 text-amber-800 text-xs font-bold transition-all">
      {copied ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
    </button>
  )
}

export default function SchoolsTab() {
  const { data: session, update } = useSession()
  const [schools, setSchools] = useState<SchoolEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ msg: string; type?: 'error' | 'ok' } | null>(null)
  const [switching, setSwitching] = useState<string | null>(null)

  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState(EMPTY_FORM)
  const [creating, setCreating] = useState(false)

  const [showJoin, setShowJoin] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [joining, setJoining] = useState(false)

  const [editSchool, setEditSchool] = useState<SchoolEntry | null>(null)
  const [editForm, setEditForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const [clearDataSchool, setClearDataSchool] = useState<SchoolEntry | null>(null)

  const activeSchoolId = (session?.user as any)?.schoolId as string | null

  const showMsg = (msg: string, type: 'ok' | 'error' = 'ok') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  async function fetchSchools() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/schools')
      const data = await res.json()
      if (!data.error) setSchools(data)
    } finally { setLoading(false) }
  }

  useEffect(() => { fetchSchools() }, [])

  async function switchSchool(schoolId: string) {
    if (schoolId === activeSchoolId) return
    setSwitching(schoolId)
    try {
      const res = await fetch('/api/admin/active-school', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId }),
      })
      const data = await res.json()
      if (data.error) { showMsg(data.error, 'error'); return }
      await update({ schoolId })
      window.location.reload()
    } finally { setSwitching(null) }
  }

  async function createSchool() {
    if (!createForm.name.trim()) { showMsg('School name is required', 'error'); return }
    setCreating(true)
    try {
      const res = await fetch('/api/admin/schools', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(createForm)
      })
      const data = await res.json()
      if (data.error) { showMsg(data.error, 'error'); return }
      setShowCreate(false)
      setCreateForm(EMPTY_FORM)
      await fetchSchools()
      showMsg(`School "${data.name}" created`)
    } finally { setCreating(false) }
  }

  async function joinSchool() {
    if (!joinCode.trim()) { showMsg('Enter the invite code first', 'error'); return }
    setJoining(true)
    try {
      const res = await fetch('/api/admin/schools/join', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ joinCode })
      })
      const data = await res.json()
      if (data.error) { showMsg(data.error, 'error'); return }
      setShowJoin(false)
      setJoinCode('')
      await fetchSchools()
      showMsg(`Joined "${data.name}"`)
    } finally { setJoining(false) }
  }

  async function saveEdit() {
    if (!editSchool) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/schools/${editSchool.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editForm)
      })
      const data = await res.json()
      if (data.error) { showMsg(data.error, 'error'); return }
      setEditSchool(null)
      await fetchSchools()
      showMsg('School updated')
    } finally { setSaving(false) }
  }

  async function deleteOrLeave(school: SchoolEntry) {
    const action = school.role === 'owner' ? 'delete this school and all its data' : 'leave this school'
    if (!confirm(`Are you sure you want to ${action}? This cannot be undone.`)) return
    const res = await fetch(`/api/admin/schools/${school.id}`, { method: 'DELETE' })
    const data = await res.json()
    if (data.error) { showMsg(data.error, 'error'); return }
    await fetchSchools()
    if (data.newSchoolId) {
      await update({ schoolId: data.newSchoolId })
      window.location.reload()
    } else if (activeSchoolId === school.id) {
      await update({ schoolId: null })
      window.location.reload()
    }
    showMsg(school.role === 'owner' ? 'School deleted' : 'Left school')
  }

  return (
    <div className="relative">
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}
            className={`fixed bottom-6 right-6 z-[100] px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-sm font-medium ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-[#0b1320] text-white'}`}>
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />{toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create School Modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-slate-900">Create New School</h2>
                <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-4">
                {[
                  { label: 'School Name *', key: 'name', placeholder: 'e.g. Delhi Public School' },
                  { label: 'Board Affiliation', key: 'board', placeholder: 'e.g. CBSE Affiliated' },
                  { label: 'Classes Offered', key: 'classes', placeholder: 'e.g. Nursery – XII' },
                  { label: 'Programs', key: 'programs', placeholder: 'e.g. STEM, Humanities, Arts' },
                  { label: 'MOU Status', key: 'mouStatus', placeholder: 'e.g. Active (2025)' },
                ].map(({ label, key, placeholder }) => (
                  <div key={key}>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</label>
                    <input value={(createForm as any)[key]} onChange={e => setCreateForm(f => ({ ...f, [key]: e.target.value }))}
                      placeholder={placeholder}
                      className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-3">A unique invite code will be auto-generated for this school.</p>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setShowCreate(false)} className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50">Cancel</button>
                <button onClick={createSchool} disabled={creating} className="flex-1 px-4 py-2.5 bg-[#0b1320] text-white rounded-lg text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center gap-2">
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Create School
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Join School Modal */}
      <AnimatePresence>
        {showJoin && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-slate-900">Join a School</h2>
                <button onClick={() => setShowJoin(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
              </div>
              <p className="text-sm text-slate-500 mb-4">Paste the invite code shared by the school owner to get access.</p>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Invite Code</label>
                <div className="mt-1 flex items-center gap-2">
                  <Hash className="w-4 h-4 text-slate-400 shrink-0" />
                  <input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="XXXX-XXXX" maxLength={9}
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-900 tracking-widest" />
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setShowJoin(false)} className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50">Cancel</button>
                <button onClick={joinSchool} disabled={joining} className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
                  {joining ? <Loader2 className="w-4 h-4 animate-spin" /> : <Hash className="w-4 h-4" />} Join School
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit School Modal */}
      <AnimatePresence>
        {editSchool && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-slate-900">Edit School</h2>
                <button onClick={() => setEditSchool(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-4">
                {[
                  { label: 'School Name *', key: 'name', placeholder: '' },
                  { label: 'Board Affiliation', key: 'board', placeholder: '' },
                  { label: 'Classes Offered', key: 'classes', placeholder: '' },
                  { label: 'Programs', key: 'programs', placeholder: '' },
                  { label: 'MOU Status', key: 'mouStatus', placeholder: '' },
                ].map(({ label, key }) => (
                  <div key={key}>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</label>
                    <input value={(editForm as any)[key]} onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                      className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
                  </div>
                ))}
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setEditSchool(null)} className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50">Cancel</button>
                <button onClick={saveEdit} disabled={saving} className="flex-1 px-4 py-2.5 bg-[#0b1320] text-white rounded-lg text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Save Changes
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Actions */}
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-slate-500">Manage all schools your account has access to. Switch the active school to view its data.</p>
        <div className="flex gap-3">
          <button onClick={() => setShowJoin(true)}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-all">
            <Hash className="w-4 h-4" /> Join by Code
          </button>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#0b1320] text-white rounded-lg text-sm font-semibold hover:bg-slate-800 transition-all">
            <Plus className="w-4 h-4" /> Add School
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-slate-400 animate-spin" /></div>
      ) : schools.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-200">
          <Building2 className="w-12 h-12 text-slate-300 mb-4" />
          <p className="text-slate-600 font-bold mb-1">No schools yet</p>
          <p className="text-sm text-slate-400 mb-4">Create a new school or join one using an invite code.</p>
          <div className="flex gap-3">
            <button onClick={() => setShowJoin(true)} className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50">Join by Code</button>
            <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-[#0b1320] text-white rounded-lg text-sm font-semibold hover:bg-slate-800">Add School</button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {schools.map(school => {
            const isActive = school.id === activeSchoolId
            return (
              <motion.div key={school.id} layout
                className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-shadow hover:shadow-md ${isActive ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-slate-200'}`}>
                <div className={`h-1.5 w-full ${isActive ? 'bg-indigo-600' : 'bg-slate-200'}`} />
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-[15px] font-bold text-slate-900 truncate">{school.name}</h3>
                        {isActive && <span className="shrink-0 flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded-full border border-indigo-200"><CheckCircle2 className="w-3 h-3" /> Active</span>}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{school.board}</p>
                    </div>
                    <span className={`shrink-0 ml-2 px-2 py-0.5 text-[10px] font-bold rounded border uppercase tracking-wider ${school.role === 'owner' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                      {school.role}
                    </span>
                  </div>

                  <div className="space-y-1.5 mb-4">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Classes</span>
                      <span className="font-medium text-slate-700">{school.classes}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Programs</span>
                      <span className="font-medium text-slate-700 truncate max-w-[60%] text-right">{school.programs}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">MOU</span>
                      <span className="font-medium text-slate-700">{school.mouStatus}</span>
                    </div>
                  </div>

                  {school.role === 'owner' && school.joinCode && (
                    <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-wider text-amber-700">Invite Code</p>
                        <p className="text-sm font-black text-amber-900 font-mono tracking-widest">{school.joinCode}</p>
                      </div>
                      <CopyButton text={school.joinCode} />
                    </div>
                  )}

                  <div className="flex gap-2">
                    {!isActive && (
                      <button onClick={() => switchSchool(school.id)} disabled={switching === school.id}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50">
                        {switching === school.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRightLeft className="w-3.5 h-3.5" />}
                        Switch
                      </button>
                    )}
                    {school.role === 'owner' && (
                      <button onClick={() => { setEditSchool(school); setEditForm({ name: school.name, board: school.board, classes: school.classes, programs: school.programs, mouStatus: school.mouStatus }) }}
                        className="flex items-center justify-center gap-1 px-3 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-xs font-bold transition-all">
                        <Pencil className="w-3.5 h-3.5" /> Edit
                      </button>
                    )}
                    <button onClick={() => deleteOrLeave(school)}
                      className={`flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-xs font-bold transition-all border ${school.role === 'owner' ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                      {school.role === 'owner' ? <Trash2 className="w-3.5 h-3.5" /> : <LogOut className="w-3.5 h-3.5" />}
                      {school.role === 'owner' ? 'Delete' : 'Leave'}
                    </button>
                  </div>

                  {isActive && school.role === 'owner' && (
                    <button onClick={() => setClearDataSchool(school)}
                      className="w-full mt-2 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-rose-500 hover:bg-rose-50 border border-transparent hover:border-rose-100 transition-all">
                      <AlertTriangle className="w-3.5 h-3.5" /> Clear All Data
                    </button>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {clearDataSchool && (
        <ClearDataModal
          schoolName={clearDataSchool.name}
          onClose={() => setClearDataSchool(null)}
          onCleared={() => showMsg('All school data cleared')}
        />
      )}
    </div>
  )
}
