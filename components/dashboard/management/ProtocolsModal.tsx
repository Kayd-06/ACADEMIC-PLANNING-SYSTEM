'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, Loader2, CheckCircle2, Clock, AlertTriangle, Trash2, Save } from 'lucide-react'

interface Protocol {
  _id: string
  label: string
  sub: string
  status: 'completed' | 'pending' | 'overdue'
  reviewedAt?: string
  overdueDays?: number
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onUpdate: () => void
}

const STATUS_OPTIONS = [
  { value: 'completed', label: 'Completed', icon: CheckCircle2, color: 'text-emerald-600' },
  { value: 'pending', label: 'Pending', icon: Clock, color: 'text-navy-600' },
  { value: 'overdue', label: 'Overdue', icon: AlertTriangle, color: 'text-red-500' },
]

export default function ProtocolsModal({ isOpen, onClose, onUpdate }: Props) {
  const [protocols, setProtocols] = useState<Protocol[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ label: '', sub: '', status: 'pending', reviewedAt: '', overdueDays: 0 })

  useEffect(() => {
    if (isOpen) fetchProtocols()
  }, [isOpen])

  async function fetchProtocols() {
    setLoading(true)
    const res = await fetch('/api/protocols')
    const data = await res.json()
    if (!data.error) setProtocols(data)
    setLoading(false)
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    await fetch('/api/protocols', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    })
    setForm({ label: '', sub: '', status: 'pending', reviewedAt: '', overdueDays: 0 })
    setShowForm(false)
    await fetchProtocols()
    onUpdate()
    setSubmitting(false)
  }

  async function changeStatus(p: Protocol, newStatus: Protocol['status']) {
    const sub = newStatus === 'completed'
      ? `Reviewed: ${new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`
      : newStatus === 'overdue'
      ? `Overdue since ${new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`
      : p.sub
    await fetch('/api/protocols', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: p._id, status: newStatus, sub })
    })
    await fetchProtocols()
    onUpdate()
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this protocol?')) return
    try {
      const res = await fetch(`/api/protocols?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        await fetchProtocols()
        onUpdate()
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to delete protocol.')
      }
    } catch (err) {
      console.error(err)
      alert('Network error. Could not delete protocol.')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">Manage Protocols</h2>
            <p className="text-xs text-gray-400 mt-0.5">Update institutional compliance protocols</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Protocol List */}
        <div className="p-6 space-y-3 max-h-72 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-[#002045]" /></div>
          ) : protocols.map((p) => {
            const Icon = p.status === 'completed' ? CheckCircle2 : p.status === 'overdue' ? AlertTriangle : Clock
            const iconColor = p.status === 'completed' ? 'text-emerald-500' : p.status === 'overdue' ? 'text-red-500' : 'text-[#002045]'
            const selectStyle = p.status === 'completed'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 focus:ring-emerald-200'
              : p.status === 'overdue'
              ? 'bg-red-50 text-red-600 border-red-200 focus:ring-red-200'
              : 'bg-blue-50 text-[#002045] border-blue-200 focus:ring-blue-200'

            return (
              <div key={p._id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-gray-200 group transition-all">
                <div className={`shrink-0 ${iconColor}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{p.label}</p>
                  <p className={`text-xs mt-0.5 ${p.status === 'overdue' ? 'text-red-500' : 'text-gray-400'}`}>{p.sub}</p>
                </div>
                {/* Status Dropdown */}
                <select
                  value={p.status}
                  onChange={e => changeStatus(p, e.target.value as Protocol['status'])}
                  className={`text-[11px] font-bold uppercase px-2.5 py-1 rounded-full border cursor-pointer outline-none focus:ring-2 shrink-0 transition-colors ${selectStyle}`}
                >
                  <option value="completed">✓ Completed</option>
                  <option value="pending">⏳ Pending</option>
                  <option value="overdue">⚠ Overdue</option>
                </select>
                <button
                  onClick={() => handleDelete(p._id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-red-400 hover:text-red-600 shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )
          })}
        </div>

        {/* Add New Form */}
        <AnimatePresence>
          {showForm && (
            <motion.form
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              onSubmit={handleAdd}
              className="border-t border-gray-100 p-6 space-y-3 overflow-hidden"
            >
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Add New Protocol</p>
              <input
                required value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                placeholder="Protocol name"
                className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#002045]/20 focus:border-[#002045] outline-none"
              />
              <input
                required value={form.sub} onChange={e => setForm(f => ({ ...f, sub: e.target.value }))}
                placeholder="Status description (e.g. Reviewed: Oct 2024)"
                className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#002045]/20 focus:border-[#002045] outline-none"
              />
              <select
                value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as any }))}
                className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#002045]/20 outline-none"
              >
                {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <button
                type="submit" disabled={submitting}
                className="w-full bg-[#002045] text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-[#1a365d] transition-colors"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Add Protocol
              </button>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Footer */}
        <div className="px-6 pb-5 flex justify-between items-center">
          <button
            onClick={() => setShowForm(f => !f)}
            className="flex items-center gap-1.5 text-sm font-semibold text-[#002045] hover:text-[#1a365d] transition-colors"
          >
            <Plus className="w-4 h-4" />
            {showForm ? 'Cancel' : 'Add Protocol'}
          </button>
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors">
            Done
          </button>
        </div>
      </motion.div>
    </div>
  )
}
