'use client'

import { useState, useEffect } from 'react'
import { useAlert } from '@/components/dashboard/AlertProvider'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Calendar as CalendarIcon, 
  List, 
  BarChart2, 
  Clock, 
  Search, 
  Plus, 
  Filter, 
  Edit2, 
  Trash2, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  RefreshCw,
  BookOpen,
  ArrowRight,
  HelpCircle,
  FileQuestion,
  Upload,
  Download
} from 'lucide-react'
import UploadPdfModal from '@/components/dashboard/UploadPdfModal'
import ExportQuestionsModal from '@/components/dashboard/ExportQuestionsModal'
import TestGradingModal from '@/components/dashboard/TestGradingModal'
import { getLocalToday } from '@/lib/scheduleUtils'

// Simple helper to get the weekday name index (0 = Monday, 6 = Sunday)
function getWeekdayIndex(dateStr: string) {
  const date = new Date(dateStr)
  // getDay returns 0 = Sunday, 1 = Monday, etc.
  const day = date.getDay()
  return day === 0 ? 6 : day - 1
}

// Format date into human readable weekday
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function TestsBankView() {
  const { showAlert } = useAlert()
  const [activeTab, setActiveTab] = useState<'calendar' | 'tests' | 'questions'>('calendar')
  
  // Data states
  const [stats, setStats] = useState({
    scheduledThisWeek: 0,
    totalQuestions: 0,
    avgScore: 0,
    pendingGrading: 0,
    batchAverages: [] as { batch: string; avgScore: number }[]
  })

  const [scheduledTests, setScheduledTests] = useState<any[]>([])
  const [questions, setQuestions] = useState<any[]>([])

  // UI state
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [subjectFilter, setSubjectFilter] = useState('All')
  const [difficultyFilter, setDifficultyFilter] = useState('All')
  const [questionFacultyFilter, setQuestionFacultyFilter] = useState('All')
  
  // Modal toggles
  const [showTestModal, setShowTestModal] = useState(false)
  const [showQuestionModal, setShowQuestionModal] = useState(false)
  const [showUploadPdfModal, setShowUploadPdfModal] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)


  // Form states
  const [testForm, setTestForm] = useState({
    title: '',
    batch: '',
    subject: 'Physics (PHY-101)',
    date: '',
    time: '10:00 AM',
    duration: '180',
    totalMarks: '300'
  })

  const [questionForm, setQuestionForm] = useState({
    subject: 'Physics',
    topic: '',
    difficulty: 'Medium' as 'Easy' | 'Medium' | 'Hard',
    type: 'MCQ' as 'MCQ' | 'Numerical' | 'Integer' | 'Subjective',
    text: '',
    options: ['', '', '', ''],
    correctAnswer: '',
    marks: '4',
    negativeMarks: '0'
  })

  const [availableBatches, setAvailableBatches] = useState<string[]>([])
  const [availablePrograms, setAvailablePrograms] = useState<string[]>([])

  // "All Tests" tab filters
  const [testFacultyFilter, setTestFacultyFilter] = useState('All')
  const [testProgramFilter, setTestProgramFilter] = useState('All')
  const [uploadingPaperFor, setUploadingPaperFor] = useState<string | null>(null)
  const [gradingTest, setGradingTest] = useState<any | null>(null)

  // Pagination for questions
  const [questionPage, setQuestionPage] = useState(1)
  const itemsPerPage = 5

  async function fetchStatsAndData() {
    try {
      setLoading(true)
      // 1. Fetch stats
      const statsRes = await fetch('/api/tests/stats')
      const statsData = await statsRes.json()
      if (!statsData.error) {
        setStats(statsData)
      }

      // 2. Fetch scheduled tests
      const scheduleRes = await fetch('/api/tests/schedule')
      const scheduleData = await scheduleRes.json()
      if (!scheduleData.error) {
        setScheduledTests(scheduleData)
      }

      // 3. Fetch questions
      const questionsRes = await fetch('/api/tests/questions')
      const questionsData = await questionsRes.json()
      if (!questionsData.error) {
        setQuestions(questionsData)
      }

      const bRes = await fetch('/api/daily-report', { method: 'PUT' })
      const bData = await bRes.json()
      if (Array.isArray(bData)) {
        setAvailableBatches(bData)
        if (bData.length > 0) {
          setTestForm(prev => ({ ...prev, batch: bData[0] }))
        } else {
          setTestForm(prev => ({ ...prev, batch: '' }))
        }
      }

      const pRes = await fetch('/api/programs')
      const pData = await pRes.json()
      if (Array.isArray(pData)) {
        setAvailablePrograms(pData.map((p: any) => p.name).filter(Boolean))
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatsAndData()
  }, [])

  // Submit test helper to support retry
  async function submitTest(payload: any) {
    setActionLoading(true)
    try {
      const res = await fetch('/api/tests/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json()
      if (!data.error) {
        setShowTestModal(false)
        setTestForm({
          title: '',
          batch: availableBatches[0] || '',
          subject: 'Physics (PHY-101)',
          date: '',
          time: '10:00 AM',
          duration: '180',
          totalMarks: '300'
        })
        fetchStatsAndData()
      } else {
        showAlert({
          title: 'Failed to Schedule Test',
          message: data.error,
          type: 'calendar',
          onRetry: () => submitTest(payload)
        })
      }
    } catch (err) {
      console.error(err)
      showAlert({
        title: 'Error Scheduling Test',
        message: 'Network error. Could not schedule test.',
        type: 'calendar',
        onRetry: () => submitTest(payload)
      })
    } finally {
      setActionLoading(false)
    }
  }

  // Schedule Test Submit
  async function handleTestSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!testForm.title || !testForm.date || !testForm.time || !testForm.duration || !testForm.totalMarks) return

    const payload = {
      ...testForm,
      duration: Number(testForm.duration),
      totalMarks: Number(testForm.totalMarks)
    }
    await submitTest(payload)
  }

  // Submit question helper to support retry
  async function submitQuestion(payload: any) {
    setActionLoading(true)
    try {
      const res = await fetch('/api/tests/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json()
      if (!data.error) {
        setShowQuestionModal(false)
        setQuestionForm({
          subject: 'Physics',
          topic: '',
          difficulty: 'Medium',
          type: 'MCQ',
          text: '',
          options: ['', '', '', ''],
          correctAnswer: '',
          marks: '4',
          negativeMarks: '0'
        })
        fetchStatsAndData()
      } else {
        showAlert({
          title: 'Failed to Save Question',
          message: data.error,
          type: 'warning',
          onRetry: () => submitQuestion(payload)
        })
      }
    } catch (err) {
      console.error(err)
      showAlert({
        title: 'Error Saving Question',
        message: 'Network error. Could not save question to the bank.',
        type: 'warning',
        onRetry: () => submitQuestion(payload)
      })
    } finally {
      setActionLoading(false)
    }
  }

  async function handlePaperUpload(testId: string, file: File) {
    setUploadingPaperFor(testId)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`/api/tests/${testId}/paper`, { method: 'POST', body: formData })
      const data = await res.json()
      if (!data.error) {
        fetchStatsAndData()
      } else {
        showAlert({ title: 'Failed to Attach Paper', message: data.error, type: 'warning' })
      }
    } catch (err) {
      console.error(err)
      showAlert({ title: 'Error', message: 'Network error while attaching the paper.', type: 'warning' })
    } finally {
      setUploadingPaperFor(null)
    }
  }

  const availableFaculty = Array.from(
    new Set(scheduledTests.map((t: any) => t.facultyName).filter(Boolean))
  ) as string[]

  const filteredScheduledTests = scheduledTests.filter((t: any) => {
    const matchesFaculty = testFacultyFilter === 'All' || t.facultyName === testFacultyFilter
    const matchesProgram = testProgramFilter === 'All' || t.program === testProgramFilter
    return matchesFaculty && matchesProgram
  })

  // Create Question Submit
  async function handleQuestionSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!questionForm.topic || !questionForm.text) return

    const payload = {
      ...questionForm,
      marks: Number(questionForm.marks),
      negativeMarks: Number(questionForm.negativeMarks),
      options: questionForm.type === 'MCQ' ? questionForm.options : []
    }
    await submitQuestion(payload)
  }

  // Filter questions
  const availableQuestionFaculty = Array.from(
    new Set(questions.map((q: any) => q.facultyName).filter(Boolean))
  ) as string[]

  const filteredQuestions = questions.filter(q => {
    const matchesSearch =
      q.topic.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.text.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesSubject = subjectFilter === 'All' || q.subject === subjectFilter
    const matchesDifficulty = difficultyFilter === 'All' || q.difficulty === difficultyFilter
    const matchesFaculty = questionFacultyFilter === 'All' || (q as any).facultyName === questionFacultyFilter

    return matchesSearch && matchesSubject && matchesDifficulty && matchesFaculty
  })

  // Pagination math for questions
  const totalQuestionPages = Math.ceil(filteredQuestions.length / itemsPerPage) || 1
  const paginatedQuestions = filteredQuestions.slice(
    (questionPage - 1) * itemsPerPage,
    questionPage * itemsPerPage
  )

  // Map tests to calendar columns:
  // We compute the current week Monday-Sunday date range, and map tests of this week
  const now = new Date()
  const currentDay = now.getDay()
  const mondayDiff = now.getDate() - currentDay + (currentDay === 0 ? -6 : 1)
  const mondayDate = new Date(now.setDate(mondayDiff))
  
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mondayDate)
    d.setDate(mondayDate.getDate() + i)
    return d.toISOString().split('T')[0]
  })

  // Group tests of the current week by their date
  const calendarSlots: Record<string, any[]> = {
    '0': [], // Mon
    '1': [], // Tue
    '2': [], // Wed
    '3': [], // Thu
    '4': [], // Fri
    '5': [], // Sat
    '6': []  // Sun
  }

  scheduledTests.forEach(test => {
    const testDateStr = test.date
    const weekIdx = weekDates.indexOf(testDateStr)
    if (weekIdx !== -1) {
      calendarSlots[String(weekIdx)].push(test)
    }
  })

  return (
    <div className="flex-1 p-8 overflow-auto bg-slate-50 flex flex-col justify-between">
      
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Tests & Question Bank</h1>
            <p className="text-[13px] text-slate-500 mt-1">
              Monitor test schedules, question bank size, and batch-wise results.
            </p>
          </div>
          <button 
            onClick={fetchStatsAndData}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-semibold shadow-sm transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          
          {/* KPI 1: Scheduled this week */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Scheduled This Week</span>
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                <CalendarIcon className="w-5 h-5" />
              </div>
            </div>
            <span className="text-3xl font-bold text-slate-900">{stats.scheduledThisWeek}</span>
          </div>

          {/* KPI 2: Total Questions */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Questions</span>
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                <List className="w-5 h-5" />
              </div>
            </div>
            <span className="text-3xl font-bold text-slate-900">{stats.totalQuestions.toLocaleString('en-IN')}</span>
          </div>

          {/* KPI 3: Avg Score */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Avg Score</span>
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                <BarChart2 className="w-5 h-5" />
              </div>
            </div>
            <span className="text-3xl font-bold text-slate-900">{stats.avgScore}%</span>
          </div>

          {/* KPI 4: Pending Grading */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pending Grading</span>
              <div className="p-2 bg-amber-50 text-amber-500 rounded-xl">
                <Clock className="w-5 h-5" />
              </div>
            </div>
            <span className="text-3xl font-bold text-slate-900">{stats.pendingGrading}</span>
          </div>

        </div>

        {/* Tab Menus */}
        <div className="flex items-center gap-6 border-b border-slate-200 mb-6">
          <button 
            onClick={() => { setActiveTab('calendar'); setSearchQuery(''); }}
            className={`pb-3 text-sm font-bold transition-all relative ${
              activeTab === 'calendar' ? 'text-[#0b1320]' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Test Calendar
            {activeTab === 'calendar' && (
              <motion.div layoutId="test-tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0b1320]" />
            )}
          </button>
          <button
            onClick={() => { setActiveTab('tests'); setSearchQuery(''); }}
            className={`pb-3 text-sm font-bold transition-all relative ${
              activeTab === 'tests' ? 'text-[#0b1320]' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            All Tests
            {activeTab === 'tests' && (
              <motion.div layoutId="test-tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0b1320]" />
            )}
          </button>
          <button
            onClick={() => { setActiveTab('questions'); setSearchQuery(''); }}
            className={`pb-3 text-sm font-bold transition-all relative ${
              activeTab === 'questions' ? 'text-[#0b1320]' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Question Bank Overview
            {activeTab === 'questions' && (
              <motion.div layoutId="test-tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0b1320]" />
            )}
          </button>
        </div>

        {/* Dynamic content rendering */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-8 h-8 text-slate-400 animate-spin" />
            <span className="text-sm font-semibold text-slate-500">Loading data from database...</span>
          </div>
        ) : activeTab === 'calendar' ? (
          
          // TAB 1: Test Calendar View
          <div className="space-y-8">
            
            {/* Calendar Controls */}
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">This Week</h2>
              <button 
                onClick={() => setShowTestModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-[#0b1320] hover:bg-slate-800 text-white rounded-lg text-sm font-semibold transition-all shadow-sm"
              >
                <Plus className="w-4 h-4" /> Schedule Test
              </button>
            </div>

            {/* Calendar Grid */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 overflow-x-auto">
              <div className="grid grid-cols-7 gap-4 min-w-[840px]">
                {WEEKDAYS.map((day, idx) => {
                  const dateObj = new Date(weekDates[idx])
                  const dayNum = dateObj.getDate()
                  const isToday = new Date().toDateString() === dateObj.toDateString()

                  return (
                    <div key={day} className="flex flex-col gap-3 min-h-[180px]">
                      {/* Day Header */}
                      <div className="flex flex-col items-center pb-3 border-b border-slate-100">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{day}</span>
                        <span className={`text-base font-bold mt-1 w-7 h-7 flex items-center justify-center rounded-full ${
                          isToday ? 'bg-[#0b1320] text-white' : 'text-slate-800'
                        }`}>
                          {dayNum}
                        </span>
                      </div>

                      {/* Day Slots */}
                      <div className="flex flex-col gap-2">
                        {calendarSlots[String(idx)].length > 0 ? (
                          calendarSlots[String(idx)].map((test, index) => {
                            // Assign style based on title / type
                            const isFullMock = test.title.toLowerCase().includes('full')
                            const isMock = test.title.toLowerCase().includes('mock') && !isFullMock
                            
                            let cardStyle = "bg-blue-50 text-blue-800 border-blue-500"
                            if (isMock) cardStyle = "bg-purple-50 text-purple-800 border-purple-500"
                            if (isFullMock) cardStyle = "bg-[#0b1320] text-white border-slate-700"

                            return (
                              <div 
                                key={index} 
                                className={`p-3 rounded-xl border-l-4 ${cardStyle} shadow-sm flex flex-col justify-between min-h-[92px]`}
                              >
                                <div>
                                  <span className="text-[10px] font-bold uppercase tracking-wider block opacity-80">{test.title}</span>
                                  <span className="text-xs font-bold block mt-1 truncate">{test.batch}</span>
                                  <span className="text-[9px] block opacity-80 truncate">{test.subject}</span>
                                </div>
                                <span className="text-[9px] font-bold mt-2 flex items-center gap-1 opacity-90">
                                  <Clock className="w-2.5 h-2.5" />
                                  {test.time}
                                </span>
                              </div>
                            )
                          })
                        ) : (
                          <div className="py-8 text-center text-[10px] font-bold text-slate-300 uppercase tracking-wider">
                            No Tests
                          </div>
                        )}
                      </div>

                    </div>
                  )
                })}
              </div>
            </div>

            {/* Performance Bar Chart */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h3 className="text-base font-bold text-slate-900 mb-6">Average Percentage per Batch (Recent Mock Test)</h3>
              
              <div className="relative pt-4 pb-2">
                
                {/* Y-Axis Labels & Grid Lines */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none text-right pr-4 text-xs font-bold text-slate-400">
                  {['100%', '75%', '50%', '25%', '0%'].map((tick, i) => (
                    <div key={tick} className="flex items-center w-full h-0">
                      <span className="w-10 select-none">{tick}</span>
                      <div className="flex-1 border-t border-dashed border-slate-200 ml-4" />
                    </div>
                  ))}
                </div>

                {/* Bars Area */}
                <div className="h-64 ml-14 flex items-end justify-around relative z-10">
                  {stats.batchAverages.map((ba) => {
                    const heightPercent = `${ba.avgScore}%`
                    
                    return (
                      <div key={ba.batch} className="flex flex-col items-center w-24">
                        
                        {/* Bar */}
                        <div className="relative w-12 bg-slate-100 rounded-t-lg h-56 flex items-end">
                          <motion.div 
                            initial={{ height: 0 }}
                            animate={{ height: heightPercent }}
                            transition={{ duration: 1, ease: 'easeOut' }}
                            className="w-full bg-[#0b1320] hover:bg-slate-700 rounded-t-lg transition-colors flex items-start justify-center pt-2 text-[10px] font-bold text-white shadow-sm"
                          >
                            {ba.avgScore}%
                          </motion.div>
                        </div>

                        {/* X-Axis Label */}
                        <span className="text-[11px] font-bold text-slate-600 mt-3 whitespace-nowrap">{ba.batch}</span>

                      </div>
                    )
                  })}
                </div>

              </div>

            </div>

          </div>

        ) : activeTab === 'tests' ? (

          // TAB 2: All Tests (every test in the school, with faculty/program)
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <h2 className="text-base font-bold text-slate-900">Every Scheduled Test</h2>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={testFacultyFilter}
                    onChange={(e) => setTestFacultyFilter(e.target.value)}
                    className="text-xs font-semibold text-slate-700 bg-transparent outline-none cursor-pointer"
                  >
                    <option value="All">All Faculty</option>
                    {availableFaculty.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={testProgramFilter}
                    onChange={(e) => setTestProgramFilter(e.target.value)}
                    className="text-xs font-semibold text-slate-700 bg-transparent outline-none cursor-pointer"
                  >
                    <option value="All">All Programs</option>
                    {availablePrograms.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Title</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Faculty</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Batch</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Program</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Date</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Status</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredScheduledTests.length > 0 ? (
                      filteredScheduledTests.map((t: any) => {
                        const isGradable = t.date <= getLocalToday()
                        return (
                          <tr key={t.id} className="hover:bg-slate-50/40 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex flex-col">
                                <span className="text-[12px] font-semibold text-slate-800">{t.title}</span>
                                <span className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{t.subject}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-xs font-semibold text-slate-600">{t.facultyName || '—'}</td>
                            <td className="px-6 py-4 text-xs font-semibold text-slate-600">{t.batch}</td>
                            <td className="px-6 py-4 text-xs font-semibold text-slate-600">{t.program || '—'}</td>
                            <td className="px-6 py-4 text-xs font-semibold text-slate-600">{t.date}</td>
                            <td className="px-6 py-4 text-center">
                              <span className={`px-2 py-0.5 text-[9px] font-bold rounded ${
                                t.status === 'Graded' ? 'bg-green-50 text-green-700 border border-green-100' :
                                t.status === 'Pending Grading' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                                'bg-blue-50 text-blue-700 border border-blue-100'
                              }`}>
                                {t.status}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center justify-end gap-2">
                                {t.paperUrl ? (
                                  <a
                                    href={`/api/tests/${t.id}/paper`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-2.5 py-1 text-[10px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                                  >
                                    View Paper
                                  </a>
                                ) : (
                                  <label className="px-2.5 py-1 text-[10px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer">
                                    {uploadingPaperFor === t.id ? 'Uploading...' : 'Add Paper'}
                                    <input
                                      type="file" accept="application/pdf" className="hidden"
                                      disabled={uploadingPaperFor === t.id}
                                      onChange={(e) => { if (e.target.files?.[0]) handlePaperUpload(t.id, e.target.files[0]) }}
                                    />
                                  </label>
                                )}
                                <button
                                  onClick={() => setGradingTest(t)}
                                  disabled={!isGradable}
                                  className="px-2.5 py-1 text-[10px] font-bold text-white bg-[#0b1320] hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-40"
                                  title={isGradable ? 'Grade this test' : 'Upcoming — not gradable yet'}
                                >
                                  Grade
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    ) : (
                      <tr>
                        <td colSpan={7} className="text-center py-16 text-xs font-bold text-slate-400 uppercase tracking-widest">
                          No tests found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        ) : (

          // TAB 2: Question Bank Overview
          <div className="space-y-6">
            
            {/* Search & Filter Controls */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              
              <div className="flex-1 min-w-[280px] max-w-md relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="text"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setQuestionPage(1); }}
                  placeholder="Search questions or topics..."
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-slate-400 transition-all shadow-sm"
                />
              </div>

              <div className="flex items-center gap-3">
                
                {/* Subject Filter */}
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <select 
                    value={subjectFilter}
                    onChange={(e) => { setSubjectFilter(e.target.value); setQuestionPage(1); }}
                    className="text-xs font-semibold text-slate-700 bg-transparent outline-none cursor-pointer"
                  >
                    <option value="All">All Subjects</option>
                    <option value="Physics">Physics</option>
                    <option value="Chemistry">Chemistry</option>
                    <option value="Mathematics">Mathematics</option>
                    <option value="Biology">Biology</option>
                  </select>
                </div>

                {/* Difficulty Filter */}
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <select 
                    value={difficultyFilter}
                    onChange={(e) => { setDifficultyFilter(e.target.value); setQuestionPage(1); }}
                    className="text-xs font-semibold text-slate-700 bg-transparent outline-none cursor-pointer"
                  >
                    <option value="All">All Difficulties</option>
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>

                {/* Faculty Filter */}
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={questionFacultyFilter}
                    onChange={(e) => { setQuestionFacultyFilter(e.target.value); setQuestionPage(1); }}
                    className="text-xs font-semibold text-slate-700 bg-transparent outline-none cursor-pointer"
                  >
                    <option value="All">All Faculty</option>
                    {availableQuestionFaculty.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowExportModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-semibold transition-all shadow-sm"
                  >
                    <Download className="w-4 h-4 text-slate-500" /> Export PDF
                  </button>

                  <button 
                    onClick={() => setShowUploadPdfModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-semibold transition-all shadow-sm"
                  >
                    <Upload className="w-4 h-4 text-slate-500" /> Upload PDF
                  </button>

                  <button 
                    onClick={() => setShowQuestionModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-[#0b1320] hover:bg-slate-800 text-white rounded-lg text-sm font-semibold transition-all shadow-sm"
                  >
                    <Plus className="w-4 h-4" /> Add Question
                  </button>
                </div>



              </div>

            </div>

            {/* Questions Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between min-h-[400px]">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Topic</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Subject</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Question Details</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Difficulty</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Type</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Faculty</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Correct Answer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedQuestions.length > 0 ? (
                      paginatedQuestions.map((q) => (
                        <tr key={q.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 text-[13px] font-bold text-[#0b1320]">{q.topic}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full border ${
                              q.subject === 'Physics' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                              q.subject === 'Chemistry' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                              q.subject === 'Mathematics' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                              'bg-green-50 text-green-700 border-green-200'
                            }`}>
                              {q.subject}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-xs font-semibold text-slate-700 max-w-xs truncate">
                            {q.text}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full ${
                              q.difficulty === 'Easy' ? 'bg-green-50 text-green-700 border border-green-200' :
                              q.difficulty === 'Medium' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                              'bg-red-50 text-red-700 border border-red-200'
                            }`}>
                              {q.difficulty}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center text-xs font-bold text-slate-600">{q.type}</td>
                          <td className="px-6 py-4 text-xs font-semibold text-slate-600">{(q as any).facultyName || '—'}</td>
                          <td className="px-6 py-4 text-xs font-bold text-slate-900 truncate max-w-[150px]">{q.correctAnswer || '—'}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="text-center py-12 text-sm font-semibold text-slate-400">
                          No questions found. Add a question to populate your bank.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Showing {filteredQuestions.length > 0 ? (questionPage - 1) * itemsPerPage + 1 : 0}-
                  {Math.min(questionPage * itemsPerPage, filteredQuestions.length)} of {filteredQuestions.length} questions
                </span>
                <div className="flex items-center gap-1.5">
                  <button 
                    onClick={() => setQuestionPage(prev => Math.max(prev - 1, 1))}
                    disabled={questionPage === 1}
                    className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 transition-colors disabled:opacity-50 flex items-center gap-1 shadow-sm"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" /> Previous
                  </button>
                  {Array.from({ length: totalQuestionPages }, (_, i) => i + 1).map(pageNum => (
                    <button
                      key={pageNum}
                      onClick={() => setQuestionPage(pageNum)}
                      className={`w-8 h-8 rounded-lg text-xs font-bold transition-all border ${
                        questionPage === pageNum 
                          ? 'bg-[#0b1320] border-[#0b1320] text-white' 
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  ))}
                  <button 
                    onClick={() => setQuestionPage(prev => Math.min(prev + 1, totalQuestionPages))}
                    disabled={questionPage === totalQuestionPages}
                    className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 transition-colors disabled:opacity-50 flex items-center gap-1 shadow-sm"
                  >
                    Next <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

          </div>

        )}
      </div>

      {/* MODAL 1: SCHEDULE TEST */}
      <AnimatePresence>
        {showTestModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl p-6 shadow-xl w-full max-w-md border border-slate-100"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-slate-900">Schedule New Test</h3>
                <button 
                  onClick={() => setShowTestModal(false)} 
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleTestSubmit} className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-0.5">Test Title *</label>
                  <input 
                    type="text" required
                    value={testForm.title}
                    onChange={(e) => setTestForm({...testForm, title: e.target.value})}
                    placeholder="e.g. Unit Test, Full Mock"
                    className="w-full mt-1.5 px-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-slate-400 transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-0.5">Batch *</label>
                    <select
                      value={testForm.batch}
                      onChange={(e) => setTestForm({...testForm, batch: e.target.value})}
                      className="w-full mt-1.5 px-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-slate-400 transition-colors cursor-pointer"
                    >
                      {availableBatches.map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                      {availableBatches.length === 0 && (
                        <option value="">No batches available</option>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-0.5">Subject *</label>
                    <input 
                      type="text" required
                      value={testForm.subject}
                      onChange={(e) => setTestForm({...testForm, subject: e.target.value})}
                      placeholder="e.g. Physics (PHY-101)"
                      className="w-full mt-1.5 px-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-slate-400 transition-colors"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-0.5">Date *</label>
                    <input 
                      type="date" required
                      value={testForm.date}
                      onChange={(e) => setTestForm({...testForm, date: e.target.value})}
                      className="w-full mt-1.5 px-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-slate-400 transition-colors cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-0.5">Time *</label>
                    <input 
                      type="text" required
                      value={testForm.time}
                      onChange={(e) => setTestForm({...testForm, time: e.target.value})}
                      placeholder="e.g. 10:00 AM"
                      className="w-full mt-1.5 px-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-slate-400 transition-colors"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-0.5">Duration (mins) *</label>
                    <input 
                      type="number" required min="1"
                      value={testForm.duration}
                      onChange={(e) => setTestForm({...testForm, duration: e.target.value})}
                      className="w-full mt-1.5 px-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-slate-400 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-0.5">Total Marks *</label>
                    <input 
                      type="number" required min="1"
                      value={testForm.totalMarks}
                      onChange={(e) => setTestForm({...testForm, totalMarks: e.target.value})}
                      className="w-full mt-1.5 px-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-slate-400 transition-colors"
                    />
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={actionLoading}
                  className="w-full bg-[#0b1320] text-white font-bold py-2.5 rounded-xl hover:bg-slate-800 transition-colors mt-2 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {actionLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                  Create Schedule
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: ADD QUESTION */}
      <AnimatePresence>
        {showQuestionModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl p-6 shadow-xl w-full max-w-md border border-slate-100 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-slate-900">Add New Question</h3>
                <button 
                  onClick={() => setShowQuestionModal(false)} 
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleQuestionSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-0.5">Subject *</label>
                    <select
                      value={questionForm.subject}
                      onChange={(e) => setQuestionForm({...questionForm, subject: e.target.value})}
                      className="w-full mt-1.5 px-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-slate-400 transition-colors cursor-pointer"
                    >
                      <option value="Physics">Physics</option>
                      <option value="Chemistry">Chemistry</option>
                      <option value="Mathematics">Mathematics</option>
                      <option value="Biology">Biology</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-0.5">Topic *</label>
                    <input 
                      type="text" required
                      value={questionForm.topic}
                      onChange={(e) => setQuestionForm({...questionForm, topic: e.target.value})}
                      placeholder="e.g. Thermodynamics"
                      className="w-full mt-1.5 px-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-slate-400 transition-colors"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-0.5">Difficulty *</label>
                    <select
                      value={questionForm.difficulty}
                      onChange={(e) => setQuestionForm({...questionForm, difficulty: e.target.value as any})}
                      className="w-full mt-1.5 px-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-slate-400 transition-colors cursor-pointer"
                    >
                      <option value="Easy">Easy</option>
                      <option value="Medium">Medium</option>
                      <option value="Hard">Hard</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-0.5">Question Type *</label>
                    <select
                      value={questionForm.type}
                      onChange={(e) => setQuestionForm({...questionForm, type: e.target.value as any})}
                      className="w-full mt-1.5 px-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-slate-400 transition-colors cursor-pointer"
                    >
                      <option value="MCQ">MCQ</option>
                      <option value="Numerical">Numerical</option>
                      <option value="Integer">Integer</option>
                      <option value="Subjective">Subjective</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-0.5">Question Text *</label>
                  <textarea 
                    required rows={3}
                    value={questionForm.text}
                    onChange={(e) => setQuestionForm({...questionForm, text: e.target.value})}
                    placeholder="Enter the complete question text..."
                    className="w-full mt-1.5 px-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-slate-400 transition-colors"
                  />
                </div>

                {questionForm.type === 'MCQ' && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-0.5">MCQ Options *</label>
                    {questionForm.options.map((opt, i) => (
                      <input 
                        key={i} type="text" required
                        value={opt}
                        onChange={(e) => {
                          const copy = [...questionForm.options]
                          copy[i] = e.target.value
                          setQuestionForm({...questionForm, options: copy})
                        }}
                        placeholder={`Option ${String.fromCharCode(65 + i)}`}
                        className="w-full px-4 py-1.5 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-slate-400 transition-colors"
                      />
                    ))}
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-0.5">Correct Answer</label>
                  <input 
                    type="text"
                    value={questionForm.correctAnswer}
                    onChange={(e) => setQuestionForm({...questionForm, correctAnswer: e.target.value})}
                    placeholder="e.g. Option A, or 42..."
                    className="w-full mt-1.5 px-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-slate-400 transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-0.5">Marks *</label>
                    <input 
                      type="number" required min="1"
                      value={questionForm.marks}
                      onChange={(e) => setQuestionForm({...questionForm, marks: e.target.value})}
                      className="w-full mt-1.5 px-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-slate-400 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-0.5">Negative Marks *</label>
                    <select
                      value={questionForm.negativeMarks}
                      onChange={(e) => setQuestionForm({...questionForm, negativeMarks: e.target.value})}
                      className="w-full mt-1.5 px-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-slate-400 transition-colors cursor-pointer"
                    >
                      {Array.from({ length: 10 }, (_, i) => -i).map(val => (
                        <option key={val} value={val}>{val}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={actionLoading}
                  className="w-full bg-[#0b1320] text-white font-bold py-2.5 rounded-xl hover:bg-slate-800 transition-colors mt-2 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {actionLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                  Save Question
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {gradingTest && (
        <TestGradingModal
          test={gradingTest}
          onClose={() => setGradingTest(null)}
          onSaved={fetchStatsAndData}
        />
      )}

      <UploadPdfModal
        isOpen={showUploadPdfModal} 
        onClose={() => setShowUploadPdfModal(false)} 
        onSuccess={fetchStatsAndData} 
      />

      <ExportQuestionsModal 
        isOpen={showExportModal} 
        onClose={() => setShowExportModal(false)} 
        filteredQuestions={filteredQuestions}
        activeSubjectFilter={subjectFilter}
      />

    </div>
  )
}
