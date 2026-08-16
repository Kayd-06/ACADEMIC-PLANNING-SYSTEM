'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, RefreshCw, AlertCircle, Check, X as XIcon, Minus } from 'lucide-react'
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

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    
    // Fetch from the new responses endpoint
    fetch(`/api/tests/${test.id}/responses`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || 'Failed to load roster')
        return data
      })
      .then((data) => { 
        if (!cancelled) {
          setQuestions(data.questions || [])
          setStudentResults(data.studentResults || [])
        }
      })
      .catch((err) => { if (!cancelled) setError(err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
      
    return () => { cancelled = true }
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
          if (status) { // Only save non-null statuses
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
      if (!res.ok) throw new Error(data.error || 'Failed to save responses')
      
      onSaved()
      onClose()
    } catch (err: any) {
      showAlert({ title: 'Failed to Save', message: err.message, type: 'warning', onRetry: handleSave, retryText: 'Retry' })
    } finally {
      setSaving(false)
    }
  }

  const renderStatusIcon = (status: string | null) => {
    if (status === 'Correct') return <Check className="w-4 h-4 text-white" />
    if (status === 'Incorrect') return <XIcon className="w-4 h-4 text-white" />
    return <Minus className="w-4 h-4 text-slate-400" />
  }

  const getStatusColor = (status: string | null) => {
    if (status === 'Correct') return 'bg-green-500 border-green-600'
    if (status === 'Incorrect') return 'bg-red-500 border-red-600'
    return 'bg-slate-100 border-slate-200 hover:bg-slate-200'
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[85vh] overflow-hidden border border-slate-100 flex flex-col"
        >
          <div className="flex items-center justify-between p-6 border-b border-slate-100 shrink-0 bg-white">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Grade: {test.title}</h2>
              <p className="text-[12px] text-slate-500 mt-0.5">{test.batch} · Total Marks {test.totalMarks} · {formatDate(test.date)}</p>
            </div>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto flex-1">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                <RefreshCw className="w-7 h-7 animate-spin mb-3" />
                <p className="text-sm font-medium">Loading responses...</p>
              </div>
            ) : error ? (
              <div className="flex items-start gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
              </div>
            ) : questions.length === 0 ? (
              <div className="text-center py-12">
                <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-slate-700">No Questions Attached</h3>
                <p className="text-sm text-slate-500 mt-2 max-w-sm mx-auto">
                  To use the per-question grading grid, please attach questions to this test first using the "Questions" button on the tests table.
                </p>
                <button onClick={onClose} className="mt-6 px-6 py-2 bg-[#0b1320] text-white rounded-lg text-sm font-bold">
                  Got it
                </button>
              </div>
            ) : studentResults.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">No students found in this batch.</p>
            ) : (
              <div className="border border-slate-100 rounded-xl overflow-hidden overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-bold text-slate-500 uppercase tracking-wider text-[10px] sticky left-0 bg-slate-50 z-10 border-r border-slate-100 min-w-[150px]">Student</th>
                      {questions.map((q, idx) => (
                        <th key={q.id} className="px-2 py-3 text-center font-bold text-slate-500 uppercase tracking-wider text-[10px] min-w-[40px]">
                          <div className="flex flex-col items-center justify-center" title={q.topic}>
                            <span>Q{idx + 1}</span>
                            <span className="text-[8px] opacity-70">({q.marks})</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {studentResults.map((r) => (
                      <tr key={r.studentId} className="hover:bg-slate-50/60">
                        <td className="px-4 py-2.5 font-semibold text-slate-800 sticky left-0 bg-white z-10 border-r border-slate-50 group-hover:bg-slate-50">
                          <div className="flex flex-col">
                            <span>{r.studentName}</span>
                            <span className="text-[9px] text-slate-400 font-normal">{r.rollNo || 'No Roll No'}</span>
                          </div>
                        </td>
                        {questions.map((q) => {
                          const status = r.responses[q.id]
                          const mistake = r.mistakes?.[q.id]
                          return (
                            <td key={q.id} className="px-1 py-1.5 text-center min-w-[70px]">
                              <div className="flex flex-col items-center gap-1">
                                <button
                                  onClick={() => toggleResponse(r.studentId, q.id)}
                                  className={`w-8 h-8 rounded border flex items-center justify-center transition-colors ${getStatusColor(status)}`}
                                  title={`Toggle Q for ${r.studentName}`}
                                >
                                  {renderStatusIcon(status)}
                                </button>
                                {status === 'Incorrect' && (
                                  <select
                                    value={mistake || MISTAKE_TYPES[0]}
                                    onChange={(e) => setMistake(r.studentId, q.id, e.target.value)}
                                    className="text-[9px] w-[65px] p-0.5 border border-red-200 bg-red-50 text-red-700 rounded outline-none"
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
            )}
          </div>

          {!loading && !error && questions.length > 0 && studentResults.length > 0 && (
            <div className="p-6 border-t border-slate-100 shrink-0 bg-white flex items-center justify-between">
              <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-green-500 border border-green-600"></div> Correct</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-red-500 border border-red-600"></div> Incorrect</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-slate-100 border border-slate-200"></div> Unattempted</div>
              </div>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-8 py-2.5 bg-[#0b1320] text-white font-bold rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
                Save Grid
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
