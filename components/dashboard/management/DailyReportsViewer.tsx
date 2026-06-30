'use client'
import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { CalendarDays, Users, BookOpen, ClipboardList, CheckCircle2, Flag, Loader2, RefreshCw, TrendingUp } from 'lucide-react'

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, type: 'spring' as const, stiffness: 320, damping: 28 },
})

interface DailyReport {
  id: string
  teacherName: string
  teacherEmail: string
  date: string
  batch: string
  subject: string
  chapter: string
  topicsCovered: string
  presentCount: number
  absentCount: number
  homeworkGiven: string
  observations: string
  isLate: boolean
  submittedAt: string
}

function getTodayLocal() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().split('T')[0]
}

function formatDisplayDate(dateStr: string) {
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  } catch { return dateStr }
}

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

const COLORS = ['bg-indigo-600 text-white', 'bg-emerald-600 text-white', 'bg-amber-500 text-white', 'bg-rose-600 text-white', 'bg-blue-600 text-white']
function avatarColor(name: string) { return COLORS[name.length % COLORS.length] }

export default function DailyReportsViewer() {
  const [selectedDate, setSelectedDate] = useState(getTodayLocal())
  const [reports, setReports] = useState<DailyReport[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<'All' | 'Submitted' | 'Late'>('All')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchReports = useCallback(async (date: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/daily-report?date=${date}`)
      const data = await res.json()
      if (Array.isArray(data)) setReports(data)
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchReports(selectedDate) }, [selectedDate, fetchReports])

  const filtered = reports.filter(r =>
    filterStatus === 'All' ? true : filterStatus === 'Late' ? r.isLate : !r.isLate
  )

  const totalStudents = reports.reduce((s, r) => s + r.presentCount + r.absentCount, 0)
  const uniqueTeachers = new Set(reports.map(r => r.teacherEmail)).size
  const uniqueBatches = new Set(reports.map(r => r.batch)).size
  const lateCount = reports.filter(r => r.isLate).length

  return (
    <div className="flex-1 p-8 overflow-auto bg-gray-50/50">
      <motion.div {...fadeUp(0)} className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Daily Teacher Reports</h1>
          <p className="text-gray-500 mt-1 text-sm">Monitor what teachers accomplished each day across the institution.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => fetchReports(selectedDate)} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 border border-gray-200 bg-white rounded-xl shadow-sm hover:bg-gray-50 font-semibold">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <div className="flex items-center gap-2 bg-white border border-gray-200 shadow-sm px-3 py-2 rounded-xl">
            <CalendarDays className="w-4 h-4 text-gray-400" />
            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
              className="text-sm font-semibold text-gray-700 focus:outline-none bg-transparent" />
          </div>
        </div>
      </motion.div>

      {/* KPIs */}
      <motion.div {...fadeUp(0.05)} className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { icon: ClipboardList, label: 'Reports Submitted', value: reports.length, sub: `${lateCount} late`, color: 'bg-green-50 text-green-600' },
          { icon: Users, label: 'Teachers Reported', value: uniqueTeachers, sub: 'for this date', color: 'bg-blue-50 text-blue-600' },
          { icon: BookOpen, label: 'Classes Logged', value: uniqueBatches, sub: 'total batches', color: 'bg-amber-50 text-amber-600' },
          { icon: TrendingUp, label: 'Students Reached', value: totalStudents, sub: 'across all classes', color: 'bg-rose-50 text-rose-600' },
        ].map((kpi, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${kpi.color}`}><kpi.icon className="w-5 h-5" /></div>
            <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
            <p className="text-[13px] font-semibold text-gray-700 mt-0.5">{kpi.label}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{kpi.sub}</p>
          </div>
        ))}
      </motion.div>

      {/* Filter & List */}
      <motion.div {...fadeUp(0.1)} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-base font-bold text-gray-900">{formatDisplayDate(selectedDate)}</p>
            <p className="text-xs text-gray-400 mt-0.5">{reports.length} report{reports.length !== 1 ? 's' : ''} for this date</p>
          </div>
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
            {(['All', 'Submitted', 'Late'] as const).map(f => (
              <button key={f} onClick={() => setFilterStatus(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterStatus === f ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                {f}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /><span className="text-sm">Loading reports...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <ClipboardList className="w-10 h-10 mx-auto mb-3 text-gray-200" />
            <p className="text-sm font-semibold text-gray-500">No reports for this date</p>
            <p className="text-xs text-gray-400 mt-1">Teachers haven't submitted their daily reports for this date yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map((report) => (
              <div key={report.id}>
                <button onClick={() => setExpandedId(expandedId === report.id ? null : report.id)}
                  className="w-full flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors text-left">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${avatarColor(report.teacherName)}`}>
                    {initials(report.teacherName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-[13px] font-bold text-gray-900">{report.teacherName}</p>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold rounded-full uppercase ${report.isLate ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                        {report.isLate ? <Flag className="w-2.5 h-2.5" /> : <CheckCircle2 className="w-2.5 h-2.5" />}
                        {report.isLate ? 'Late' : 'On Time'}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500">{report.batch} · {report.subject}{report.chapter ? ` · ${report.chapter}` : ''}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[11px] font-semibold text-gray-500">{new Date(report.submittedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-400 justify-end">
                      <span className="text-emerald-600 font-bold">✓ {report.presentCount} present</span>
                      <span className="text-red-500 font-bold">✗ {report.absentCount} absent</span>
                    </div>
                  </div>
                </button>

                {expandedId === report.id && (
                  <div className="px-6 pb-5 bg-gray-50/60 border-t border-gray-100">
                    <div className="pt-4 space-y-3">
                      {report.topicsCovered && (
                        <div><p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Topics Covered</p>
                          <p className="text-sm text-gray-700">{report.topicsCovered}</p></div>
                      )}
                      {report.homeworkGiven && (
                        <div><p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Homework Given</p>
                          <p className="text-sm text-gray-700">{report.homeworkGiven}</p></div>
                      )}
                      {report.observations && (
                        <div><p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Observations</p>
                          <p className="text-sm text-gray-700">{report.observations}</p></div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  )
}
