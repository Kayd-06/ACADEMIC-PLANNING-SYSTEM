'use client'

import { useState, useEffect, useMemo } from 'react'
import { 
  FileCheck, 
  ArrowLeft, 
  Download, 
  Search,
  Loader2,
  AlertCircle, 
  CheckCircle2, 
  ChevronLeft, 
  ChevronRight, 
  User 
} from 'lucide-react'

// Helper for avatar initials
function getInitials(name: string) {
  if (!name) return 'ST'
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

// Avatar color assignment
const avatarBgs = [
  'bg-blue-50 text-blue-600 border-blue-100',
  'bg-emerald-50 text-emerald-600 border-emerald-100',
  'bg-indigo-50 text-indigo-600 border-indigo-100',
  'bg-rose-50 text-rose-600 border-rose-100',
  'bg-amber-50 text-amber-600 border-amber-100',
  'bg-purple-50 text-purple-600 border-purple-100'
]

function getAvatarStyle(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  const index = Math.abs(hash) % avatarBgs.length
  return avatarBgs[index]
}

export default function AcademicRecordsView() {
  // Test selection states
  const [tests, setTests] = useState<any[]>([])
  const [selectedTestId, setSelectedTestId] = useState<string>('')
  const [selectedTest, setSelectedTest] = useState<any>(null)
  
  // Roster / Marks states
  const [studentResults, setStudentResults] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [testsLoading, setTestsLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState('All') // All, Present, Absent, Passed, Failed
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // 1. Fetch available tests
  async function fetchTests() {
    setTestsLoading(true)
    try {
      const res = await fetch('/api/tests/schedule')
      const data = await res.json()
      if (Array.isArray(data)) {
        setTests(data)
        if (data.length > 0) {
          setSelectedTestId(data[0].id)
        } else {
          // If no tests are returned, turn off the loading state
          setLoading(false)
        }
      } else {
        setLoading(false)
      }
    } catch (err) {
      console.error('Failed to load tests:', err)
      setLoading(false)
    } finally {
      setTestsLoading(false)
    }
  }

  // 2. Fetch marks/results for the selected test
  async function fetchTestResults() {
    if (!selectedTestId) return
    setLoading(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/tests/${selectedTestId}/grades`)
      const data = await res.json()
      if (data && !data.error) {
        setSelectedTest(data.test)
        setStudentResults(data.studentResults || [])
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to fetch test results.' })
      }
    } catch (err) {
      console.error('Failed to load results:', err)
      setMessage({ type: 'error', text: 'Connection error. Please try again.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTests()
  }, [])

  useEffect(() => {
    fetchTestResults()
    setCurrentPage(1)
  }, [selectedTestId])

  // Dynamic ranks recalculation in frontend
  function recalculateRanks(records: any[]) {
    const graded = records
      .filter(r => !r.absent && r.marksObtained !== undefined && r.marksObtained !== '')
      .sort((a, b) => Number(b.marksObtained || 0) - Number(a.marksObtained || 0))

    const rankMap = new Map<string, number>()
    let currentRank = 1

    graded.forEach((res, index) => {
      if (index > 0 && Number(res.marksObtained || 0) !== Number(graded[index - 1].marksObtained || 0)) {
        currentRank = index + 1
      }
      // Unique key by roll number if available, else name
      const key = res.rollNo ? `${res.rollNo}-${res.studentName}` : res.studentName
      rankMap.set(key, currentRank)
    })

    return records.map(res => {
      if (res.absent) {
        return {
          ...res,
          rank: undefined,
          percentage: undefined
        }
      }
      const key = res.rollNo ? `${res.rollNo}-${res.studentName}` : res.studentName
      return {
        ...res,
        rank: rankMap.get(key) || 1
      }
    })
  }

  // Handle inputs modification
  const handleInputChange = (index: number, field: string, value: any) => {
    setStudentResults(prev => {
      const updated = [...prev]
      const record = { ...updated[index] }

      if (field === 'absent') {
        record.absent = value
        if (value) {
          record.marksObtained = undefined
          record.correct = undefined
          record.incorrect = undefined
          record.unattempted = undefined
          record.percentage = undefined
          record.rank = undefined
        } else {
          record.marksObtained = 0
          record.correct = 0
          record.incorrect = 0
          record.unattempted = 50
          record.percentage = 0
        }
      } else {
        const numVal = value === '' ? '' : Number(value)
        record[field] = numVal

        // If correct/incorrect/unattempted are modified, enforce totals
        if (field === 'correct' || field === 'incorrect' || field === 'unattempted') {
          // If total marks is 100 and it's 50 questions, each is 2 marks
          // We can suggest marksObtained automatically if they are editing correctness inputs
          const totalQuestions = 50
          const c = field === 'correct' ? Number(value || 0) : Number(record.correct || 0)
          const i = field === 'incorrect' ? Number(value || 0) : Number(record.incorrect || 0)
          const u = field === 'unattempted' ? Number(value || 0) : Number(record.unattempted || 0)
          
          if (field === 'correct') {
            record.marksObtained = c * 2
            record.unattempted = Math.max(0, totalQuestions - c - i)
          } else if (field === 'incorrect') {
            record.unattempted = Math.max(0, totalQuestions - c - i)
          } else if (field === 'unattempted') {
            record.incorrect = Math.max(0, totalQuestions - c - u)
          }
        }

        const marks = Number(record.marksObtained || 0)
        record.percentage = Math.round((marks / (selectedTest?.totalMarks || 100)) * 1000) / 10
      }

      updated[index] = record
      return recalculateRanks(updated)
    })
  }

  // Save changes
  const handleSaveResults = async () => {
    if (!selectedTestId) return
    
    // Guard against roster rows with missing names before saving
    const hasEmptyNames = studentResults.some(r => !r.studentName.trim())
    if (hasEmptyNames) {
      setMessage({ type: 'error', text: 'Some students are missing a name. Please refresh and try again.' })
      return
    }

    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/tests/${selectedTestId}/grades`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grades: studentResults
            .filter(r => r.studentId)
            .map(r => ({
              studentId: r.studentId,
              marksObtained: r.marksObtained,
              correct: r.correct,
              incorrect: r.incorrect,
              unattempted: r.unattempted,
              absent: r.absent,
            })),
        })
      })
      const data = await res.json()
      if (data.success) {
        setMessage({ type: 'success', text: 'Test results saved and graded successfully!' })
        setSelectedTest(data.test)
        // Re-fetch the roster+grades from the server rather than reading a
        // studentResults field from the POST response (the API doesn't return one).
        await fetchTestResults()
        // Update in tests list
        setTests(prev => prev.map(t => t.id === selectedTestId ? data.test : t))
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save results.' })
      }
    } catch (err) {
      console.error(err)
      setMessage({ type: 'error', text: 'Connection error while saving.' })
    } finally {
      setSaving(false)
    }
  }

  // Export results to CSV
  const handleExportCSV = () => {
    const headers = ['Student Name', 'Roll No', 'Marks Obtained', 'Correct', 'Incorrect', 'Unattempted', 'Rank', 'Percentage', 'Absent']
    const rows = studentResults.map(r => [
      r.studentName,
      r.rollNo,
      r.absent ? 'AB' : r.marksObtained ?? '',
      r.absent ? '' : r.correct ?? '',
      r.absent ? '' : r.incorrect ?? '',
      r.absent ? '' : r.unattempted ?? '',
      r.absent ? '-' : r.rank ?? '',
      r.absent ? '-' : `${r.percentage}%`,
      r.absent ? 'Yes' : 'No'
    ])

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(','))].join('\n')
    
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `${selectedTest?.title || 'test'}_${selectedTest?.batch || 'batch'}_results.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Calculations for Class Performance Card
  const stats = useMemo(() => {
    const presentRecords = studentResults.filter(r => !r.absent && r.marksObtained !== undefined && r.marksObtained !== null && r.marksObtained !== '')
    if (presentRecords.length === 0) {
      return { average: 0, highest: '—', lowest: '—', pctLess50: 0, pct70to80: 0, pctMore90: 0 }
    }

    const totalMarks = selectedTest?.totalMarks || 100
    const scores = presentRecords.map(r => Number(r.marksObtained))
    
    const highest = Math.max(...scores)
    const lowest = Math.min(...scores)
    
    // Average score percentage
    const sumPercentages = presentRecords.reduce((sum, r) => sum + (Number(r.marksObtained) / totalMarks) * 100, 0)
    const average = Math.round((sumPercentages / presentRecords.length) * 10) / 10

    // Distributions
    const countLess50 = presentRecords.filter(r => (Number(r.marksObtained) / totalMarks) * 100 < 50).length
    const count70to80 = presentRecords.filter(r => {
      const p = (Number(r.marksObtained) / totalMarks) * 100
      return p >= 70 && p <= 80
    }).length
    const countMore90 = presentRecords.filter(r => (Number(r.marksObtained) / totalMarks) * 100 > 90).length

    return {
      average,
      highest,
      lowest,
      pctLess50: Math.round((countLess50 / presentRecords.length) * 100),
      pct70to80: Math.round((count70to80 / presentRecords.length) * 100),
      pctMore90: Math.round((countMore90 / presentRecords.length) * 100)
    }
  }, [studentResults, selectedTest])

  // Filtered & Searched student list
  const filteredResults = useMemo(() => {
    return studentResults.filter((record) => {
      // 1. Search Query Filter
      const query = searchQuery.toLowerCase().trim()
      const matchesSearch = 
        record.studentName.toLowerCase().includes(query) || 
        record.rollNo.toLowerCase().includes(query)

      if (!matchesSearch) return false

      // 2. Tab Filter
      if (filterType === 'Present') return !record.absent
      if (filterType === 'Absent') return record.absent
      if (filterType === 'Passed') return !record.absent && (record.percentage || 0) >= 50
      if (filterType === 'Failed') return !record.absent && (record.percentage || 0) < 50

      return true
    })
  }, [studentResults, searchQuery, filterType])

  // Paginated records
  const paginatedResults = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return filteredResults.slice(startIndex, startIndex + itemsPerPage)
  }, [filteredResults, currentPage])

  const totalPages = Math.ceil(filteredResults.length / itemsPerPage) || 1

  return (
    <div className="flex-1 p-6 space-y-6 overflow-y-auto max-h-[calc(100vh-64px)]">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Test Results Entry</h1>
          <p className="text-sm text-slate-500 mt-1">Enter and review marks for a completed test.</p>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-xl flex items-start gap-3 border ${
          message.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          )}
          <span className="text-sm font-medium">{message.text}</span>
        </div>
      )}

      {/* Configuration & Analytics Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Select Assessment Card */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col justify-between space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              Select Assessment
            </label>
            {testsLoading ? (
              <div className="flex items-center gap-2 text-slate-400 text-sm py-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading scheduled assessments...
              </div>
            ) : (
              <div className="relative">
                <select
                  value={selectedTestId}
                  onChange={(e) => setSelectedTestId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none cursor-pointer"
                >
                  {tests.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title} - {t.batch} ({new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})
                    </option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  ▼
                </div>
              </div>
            )}
          </div>

          {/* Test details tags */}
          {selectedTest && (
            <div className="flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-50 text-blue-600 text-sm font-semibold border border-blue-100">
                <span className="font-bold">Σ</span> Total Marks: {selectedTest.totalMarks}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-50 text-purple-600 text-sm font-semibold border border-purple-100">
                ⏱ Duration: {selectedTest.duration} min
              </span>
              <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-50 text-blue-600 text-sm font-semibold border border-blue-100 font-sans">
                📋 Pattern: {selectedTest.testType === 'Mock' ? 'Full Length MCQ' : 'MCQ + Numerical'}
              </span>
            </div>
          )}
        </div>

        {/* Class Performance Card */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col justify-between space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Class Performance</h3>
            <div className="grid grid-cols-3 gap-2 mt-4">
              <div className="text-left">
                <span className="block text-xs text-slate-400 font-medium">Average</span>
                <span className="text-2xl font-bold text-blue-600 tracking-tight">{stats.average}%</span>
              </div>
              <div className="text-left border-l border-slate-100 pl-4">
                <span className="block text-xs text-slate-400 font-medium">Highest</span>
                <span className="text-2xl font-bold text-emerald-600 tracking-tight">
                  {loading ? '-' : stats.highest}
                </span>
              </div>
              <div className="text-left border-l border-slate-100 pl-4">
                <span className="block text-xs text-slate-400 font-medium">Lowest</span>
                <span className="text-2xl font-bold text-rose-600 tracking-tight">
                  {loading ? '-' : stats.lowest}
                </span>
              </div>
            </div>
          </div>

          {/* Performance Distribution Bars */}
          <div className="space-y-2">
            <div className="flex h-2 w-full rounded-full overflow-hidden bg-slate-100">
              <div style={{ width: `${stats.pctLess50}%` }} className="bg-rose-500 h-full" />
              <div style={{ width: `${100 - stats.pctLess50 - stats.pct70to80 - stats.pctMore90}%` }} className="bg-slate-300 h-full" />
              <div style={{ width: `${stats.pct70to80}%` }} className="bg-amber-400 h-full" />
              <div style={{ width: `${stats.pctMore90}%` }} className="bg-emerald-500 h-full" />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium font-mono px-0.5">
              <span>&lt;50 ({stats.pctLess50}%)</span>
              <span>70-80 ({stats.pct70to80}%)</span>
              <span>&gt;90 ({stats.pctMore90}%)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Student Results Entry Card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
        {/* Table Toolbar Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <h2 className="text-lg font-bold text-slate-800">Student Results</h2>
          
          <div className="flex items-center gap-3 self-end md:self-auto">
            {/* Export CSV */}
            <button
              onClick={handleExportCSV}
              disabled={loading || studentResults.length === 0}
              className="inline-flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-slate-700 font-semibold px-4 py-2 rounded-xl text-sm transition"
            >
              <Download className="w-4 h-4 text-slate-500" />
              Export CSV
            </button>

            {/* Filter Dropdown */}
            <div className="relative">
              <select
                value={filterType}
                onChange={(e) => {
                  setFilterType(e.target.value)
                  setCurrentPage(1)
                }}
                className="bg-white border border-slate-200 text-slate-700 font-semibold px-4 py-2 pr-8 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none cursor-pointer"
              >
                <option value="All">All Students</option>
                <option value="Present">Present Only</option>
                <option value="Absent">Absent Only</option>
                <option value="Passed">Passed (≥ 50%)</option>
                <option value="Failed">Failed (&lt; 50%)</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">
                ▼
              </div>
            </div>
          </div>
        </div>

        {/* Search Bar Row */}
        <div className="px-6 py-3 bg-slate-50/50 border-b border-slate-100 flex items-center gap-3">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search students by name or roll number..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setCurrentPage(1)
            }}
            className="bg-transparent border-none text-sm text-slate-700 focus:outline-none placeholder-slate-400 w-full"
          />
        </div>

        {/* Results Entry Table */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-24 text-center text-slate-400 space-y-2">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500" />
              <p className="text-sm font-medium">Loading roster entries...</p>
            </div>
          ) : studentResults.length === 0 ? (
            <div className="py-24 text-center text-slate-400">
              <AlertCircle className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-medium">No students found in this batch.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Student Name</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Roll No</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-center w-28">Marks Obtd.</th>
                  <th className="px-4 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-center w-24">Correct</th>
                  <th className="px-4 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-center w-24">Incorrect</th>
                  <th className="px-4 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-center w-24">Unattempted</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-center w-20">Rank</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-center w-28">Percentage</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-center w-20">Absent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedResults.map((record, index) => {
                  // Translate global index inside the actual array
                  const originalIndex = studentResults.findIndex(r => r.rollNo === record.rollNo && r.studentName === record.studentName)
                  const initials = getInitials(record.studentName)
                  const avatarColor = getAvatarStyle(record.studentName)

                  return (
                    <tr key={index} className={`hover:bg-slate-50/50 transition ${record.absent ? 'bg-slate-50/30' : ''}`}>
                      {/* Name with Avatar */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full border flex items-center justify-center text-xs font-bold ${avatarColor} shrink-0`}>
                            {initials}
                          </div>
                          {record.isCustom ? (
                            <input
                              type="text"
                              value={record.studentName}
                              onChange={(e) => handleInputChange(originalIndex, 'studentName', e.target.value)}
                              placeholder="Enter student name"
                              className="border border-slate-200 rounded-lg px-2 py-1 text-sm font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 w-full"
                            />
                          ) : (
                            <span className="font-semibold text-slate-700 text-sm">{record.studentName}</span>
                          )}
                        </div>
                      </td>

                      {/* Roll No */}
                      <td className="px-6 py-4 text-sm text-slate-500 font-medium font-mono">
                        {record.isCustom ? (
                          <input
                            type="text"
                            value={record.rollNo}
                            onChange={(e) => handleInputChange(originalIndex, 'rollNo', e.target.value)}
                            placeholder="Roll No"
                            className="border border-slate-200 rounded-lg px-2 py-1 text-sm font-medium text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 w-24 font-mono"
                          />
                        ) : (
                          record.rollNo
                        )}
                      </td>

                      {/* Marks Obtained Input */}
                      <td className="px-6 py-4 text-center">
                        {record.absent ? (
                          <span className="inline-flex justify-center items-center w-20 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 text-sm font-bold tracking-wider font-mono">
                            AB
                          </span>
                        ) : (
                          <input
                            type="number"
                            min="0"
                            max={selectedTest?.totalMarks || 100}
                            value={record.marksObtained ?? ''}
                            onChange={(e) => handleInputChange(originalIndex, 'marksObtained', e.target.value)}
                            className="w-20 text-center border border-slate-200 rounded-lg py-1 px-2 font-bold text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          />
                        )}
                      </td>

                      {/* Correct Answers */}
                      <td className="px-4 py-4 text-center">
                        {!record.absent && (
                          <input
                            type="number"
                            min="0"
                            max="50"
                            value={record.correct ?? ''}
                            onChange={(e) => handleInputChange(originalIndex, 'correct', e.target.value)}
                            className="w-16 text-center border border-slate-200 rounded-lg py-1 px-1 text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
                          />
                        )}
                      </td>

                      {/* Incorrect Answers */}
                      <td className="px-4 py-4 text-center">
                        {!record.absent && (
                          <input
                            type="number"
                            min="0"
                            max="50"
                            value={record.incorrect ?? ''}
                            onChange={(e) => handleInputChange(originalIndex, 'incorrect', e.target.value)}
                            className="w-16 text-center border border-slate-200 rounded-lg py-1 px-1 text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
                          />
                        )}
                      </td>

                      {/* Unattempted Questions */}
                      <td className="px-4 py-4 text-center">
                        {!record.absent && (
                          <input
                            type="number"
                            min="0"
                            max="50"
                            value={record.unattempted ?? ''}
                            onChange={(e) => handleInputChange(originalIndex, 'unattempted', e.target.value)}
                            className="w-16 text-center border border-slate-200 rounded-lg py-1 px-1 text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
                          />
                        )}
                      </td>

                      {/* Rank */}
                      <td className="px-6 py-4 text-center text-sm font-bold text-slate-700">
                        {record.absent || record.rank === undefined ? '-' : record.rank}
                      </td>

                      {/* Percentage */}
                      <td className="px-6 py-4 text-center text-sm font-semibold text-slate-500 font-mono">
                        {record.absent || record.percentage === undefined ? '-' : `${record.percentage}%`}
                      </td>

                      {/* Absent Checkbox */}
                      <td className="px-6 py-4 text-center">
                        <input
                          type="checkbox"
                          checked={record.absent}
                          onChange={(e) => handleInputChange(originalIndex, 'absent', e.target.checked)}
                          className="w-4.5 h-4.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 focus:ring-2 cursor-pointer"
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Table Footer Pagination */}
        {filteredResults.length > 0 && (
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 font-mono">
              Showing {Math.min(filteredResults.length, (currentPage - 1) * itemsPerPage + 1)} to {Math.min(filteredResults.length, currentPage * itemsPerPage)} of {filteredResults.length} students
            </span>

            <div className="flex items-center gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 disabled:opacity-40 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentPage(i + 1)}
                  className={`w-7 h-7 text-xs font-bold rounded-lg transition border ${
                    currentPage === i + 1
                      ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                      : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 disabled:opacity-40 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Sticky Action Buttons Bar */}
      <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex items-center justify-between gap-4 mt-6">
        <button
          type="button"
          onClick={() => {
            setMessage(null)
            fetchTestResults()
          }}
          className="px-6 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm transition"
        >
          Cancel
        </button>

        <button
          type="button"
          disabled={saving || loading || studentResults.length === 0}
          onClick={handleSaveResults}
          className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition shadow-sm"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <FileCheck className="w-4 h-4" />
              Save Results
            </>
          )}
        </button>
      </div>
    </div>
  )
}
