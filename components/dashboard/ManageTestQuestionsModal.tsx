'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, RefreshCw, Search, CheckCircle2, AlertCircle } from 'lucide-react'
import { useAlert } from '@/components/dashboard/AlertProvider'

interface ManageTestQuestionsModalProps {
  test: { id: string; title: string; subject: string; }
  onClose: () => void
}

export default function ManageTestQuestionsModal({ test, onClose }: ManageTestQuestionsModalProps) {
  const { showAlert } = useAlert()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  const [allQuestions, setAllQuestions] = useState<any[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState('')

  const loadModalData = () => {
    setLoading(true)
    setError('')
    
    Promise.all([
      fetch('/api/tests/questions').then(r => r.json()),
      fetch(`/api/tests/${test.id}/questions`).then(r => r.json())
    ])
    .then(([allQ, attachedQ]) => {
      if (attachedQ?.error) {
        throw new Error(attachedQ.error)
      }
      if (allQ?.error) {
        throw new Error(allQ.error)
      }
      if (Array.isArray(allQ)) {
        const subjectQuestions = allQ.filter((q: any) => q.subject.includes(test.subject) || test.subject.includes(q.subject))
        setAllQuestions(subjectQuestions.length > 0 ? subjectQuestions : allQ) 
      }
      if (Array.isArray(attachedQ)) {
        const ids = new Set<string>(attachedQ.map((q: any) => q.id))
        setSelectedIds(ids)
      }
    })
    .catch(err => setError(err.message || 'Failed to load questions'))
    .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadModalData()
  }, [test.id])

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/tests/${test.id}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionIds: Array.from(selectedIds) })
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Failed to save attached questions')
      
      showAlert({ title: 'Success', message: 'Questions attached successfully.', type: 'success' })
      onClose()
    } catch (err: any) {
      showAlert({ title: 'Error', message: err.message, type: 'warning' })
    } finally {
      setSaving(false)
    }
  }

  function toggleQuestion(id: string) {
    const newSet = new Set(selectedIds)
    if (newSet.has(id)) newSet.delete(id)
    else newSet.add(id)
    setSelectedIds(newSet)
  }

  const filteredQuestions = allQuestions.filter(q => 
    q.text.toLowerCase().includes(searchQuery.toLowerCase()) || 
    q.topic.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col border border-slate-100"
        >
          <div className="flex items-center justify-between p-6 border-b border-slate-100 shrink-0">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Attach Questions: {test.title}</h2>
              <p className="text-[12px] text-slate-500 mt-0.5">Select questions to include in this test</p>
            </div>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 shrink-0 border-b border-slate-50 bg-slate-50/50">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search questions by text or topic..."
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm bg-white outline-none focus:border-slate-400 transition-all shadow-sm"
              />
            </div>
          </div>

          <div className="p-6 flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                <RefreshCw className="w-7 h-7 animate-spin mb-3 text-blue-600" />
                <p className="text-sm font-medium">Loading questions...</p>
              </div>
            ) : error ? (
              <div className="max-w-md mx-auto my-6 bg-white p-6 rounded-2xl border border-rose-100 text-center shadow-sm">
                <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mx-auto mb-3">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Unable to load questions</h3>
                <p className="text-xs text-slate-500 mt-1 mb-4">{error}</p>
                <button
                  onClick={loadModalData}
                  className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors inline-flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Try Again
                </button>
              </div>
            ) : filteredQuestions.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">No questions found matching your search.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {filteredQuestions.map(q => {
                  const isSelected = selectedIds.has(q.id)
                  return (
                    <div 
                      key={q.id}
                      onClick={() => toggleQuestion(q.id)}
                      className={`flex items-start gap-4 p-4 rounded-xl border cursor-pointer transition-all ${
                        isSelected 
                          ? 'border-[#0b1320] bg-slate-50' 
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                      }`}
                    >
                      <div className="mt-0.5 shrink-0">
                        <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                          isSelected ? 'bg-[#0b1320] border-[#0b1320] text-white' : 'border-slate-300 bg-white text-transparent'
                        }`}>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 line-clamp-2">{q.text}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="px-2 py-0.5 text-[9px] font-bold text-slate-600 bg-slate-100 rounded uppercase">{q.topic || 'General'}</span>
                          <span className="px-2 py-0.5 text-[9px] font-bold text-blue-700 bg-blue-50 border border-blue-100 rounded">{q.type}</span>
                          <span className={`px-2 py-0.5 text-[9px] font-bold rounded ${
                            q.difficulty === 'Easy' ? 'bg-green-50 text-green-700 border border-green-100' :
                            q.difficulty === 'Medium' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                            'bg-red-50 text-red-700 border border-red-100'
                          }`}>
                            {q.difficulty.toUpperCase()}
                          </span>
                          <span className="text-[10px] font-bold text-slate-500 ml-auto">{q.marks} Marks</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="p-6 border-t border-slate-100 shrink-0 bg-white rounded-b-2xl flex items-center justify-between">
            <span className="text-sm font-bold text-slate-600">
              {selectedIds.size} questions selected
            </span>
            <button
              onClick={handleSave}
              disabled={saving || loading}
              className="px-6 py-2.5 bg-[#0b1320] text-white font-bold rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
              Save Attached Questions
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
