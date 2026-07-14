'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, RefreshCw, AlertCircle } from 'lucide-react'
import { useAlert } from '@/components/dashboard/AlertProvider'

interface GradeRow {
  studentId: string
  studentName: string
  rollNo: string
  marksObtained: number | null
  correct: number | null
  incorrect: number | null
  unattempted: number | null
  absent: boolean
  percentage: number | null
  rank: number | null
}

interface TestGradingModalProps {
  test: { id: string; title: string; batch: string; totalMarks: number; date: string }
  onClose: () => void
  onSaved: () => void
}

export default function TestGradingModal({ test, onClose, onSaved }: TestGradingModalProps) {
  const { showAlert } = useAlert()
  const [rows, setRows] = useState<GradeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    fetch(`/api/tests/${test.id}/grades`)
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to load roster')
        return data
      })
      .then((data) => { if (!cancelled) setRows(data.studentResults) })
      .catch((err) => { if (!cancelled) setError(err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [test.id])

  function updateRow(studentId: string, patch: Partial<GradeRow>) {
    setRows(prev => prev.map(r => r.studentId === studentId ? { ...r, ...patch } : r))
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/tests/${test.id}/grades`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grades: rows.map(r => ({
            studentId: r.studentId,
            marksObtained: r.marksObtained,
            correct: r.correct,
            incorrect: r.incorrect,
            unattempted: r.unattempted,
            absent: r.absent,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save grades')
      onSaved()
      onClose()
    } catch (err: any) {
      showAlert({ title: 'Failed to Save Grades', message: err.message, type: 'warning', onRetry: handleSave, retryText: 'Retry' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-y-auto border border-slate-100"
        >
          <div className="flex items-center justify-between p-6 border-b border-slate-100 sticky top-0 bg-white">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Grade: {test.title}</h2>
              <p className="text-[12px] text-slate-500 mt-0.5">{test.batch} · Total Marks {test.totalMarks} · {test.date}</p>
            </div>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                <RefreshCw className="w-7 h-7 animate-spin mb-3" />
                <p className="text-sm font-medium">Loading roster...</p>
              </div>
            ) : error ? (
              <div className="flex items-start gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
              </div>
            ) : rows.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">No students found in this batch.</p>
            ) : (
              <div className="border border-slate-100 rounded-xl overflow-hidden overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {['Student', 'Roll No', 'Marks', 'Correct', 'Incorrect', 'Unattempted', 'Absent'].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left font-bold text-slate-500 uppercase tracking-wider text-[10px]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {rows.map((r) => (
                      <tr key={r.studentId} className="hover:bg-slate-50/60">
                        <td className="px-4 py-2.5 font-medium text-slate-800">{r.studentName}</td>
                        <td className="px-4 py-2.5 text-slate-600">{r.rollNo || '—'}</td>
                        <td className="px-4 py-2.5">
                          <input
                            type="number" min="0" max={test.totalMarks}
                            disabled={r.absent}
                            value={r.marksObtained ?? ''}
                            onChange={(e) => updateRow(r.studentId, { marksObtained: e.target.value === '' ? null : Number(e.target.value) })}
                            className="w-20 px-2 py-1 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-slate-400 disabled:opacity-40"
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <input
                            type="number" min="0"
                            disabled={r.absent}
                            value={r.correct ?? ''}
                            onChange={(e) => updateRow(r.studentId, { correct: e.target.value === '' ? null : Number(e.target.value) })}
                            className="w-16 px-2 py-1 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-slate-400 disabled:opacity-40"
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <input
                            type="number" min="0"
                            disabled={r.absent}
                            value={r.incorrect ?? ''}
                            onChange={(e) => updateRow(r.studentId, { incorrect: e.target.value === '' ? null : Number(e.target.value) })}
                            className="w-16 px-2 py-1 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-slate-400 disabled:opacity-40"
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <input
                            type="number" min="0"
                            disabled={r.absent}
                            value={r.unattempted ?? ''}
                            onChange={(e) => updateRow(r.studentId, { unattempted: e.target.value === '' ? null : Number(e.target.value) })}
                            className="w-16 px-2 py-1 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-slate-400 disabled:opacity-40"
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <input
                            type="checkbox"
                            checked={r.absent}
                            onChange={(e) => updateRow(r.studentId, { absent: e.target.checked })}
                            className="w-4 h-4"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!loading && !error && rows.length > 0 && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full mt-6 bg-[#0b1320] text-white font-bold py-2.5 rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
                Save Grades
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
