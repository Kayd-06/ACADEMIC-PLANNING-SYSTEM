'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, RefreshCw, AlertCircle, Check, X as XIcon, Minus, Award, Calendar, Layers, Users, BookOpen } from 'lucide-react'
import { useAlert } from '@/components/dashboard/AlertProvider'
import { formatDate } from '@/lib/date'

interface Question {
  id: string
  topic: string
  marks: number
  negativeMarks: number
}

interface StudentResult {
  studentId: string
  studentName: string
  rollNo: string
  responses: Record<string, 'Correct' | 'Incorrect' | 'Unattempted' | null>
  mistakes: Record<string, string | null>
}

const MISTAKE_TYPES = [
  'Calculation Error',
  'Conceptual Error',
  'Formula Error',
  'Silly Mistake',
  'Time Management',
  'Other'
]

interface TestGradingModalProps {
  test: { id: string; title: string; batch: string; totalMarks: number; date: string }
  onClose: () => void
  onSaved: () => void
}

export default function TestGradingModal({ test, onClose, onSaved }: TestGradingModalProps) {
  const { showAlert } = useAlert()
  const [questions, setQuestions] = useState<Question[]>([])
  const [studentResults, setStudentResults] = useState<StudentResult[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadResponses = () => {
    setLoading(true)
    setError('')
    
    fetch(`/api/tests/${test.id}/responses`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || 'Failed to load roster or test responses')
        return data
      })
      .then((data) => {
        setQuestions(data.questions || [])
        setStudentResults(data.studentResults || [])
      })
      .catch((err) => { setError(err.message) })
      .finally(() => { setLoading(false) })
  }

  useEffect(() => {
    loadResponses()
  }, [test.id])

  function toggleResponse(studentId: string, questionId: string) {
    setStudentResults(prev => prev.map(student => {
      if (student.studentId !== studentId) return student
      
      const current = student.responses[questionId]
      let nextStatus: 'Correct' | 'Incorrect' | 'Unattempted' | null = null
      
      // Cycle: Unattempted (or null) -> Correct -> Incorrect -> Unattempted
      if (!current || current === 'Unattempted') nextStatus = 'Correct'
      else if (current === 'Correct') nextStatus = 'Incorrect'
      else if (current === 'Incorrect') nextStatus = 'Unattempted'
      
      return {
        ...student,
        responses: {
          ...student.responses,
          [questionId]: nextStatus
        },
        mistakes: {
          ...student.mistakes,
          [questionId]: nextStatus === 'Incorrect' ? MISTAKE_TYPES[0] : null
        }
      }
    }))
  }

  function setMistake(studentId: string, questionId: string, mistakeType: string) {
    setStudentResults(prev => prev.map(student => {
      if (student.studentId !== studentId) return student
      return {
        ...student,
        mistakes: {
          ...student.mistakes,
          [questionId]: mistakeType
        }
      }
    }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      const payloadResponses: any[] = []
      studentResults.forEach(student => {
        Object.entries(student.responses).forEach(([questionId, status]) => {
          if (status) {
            payloadResponses.push({
              studentId: student.studentId,
              questionId,
              status,
              mistakeType: status === 'Incorrect' ? student.mistakes[questionId] : null
            })
          }
        })
      })

      const res = await fetch(`/api/tests/${test.id}/responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responses: payloadResponses }),
      })
      
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to save test responses')
      
      onSaved()
      onClose()
    } catch (err: any) {
      showAlert({ title: 'Failed to Save', message: err.message, type: 'warning', onRetry: handleSave, retryText: 'Retry' })
    } finally {
      setSaving(false)
    }
  }

  // Count response summary
  let totalCorrect = 0
  let totalIncorrect = 0
  let totalUnattempted = 0
  studentResults.forEach(s => {
    Object.values(s.responses).forEach(status => {
      if (status === 'Correct') totalCorrect++
      else if (status === 'Incorrect') totalIncorrect++
      else if (status === 'Unattempted') totalUnattempted++
    })
  })

  const renderStatusIcon = (status: string | null) => {
    if (status === 'Correct') return <Check className="w-3.5 h-3.5 text-white stroke-[2.5]" />
    if (status === 'Incorrect') return <XIcon className="w-3.5 h-3.5 text-white stroke-[2.5]" />
    return <Minus className="w-3.5 h-3.5 text-slate-400" />
  }

  const getStatusStyle = (status: string | null) => {
    if (status === 'Correct') return 'bg-emerald-500 hover:bg-emerald-600 border-emerald-600 text-white shadow-sm shadow-emerald-200'
    if (status === 'Incorrect') return 'bg-rose-500 hover:bg-rose-600 border-rose-600 text-white shadow-sm shadow-rose-200'
    return 'bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-400'
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden border border-slate-200/80 flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-8 py-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white shrink-0">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-100 rounded-full flex items-center gap-1">
                  <Award className="w-3 h-3" /> Test Grading Grid
                </span>
              </div>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">{test.title}</h2>
              <div className="flex items-center gap-3 mt-1 text-xs font-semibold text-slate-500">
                <span className="flex items-center gap-1"><Layers className="w-3.5 h-3.5 text-slate-400" /> Batch: <strong className="text-slate-700">{test.batch}</strong></span>
                <span className="text-slate-300">•</span>
                <span className="flex items-center gap-1"><BookOpen className="w-3.5 h-3.5 text-slate-400" /> Total Marks: <strong className="text-slate-700">{test.totalMarks}</strong></span>
                <span className="text-slate-300">•</span>
                <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-slate-400" /> {formatDate(test.date)}</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all shadow-sm"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Content */}
          <div className="p-8 overflow-y-auto flex-1 bg-slate-50/50">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mb-3" />
                <p className="text-sm font-semibold text-slate-600">Loading student roster and question grid...</p>
              </div>
            ) : error ? (
              <div className="max-w-md mx-auto my-8 bg-white p-6 rounded-2xl border border-rose-100 shadow-sm text-center">
                <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mx-auto mb-3">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Unable to load test</h3>
                <p className="text-xs text-slate-500 mt-1 mb-4">{error}</p>
                <button
                  onClick={loadResponses}
                  className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors inline-flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Try Again
                </button>
              </div>
            ) : questions.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200/80 p-8 text-center max-w-lg mx-auto my-6 shadow-sm">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4">
                  <BookOpen className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900">No Questions Attached Yet</h3>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  To evaluate students using this per-question grading grid, please attach questions to <strong>{test.title}</strong> using the <strong>Questions</strong> button on the tests table first.
                </p>
                <button
                  onClick={onClose}
                  className="mt-6 px-6 py-2.5 bg-[#0b1320] text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all shadow-sm"
                >
                  Understood
                </button>
              </div>
            ) : studentResults.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center max-w-md mx-auto my-6 shadow-sm">
                <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-700">No Students Found</p>
                <p className="text-xs text-slate-500 mt-1">No active students found registered in batch "{test.batch}".</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50/80 border-b border-slate-200/80">
                      <tr>
                        <th className="px-5 py-3.5 font-bold text-slate-600 uppercase tracking-widest text-[10px] sticky left-0 bg-slate-50 z-20 border-r border-slate-200/80 min-w-[180px] shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                          Student Roster
                        </th>
                        {questions.map((q, idx) => (
                          <th key={q.id} className="px-3 py-3 text-center font-bold text-slate-600 uppercase tracking-widest text-[10px] min-w-[70px]">
                            <div className="flex flex-col items-center justify-center" title={q.topic}>
                              <span className="text-slate-800 font-extrabold">Q{idx + 1}</span>
                              <span className="text-[9px] font-semibold text-slate-400 mt-0.5">{q.marks} pts</span>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {studentResults.map((r) => (
                        <tr key={r.studentId} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-5 py-3 font-semibold text-slate-800 sticky left-0 bg-white z-10 border-r border-slate-100 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-slate-900">{r.studentName}</span>
                              <span className="text-[10px] font-semibold text-slate-400 mt-0.5">Roll: {r.rollNo || '—'}</span>
                            </div>
                          </td>
                          {questions.map((q) => {
                            const status = r.responses[q.id]
                            const mistake = r.mistakes?.[q.id]
                            return (
                              <td key={q.id} className="px-2 py-2.5 text-center min-w-[75px]">
                                <div className="flex flex-col items-center gap-1.5">
                                  <motion.button
                                    whileTap={{ scale: 0.92 }}
                                    onClick={() => toggleResponse(r.studentId, q.id)}
                                    className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-all ${getStatusStyle(status)}`}
                                    title={`Click to cycle (Unattempted -> Correct -> Incorrect)`}
                                  >
                                    {renderStatusIcon(status)}
                                  </motion.button>
                                  {status === 'Incorrect' && (
                                    <select
                                      value={mistake || MISTAKE_TYPES[0]}
                                      onChange={(e) => setMistake(r.studentId, q.id, e.target.value)}
                                      className="text-[9px] font-semibold w-[72px] px-1 py-0.5 border border-rose-200 bg-rose-50/90 text-rose-700 rounded-md outline-none cursor-pointer hover:bg-rose-100 transition-colors"
                                    >
                                      {MISTAKE_TYPES.map(m => (
                                        <option key={m} value={m}>{m}</option>
                                      ))}
                                    </select>
                                  )}
                                </div>
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Footer Bar */}
          {!loading && !error && questions.length > 0 && studentResults.length > 0 && (
            <div className="px-8 py-4 border-t border-slate-200/80 shrink-0 bg-white flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-5 text-xs font-bold text-slate-600">
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 rounded-md bg-emerald-500 flex items-center justify-center text-white"><Check className="w-2.5 h-2.5 stroke-[3]" /></div>
                  <span>Correct: <strong className="text-emerald-600">{totalCorrect}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 rounded-md bg-rose-500 flex items-center justify-center text-white"><XIcon className="w-2.5 h-2.5 stroke-[3]" /></div>
                  <span>Incorrect: <strong className="text-rose-600">{totalIncorrect}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 rounded-md bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-400"><Minus className="w-2.5 h-2.5 stroke-[3]" /></div>
                  <span>Unattempted: <strong className="text-slate-500">{totalUnattempted}</strong></span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={onClose}
                  className="px-5 py-2.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-7 py-2.5 bg-[#0b1320] hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  {saving ? 'Saving...' : 'Save Grading Grid'}
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
