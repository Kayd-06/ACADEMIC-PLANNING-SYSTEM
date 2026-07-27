'use client'
import { useState, useEffect } from 'react'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'

interface PromotionRun {
  id: string
  academicYear: string
  boundaryDate: string
  status: 'pending' | 'confirmed' | 'dismissed'
  previewCounts: Record<string, Record<string, number>>
  excludedNewAdmissionCount: number
  excludedTerminalCount: number
  confirmedAt: string | null
  confirmedByName: string | null
  promotedCount: number
  createdAt: string
}

export default function PromotionTab() {
  const [pending, setPending] = useState<PromotionRun | null>(null)
  const [history, setHistory] = useState<PromotionRun[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/academic-planning/promotions')
      const data = await res.json()
      setPending(data.pending)
      setHistory(data.history || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function confirmPromotion() {
    if (!pending) return
    if (!window.confirm(`Promote all eligible students for ${pending.academicYear}? This cannot be undone.`)) return
    setActing(true)
    try {
      await fetch(`/api/academic-planning/promotions/${pending.id}/confirm`, { method: 'POST' })
      await load()
    } finally {
      setActing(false)
    }
  }

  async function dismissPromotion() {
    if (!pending) return
    if (!window.confirm(`Dismiss the ${pending.academicYear} promotion cycle? No students will be promoted.`)) return
    setActing(true)
    try {
      await fetch(`/api/academic-planning/promotions/${pending.id}/dismiss`, { method: 'POST' })
      await load()
    } finally {
      setActing(false)
    }
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-slate-400 animate-spin" /></div>
  }

  return (
    <div className="space-y-8">
      {pending ? (
        <div className="bg-white rounded-xl border border-amber-200 shadow-sm p-6">
          <h3 className="font-bold text-slate-900 mb-1">Class Promotion Ready: {pending.academicYear}</h3>
          <p className="text-sm text-slate-500 mb-4">Boundary date {pending.boundaryDate}. Review before confirming.</p>

          <table className="w-full text-sm mb-4">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-100">
                <th className="py-2">From Class</th>
                <th className="py-2">To Class</th>
                <th className="py-2">Students</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(pending.previewCounts).map(([fromClass, toMap]) =>
                Object.entries(toMap).map(([toClass, count]) => (
                  <tr key={`${fromClass}-${toClass}`} className="border-b border-slate-50">
                    <td className="py-2">{fromClass}</td>
                    <td className="py-2">{toClass}</td>
                    <td className="py-2 font-semibold">{count}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <p className="text-xs text-slate-500 mb-1">{pending.excludedNewAdmissionCount} new admissions held to next year.</p>
          <p className="text-xs text-slate-500 mb-4">{pending.excludedTerminalCount} Class 12 students excluded — handle manually.</p>

          <div className="flex gap-3">
            <button onClick={confirmPromotion} disabled={acting} className="flex items-center gap-2 px-4 py-2 bg-[#0b1320] hover:bg-slate-800 text-white rounded-lg text-sm font-semibold disabled:opacity-50">
              {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Confirm Promotion
            </button>
            <button onClick={dismissPromotion} disabled={acting} className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-sm font-semibold disabled:opacity-50">
              <XCircle className="w-4 h-4" /> Dismiss
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 text-sm text-slate-500">
          No promotion cycle is currently pending review.
        </div>
      )}

      <div>
        <h3 className="font-bold text-slate-900 mb-3">History</h3>
        {history.length === 0 ? (
          <p className="text-sm text-slate-400">No past promotion cycles yet.</p>
        ) : (
          <table className="w-full text-sm bg-white rounded-xl border border-slate-200 overflow-hidden">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-100">
                <th className="py-2 px-4">Academic Year</th>
                <th className="py-2 px-4">Date</th>
                <th className="py-2 px-4">Promoted</th>
                <th className="py-2 px-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {history.map((run) => (
                <tr key={run.id} className="border-b border-slate-50">
                  <td className="py-2 px-4">{run.academicYear}</td>
                  <td className="py-2 px-4">{new Date(run.createdAt).toLocaleDateString()}</td>
                  <td className="py-2 px-4">{run.promotedCount}</td>
                  <td className="py-2 px-4">
                    {run.status === 'confirmed' ? `Confirmed by ${run.confirmedByName ?? 'Unknown'}` : 'Dismissed'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
