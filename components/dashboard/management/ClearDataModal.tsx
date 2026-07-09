'use client'
import { useState, useEffect } from 'react'
import { X, Loader2, AlertTriangle, Trash2 } from 'lucide-react'
import { motion } from 'framer-motion'

interface ClearDataModalProps {
  schoolName: string
  onClose: () => void
  onCleared: () => void
}

export default function ClearDataModal({ schoolName, onClose, onCleared }: ClearDataModalProps) {
  const [loading, setLoading] = useState(true)
  const [counts, setCounts] = useState<{ label: string; count: number }[]>([])
  const [total, setTotal] = useState(0)
  const [confirmText, setConfirmText] = useState('')
  const [clearing, setClearing] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    fetch('/api/admin/clear-school-data')
      .then(r => r.json())
      .then(data => {
        if (!data.error) {
          setCounts(data.counts ?? [])
          setTotal(data.total ?? 0)
        } else {
          setError(data.error)
        }
      })
      .catch(() => setError('Failed to load data preview'))
      .finally(() => setLoading(false))
  }, [])

  async function handleClear() {
    if (confirmText !== schoolName) {
      setError('Type the school name exactly to confirm.')
      return
    }
    setClearing(true)
    setError('')
    try {
      const res = await fetch('/api/admin/clear-school-data', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmText }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Failed to clear data.')
        return
      }
      setDone(true)
      setTimeout(() => { onCleared(); onClose() }, 1500)
    } finally {
      setClearing(false)
    }
  }

  const nonZero = counts.filter(c => c.count > 0)

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-rose-100 bg-rose-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4.5 h-4.5 text-rose-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-rose-900">Clear All Data</h2>
              <p className="text-[11px] text-rose-600">{schoolName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {done ? (
            <div className="flex flex-col items-center py-10">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mb-3">
                <Trash2 className="w-6 h-6 text-emerald-600" />
              </div>
              <p className="text-sm font-bold text-slate-800">Data cleared</p>
              <p className="text-xs text-slate-400 mt-1">Refreshing…</p>
            </div>
          ) : loading ? (
            <div className="flex flex-col items-center py-10 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin mb-2" />
              <p className="text-xs">Scanning school data…</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-600 leading-relaxed">
                This permanently deletes every operational record for <strong>{schoolName}</strong> — students, guardians,
                staff, reports, attendance, schedules, feedback, tests, and more. Your login and school account are kept.
                <span className="block mt-1.5 font-semibold text-rose-600">This cannot be undone.</span>
              </p>

              {nonZero.length === 0 ? (
                <p className="text-sm text-slate-400 italic bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
                  This school has no data to clear.
                </p>
              ) : (
                <div className="bg-slate-50 border border-slate-100 rounded-xl divide-y divide-slate-100 max-h-56 overflow-y-auto">
                  {nonZero.map(c => (
                    <div key={c.label} className="flex items-center justify-between px-4 py-2 text-[12px]">
                      <span className="font-semibold text-slate-700">{c.label}</span>
                      <span className="font-bold text-slate-900">{c.count}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between px-4 py-2.5 bg-slate-100 text-[12px] font-extrabold">
                    <span>Total records</span>
                    <span>{total}</span>
                  </div>
                </div>
              )}

              {total > 0 && (
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                    Type <span className="font-mono text-rose-600">{schoolName}</span> to confirm
                  </label>
                  <input
                    value={confirmText}
                    onChange={e => { setConfirmText(e.target.value); setError('') }}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                    placeholder={schoolName}
                    autoFocus
                  />
                </div>
              )}

              {error && <p className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{error}</p>}
            </>
          )}
        </div>

        {!done && !loading && total > 0 && (
          <div className="flex gap-3 p-6 border-t border-slate-100 shrink-0">
            <button onClick={onClose} className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-bold rounded-lg hover:bg-slate-50">
              Cancel
            </button>
            <button
              onClick={handleClear}
              disabled={clearing || confirmText !== schoolName}
              className="flex-1 py-2.5 bg-rose-600 text-white text-sm font-bold rounded-lg hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {clearing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Clear All Data
            </button>
          </div>
        )}
      </motion.div>
    </div>
  )
}
