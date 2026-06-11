'use client'
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Users,
  BookOpen,
  Pencil,
  ClipboardList,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Loader2,
  Filter,
  RefreshCw,
  FileText,
  TrendingUp,
} from 'lucide-react'

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, type: 'spring' as const, stiffness: 320, damping: 28 },
})

interface ClassHeld {
  className: string
  subject: string
  topicCovered: string
  studentsPresent: number
}

interface Report {
  _id: string
  teacherName: string
  teacherEmail: string
  date: string
  classesHeld: ClassHeld[]
  activitiesConducted: string
  materialsUsed: string
  studentsAttended: string
  remarks: string
  status: 'draft' | 'submitted'
  createdAt: string
  updatedAt: string
}

function getTodayLocal() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().split('T')[0]
}

function formatDisplayDate(dateStr: string) {
  try {
    const d = new Date(dateStr.replace(/-/g, '/'))
    return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return dateStr
  }
}

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export default function DailyReportsViewer() {
  const [selectedDate, setSelectedDate] = useState(getTodayLocal())
  const [reports, setReports] = useState<Report[]>([])
  const [allReports, setAllReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<'all' | 'submitted' | 'draft'>('all')

  const fetchReports = useCallback(async (date: string) => {
    setLoading(true)
    try {
      const [dateRes, allRes] = await Promise.all([
        fetch(`/api/daily-report?date=${date}`),
        fetch('/api/daily-report'),
      ])
      const dateData = await dateRes.json()
      const allData = await allRes.json()
      if (!dateData.error) setReports(dateData)
      if (!allData.error) setAllReports(allData)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchReports(selectedDate)
  }, [selectedDate, fetchReports])

  const filteredReports = reports.filter(r =>
    filterStatus === 'all' ? true : r.status === filterStatus
  )

  // Stats for selected date
  const totalSubmitted = reports.filter(r => r.status === 'submitted').length
  const totalDraft = reports.filter(r => r.status === 'draft').length
  const totalClasses = reports.reduce((s, r) => s + r.classesHeld.length, 0)
  const totalStudents = reports.reduce(
    (s, r) => s + r.classesHeld.reduce((cs, c) => cs + (c.studentsPresent || 0), 0), 0
  )

  // Unique teachers who submitted today vs total who have any report
  const teachersWithReports = new Set(allReports.filter(r => r.date === selectedDate).map(r => r.teacherEmail)).size

  return (
    <div className="flex-1 p-8 overflow-auto bg-gray-50/50">
      {/* Header */}
      <motion.div {...fadeUp(0)} className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Daily Teacher Reports</h1>
          <p className="text-gray-500 mt-1 text-sm">Monitor what teachers accomplished each day across the institution.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchReports(selectedDate)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 border border-gray-200 bg-white rounded-xl shadow-sm hover:bg-gray-50 transition-all font-semibold"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <div className="flex items-center gap-2 text-sm bg-white border border-gray-200 shadow-sm px-3 py-2 rounded-xl">
            <CalendarDays className="w-4 h-4 text-[#002045]" />
            <input
              type="date"
              value={selectedDate}
              max={getTodayLocal()}
              onChange={e => { setSelectedDate(e.target.value); setExpandedId(null) }}
              className="text-sm font-semibold text-gray-700 outline-none cursor-pointer"
            />
          </div>
        </div>
      </motion.div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          {
            icon: <FileText className="w-5 h-5" />,
            label: 'Reports Submitted',
            value: totalSubmitted,
            color: 'bg-emerald-50',
            iconColor: 'text-emerald-600',
            sub: `${totalDraft} draft${totalDraft !== 1 ? 's' : ''}`,
          },
          {
            icon: <Users className="w-5 h-5" />,
            label: 'Teachers Reported',
            value: teachersWithReports,
            color: 'bg-blue-50',
            iconColor: 'text-blue-600',
            sub: 'for this date',
          },
          {
            icon: <BookOpen className="w-5 h-5" />,
            label: 'Classes Logged',
            value: totalClasses,
            color: 'bg-indigo-50',
            iconColor: 'text-indigo-600',
            sub: 'total sessions',
          },
          {
            icon: <TrendingUp className="w-5 h-5" />,
            label: 'Students Reached',
            value: totalStudents,
            color: 'bg-amber-50',
            iconColor: 'text-amber-600',
            sub: 'across all classes',
          },
        ].map((stat, i) => (
          <motion.div key={stat.label} {...fadeUp(i * 0.04)} className={`${stat.color} rounded-2xl p-5 shadow-sm border border-transparent hover:border-gray-200 transition-colors`}>
            <div className="flex items-center justify-between mb-4">
              <span className={stat.iconColor}>{stat.icon}</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 leading-none mb-1">{stat.value}</p>
            <p className="text-xs font-semibold text-gray-600">{stat.label}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{stat.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Date heading + filter */}
      <motion.div {...fadeUp(0.16)} className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-bold text-gray-900">{formatDisplayDate(selectedDate)}</h2>
          <p className="text-xs text-gray-400 mt-0.5">{reports.length} report{reports.length !== 1 ? 's' : ''} for this date</p>
        </div>
        <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
          <Filter className="w-3.5 h-3.5 text-gray-400 ml-2" />
          {(['all', 'submitted', 'draft'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilterStatus(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all capitalize ${
                filterStatus === f
                  ? 'bg-[#002045] text-white shadow-sm'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Reports list */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-7 h-7 animate-spin text-indigo-600" />
        </div>
      ) : filteredReports.length === 0 ? (
        <motion.div {...fadeUp(0.1)} className="flex flex-col items-center justify-center py-20 bg-white border border-gray-100 rounded-2xl shadow-sm text-center">
          <ClipboardList className="w-12 h-12 text-gray-200 mb-4" />
          <p className="text-lg font-bold text-gray-700">No reports for this date</p>
          <p className="text-sm text-gray-400 max-w-sm mt-1">
            {filterStatus !== 'all'
              ? `No ${filterStatus} reports found. Try changing the filter.`
              : 'Teachers haven\'t submitted their daily reports for this date yet.'}
          </p>
        </motion.div>
      ) : (
        <div className="space-y-3">
          {filteredReports.map((report, i) => {
            const isExpanded = expandedId === report._id
            const totalStudentsInReport = report.classesHeld.reduce((s, c) => s + (c.studentsPresent || 0), 0)

            return (
              <motion.div
                key={report._id}
                {...fadeUp(i * 0.04)}
                className={`bg-white border rounded-2xl shadow-sm overflow-hidden transition-all ${
                  isExpanded ? 'border-[#002045]/20 shadow-md' : 'border-gray-100 hover:border-gray-200 hover:shadow'
                }`}
              >
                {/* Card Header — always visible */}
                <button
                  className="w-full flex items-center justify-between px-6 py-4 text-left"
                  onClick={() => setExpandedId(isExpanded ? null : report._id)}
                >
                  <div className="flex items-center gap-4">
                    {/* Teacher avatar */}
                    <div className="w-10 h-10 rounded-full bg-[#002045]/10 text-[#002045] flex items-center justify-center text-sm font-bold shrink-0">
                      {initials(report.teacherName)}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{report.teacherName}</p>
                      <p className="text-xs text-gray-400">{report.teacherEmail}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    {/* Quick stats in header */}
                    <div className="hidden md:flex items-center gap-6 text-xs text-gray-500">
                      <span className="flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-gray-300" />
                        {report.classesHeld.length} class{report.classesHeld.length !== 1 ? 'es' : ''}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-gray-300" />
                        {totalStudentsInReport} students
                      </span>
                    </div>

                    {/* Status badge */}
                    <span className={`flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full ${
                      report.status === 'submitted'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}>
                      {report.status === 'submitted'
                        ? <CheckCircle2 className="w-3 h-3" />
                        : <Clock className="w-3 h-3" />}
                      {report.status === 'submitted' ? 'Submitted' : 'Draft'}
                    </span>

                    {isExpanded
                      ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
                      : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
                  </div>
                </button>

                {/* Expanded Detail Panel */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-6 pb-6 pt-1 border-t border-gray-100">
                        <div className="grid grid-cols-12 gap-6">
                          {/* Classes table */}
                          <div className="col-span-7">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-3">
                              Classes Held
                            </p>
                            {report.classesHeld.length === 0 ? (
                              <p className="text-xs text-gray-400 italic">No classes logged.</p>
                            ) : (
                              <div className="rounded-xl border border-gray-100 overflow-hidden">
                                <table className="w-full text-left">
                                  <thead>
                                    <tr className="bg-gray-50 border-b border-gray-100">
                                      {['Class', 'Subject', 'Topic', 'Students'].map(h => (
                                        <th key={h} className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">{h}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-50">
                                    {report.classesHeld.map((cls, idx) => (
                                      <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-3 py-2 text-xs font-semibold text-gray-800">{cls.className}</td>
                                        <td className="px-3 py-2 text-xs text-gray-600">{cls.subject}</td>
                                        <td className="px-3 py-2 text-xs text-gray-500">{cls.topicCovered}</td>
                                        <td className="px-3 py-2 text-xs font-bold text-[#002045]">{cls.studentsPresent}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>

                          {/* Text fields */}
                          <div className="col-span-5 space-y-4">
                            {[
                              { icon: <Pencil className="w-3.5 h-3.5" />, label: 'Activities Conducted', value: report.activitiesConducted },
                              { icon: <BookOpen className="w-3.5 h-3.5" />, label: 'Materials Used', value: report.materialsUsed },
                              { icon: <Users className="w-3.5 h-3.5" />, label: 'Attendance Note', value: report.studentsAttended },
                              { icon: <ClipboardList className="w-3.5 h-3.5" />, label: 'Remarks', value: report.remarks },
                            ].map(field => (
                              field.value ? (
                                <div key={field.label}>
                                  <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                                    {field.icon} {field.label}
                                  </p>
                                  <p className="text-xs text-gray-600 leading-relaxed bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                                    {field.value}
                                  </p>
                                </div>
                              ) : null
                            ))}

                            {!report.activitiesConducted && !report.materialsUsed && !report.studentsAttended && !report.remarks && (
                              <p className="text-xs text-gray-400 italic">No additional details provided.</p>
                            )}

                            {/* Timestamp */}
                            <p className="text-[10px] text-gray-300 pt-2">
                              Last updated: {new Date(report.updatedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                            </p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Missing reports warning */}
      {!loading && reports.filter(r => r.status === 'submitted').length === 0 && reports.length > 0 && (
        <motion.div {...fadeUp(0.3)} className="mt-4 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 font-medium">
            {reports.length} draft report{reports.length > 1 ? 's exist' : ' exists'} for this date but {reports.length > 1 ? 'none have' : 'it has not'} been officially submitted yet.
          </p>
        </motion.div>
      )}
    </div>
  )
}
