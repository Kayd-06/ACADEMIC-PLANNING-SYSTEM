'use client'

import { useState, useEffect } from 'react'
import { useAlert } from '@/components/dashboard/AlertProvider'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Search, 
  Plus, 
  Filter, 
  Edit2, 
  Trash2, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  RefreshCw,
  Clock,
  BookOpen,
  Calendar,
  FileQuestion,
  CheckCircle2,
  AlertCircle,
  Upload
} from 'lucide-react'
import UploadPdfModal from '@/components/dashboard/UploadPdfModal'
import TestGradingModal from '@/components/dashboard/TestGradingModal'

export default function TeacherTestsView() {
  const { showAlert } = useAlert()
  const [activeTab, setActiveTab] = useState<'questions' | 'tests'>('questions')
  
  // Data states
  const [questions, setQuestions] = useState<any[]>([])
  const [tests, setTests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [subjectFilter, setSubjectFilter] = useState('All')
  const [chapterFilter, setChapterFilter] = useState('All')
  const [difficultyFilter, setDifficultyFilter] = useState('All')
  const [availableBatches, setAvailableBatches] = useState<string[]>([])
  const [availablePrograms, setAvailablePrograms] = useState<string[]>([])
  const [uploadingPaperFor, setUploadingPaperFor] = useState<string | null>(null)
  const [gradingTest, setGradingTest] = useState<any | null>(null)

  // Test Filters
  const [testBatchFilter, setTestBatchFilter] = useState('All')
  const [testTypeFilter, setTestTypeFilter] = useState('All')
  const [testStatusFilter, setTestStatusFilter] = useState('All')

  // Pagination
  const [questionPage, setQuestionPage] = useState(1)
  const [testPage, setTestPage] = useState(1)
  const itemsPerPage = 8

  // Modals
  const [showQuestionModal, setShowQuestionModal] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<any>(null)
  const [showUploadPdfModal, setShowUploadPdfModal] = useState(false)
  
  const [showTestModal, setShowTestModal] = useState(false)
  const [editingTest, setEditingTest] = useState<any>(null)

  // Question Form State
  const [questionForm, setQuestionForm] = useState({
    subject: 'Physics',
    topic: '',
    difficulty: 'Medium' as 'Easy' | 'Medium' | 'Hard',
    type: 'MCQ' as 'MCQ' | 'Numerical' | 'Integer' | 'Subjective',
    text: '',
    options: ['', '', '', ''],
    correctAnswer: '',
    marks: '4',
    negativeMarks: '0',
    source: 'Custom'
  })

  // Test Form State
  const [testForm, setTestForm] = useState({
    title: '',
    batch: '',
    program: '',
    subject: 'Physics (PHY-101)',
    date: '',
    time: '10:00 AM',
    duration: '180',
    totalMarks: '300',
    testType: 'Unit Test' as 'Unit Test' | 'Mock' | 'DPP'
  })

  async function loadData() {
    try {
      setLoading(true)
      const qRes = await fetch('/api/tests/questions')
      const qData = await qRes.json()
      if (!qData.error) setQuestions(qData)

      const tRes = await fetch('/api/tests/schedule')
      const tData = await tRes.json()
      if (!tData.error) setTests(tData)

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
      console.error('Error loading tests/questions/batches:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Question form submit (add or edit)
  async function submitQuestionData(payload: any, isEditing: boolean) {
    setActionLoading(true)
    try {
      const url = '/api/tests/questions'
      const method = isEditing ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          marks: Number(questionForm.marks),
          negativeMarks: Number(questionForm.negativeMarks),
          options: questionForm.type === 'MCQ' ? questionForm.options : []
        })
      })

      const data = await res.json()
      if (!data.error) {
        setShowQuestionModal(false)
        setEditingQuestion(null)
        setQuestionForm({
          subject: 'Physics',
          topic: '',
          difficulty: 'Medium',
          type: 'MCQ',
          text: '',
          options: ['', '', '', ''],
          correctAnswer: '',
          marks: '4',
          negativeMarks: '0',
          source: 'Custom'
        })
        loadData()
      } else {
        showAlert({
          title: 'Failed to Save Question',
          message: data.error || 'Failed to save question.',
          type: 'warning',
          onRetry: () => submitQuestionData(payload, isEditing),
          retryText: 'Retry'
        })
      }
    } catch (err) {
      console.error(err)
      showAlert({
        title: 'Error',
        message: 'A network error occurred. Please try again.',
        type: 'warning',
        onRetry: () => submitQuestionData(payload, isEditing),
        retryText: 'Retry'
      })
    } finally {
      setActionLoading(false)
    }
  }

  async function handleQuestionSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!questionForm.topic || !questionForm.text) return
    const isEditing = !!editingQuestion
    const payload = isEditing 
      ? { ...questionForm, id: editingQuestion.id } 
      : questionForm
    submitQuestionData(payload, isEditing)
  }

  // Delete Question
  async function executeQuestionDelete(id: string) {
    try {
      const res = await fetch(`/api/tests/questions?id=${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!data.error) {
        loadData()
      } else {
        showAlert({
          title: 'Delete Failed',
          message: data.error || 'Failed to delete question.',
          type: 'warning',
          onRetry: () => executeQuestionDelete(id),
          retryText: 'Retry'
        })
      }
    } catch (err) {
      console.error(err)
      showAlert({
        title: 'Error',
        message: 'A network error occurred while deleting the question.',
        type: 'warning',
        onRetry: () => executeQuestionDelete(id),
        retryText: 'Retry'
      })
    }
  }

  async function handleQuestionDelete(id: string) {
    showAlert({
      title: 'Delete Question',
      message: 'Are you sure you want to delete this question?',
      type: 'trash',
      retryText: 'Delete',
      cancelText: 'Cancel',
      onRetry: () => executeQuestionDelete(id)
    })
  }

  // Edit Question Click
  function handleQuestionEditClick(q: any) {
    setEditingQuestion(q)
    setQuestionForm({
      subject: q.subject,
      topic: q.topic,
      difficulty: q.difficulty,
      type: q.type,
      text: q.text,
      options: q.options && q.options.length > 0 ? [...q.options, '', '', '', ''].slice(0, 4) : ['', '', '', ''],
      correctAnswer: q.correctAnswer || '',
      marks: String(q.marks || 4),
      negativeMarks: String(q.negativeMarks || 0),
      source: q.source || 'Custom'
    })
    setShowQuestionModal(true)
  }

  // Test form submit (create or edit)
  async function submitTestData(payload: any, isEditing: boolean) {
    setActionLoading(true)
    try {
      const url = '/api/tests/schedule'
      const method = isEditing ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          duration: Number(testForm.duration),
          totalMarks: Number(testForm.totalMarks)
        })
      })

      const data = await res.json()
      if (!data.error) {
        setShowTestModal(false)
        setEditingTest(null)
        setTestForm({
          title: '',
          batch: availableBatches[0] || '',
          program: availablePrograms[0] || '',
          subject: 'Physics (PHY-101)',
          date: '',
          time: '10:00 AM',
          duration: '180',
          totalMarks: '300',
          testType: 'Unit Test'
        })
        loadData()
      } else {
        showAlert({
          title: 'Failed to Save Test',
          message: data.error || 'Failed to save test scheduled details.',
          type: 'warning',
          onRetry: () => submitTestData(payload, isEditing),
          retryText: 'Retry'
        })
      }
    } catch (err) {
      console.error(err)
      showAlert({
        title: 'Error',
        message: 'A network error occurred. Please try again.',
        type: 'warning',
        onRetry: () => submitTestData(payload, isEditing),
        retryText: 'Retry'
      })
    } finally {
      setActionLoading(false)
    }
  }

  async function handleTestSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!testForm.title || !testForm.date || !testForm.time || !testForm.duration || !testForm.totalMarks) return
    const isEditing = !!editingTest
    const payload = isEditing 
      ? { ...testForm, id: editingTest.id, status: editingTest.status } 
      : testForm
    submitTestData(payload, isEditing)
  }

  // Delete Test
  async function executeTestDelete(id: string) {
    try {
      const res = await fetch(`/api/tests/schedule?id=${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!data.error) {
        loadData()
      } else {
        showAlert({
          title: 'Delete Failed',
          message: data.error || 'Failed to delete/cancel scheduled test.',
          type: 'warning',
          onRetry: () => executeTestDelete(id),
          retryText: 'Retry'
        })
      }
    } catch (err) {
      console.error(err)
      showAlert({
        title: 'Error',
        message: 'A network error occurred while deleting the test.',
        type: 'warning',
        onRetry: () => executeTestDelete(id),
        retryText: 'Retry'
      })
    }
  }

  async function handleTestDelete(id: string) {
    showAlert({
      title: 'Cancel Test',
      message: 'Are you sure you want to cancel/delete this scheduled test?',
      type: 'trash',
      retryText: 'Delete',
      cancelText: 'Cancel',
      onRetry: () => executeTestDelete(id)
    })
  }

  // Edit Test Click
  function handleTestEditClick(t: any) {
    setEditingTest(t)
    setTestForm({
      title: t.title,
      batch: t.batch,
      program: t.program || '',
      subject: t.subject,
      date: t.date,
      time: t.time,
      duration: String(t.duration),
      totalMarks: String(t.totalMarks),
      testType: t.testType || 'Unit Test'
    })
    setShowTestModal(true)
  }

  async function handlePaperUpload(testId: string, file: File) {
    setUploadingPaperFor(testId)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`/api/tests/${testId}/paper`, { method: 'POST', body: formData })
      const data = await res.json()
      if (!data.error) {
        loadData()
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

  // Get dynamic unique chapters/topics for filtering
  const chapters = Array.from(new Set(questions.map(q => q.topic))).filter(Boolean)

  // Filtering questions
  const filteredQuestions = questions.filter(q => {
    const matchesSearch = 
      q.topic.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.text.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesSubject = subjectFilter === 'All' || q.subject === subjectFilter
    const matchesChapter = chapterFilter === 'All' || q.topic === chapterFilter
    const matchesDifficulty = difficultyFilter === 'All' || q.difficulty === difficultyFilter

    return matchesSearch && matchesSubject && matchesChapter && matchesDifficulty
  })

  // Filtering tests
  const filteredTests = tests.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) || t.subject.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesBatch = testBatchFilter === 'All' || t.batch === testBatchFilter
    const matchesType = testTypeFilter === 'All' || (t.testType || 'Unit Test') === testTypeFilter
    
    let matchesStatus = true
    if (testStatusFilter !== 'All') {
      const tStatus = t.status === 'Upcoming' ? 'Scheduled' : t.status === 'Pending Grading' ? 'Ongoing' : 'Completed'
      matchesStatus = tStatus === testStatusFilter
    }

    return matchesSearch && matchesBatch && matchesType && matchesStatus
  })

  // Pagination logic
  const totalQuestionPages = Math.ceil(filteredQuestions.length / itemsPerPage) || 1
  const paginatedQuestions = filteredQuestions.slice(
    (questionPage - 1) * itemsPerPage,
    questionPage * itemsPerPage
  )

  const totalTestPages = Math.ceil(filteredTests.length / itemsPerPage) || 1
  const paginatedTests = filteredTests.slice(
    (testPage - 1) * itemsPerPage,
    testPage * itemsPerPage
  )

  return (
    <div className="flex-1 p-8 overflow-y-auto bg-slate-50 flex flex-col justify-between h-full">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Tests & Question Bank</h1>
            <p className="text-[13px] text-slate-500 mt-1">
              Create tests and manage your question bank
            </p>
          </div>
          <button 
            onClick={loadData}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-semibold shadow-sm transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Outer White Card Layout */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          
          {/* Tab Selection */}
          <div className="flex items-center gap-6 border-b border-slate-200 mb-6">
            <button 
              onClick={() => { setActiveTab('questions'); setSearchQuery(''); }}
              className={`pb-3 text-sm font-bold transition-all relative ${
                activeTab === 'questions' ? 'text-[#0b1320]' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              My Question Bank
              {activeTab === 'questions' && (
                <motion.div layoutId="faculty-tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0b1320]" />
              )}
            </button>
            <button 
              onClick={() => { setActiveTab('tests'); setSearchQuery(''); }}
              className={`pb-3 text-sm font-bold transition-all relative ${
                activeTab === 'tests' ? 'text-[#0b1320]' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Tests
              {activeTab === 'tests' && (
                <motion.div layoutId="faculty-tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0b1320]" />
              )}
            </button>
          </div>

          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-8 h-8 text-slate-400 animate-spin" />
              <span className="text-sm font-semibold text-slate-500">Loading records...</span>
            </div>
          ) : activeTab === 'questions' ? (
            
            // TABS CONTENT: MY QUESTION BANK
            <div className="space-y-6">
              
              {/* Add & Filter Control Bar */}
              <div className="flex flex-wrap items-center justify-between gap-4">
                
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setShowUploadPdfModal(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-semibold transition-all shadow-sm"
                  >
                    <Upload className="w-4 h-4 text-slate-500" /> Upload PDF
                  </button>

                  <button 
                    onClick={() => {
                      setEditingQuestion(null)
                      setQuestionForm({
                        subject: 'Physics',
                        topic: '',
                        difficulty: 'Medium',
                        type: 'MCQ',
                        text: '',
                        options: ['', '', '', ''],
                        correctAnswer: '',
                        marks: '4',
                        negativeMarks: '0',
                        source: 'Custom'
                      })
                      setShowQuestionModal(true)
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-[#0b1320] hover:bg-slate-800 text-white rounded-lg text-sm font-semibold transition-all shadow-sm"
                  >
                    <Plus className="w-4 h-4" /> Add Question
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  
                  {/* Search query */}
                  <div className="relative w-44">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input 
                      type="text"
                      value={searchQuery}
                      onChange={(e) => { setSearchQuery(e.target.value); setQuestionPage(1); }}
                      placeholder="Search text..."
                      className="w-full pl-8 pr-2.5 py-1.5 border border-slate-200 rounded-lg text-[11px] bg-slate-50 outline-none focus:border-slate-400 transition-all shadow-sm"
                    />
                  </div>

                  {/* Subject Filter */}
                  <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 shadow-sm">
                    <Filter className="w-3 h-3 text-slate-400" />
                    <select 
                      value={subjectFilter}
                      onChange={(e) => { setSubjectFilter(e.target.value); setQuestionPage(1); }}
                      className="text-[11px] font-semibold text-slate-700 bg-transparent outline-none cursor-pointer"
                    >
                      <option value="All">All Subjects</option>
                      <option value="Physics">Physics</option>
                      <option value="Chemistry">Chemistry</option>
                      <option value="Mathematics">Mathematics</option>
                      <option value="Biology">Biology</option>
                    </select>
                  </div>

                  {/* Chapter Filter */}
                  <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 shadow-sm">
                    <Filter className="w-3 h-3 text-slate-400" />
                    <select 
                      value={chapterFilter}
                      onChange={(e) => { setChapterFilter(e.target.value); setQuestionPage(1); }}
                      className="text-[11px] font-semibold text-slate-700 bg-transparent outline-none cursor-pointer max-w-[120px] truncate"
                    >
                      <option value="All">All Chapters</option>
                      {chapters.map(ch => (
                        <option key={ch} value={ch}>{ch}</option>
                      ))}
                    </select>
                  </div>

                  {/* Difficulty Filter */}
                  <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 shadow-sm">
                    <Filter className="w-3 h-3 text-slate-400" />
                    <select 
                      value={difficultyFilter}
                      onChange={(e) => { setDifficultyFilter(e.target.value); setQuestionPage(1); }}
                      className="text-[11px] font-semibold text-slate-700 bg-transparent outline-none cursor-pointer"
                    >
                      <option value="All">All Difficulties</option>
                      <option value="Easy">Easy</option>
                      <option value="Medium">Medium</option>
                      <option value="Hard">Hard</option>
                    </select>
                  </div>

                </div>

              </div>

              {/* Questions Table */}
              <div className="border border-slate-100 rounded-xl overflow-hidden min-h-[300px]">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Question</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Type</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Difficulty</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Marks</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Source</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedQuestions.length > 0 ? (
                      paginatedQuestions.map((q) => (
                        <tr key={q.id} className="hover:bg-slate-50/40 transition-colors">
                          <td className="px-6 py-4 max-w-sm">
                            <div className="flex flex-col">
                              <span className="text-[12px] font-semibold text-slate-800 line-clamp-2">{q.text}</span>
                              <span className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-wider">
                                {q.subject} • {q.topic}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="px-2 py-0.5 text-[9px] font-bold text-blue-700 bg-blue-50 border border-blue-100 rounded">
                              {q.type}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`px-2 py-0.5 text-[9px] font-bold rounded ${
                              q.difficulty === 'Easy' ? 'bg-green-50 text-green-700 border border-green-100' :
                              q.difficulty === 'Medium' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                              'bg-red-50 text-red-700 border border-red-100'
                            }`}>
                              {q.difficulty.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center text-xs font-semibold text-slate-700">{q.marks || 4}</td>
                          <td className="px-6 py-4 text-center">
                            <span className="px-2 py-0.5 text-[9px] font-bold text-slate-600 bg-slate-100 rounded">
                              {(q.source || 'Custom').toUpperCase()}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2.5">
                              <button 
                                onClick={() => handleQuestionEditClick(q)}
                                className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded transition-all"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button 
                                onClick={() => handleQuestionDelete(q.id)}
                                className="text-slate-400 hover:text-red-600 p-1 hover:bg-red-50 rounded transition-all"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="text-center py-16 text-xs font-bold text-slate-400 uppercase tracking-widest">
                          No questions found. Add a question to populate your bank.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="p-4 border border-slate-100 bg-slate-50/50 rounded-xl flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Showing {filteredQuestions.length > 0 ? (questionPage - 1) * itemsPerPage + 1 : 0}-
                  {Math.min(questionPage * itemsPerPage, filteredQuestions.length)} of {filteredQuestions.length} questions
                </span>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => setQuestionPage(prev => Math.max(prev - 1, 1))}
                    disabled={questionPage === 1}
                    className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 bg-white hover:bg-slate-50 transition-colors disabled:opacity-50 flex items-center gap-1 shadow-sm"
                  >
                    <ChevronLeft className="w-3 h-3" /> Prev
                  </button>
                  {Array.from({ length: totalQuestionPages }, (_, i) => i + 1).map(pageNum => (
                    <button
                      key={pageNum}
                      onClick={() => setQuestionPage(pageNum)}
                      className={`w-7 h-7 rounded-lg text-[10px] font-bold transition-all border ${
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
                    className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 bg-white hover:bg-slate-50 transition-colors disabled:opacity-50 flex items-center gap-1 shadow-sm"
                  >
                    Next <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>

            </div>

          ) : (
            
            // TABS CONTENT: TESTS
            <div className="space-y-6">
              
              {/* Add & Filter Control Bar */}
              <div className="flex flex-wrap items-center justify-between gap-4">
                
                <button 
                  onClick={() => {
                    setEditingTest(null)
                    setTestForm({
                      title: '',
                      batch: availableBatches[0] || '',
                      program: availablePrograms[0] || '',
                      subject: 'Physics (PHY-101)',
                      date: '',
                      time: '10:00 AM',
                      duration: '180',
                      totalMarks: '300',
                      testType: 'Unit Test'
                    })
                    setShowTestModal(true)
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 bg-[#0b1320] hover:bg-slate-800 text-white rounded-lg text-sm font-semibold transition-all shadow-sm"
                >
                  <Plus className="w-4 h-4" /> Create Test
                </button>

                <div className="flex flex-wrap items-center gap-3">
                  
                  {/* Search query */}
                  <div className="relative w-44">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input 
                      type="text"
                      value={searchQuery}
                      onChange={(e) => { setSearchQuery(e.target.value); setTestPage(1); }}
                      placeholder="Search name/subject..."
                      className="w-full pl-8 pr-2.5 py-1.5 border border-slate-200 rounded-lg text-[11px] bg-slate-50 outline-none focus:border-slate-400 transition-all shadow-sm"
                    />
                  </div>

                  {/* Batch Filter */}
                  <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 shadow-sm">
                    <Filter className="w-3 h-3 text-slate-400" />
                    <select 
                      value={testBatchFilter}
                      onChange={(e) => { setTestBatchFilter(e.target.value); setTestPage(1); }}
                      className="text-[11px] font-semibold text-slate-700 bg-transparent outline-none cursor-pointer"
                    >
                      <option value="All">All Batches</option>
                      {availableBatches.map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>

                  {/* Type Filter */}
                  <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 shadow-sm">
                    <Filter className="w-3 h-3 text-slate-400" />
                    <select 
                      value={testTypeFilter}
                      onChange={(e) => { setTestTypeFilter(e.target.value); setTestPage(1); }}
                      className="text-[11px] font-semibold text-slate-700 bg-transparent outline-none cursor-pointer"
                    >
                      <option value="All">All Types</option>
                      <option value="Unit Test">Unit Test</option>
                      <option value="Mock">Mock</option>
                      <option value="DPP">DPP</option>
                    </select>
                  </div>

                  {/* Status Filter */}
                  <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 shadow-sm">
                    <Filter className="w-3 h-3 text-slate-400" />
                    <select 
                      value={testStatusFilter}
                      onChange={(e) => { setTestStatusFilter(e.target.value); setTestPage(1); }}
                      className="text-[11px] font-semibold text-slate-700 bg-transparent outline-none cursor-pointer"
                    >
                      <option value="All">All Statuses</option>
                      <option value="Scheduled">Scheduled</option>
                      <option value="Ongoing">Ongoing</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </div>

                </div>

              </div>

              {/* Tests Table */}
              <div className="border border-slate-100 rounded-xl overflow-hidden min-h-[300px]">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Name</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Batch</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Type</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Date & Time</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Duration</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Total Marks</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Status</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedTests.length > 0 ? (
                      paginatedTests.map((t) => {
                        const statusMapped = t.status === 'Upcoming' ? 'Scheduled' : t.status === 'Pending Grading' ? 'Ongoing' : 'Completed'
                        return (
                          <tr key={t.id} className="hover:bg-slate-50/40 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex flex-col">
                                <span className="text-[12px] font-semibold text-slate-800">{t.title}</span>
                                <span className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{t.subject}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-xs font-semibold text-slate-600">{t.batch}</td>
                            <td className="px-6 py-4 text-center">
                              <span className="px-2 py-0.5 text-[9px] font-bold text-slate-600 bg-slate-100 rounded">
                                {t.testType || 'Unit Test'}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col text-[11px] font-semibold text-slate-700">
                                <span>{t.date}</span>
                                <span className="text-[9px] text-slate-400 flex items-center gap-1 mt-0.5"><Clock className="w-2.5 h-2.5" />{t.time}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center text-xs font-semibold text-slate-600">{t.duration} mins</td>
                            <td className="px-6 py-4 text-center text-xs font-semibold text-slate-600">{t.totalMarks}</td>
                            <td className="px-6 py-4 text-center">
                              <span className={`px-2 py-0.5 text-[9px] font-bold rounded ${
                                statusMapped === 'Scheduled' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                                statusMapped === 'Ongoing' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                                'bg-green-50 text-green-700 border border-green-100'
                              }`}>
                                {statusMapped}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {t.paperUrl ? (
                                  <a
                                    href={`/api/tests/${t.id}/paper`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-2 py-1 text-[9px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                                  >
                                    Paper
                                  </a>
                                ) : (
                                  <label className="px-2 py-1 text-[9px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer">
                                    {uploadingPaperFor === t.id ? '...' : 'Add Paper'}
                                    <input
                                      type="file" accept="application/pdf" className="hidden"
                                      disabled={uploadingPaperFor === t.id}
                                      onChange={(e) => { if (e.target.files?.[0]) handlePaperUpload(t.id, e.target.files[0]) }}
                                    />
                                  </label>
                                )}
                                <button
                                  onClick={() => setGradingTest(t)}
                                  disabled={t.date > new Date().toISOString().split('T')[0]}
                                  className="px-2 py-1 text-[9px] font-bold text-white bg-[#0b1320] hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-40"
                                  title={t.date > new Date().toISOString().split('T')[0] ? 'Upcoming — not gradable yet' : 'Grade this test'}
                                >
                                  Grade
                                </button>
                                <button
                                  onClick={() => handleTestEditClick(t)}
                                  className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded transition-all"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleTestDelete(t.id)}
                                  className="text-slate-400 hover:text-red-600 p-1 hover:bg-red-50 rounded transition-all"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    ) : (
                      <tr>
                        <td colSpan={8} className="text-center py-16 text-xs font-bold text-slate-400 uppercase tracking-widest">
                          No tests found. Create a test to schedule.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="p-4 border border-slate-100 bg-slate-50/50 rounded-xl flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Showing {filteredTests.length > 0 ? (testPage - 1) * itemsPerPage + 1 : 0}-
                  {Math.min(testPage * itemsPerPage, filteredTests.length)} of {filteredTests.length} tests
                </span>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => setTestPage(prev => Math.max(prev - 1, 1))}
                    disabled={testPage === 1}
                    className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 bg-white hover:bg-slate-50 transition-colors disabled:opacity-50 flex items-center gap-1 shadow-sm"
                  >
                    <ChevronLeft className="w-3 h-3" /> Prev
                  </button>
                  {Array.from({ length: totalTestPages }, (_, i) => i + 1).map(pageNum => (
                    <button
                      key={pageNum}
                      onClick={() => setTestPage(pageNum)}
                      className={`w-7 h-7 rounded-lg text-[10px] font-bold transition-all border ${
                        testPage === pageNum 
                          ? 'bg-[#0b1320] border-[#0b1320] text-white' 
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  ))}
                  <button 
                    onClick={() => setTestPage(prev => Math.min(prev + 1, totalTestPages))}
                    disabled={testPage === totalTestPages}
                    className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 bg-white hover:bg-slate-50 transition-colors disabled:opacity-50 flex items-center gap-1 shadow-sm"
                  >
                    Next <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>

            </div>

          )}

        </div>
      </div>

      {/* FOOTER */}
      <div className="mt-8 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
        © 2026 EduAdmin Faculty Platform • Academic Integrity Assured
      </div>

      {/* MODAL 1: ADD / EDIT QUESTION */}
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
                <h3 className="text-lg font-bold text-slate-900">
                  {editingQuestion ? 'Edit Question' : 'Add New Question'}
                </h3>
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
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-0.5">Topic/Chapter *</label>
                    <input 
                      type="text" required
                      value={questionForm.topic}
                      onChange={(e) => setQuestionForm({...questionForm, topic: e.target.value})}
                      placeholder="e.g. Circular Motion"
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

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-0.5">Source *</label>
                  <input 
                    type="text" required
                    value={questionForm.source}
                    onChange={(e) => setQuestionForm({...questionForm, source: e.target.value})}
                    placeholder="e.g. JEE PYQ, Custom"
                    className="w-full mt-1.5 px-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-slate-400 transition-colors"
                  />
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

                <button 
                  type="submit"
                  disabled={actionLoading}
                  className="w-full bg-[#0b1320] text-white font-bold py-2.5 rounded-xl hover:bg-slate-800 transition-colors mt-2 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {actionLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                  {editingQuestion ? 'Update Question' : 'Save Question'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: CREATE / EDIT TEST */}
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
                <h3 className="text-lg font-bold text-slate-900">
                  {editingTest ? 'Edit Scheduled Test' : 'Create Scheduled Test'}
                </h3>
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
                    placeholder="e.g. Mock Test, DPP 4"
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
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-0.5">Type *</label>
                    <select
                      value={testForm.testType}
                      onChange={(e) => setTestForm({...testForm, testType: e.target.value as any})}
                      className="w-full mt-1.5 px-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-slate-400 transition-colors cursor-pointer"
                    >
                      <option value="Unit Test">Unit Test</option>
                      <option value="Mock">Mock</option>
                      <option value="DPP">DPP</option>
                    </select>
                  </div>
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

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-0.5">Program</label>
                  <select
                    value={testForm.program}
                    onChange={(e) => setTestForm({...testForm, program: e.target.value})}
                    className="w-full mt-1.5 px-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-slate-400 transition-colors cursor-pointer"
                  >
                    <option value="">No specific program</option>
                    {availablePrograms.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
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
                  {editingTest ? 'Update Test' : 'Create Schedule'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <UploadPdfModal
        isOpen={showUploadPdfModal}
        onClose={() => setShowUploadPdfModal(false)}
        onSuccess={loadData}
      />

      {gradingTest && (
        <TestGradingModal
          test={gradingTest}
          onClose={() => setGradingTest(null)}
          onSaved={loadData}
        />
      )}

    </div>
  )
}
