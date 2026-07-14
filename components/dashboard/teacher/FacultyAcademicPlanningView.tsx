'use client'
import { useState, useEffect } from 'react'
import { ChevronDown, Calendar, Lock, Loader2, Save, CheckCircle2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function FacultyAcademicPlanningView() {
  const [chapters, setChapters] = useState<any[]>([])
  const [totalChapters, setTotalChapters] = useState(24)
  const [isLoading, setIsLoading] = useState(true)
  const [activeClass, setActiveClass] = useState('Grade 11-A')
  const [activeSubject, setActiveSubject] = useState('Physics')
  const [savingId, setSavingId] = useState<string | null>(null)
  
  // Toast
  const [toastMessage, setToastMessage] = useState<{title: string, type: 'success' | 'error'} | null>(null)
  const [batches, setBatches] = useState<string[]>([])

  useEffect(() => {
    fetch('/api/daily-report', { method: 'PUT' })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setBatches(data)
          setActiveClass(data[0])
        } else {
          setBatches(['Grade 11-A', 'Grade 10-C'])
          setActiveClass('Grade 11-A')
        }
      })
      .catch(() => {
        setBatches(['Grade 11-A', 'Grade 10-C'])
        setActiveClass('Grade 11-A')
      })
  }, [])

  useEffect(() => {
    fetchChapters()
  }, [activeClass, activeSubject])

  const showToast = (title: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ title, type })
    setTimeout(() => setToastMessage(null), 3000)
  }

  const fetchChapters = async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/teacher-portal/academic-planning/chapters?class=${encodeURIComponent(activeClass)}&subject=${encodeURIComponent(activeSubject)}`)
      if (res.ok) {
        const data = await res.json()
        setChapters(data.chapters || [])
        if (data.totalChapters) setTotalChapters(data.totalChapters)
      }
    } catch (error) {
      console.error('Failed to fetch chapters', error)
      showToast('Failed to load chapters', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleStatusChange = async (id: string, newStatus: string) => {
    // Optimistic UI update
    setChapters(prev => prev.map(c => c._id === id ? { ...c, status: newStatus } : c))
    
    try {
      const res = await fetch('/api/teacher-portal/academic-planning/chapters', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus })
      })
      if (!res.ok) {
        throw new Error('Failed to update')
      }
      showToast('Status updated!')
    } catch (error) {
      console.error(error)
      showToast('Failed to update status', 'error')
      // Revert on failure
      fetchChapters()
    }
  }

  const handleNotesChange = (id: string, newNotes: string) => {
    setChapters(prev => prev.map(c => c._id === id ? { ...c, notes: newNotes } : c))
  }

  const handleSaveNotes = async (id: string, notes: string) => {
    setSavingId(id)
    try {
      const res = await fetch('/api/teacher-portal/academic-planning/chapters', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, notes })
      })
      if (!res.ok) {
        throw new Error('Failed to save notes')
      }
      showToast('Notes saved successfully!')
    } catch (error) {
      console.error(error)
      showToast('Failed to save notes', 'error')
    } finally {
      setSavingId(null)
    }
  }

  const getStatusTheme = (status: string) => {
    if (status === 'COMPLETED') return 'green'
    if (status === 'IN PROGRESS') return 'gray'
    return 'blue'
  }

  const completedCount = chapters.filter(c => c.status === 'COMPLETED').length
  // Estimate overall progress based on completed chapters vs total expected chapters
  const progressPercentage = totalChapters > 0 ? Math.round((completedCount / totalChapters) * 100) : 0

  return (
    <div className="flex-1 p-8 overflow-auto bg-slate-50 min-h-screen relative">
      
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={`fixed bottom-6 right-6 ${
              toastMessage.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'
            } text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 z-50`}
          >
            <CheckCircle2 className="w-5 h-5" />
            <h4 className="text-sm font-bold">{toastMessage.title}</h4>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Academic Planning</h1>
          <p className="text-[13px] text-slate-500 mt-1">
            Track syllabus coverage for your assigned batches and subjects.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <select 
            value={activeClass}
            onChange={e => setActiveClass(e.target.value)}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors shadow-sm outline-none cursor-pointer appearance-none"
          >
            {batches.map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
          <select 
            value={activeSubject}
            onChange={e => setActiveSubject(e.target.value)}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors shadow-sm outline-none cursor-pointer appearance-none"
          >
            <option>Physics</option>
            <option>Science</option>
          </select>
        </div>
      </div>

      {/* Overall Progress Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-8 transition-opacity duration-300">
        <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Overall Syllabus Completion</h3>
        <div className="flex flex-col md:flex-row md:items-end gap-6 md:gap-16">
          <div className="flex items-baseline">
            <span className="text-5xl font-bold text-slate-900">{progressPercentage}</span>
            <span className="text-xl font-bold text-slate-400 ml-1">%</span>
          </div>
          
          <div className="flex-1 pb-1">
            <div className="flex justify-between text-[11px] font-bold text-slate-500 mb-2">
              <span>Total Chapters: {totalChapters}</span>
              <div className="flex gap-4">
                <span className="text-emerald-500">Completed: {completedCount}</span>
                <span>Remaining: {totalChapters - completedCount}</span>
              </div>
            </div>
            {/* Progress Bar */}
            <div className="w-full h-3 bg-indigo-50 rounded-full overflow-hidden">
              <div className="h-full bg-[#0b1320] rounded-full transition-all duration-1000 ease-out" style={{ width: `${progressPercentage}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Chapter List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-12 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin mb-4" />
            <p className="text-sm font-medium">Loading syllabus data...</p>
          </div>
        ) : chapters.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm text-center">
             <p className="text-slate-500">No syllabus chapters found for this class and subject.</p>
          </div>
        ) : (
          chapters.map((chap) => {
            const theme = getStatusTheme(chap.status)
            return (
              <div key={chap._id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-6 hover:shadow transition-shadow">
                
                {/* Left Info */}
                <div className="lg:w-1/3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded border ${
                      theme === 'green' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      theme === 'gray' ? 'bg-slate-100 text-slate-700 border-slate-200' :
                      'bg-blue-50 text-blue-700 border-blue-200'
                    }`}>
                      {chap.status}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-500">{chap.estHours}</span>
                  </div>
                  <h4 className="text-[15px] font-bold text-slate-900 mb-1.5">{chap.title}</h4>
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                    <Calendar className="w-3.5 h-3.5" />
                    {chap.dates}
                  </div>
                </div>

                {/* Segmented Control */}
                <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100 shrink-0">
                  {['NOT STARTED', 'IN PROGRESS', 'COMPLETED'].map((stateStr) => {
                    // Map backend enum to UI labels
                    const uiLabel = stateStr === 'NOT STARTED' ? 'Not Started' : stateStr === 'IN PROGRESS' ? 'In Progress' : 'Completed'
                    const isActive = chap.status === stateStr
                    
                    return (
                      <button
                        key={stateStr}
                        onClick={() => handleStatusChange(chap._id, stateStr)}
                        className={`px-4 py-2 text-[13px] font-bold rounded-lg transition-all ${
                          isActive 
                            ? (stateStr === 'NOT STARTED' ? 'bg-indigo-100 text-indigo-700 shadow-sm' : 'bg-[#0b1320] text-white shadow-sm') 
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        {uiLabel}
                      </button>
                    )
                  })}
                </div>

                {/* Faculty Notes */}
                <div className="lg:w-1/3 lg:pl-8 w-full">
                  <label className="block text-[10px] font-bold text-slate-500 mb-1.5">Faculty Notes</label>
                  <div className="flex items-center gap-3">
                    <input 
                      type="text" 
                      placeholder="Add notes here..."
                      value={chap.notes || ''}
                      onChange={(e) => handleNotesChange(chap._id, e.target.value)}
                      onBlur={() => handleSaveNotes(chap._id, chap.notes)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.currentTarget.blur() // Triggers onBlur which saves
                        }
                      }}
                      className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-[13px] text-slate-700 focus:outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-300 transition-all"
                    />
                    <button 
                      onClick={() => handleSaveNotes(chap._id, chap.notes)}
                      className={`p-2 rounded-lg transition-colors ${savingId === chap._id ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                      title="Save Note"
                    >
                      {savingId === chap._id ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

              </div>
            )
          })
        )}
      </div>

    </div>
  )
}
