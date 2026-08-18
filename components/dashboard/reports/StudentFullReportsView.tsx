'use client'
import { useState, useEffect } from 'react'
import {
  Search,
  Download,
  Award,
  TrendingUp,
  Target,
  AlertTriangle,
  MessageSquare,
  CheckCircle,
  XCircle,
  HelpCircle,
  Star,
  Users,
  Calendar,
  FileText,
  Loader2,
  ChevronRight,
  Sparkles,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import * as XLSX from 'xlsx'
import { downloadTabularReportPDF } from '@/lib/pdf/reportPdfGenerator'

interface StudentFullReportsProps {
  initialStudentId?: string
}

export default function StudentFullReportsView({ initialStudentId }: StudentFullReportsProps) {
  const [studentList, setStudentList] = useState<{ id: string; name: string; rollNo: string; batch: string }[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStudentId, setSelectedStudentId] = useState<string>(initialStudentId || '')
  const [reportData, setReportData] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'performance' | 'testAnalysis' | 'strengthWeakness' | 'errorLogs' | 'feedback'>('performance')
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3000)
  }

  // Fetch student roster for dropdown / search
  useEffect(() => {
    fetch('/api/students')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (Array.isArray(data)) {
          const formatted = data.map((s: any) => ({
            id: s._id || s.id,
            name: s.name,
            rollNo: s.rollNo || s.roll_no || 'N/A',
            batch: s.batch || 'N/A',
          }))
          setStudentList(formatted)
          if (!selectedStudentId && formatted.length > 0) {
            setSelectedStudentId(formatted[0].id)
          }
        }
      })
      .catch((err) => console.error('Failed to fetch students roster', err))
  }, [])

  // Fetch report data when selected student changes
  useEffect(() => {
    if (!selectedStudentId) return
    setLoading(true)
    fetch(`/api/reports/students/${selectedStudentId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && !data.error) setReportData(data)
        else setReportData(null)
      })
      .catch((err) => {
        console.error('Failed to fetch student full report', err)
        setReportData(null)
      })
      .finally(() => setLoading(false))
  }, [selectedStudentId])

  const filteredStudents = studentList.filter((s) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return s.name.toLowerCase().includes(q) || s.rollNo.toLowerCase().includes(q) || s.batch.toLowerCase().includes(q)
  })

  // Export PDF containing all 5 reports
  const handleExportPDF = async () => {
    if (!reportData) return
    const { student, performanceReport, testAnalysisReport, teacherFeedbackSummary } = reportData

    const rows = [
      ['Student Name', student.name],
      ['Roll Number', student.rollNo],
      ['Batch', student.batch],
      ['Overall Percentage', `${performanceReport.overallPercentage}% (${performanceReport.overallGrade})`],
      ['Batch Rank', `#${performanceReport.rank} of ${performanceReport.totalStudentsInBatch}`],
      ['Percentile', `${performanceReport.percentile}th Percentile`],
      ['Test Accuracy', `${testAnalysisReport.accuracyRate}%`],
      ['Attempt Rate', `${testAnalysisReport.attemptRate}%`],
      ['Behavioral Score', `${teacherFeedbackSummary.ratings.behavioralScore} / 5.0`],
      ['PTM Meetings Logged', `${teacherFeedbackSummary.ptm.totalMeetings}`],
    ]

    await downloadTabularReportPDF({
      title: `Student 360 Progress Report — ${student.name}`,
      subtitle: `EduAdmin Pro • ${student.batch} • Roll No: ${student.rollNo}`,
      columns: ['Metric / Area', 'Performance Summary'],
      rows,
      fileName: `${student.name.replace(/\s+/g, '_')}_360_Report.pdf`,
    })
    showToast('Downloaded PDF report successfully!')
  }

  // Export CSV
  const handleExportCSV = () => {
    if (!reportData) return
    const { student, performanceReport, testAnalysisReport, strengthVsWeaknessMap, errorLogs, teacherFeedbackSummary } = reportData

    const performanceSheet = [
      ['STUDENT PERFORMANCE REPORT'],
      ['Name', student.name],
      ['Roll No', student.rollNo],
      ['Batch', student.batch],
      ['Overall Score', `${performanceReport.overallPercentage}%`],
      ['Grade', performanceReport.overallGrade],
      ['Batch Rank', performanceReport.rank],
      ['Percentile', performanceReport.percentile],
      [],
      ['SUBJECT BREAKDOWN'],
      ['Subject', 'Marks Obtained', 'Max Marks', 'Percentage'],
      ...performanceReport.subjectBreakdown.map((s: any) => [s.subject, s.marksObtained, s.maxMarks, `${s.percentage}%`]),
    ]

    const testAnalysisSheet = [
      ['TEST ANALYSIS REPORT'],
      ['Total Questions', testAnalysisReport.totalQuestions],
      ['Attempted', testAnalysisReport.questionsAttempted],
      ['Correct', testAnalysisReport.questionsCorrect],
      ['Incorrect', testAnalysisReport.questionsIncorrect],
      ['Unattempted', testAnalysisReport.questionsUnattempted],
      ['Accuracy Rate', `${testAnalysisReport.accuracyRate}%`],
      ['Attempt Rate', `${testAnalysisReport.attemptRate}%`],
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(performanceSheet), 'Performance')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(testAnalysisSheet), 'Test Analysis')
    XLSX.writeFile(wb, `${student.name.replace(/\s+/g, '_')}_Report.xlsx`)
    showToast('Downloaded Excel/CSV report successfully!')
  }

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 right-6 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl z-50 text-xs font-bold flex items-center gap-2 border border-slate-700"
          >
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Student Roster Selector Bar */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search student by name, roll no..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs font-medium border border-slate-200 rounded-xl outline-none focus:border-indigo-500 bg-slate-50/50"
            />
          </div>
          <select
            value={selectedStudentId}
            onChange={(e) => setSelectedStudentId(e.target.value)}
            className="px-3.5 py-2 text-xs font-semibold border border-slate-200 rounded-xl outline-none bg-white text-slate-700 focus:border-indigo-500 max-w-xs truncate"
          >
            {filteredStudents.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.rollNo}) — {s.batch}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            disabled={!reportData}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" /> Export Excel/CSV
          </button>
          <button
            onClick={handleExportPDF}
            disabled={!reportData}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm transition-all disabled:opacity-50"
          >
            <FileText className="w-3.5 h-3.5" /> Export 5-in-1 PDF
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl p-16 flex flex-col items-center justify-center border border-slate-100 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin mb-3 text-indigo-500" />
          <p className="text-sm font-semibold text-slate-600">Generating student analytics report...</p>
        </div>
      ) : !reportData ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-100 text-slate-400">
          <Users className="w-10 h-10 mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-semibold text-slate-600">No student report data available.</p>
          <p className="text-xs text-slate-400 mt-1">Select a valid student from the dropdown above.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Header Card */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="relative z-10 flex flex-wrap items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-xl font-black text-indigo-200">
                  {reportData.student.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-xl font-bold tracking-tight">{reportData.student.name}</h2>
                    <span className="px-2.5 py-0.5 text-[11px] font-extrabold rounded-full bg-indigo-500/30 border border-indigo-400/40 text-indigo-200">
                      Roll No: {reportData.student.rollNo}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1">
                    Batch: <span className="font-semibold text-white">{reportData.student.batch}</span> · Program: {reportData.student.programName || 'Standard'}
                  </p>
                </div>
              </div>

              {/* Top Quick KPIs */}
              <div className="flex items-center gap-4 border-l border-white/10 pl-6">
                <div className="text-center px-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Overall Score</p>
                  <p className="text-2xl font-black text-emerald-400 mt-0.5">
                    {reportData.performanceReport.overallPercentage}%
                  </p>
                  <p className="text-[10px] text-slate-300 font-bold">Grade {reportData.performanceReport.overallGrade}</p>
                </div>

                <div className="text-center px-3 border-l border-white/10">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Batch Rank</p>
                  <p className="text-2xl font-black text-amber-300 mt-0.5">
                    #{reportData.performanceReport.rank}
                  </p>
                  <p className="text-[10px] text-slate-300">Top {reportData.performanceReport.percentile}%</p>
                </div>

                <div className="text-center px-3 border-l border-white/10">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Behavior Score</p>
                  <p className="text-2xl font-black text-indigo-300 mt-0.5">
                    {reportData.teacherFeedbackSummary.ratings.behavioralScore}
                  </p>
                  <p className="text-[10px] text-slate-300">Out of 5.0</p>
                </div>
              </div>
            </div>
          </div>

          {/* 5-Report Tabs Navigation */}
          <div className="bg-white rounded-2xl p-2 shadow-sm border border-slate-100 flex overflow-x-auto gap-1">
            {[
              { id: 'performance', label: '1. Performance Report', icon: <Award className="w-4 h-4" /> },
              { id: 'testAnalysis', label: '2. Test Analysis', icon: <TrendingUp className="w-4 h-4" /> },
              { id: 'strengthWeakness', label: '3. Strength vs Weakness', icon: <Target className="w-4 h-4" /> },
              { id: 'errorLogs', label: '4. Error Logs', icon: <AlertTriangle className="w-4 h-4" /> },
              { id: 'feedback', label: '5. Teacher Feedback', icon: <MessageSquare className="w-4 h-4" /> },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                  activeTab === tab.id
                    ? 'bg-slate-900 text-white shadow-md'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* TAB 1: PERFORMANCE REPORT */}
          {activeTab === 'performance' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Marks Obtained</p>
                  <p className="text-3xl font-black text-slate-900 mt-2">
                    {reportData.performanceReport.totalMarksObtained}{' '}
                    <span className="text-sm text-slate-400 font-semibold">/ {reportData.performanceReport.totalMarksAttempted}</span>
                  </p>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Batch Rank & Percentile</p>
                  <p className="text-3xl font-black text-indigo-600 mt-2">
                    Rank #{reportData.performanceReport.rank}{' '}
                    <span className="text-xs font-semibold text-slate-400">({reportData.performanceReport.percentile}th percentile)</span>
                  </p>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Performance Grade</p>
                  <span className="inline-block mt-2 px-3 py-1 text-lg font-black rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Grade {reportData.performanceReport.overallGrade}
                  </span>
                </div>
              </div>

              {/* Subject Breakdown */}
              <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Award className="w-4 h-4 text-indigo-500" /> Subject-wise Performance Breakdown
                </h3>
                {reportData.performanceReport.subjectBreakdown.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No subject data evaluated yet.</p>
                ) : (
                  <div className="space-y-3">
                    {reportData.performanceReport.subjectBreakdown.map((s: any) => (
                      <div key={s.subject} className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-slate-800">{s.subject}</span>
                          <span className="text-indigo-600">{s.marksObtained} / {s.maxMarks} ({s.percentage}%)</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                          <div
                            className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, s.percentage)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: TEST ANALYSIS REPORT */}
          {activeTab === 'testAnalysis' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm text-center">
                  <p className="text-xs font-bold text-slate-400 uppercase">Accuracy Rate</p>
                  <p className="text-3xl font-black text-emerald-600 mt-1">{reportData.testAnalysisReport.accuracyRate}%</p>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm text-center">
                  <p className="text-xs font-bold text-slate-400 uppercase">Attempt Rate</p>
                  <p className="text-3xl font-black text-indigo-600 mt-1">{reportData.testAnalysisReport.attemptRate}%</p>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm text-center">
                  <p className="text-xs font-bold text-slate-400 uppercase">Questions Correct</p>
                  <p className="text-3xl font-black text-emerald-500 mt-1">{reportData.testAnalysisReport.questionsCorrect}</p>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm text-center">
                  <p className="text-xs font-bold text-slate-400 uppercase">Questions Incorrect</p>
                  <p className="text-3xl font-black text-rose-500 mt-1">{reportData.testAnalysisReport.questionsIncorrect}</p>
                </div>
              </div>

              {/* Breakdown by Question Type & Difficulty */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-3">
                  <h3 className="text-sm font-bold text-slate-900">Accuracy by Question Type</h3>
                  {reportData.testAnalysisReport.questionTypeBreakdown.map((t: any) => (
                    <div key={t.type} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 text-xs font-semibold">
                      <span className="text-slate-700">{t.type}</span>
                      <span className="text-slate-900 font-bold">{t.correct} / {t.total} ({t.accuracy}%)</span>
                    </div>
                  ))}
                </div>
                <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-3">
                  <h3 className="text-sm font-bold text-slate-900">Accuracy by Difficulty Level</h3>
                  {reportData.testAnalysisReport.difficultyBreakdown.map((d: any) => (
                    <div key={d.difficulty} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 text-xs font-semibold">
                      <span className="text-slate-700">{d.difficulty}</span>
                      <span className="text-slate-900 font-bold">{d.correct} / {d.total} ({d.accuracy}%)</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: STRENGTH VS WEAKNESS MAP */}
          {activeTab === 'strengthWeakness' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Strong Topics */}
              <div className="bg-white rounded-2xl p-6 border border-emerald-100 shadow-sm space-y-4">
                <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                  <h3>Strong Topics (≥ 75%)</h3>
                </div>
                {reportData.strengthVsWeaknessMap.strongTopics.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No strong topics recorded yet.</p>
                ) : (
                  <div className="space-y-2">
                    {reportData.strengthVsWeaknessMap.strongTopics.map((t: any, idx: number) => (
                      <div key={idx} className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-100 flex items-center justify-between text-xs">
                        <span className="font-bold text-emerald-900">{t.topic}</span>
                        <span className="px-2 py-0.5 text-[10px] font-black rounded-md bg-emerald-200 text-emerald-800">{t.mastery}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Average Topics */}
              <div className="bg-white rounded-2xl p-6 border border-amber-100 shadow-sm space-y-4">
                <div className="flex items-center gap-2 text-amber-700 font-bold text-sm">
                  <Sparkles className="w-5 h-5 text-amber-600" />
                  <h3>Average Topics (50–74%)</h3>
                </div>
                {reportData.strengthVsWeaknessMap.averageTopics.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No average topics recorded.</p>
                ) : (
                  <div className="space-y-2">
                    {reportData.strengthVsWeaknessMap.averageTopics.map((t: any, idx: number) => (
                      <div key={idx} className="p-3 rounded-xl bg-amber-50/60 border border-amber-100 flex items-center justify-between text-xs">
                        <span className="font-bold text-amber-900">{t.topic}</span>
                        <span className="px-2 py-0.5 text-[10px] font-black rounded-md bg-amber-200 text-amber-800">{t.mastery}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Weak Topics */}
              <div className="bg-white rounded-2xl p-6 border border-rose-100 shadow-sm space-y-4">
                <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
                  <XCircle className="w-5 h-5 text-rose-600" />
                  <h3>Weak Topics (&lt; 50%)</h3>
                </div>
                {reportData.strengthVsWeaknessMap.weakTopics.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No weak topics! Great performance.</p>
                ) : (
                  <div className="space-y-2">
                    {reportData.strengthVsWeaknessMap.weakTopics.map((t: any, idx: number) => (
                      <div key={idx} className="p-3 rounded-xl bg-rose-50/60 border border-rose-100 flex items-center justify-between text-xs">
                        <span className="font-bold text-rose-900">{t.topic}</span>
                        <span className="px-2 py-0.5 text-[10px] font-black rounded-md bg-rose-200 text-rose-800">{t.mastery}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: ERROR LOGS */}
          {activeTab === 'errorLogs' && (
            <div className="space-y-6">
              {/* Mistake Type Summary */}
              <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-900">Mistake History Breakdown</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {Object.entries(reportData.errorLogs.mistakeTypeSummary).map(([type, count]) => (
                    <div key={type} className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-center">
                      <p className="text-xs font-semibold text-slate-500">{type}</p>
                      <p className="text-2xl font-black text-slate-900 mt-1">{count as number}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Tagged Errors */}
              <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-900">Recent Incorrect Question Logs</h3>
                {reportData.errorLogs.recentErrors.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No tagged errors recorded.</p>
                ) : (
                  <div className="space-y-3">
                    {reportData.errorLogs.recentErrors.map((err: any) => (
                      <div key={err.id} className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-slate-800">{err.questionText}</p>
                          <p className="text-[11px] text-slate-500">Test: {err.testTitle} · Chapter: {err.chapterTitle}</p>
                        </div>
                        <span className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-rose-50 text-rose-700 border border-rose-200 shrink-0">
                          {err.mistakeType}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: TEACHER FEEDBACK SUMMARY */}
          {activeTab === 'feedback' && (
            <div className="space-y-6">
              {/* Daily Rating Rollup */}
              <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Star className="w-4 h-4 text-amber-500 fill-amber-500" /> Daily Behavior & Engagement Ratings
                  </h3>
                  <span className="px-3 py-1 text-xs font-bold rounded-full bg-indigo-50 text-indigo-700">
                    {reportData.teacherFeedbackSummary.dailyRatingsCount} Days Evaluated
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Attitude', score: reportData.teacherFeedbackSummary.ratings.attitude },
                    { label: 'Behaviour', score: reportData.teacherFeedbackSummary.ratings.behaviour },
                    { label: 'Focus', score: reportData.teacherFeedbackSummary.ratings.focus },
                    { label: 'Interaction', score: reportData.teacherFeedbackSummary.ratings.interaction },
                  ].map((r) => (
                    <div key={r.label} className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-center">
                      <p className="text-xs font-semibold text-slate-500">{r.label}</p>
                      <p className="text-2xl font-black text-slate-900 mt-1">{r.score} <span className="text-xs text-slate-400">/ 5.0</span></p>
                    </div>
                  ))}
                </div>
              </div>

              {/* PTM Logs */}
              <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-indigo-500" /> Parent-Teacher Meeting (PTM) History
                  </h3>
                  <span className="text-xs font-bold text-slate-500">
                    Attendance Rate: {reportData.teacherFeedbackSummary.ptm.attendanceRate}%
                  </span>
                </div>

                {reportData.teacherFeedbackSummary.ptm.recentLogs.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No PTM meeting notes recorded.</p>
                ) : (
                  <div className="space-y-3">
                    {reportData.teacherFeedbackSummary.ptm.recentLogs.map((log: any) => (
                      <div key={log.id} className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-slate-900">Parent: {log.parentName || 'Parent'} ({log.date})</span>
                          <span className={`px-2 py-0.5 text-[10px] rounded-full font-bold ${log.parentAttended ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                            {log.parentAttended ? 'Attended' : 'Absent'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600">{log.discussionNotes}</p>
                        {log.actionItems && (
                          <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-xs text-indigo-900 font-medium">
                            <span className="font-bold text-indigo-700">Action Items:</span> {log.actionItems}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
