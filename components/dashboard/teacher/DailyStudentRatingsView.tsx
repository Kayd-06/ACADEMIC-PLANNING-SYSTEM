'use client'

import { useState, useEffect } from 'react'
import { Calendar, ChevronDown, Save, Loader2, CheckCircle2, Star, Sparkles, Filter, RefreshCw, UserCheck, AlertCircle } from 'lucide-react'
import { formatDate } from '@/lib/date'

function getTodayLocal() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().split('T')[0]
}

type RatingOption = 'Unsatisfactory' | 'Satisfactory' | 'Good' | 'Very Good' | 'Excellent'

const RATING_OPTIONS: RatingOption[] = ['Unsatisfactory', 'Satisfactory', 'Good', 'Very Good', 'Excellent']

const RATING_COLORS: Record<RatingOption, string> = {
  Unsatisfactory: 'bg-rose-50 text-rose-700 border-rose-200 focus:ring-rose-400',
  Satisfactory: 'bg-amber-50 text-amber-700 border-amber-200 focus:ring-amber-400',
  Good: 'bg-blue-50 text-blue-700 border-blue-200 focus:ring-blue-400',
  'Very Good': 'bg-indigo-50 text-indigo-700 border-indigo-200 focus:ring-indigo-400',
  Excellent: 'bg-emerald-50 text-emerald-700 border-emerald-200 focus:ring-emerald-400',
}

interface StudentRatingItem {
  studentId: string
  studentName: string
  rollNo: string
  batch: string
  attitude: RatingOption
  behaviour: RatingOption
  focus: RatingOption
  interaction: RatingOption
  notes: string
  isSaved?: boolean
}

