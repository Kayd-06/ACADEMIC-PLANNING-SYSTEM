'use client'

import { useState, useEffect } from 'react'
import { Star, MessageSquare, CheckCircle2, XCircle, Clock, Award, User, RefreshCw, AlertCircle, Calendar } from 'lucide-react'
import { formatDate } from '@/lib/date'

interface TeacherFeedbackSummaryProps {
  studentId: string
}

export default function TeacherFeedbackSummaryView({ studentId }: TeacherFeedbackSummaryProps) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!studentId) return
    setLoading(true)
    setError('')
    fetch(`/api/reports/students/${studentId}/teacher-feedback`)
      .then(r => r.json())
      .then(result => {
        if (result.error) {
          setError(result.error)
        } else {
          setData(result)
        }
      })
      .catch(() => setError('Failed to load teacher feedback summary.'))
      .finally(() => setLoading(false))
  }, [studentId])

  if (loading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center text-slate-400 gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
        <p className="text-sm font-semibold">Loading Teacher Feedback Summary Report...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 space-y-2">
        <AlertCircle className="w-8 h-8 mx-auto" />
        <p className="text-sm font-bold">{error || 'No report data found'}</p>
      </div>
    )
  }

  const { student, dailyRatings, ptmReports } = data

  const getScoreBadge = (score: number) => {
    if (score >= 4.5) return { label: 'Excellent', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' }
    if (score >= 3.5) return { label: 'Very Good', color: 'bg-indigo-100 text-indigo-800 border-indigo-300' }
    if (score >= 2.5) return { label: 'Good', color: 'bg-blue-100 text-blue-800 border-blue-300' }
    if (score >= 1.5) return { label: 'Satisfactory', color: 'bg-amber-100 text-amber-800 border-amber-300' }
    return { label: 'Needs Focus', color: 'bg-rose-100 text-rose-800 border-rose-300' }
  }

  const overallBadge = getScoreBadge(dailyRatings.overallRatingScore || 0)

  return (
    <div className="space-y-6 text-slate-800 font-sans">
      {/* Report Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-extrabold text-slate-900">{student.name}</h2>
            <span className="px-2.5 py-0.5 text-[10px] font-extrabold bg-slate-100 text-slate-600 rounded-full border border-slate-200">
              Roll No: {student.rollNo || 'N/A'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Batch: <span className="font-bold text-slate-700">{student.batch}</span> · Guardian: {student.guardianName} ({student.guardianPhone})
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Behavioral Score</p>
            <p className="text-2xl font-extrabold text-slate-900">{dailyRatings.overallRatingScore} <span className="text-xs text-slate-400">/ 5.0</span></p>
          </div>
          <span className={`px-3 py-1 text-xs font-bold rounded-xl border ${overallBadge.color}`}>
            {overallBadge.label}
          </span>
        </div>
      </div>

      {/* Daily Behavioral & Participation Metrics */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
        <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
          <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
          Daily Ratings Rollup ({dailyRatings.totalEntries} Days Evaluated)
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 text-center">
            <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">Attitude</p>
            <p className="text-2xl font-extrabold text-indigo-600">{dailyRatings.avgAttitude || 0}</p>
            <p className="text-[10px] text-slate-400 font-semibold mt-1">/ 5.0 Rating</p>
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 text-center">
            <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">Behaviour</p>
            <p className="text-2xl font-extrabold text-emerald-600">{dailyRatings.avgBehaviour || 0}</p>
            <p className="text-[10px] text-slate-400 font-semibold mt-1">/ 5.0 Rating</p>
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 text-center">
            <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">Focus</p>
            <p className="text-2xl font-extrabold text-amber-600">{dailyRatings.avgFocus || 0}</p>
            <p className="text-[10px] text-slate-400 font-semibold mt-1">/ 5.0 Rating</p>
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 text-center">
            <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">Interaction</p>
            <p className="text-2xl font-extrabold text-blue-600">{dailyRatings.avgInteraction || 0}</p>
            <p className="text-[10px] text-slate-400 font-semibold mt-1">/ 5.0 Rating</p>
          </div>
        </div>

        {/* Recent Daily Rating Entries */}
        {dailyRatings.ratingsList?.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest mb-2.5">Recent Ratings Log</p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-extrabold text-[10px] uppercase">
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3">Attitude</th>
                    <th className="py-2 px-3">Behaviour</th>
                    <th className="py-2 px-3">Focus</th>
                    <th className="py-2 px-3">Interaction</th>
                    <th className="py-2 px-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dailyRatings.ratingsList.slice(0, 5).map((r: any) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-semibold text-slate-700">{formatDate(r.date)}</td>
                      <td className="py-2 px-3 font-bold text-indigo-700">{r.attitude}</td>
                      <td className="py-2 px-3 font-bold text-emerald-700">{r.behaviour}</td>
                      <td className="py-2 px-3 font-bold text-amber-700">{r.focus}</td>
                      <td className="py-2 px-3 font-bold text-blue-700">{r.interaction}</td>
                      <td className="py-2 px-3 text-slate-500 italic max-w-xs truncate">{r.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Parent-Teacher Meeting Discussions & Action Items */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-indigo-600" />
            Parent-Teacher Meetings Log ({ptmReports.totalMeetings} Meetings)
          </h3>

          <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-xl">
            Parent Attendance Rate: <span className="text-indigo-600">{ptmReports.attendanceRate}%</span>
          </span>
        </div>

        {ptmReports.ptmList?.length === 0 ? (
          <p className="text-xs text-slate-400 italic">No parent-teacher meeting notes logged yet.</p>
        ) : (
          <div className="space-y-3">
            {ptmReports.ptmList.map((ptm: any) => (
              <div key={ptm.id} className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{formatDate(ptm.date)}</span>
                    {ptm.parentName && <span className="text-slate-400">· Parent: {ptm.parentName}</span>}
                  </div>
                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                    ptm.parentAttended ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}>
                    {ptm.parentAttended ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                    {ptm.parentAttended ? 'Attended' : 'Absent'}
                  </span>
                </div>

                <div>
                  <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-0.5">Discussion Notes</p>
                  <p className="text-slate-700 leading-relaxed font-normal">{ptm.discussionNotes}</p>
                </div>

                {ptm.actionItems && (
                  <div className="pt-2 border-t border-slate-200/60">
                    <p className="text-[10px] font-extrabold text-indigo-600 uppercase tracking-widest mb-0.5">Action Items & Next Steps</p>
                    <p className="text-slate-800 font-semibold leading-relaxed">{ptm.actionItems}</p>
                  </div>
                )}

                {ptm.followUpDate && (
                  <p className="text-[10px] font-bold text-indigo-600 flex items-center gap-1 mt-1">
                    <Clock className="w-3 h-3" /> Follow-up: {formatDate(ptm.followUpDate)}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
