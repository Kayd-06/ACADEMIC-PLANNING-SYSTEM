'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, Trash2, CheckCircle, AlertCircle, Loader2, Save } from 'lucide-react'

interface Protocol {
  _id: string
  label: string
  sub: string
  done: boolean
  urgent: boolean
}

export default function ProtocolsModal({ 
  isOpen, 
  onClose, 
  onUpdate 
}: { 
  isOpen: boolean
  onClose: () => void
  onUpdate: () => void
}) {
  const [protocols, setProtocols] = useState<Protocol[]>([])
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ label: '', sub: '', done: false, urgent: false })

  useEffect(() => {
    if (isOpen) fetchProtocols()
  }, [isOpen])

  async function fetchProtocols() {
    const res = await fetch('/api/protocols')
    const data = await res.json()
    if (!data.error) setProtocols(data)
  }

  async function handleSave() {
    setLoading(true)
    const url = editingId ? `/api/protocols/${editingId}` : '/api/protocols'
    const method = editingId ? 'PATCH' : 'POST'
    
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    })
    
    if (res.ok) {
      setForm({ label: '', sub: '', done: false, urgent: false })
      setEditingId(null)
      fetchProtocols()
      onUpdate()
    }
    setLoading(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this protocol?')) return
    await fetch(`/api/protocols/${id}`, { method: 'DELETE' })
    fetchProtocols()
    onUpdate()
  }

  function startEdit(p: Protocol) {
    setEditingId(p._id)
    setForm({ label: p.label, sub: p.sub, done: p.done, urgent: p.urgent })
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <h2 className="text-lg font-semibold text-gray-900">Manage Protocols</h2>
              <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-6 space-y-6">
              {/* Form Section */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                  {editingId ? 'Edit Protocol' : 'Add New Protocol'}
                </h3>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <input 
                    placeholder="Protocol Label (e.g. Child Safety Policy)"
                    className="col-span-2 text-sm px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                    value={form.label}
                    onChange={e => setForm({ ...form, label: e.target.value })}
                  />
                  <input 
                    placeholder="Status/Subtext (e.g. Reviewed: Oct 2023)"
                    className="col-span-2 text-sm px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                    value={form.sub}
                    onChange={e => setForm({ ...form, sub: e.target.value })}
                  />
                  <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                    <input type="checkbox" checked={form.done} onChange={e => setForm({ ...form, done: e.target.checked })} className="rounded text-indigo-600" />
                    Mark as Completed
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                    <input type="checkbox" checked={form.urgent} onChange={e => setForm({ ...form, urgent: e.target.checked })} className="rounded text-red-600" />
                    Urgent/Overdue
                  </label>
                </div>
                <div className="flex justify-end gap-2">
                  {editingId && (
                    <button onClick={() => { setEditingId(null); setForm({ label: '', sub: '', done: false, urgent: false }) }} className="px-4 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700">
                      Cancel
                    </button>
                  )}
                  <button 
                    onClick={handleSave}
                    disabled={loading || !form.label || !form.sub}
                    className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : editingId ? <Save className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                    {editingId ? 'Update Protocol' : 'Add Protocol'}
                  </button>
                </div>
              </div>

              {/* List Section */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Current Protocols</h3>
                {protocols.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No protocols defined yet.</p>}
                {protocols.map(p => (
                  <div key={p._id} className="flex items-center justify-between p-3 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors">
                    <div className="flex gap-3">
                      <div className="mt-0.5">
                        {p.done ? <CheckCircle className="w-4 h-4 text-green-500" /> : <AlertCircle className={`w-4 h-4 ${p.urgent ? 'text-red-500' : 'text-amber-500'}`} />}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{p.label}</p>
                        <p className={`text-[11px] ${p.urgent ? 'text-red-500' : 'text-gray-400'}`}>{p.sub}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => startEdit(p)} className="p-1.5 text-gray-400 hover:text-indigo-600 rounded-md hover:bg-indigo-50 transition-colors">
                        <Plus className="w-3.5 h-3.5 rotate-45" /> {/* Use as edit icon or just text */}
                        <span className="text-[10px] ml-1">Edit</span>
                      </button>
                      <button onClick={() => handleDelete(p._id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
