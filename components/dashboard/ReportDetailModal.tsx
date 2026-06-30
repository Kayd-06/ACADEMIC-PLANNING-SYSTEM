'use client'
import { useState, useEffect } from 'react'
import { X, Loader2, AlertCircle } from 'lucide-react'

interface ReportEntry {
  name: string
  rollNo: string
  marks: number
  maxMarks: number
  grade: string
  attendance: number | null
  remarks: string | null
}

interface ReportDetail {
  _id: string
  teacherName: string
  className: string
  subject: string
  term: string
  date: string
  entries: ReportEntry[]
}

interface ReportDetailModalProps {
  reportId: string
  onClose: () => void
}

export default function ReportDetailModal({ reportId, onClose }: ReportDetailModalProps) {
  const [report, setReport] = useState<ReportDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    fetch(`/api/student-reports/${reportId}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || 'Failed to load report')
        }
        return res.json()
      })
      .then((data) => { if (!cancelled) setReport(data) })
      .catch((err) => { if (!cancelled) setError(err.message || 'Failed to load report') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [reportId])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto border border-slate-100">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 sticky top-0 bg-white">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {loading ? 'Loading report...' : report ? `${report.className} — ${report.subject}` : 'Report'}
            </h2>
            {report && (
              <p className="text-[12px] text-slate-500 mt-0.5">
                {report.term} · Uploaded by {report.teacherName} · {report.date}
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-400">
              <Loader2 className="w-7 h-7 animate-spin mb-3" />
              <p className="text-sm font-medium">Loading...</p>
            </div>
          ) : error ? (
            <div className="flex items-start gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
            </div>
          ) : report && report.entries.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">No students in this report.</p>
          ) : (
            <div className="border border-slate-100 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {['Name', 'Roll No', 'Marks', 'Grade', 'Attendance', 'Remarks'].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left font-bold text-slate-500 uppercase tracking-wider text-[10px]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {report?.entries.map((e, i) => (
                    <tr key={i} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-medium text-slate-800">{e.name}</td>
                      <td className="px-4 py-3 text-slate-600">{e.rollNo || '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{e.marks} / {e.maxMarks}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-indigo-50 text-indigo-700">{e.grade}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{e.attendance !== null ? `${e.attendance}%` : '—'}</td>
                      <td className="px-4 py-3 text-slate-500">{e.remarks || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
