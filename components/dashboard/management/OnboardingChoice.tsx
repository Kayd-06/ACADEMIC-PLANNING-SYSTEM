'use client'
import { useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { motion, AnimatePresence } from 'framer-motion'
import { Building2, Hash, Plus, ArrowLeft, Loader2, CheckCircle2, LogOut } from 'lucide-react'
import { SelectBoard, MultiSelectPrograms, MultiSelectClasses } from './SchoolFormHelpers'

type Choice = 'select' | 'create' | 'join'

const EMPTY_FORM = { name: '', board: 'CBSE Affiliated', classes: '6, 7, 8, 9, 10, 11, 12', programs: 'JEE, NEET, Foundational', mouStatus: 'Active (2025)' }

const inputClass = 'w-full bg-gray-100 rounded-lg px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:bg-gray-50 focus:ring-2 focus:ring-indigo-400/30 transition-all'
const labelClass = 'text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1'

export default function OnboardingChoice({ userName }: { userName: string }) {
  const { update } = useSession()
  const [choice, setChoice] = useState<Choice>('select')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState<{ name: string } | null>(null)

  const [createForm, setCreateForm] = useState(EMPTY_FORM)
  const [joinCode, setJoinCode] = useState('')

  async function finishInto(schoolId: string, schoolName: string) {
    setDone({ name: schoolName })
    await update({ schoolId })
    setTimeout(() => { window.location.href = '/management' }, 1200)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!createForm.name.trim()) { setError('School name is required.'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/schools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      })
      const data = await res.json()
      if (!res.ok || data.error) { setError(data.error || 'Failed to create school.'); return }
      await finishInto(data.id, data.name)
    } catch {
      setError('Network error — please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    if (!joinCode.trim()) { setError('Enter your invite code.'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/schools/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ joinCode }),
      })
      const data = await res.json()
      if (!res.ok || data.error) { setError(data.error || 'Failed to join school.'); return }
      await finishInto(data.id, data.name)
    } catch {
      setError('Network error — please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen gradient-mesh flex items-center justify-center p-6 font-sans">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="relative w-full max-w-lg bg-white/90 backdrop-blur-xl rounded-3xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.15)] border border-white/50 p-10"
      >
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="absolute top-6 right-6 flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" /> Sign out
        </button>

        {done ? (
          <div className="text-center py-8">
            <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-7 h-7 text-emerald-600" />
            </div>
            <p className="text-lg font-bold text-gray-800">You&apos;re all set!</p>
            <p className="text-sm text-gray-400 mt-1">Taking you to {done.name}&apos;s dashboard…</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {choice === 'select' && (
              <motion.div key="select" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                <h1 className="text-2xl font-bold text-gray-800 text-center mb-1">Welcome, {userName}!</h1>
                <p className="text-sm text-gray-400 text-center mb-8">Let&apos;s set up your school to get started</p>

                <div className="space-y-3">
                  <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.99 }}
                    onClick={() => { setError(''); setChoice('create') }}
                    className="w-full flex items-center gap-4 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 rounded-2xl px-5 py-4 transition-colors text-left">
                    <div className="w-11 h-11 rounded-xl bg-indigo-500 flex items-center justify-center text-white shrink-0">
                      <Plus className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-800">Create a New School</p>
                      <p className="text-xs text-gray-500 mt-0.5">Set up a fresh institution and get an invite code to share</p>
                    </div>
                  </motion.button>

                  <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.99 }}
                    onClick={() => { setError(''); setChoice('join') }}
                    className="w-full flex items-center gap-4 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-2xl px-5 py-4 transition-colors text-left">
                    <div className="w-11 h-11 rounded-xl bg-gray-700 flex items-center justify-center text-white shrink-0">
                      <Hash className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-800">Join an Existing School</p>
                      <p className="text-xs text-gray-500 mt-0.5">Enter the invite code from another administrator</p>
                    </div>
                  </motion.button>
                </div>
              </motion.div>
            )}

            {choice === 'create' && (
              <motion.div key="create" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                <button onClick={() => setChoice('select')} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mb-4 transition-colors">
                  <ArrowLeft className="w-3.5 h-3.5" /> Back
                </button>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center text-white"><Building2 className="w-5 h-5" /></div>
                  <h2 className="text-xl font-bold text-gray-800">Create Your School</h2>
                </div>
                {error && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-3">{error}</p>}
                <form onSubmit={handleCreate} className="space-y-3">
                  <div>
                    <label className={labelClass}>School Name *</label>
                    <input value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} className={inputClass} placeholder="e.g. Riverdale Coaching Institute" autoFocus />
                  </div>
                   <div>
                    <label className={labelClass}>Board</label>
                    <SelectBoard value={createForm.board} onChange={val => setCreateForm(f => ({ ...f, board: val }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Classes</label>
                      <MultiSelectClasses value={createForm.classes} onChange={val => setCreateForm(f => ({ ...f, classes: val }))} />
                    </div>
                    <div>
                      <label className={labelClass}>MOU Status</label>
                      <input value={createForm.mouStatus} onChange={e => setCreateForm(f => ({ ...f, mouStatus: e.target.value }))} className={inputClass} />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Programs</label>
                    <MultiSelectPrograms value={createForm.programs} onChange={val => setCreateForm(f => ({ ...f, programs: val }))} />
                  </div>
                  <button type="submit" disabled={loading}
                    className="w-full bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm mt-2 flex items-center justify-center gap-2">
                    {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</> : 'Create School & Continue'}
                  </button>
                </form>
              </motion.div>
            )}

            {choice === 'join' && (
              <motion.div key="join" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                <button onClick={() => setChoice('select')} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mb-4 transition-colors">
                  <ArrowLeft className="w-3.5 h-3.5" /> Back
                </button>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-gray-700 flex items-center justify-center text-white"><Hash className="w-5 h-5" /></div>
                  <h2 className="text-xl font-bold text-gray-800">Join a School</h2>
                </div>
                {error && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-3">{error}</p>}
                <form onSubmit={handleJoin} className="space-y-3">
                  <div>
                    <label className={labelClass}>Invite Code</label>
                    <input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())}
                      className={inputClass + ' font-mono font-bold tracking-widest uppercase'}
                      placeholder="EDUA-4821" maxLength={9} autoFocus />
                  </div>
                  <button type="submit" disabled={loading}
                    className="w-full bg-gray-800 hover:bg-gray-900 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm mt-2 flex items-center justify-center gap-2">
                    {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Joining…</> : 'Join School & Continue'}
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </motion.div>
    </div>
  )
}