export default function DailyStudentRatingsView() {
  const [date, setDate] = useState(getTodayLocal())
  const [selectedBatch, setSelectedBatch] = useState('')
  const [batches, setBatches] = useState<string[]>([])
  const [students, setStudents] = useState<StudentRatingItem[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  // Fetch batches
  useEffect(() => {
    fetch('/api/daily-report', { method: 'PUT' })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setBatches(data)
          if (data.length > 0 && !selectedBatch) {
            setSelectedBatch(data[0])
          }
        }
      })
      .catch(() => {})
  }, [selectedBatch])

  // Fetch student roster & existing ratings when batch or date changes
  useEffect(() => {
    if (!selectedBatch) return
    setLoading(true)
    setErrorMsg('')
    setSuccessMsg('')
    fetch(`/api/teacher/daily-ratings?batch=${encodeURIComponent(selectedBatch)}&date=${encodeURIComponent(date)}`)
      .then(r => r.json())
      .then(data => {
        if (data.students) {
          setStudents(data.students)
        } else if (data.error) {
          setErrorMsg(data.error)
          setStudents([])
        }
      })
      .catch(() => {
        setErrorMsg('Failed to load student roster.')
        setStudents([])
      })
      .finally(() => setLoading(false))
  }, [selectedBatch, date])

  const updateStudentRating = (studentId: string, field: 'attitude' | 'behaviour' | 'focus' | 'interaction' | 'notes', val: any) => {
    setStudents(prev =>
      prev.map(s => (s.studentId === studentId ? { ...s, [field]: val, isSaved: false } : s))
    )
  }

  const applyBulkRating = (rating: RatingOption) => {
    setStudents(prev =>
      prev.map(s => ({
        ...s,
        attitude: rating,
        behaviour: rating,
        focus: rating,
        interaction: rating,
        isSaved: false,
      }))
    )
  }

  const handleSaveAll = async () => {
    if (!selectedBatch || students.length === 0) return
    setSaving(true)
    setErrorMsg('')
    setSuccessMsg('')

    try {
      const payload = {
        batch: selectedBatch,
        date,
        ratings: students.map(s => ({
          studentId: s.studentId,
          attitude: s.attitude,
          behaviour: s.behaviour,
          focus: s.focus,
          interaction: s.interaction,
          notes: s.notes,
        })),
      }

      const res = await fetch('/api/teacher/daily-ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (res.ok && data.success) {
        setSuccessMsg(`Daily ratings saved successfully for ${students.length} students!`)
        setStudents(prev => prev.map(s => ({ ...s, isSaved: true })))
        setTimeout(() => setSuccessMsg(''), 4000)
      } else {
        setErrorMsg(data.error || 'Failed to save daily ratings.')
      }
    } catch (err) {
      console.error(err)
      setErrorMsg('Network error. Could not save ratings.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex-1 p-6 md:p-8 overflow-auto bg-slate-50 min-h-screen">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Star className="w-6 h-6 text-amber-500 fill-amber-400" />
            Daily Student Ratings
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Rate behavior, participation, attitude, focus & interaction for each student daily.
          </p>
        </div>

        <button
          onClick={handleSaveAll}
          disabled={saving || loading || students.length === 0}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition disabled:opacity-50 cursor-pointer self-start md:self-auto"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save All Ratings
        </button>
      </div>

      {/* Control Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          {/* Date Picker */}
          <div>
            <label className="block text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">
              Date
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Batch Selector */}
          <div>
            <label className="block text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">
              Select Batch
            </label>
            <div className="relative">
              <select
                value={selectedBatch}
                onChange={e => setSelectedBatch(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer"
              >
                <option value="">Choose batch...</option>
                {batches.map(b => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Quick Bulk Presets */}
          <div>
            <label className="block text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">
              Quick Presets
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => applyBulkRating('Good')}
                disabled={students.length === 0}
                className="flex-1 py-2 px-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-xl text-[11px] font-bold transition disabled:opacity-50"
              >
                Set Good
              </button>
              <button
                type="button"
                onClick={() => applyBulkRating('Very Good')}
                disabled={students.length === 0}
                className="flex-1 py-2 px-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-xl text-[11px] font-bold transition disabled:opacity-50"
              >
                Set Very Good
              </button>
              <button
                type="button"
                onClick={() => applyBulkRating('Excellent')}
                disabled={students.length === 0}
                className="flex-1 py-2 px-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-xl text-[11px] font-bold transition disabled:opacity-50"
              >
                Set Excellent
              </button>
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs font-semibold text-rose-700">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs font-semibold text-emerald-700">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {successMsg}
          </div>
        )}
      </div>

      {/* Roster Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center text-slate-400 gap-3">
            <RefreshCw className="w-7 h-7 animate-spin text-indigo-600" />
            <p className="text-xs font-semibold">Loading student roster and ratings...</p>
          </div>
        ) : !selectedBatch ? (
          <div className="p-12 text-center text-slate-400">
            <UserCheck className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-semibold">Please select a batch above to load student roster.</p>
          </div>
        ) : students.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <p className="text-sm font-semibold">No students found in batch "{selectedBatch}".</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-extrabold uppercase text-[10px] tracking-wider">
                  <th className="py-3.5 px-4 w-12 text-center">#</th>
                  <th className="py-3.5 px-4 min-w-[160px]">Student Name</th>
                  <th className="py-3.5 px-4 min-w-[140px]">Attitude</th>
                  <th className="py-3.5 px-4 min-w-[140px]">Behaviour</th>
                  <th className="py-3.5 px-4 min-w-[140px]">Focus</th>
                  <th className="py-3.5 px-4 min-w-[140px]">Interaction</th>
                  <th className="py-3.5 px-4 min-w-[200px]">Notes</th>
                  <th className="py-3.5 px-4 w-20 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((student, idx) => (
                  <tr key={student.studentId} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 text-center font-bold text-slate-400">{student.rollNo || idx + 1}</td>
                    <td className="py-3 px-4">
                      <p className="font-bold text-slate-800">{student.studentName}</p>
                      <p className="text-[10px] text-slate-400">{student.batch}</p>
                    </td>

                    {/* Attitude Rating */}
                    <td className="py-3 px-4">
                      <select
                        value={student.attitude}
                        onChange={e => updateStudentRating(student.studentId, 'attitude', e.target.value as RatingOption)}
                        className={`w-full px-2.5 py-1.5 border rounded-lg font-bold text-xs transition focus:outline-none focus:ring-2 cursor-pointer ${RATING_COLORS[student.attitude]}`}
                      >
                        {RATING_OPTIONS.map(opt => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Behaviour Rating */}
                    <td className="py-3 px-4">
                      <select
                        value={student.behaviour}
                        onChange={e => updateStudentRating(student.studentId, 'behaviour', e.target.value as RatingOption)}
                        className={`w-full px-2.5 py-1.5 border rounded-lg font-bold text-xs transition focus:outline-none focus:ring-2 cursor-pointer ${RATING_COLORS[student.behaviour]}`}
                      >
                        {RATING_OPTIONS.map(opt => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Focus Rating */}
                    <td className="py-3 px-4">
                      <select
                        value={student.focus}
                        onChange={e => updateStudentRating(student.studentId, 'focus', e.target.value as RatingOption)}
                        className={`w-full px-2.5 py-1.5 border rounded-lg font-bold text-xs transition focus:outline-none focus:ring-2 cursor-pointer ${RATING_COLORS[student.focus]}`}
                      >
                        {RATING_OPTIONS.map(opt => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Interaction Rating */}
                    <td className="py-3 px-4">
                      <select
                        value={student.interaction}
                        onChange={e => updateStudentRating(student.studentId, 'interaction', e.target.value as RatingOption)}
                        className={`w-full px-2.5 py-1.5 border rounded-lg font-bold text-xs transition focus:outline-none focus:ring-2 cursor-pointer ${RATING_COLORS[student.interaction]}`}
                      >
                        {RATING_OPTIONS.map(opt => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Notes */}
                    <td className="py-3 px-4">
                      <input
                        type="text"
                        value={student.notes || ''}
                        onChange={e => updateStudentRating(student.studentId, 'notes', e.target.value)}
                        placeholder="Optional remarks..."
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4 text-center">
                      {student.isSaved ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" /> Saved
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                          Pending
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
