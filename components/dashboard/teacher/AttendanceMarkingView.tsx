'use client'

import { useState, useEffect } from 'react'
import { useAlert } from '@/components/dashboard/AlertProvider'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  CheckCircle, 
  XCircle, 
  Calendar, 
  Clock, 
  Search, 
  FileText, 
  X, 
  RefreshCw, 
  User, 
  ChevronDown 
} from 'lucide-react'

// Avatar background colors helper
const avatarBgs = [
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-indigo-100 text-indigo-700',
  'bg-rose-100 text-rose-700',
  'bg-amber-100 text-amber-700',
  'bg-purple-100 text-purple-700'
]

function getAvatarStyle(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  const index = Math.abs(hash) % avatarBgs.length
  return avatarBgs[index]
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export default function AttendanceMarkingView() {
  const { showAlert } = useAlert()
  // Selection states
  const [selectedBatch, setSelectedBatch] = useState('Grade 11-A')
  const [selectedSubject, setSelectedSubject] = useState('Physics (PHY-101)')
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date()
    return today.toISOString().split('T')[0]
  })

  // Attendance Records & Loading state
  const [records, setRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Notes Modal state
  const [activeNoteRecordIdx, setActiveNoteRecordIdx] = useState<number | null>(null)
  const [noteText, setNoteText] = useState('')

  // Fetch student roster or marked sheet on selection changes
  async function fetchAttendanceSheet() {
    setLoading(true)
    try {
      const res = await fetch(`/api/attendance?date=${selectedDate}&batch=${encodeURIComponent(selectedBatch)}&subject=${encodeURIComponent(selectedSubject)}`)
      const data = await res.json()
      if (!data.error) {
        setRecords(data.records || [])
      } else {
        setRecords([])
      }
    } catch (err) {
      console.error(err)
      setRecords([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAttendanceSheet()
  }, [selectedBatch, selectedSubject, selectedDate])

  // Bulk Actions
  function markAll(status: 'Present' | 'Absent') {
    setRecords(prev => prev.map(r => ({ ...r, status })))
  }

  // Individual Marking
  function markIndividual(index: number, status: 'Present' | 'Absent' | 'Late' | 'Excused') {
    setRecords(prev => {
      const copy = [...prev]
      copy[index] = { ...copy[index], status }
      return copy
    })
  }

  // Open Notes Modal
  function openNotesModal(index: number) {
    setActiveNoteRecordIdx(index)
    setNoteText(records[index].notes || '')
  }

  // Save Note
  function saveNote() {
    if (activeNoteRecordIdx === null) return
    setRecords(prev => {
      const copy = [...prev]
      copy[activeNoteRecordIdx] = { ...copy[activeNoteRecordIdx], notes: noteText }
      return copy
    })
    setActiveNoteRecordIdx(null)
    setNoteText('')
  }

  // Submit to DB
  async function executeSubmitAttendance() {
    setSubmitting(true)
    try {
      const payload = {
        date: selectedDate,
        batch: selectedBatch,
        subject: selectedSubject,
        classTime: '09:00 AM - 10:00 AM',
        records: records.map(r => ({
          ...r,
          status: r.status || 'Absent' // fallback unmarked to Absent
        }))
      }

      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (!data.error) {
        showAlert({
          title: 'Success',
          message: 'Attendance submitted successfully!',
          type: 'success'
        })
        fetchAttendanceSheet()
      } else {
        showAlert({
          title: 'Submission Failed',
          message: data.error,
          type: 'warning',
          onRetry: () => executeSubmitAttendance(),
          retryText: 'Retry'
        })
      }
    } catch (err) {
      console.error(err)
      showAlert({
        title: 'Submission Error',
        message: 'Failed to submit attendance.',
        type: 'warning',
        onRetry: () => executeSubmitAttendance(),
        retryText: 'Retry'
      })
    } finally {
      setSubmitting(false)
    }
  }

  function submitAttendance() {
    // Check if any student is unmarked
    const unmarkedCount = records.filter(r => !r.status).length
    if (unmarkedCount > 0) {
      showAlert({
        title: 'Unmarked Students',
        message: `You have left ${unmarkedCount} student(s) unmarked. Do you want to submit anyway? (Unmarked students will default to Absent)`,
        type: 'warning',
        retryText: 'Submit Anyway',
        cancelText: 'Cancel',
        onRetry: () => executeSubmitAttendance()
      })
    } else {
      executeSubmitAttendance()
    }
  }

  // Stats calculation
  const totalStudents = records.length
  const presentCount = records.filter(r => r.status === 'Present').length
  const absentCount = records.filter(r => r.status === 'Absent').length
  const lateCount = records.filter(r => r.status === 'Late').length
  const excusedCount = records.filter(r => r.status === 'Excused').length

  // Local Search Filter
  const filteredRecords = records.filter(r => 
    r.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.rollNo && r.rollNo.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  return (
    <div className="flex-1 p-8 overflow-auto bg-slate-50 min-h-screen relative flex flex-col justify-between">
      
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Attendance Marking</h1>
            <p className="text-[13px] text-slate-500 mt-1">
              Mark attendance for today's class
            </p>
          </div>
          <button 
            onClick={fetchAttendanceSheet}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-semibold shadow-sm transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Selection Bar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm mb-8 items-end">
          
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 pl-0.5">Batch</label>
            <div className="relative">
              <select
                value={selectedBatch}
                onChange={(e) => setSelectedBatch(e.target.value)}
                className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 text-slate-800 rounded-lg text-sm font-semibold outline-none focus:border-slate-400 transition-colors cursor-pointer appearance-none"
              >
                <option value="Grade 11-A">Grade 11-A</option>
                <option value="Grade 11-B">Grade 11-B</option>
                <option value="Grade 10-A">Grade 10-A</option>
                <option value="Grade 10-B">Grade 10-B</option>
              </select>
              <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 pl-0.5">Subject</label>
            <div className="relative">
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 text-slate-800 rounded-lg text-sm font-semibold outline-none focus:border-slate-400 transition-colors cursor-pointer appearance-none"
              >
                <option value="Physics (PHY-101)">Physics (PHY-101)</option>
                <option value="Chemistry (CHE-101)">Chemistry (CHE-101)</option>
                <option value="Mathematics (MAT-101)">Mathematics (MAT-101)</option>
                <option value="English (ENG-101)">English (ENG-101)</option>
              </select>
              <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 pl-0.5">Date</label>
            <div className="relative">
              <input 
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full pl-4 pr-4 py-2 bg-slate-50 border border-slate-200 text-slate-800 rounded-lg text-sm font-semibold outline-none focus:border-slate-400 transition-colors cursor-pointer"
              />
            </div>
          </div>

          {/* Read only Class Time Box */}
          <div className="flex items-center gap-3 bg-slate-50/50 border border-slate-200 rounded-xl p-3.5 h-[42px] mb-[1px]">
            <Clock className="w-4 h-4 text-slate-700" />
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Class Time</span>
              <span className="text-xs font-bold text-slate-700">09:00 AM - 10:00 AM</span>
            </div>
          </div>

        </div>

        {/* Student List Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900">Student List</h2>
            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-bold rounded-md">({totalStudents} Students)</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            
            {/* Local search */}
            <div className="relative max-w-xs">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search students..."
                className="pl-9 pr-4 py-1.5 border border-slate-200 bg-white rounded-lg text-xs outline-none focus:border-slate-400 transition-colors shadow-sm"
              />
            </div>

            <button 
              onClick={() => markAll('Present')}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-bold transition-all shadow-sm"
            >
              <CheckCircle className="w-3.5 h-3.5 text-green-500" /> Mark All Present
            </button>
            <button 
              onClick={() => markAll('Absent')}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-bold transition-all shadow-sm"
            >
              <XCircle className="w-3.5 h-3.5 text-red-500" /> Mark All Absent
            </button>

          </div>

        </div>

        {/* Student List Table */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-8 h-8 text-slate-400 animate-spin" />
            <span className="text-sm font-semibold text-slate-500">Loading student roster from database...</span>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-12">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Student</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Attendance Status</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.length > 0 ? (
                  filteredRecords.map((record, index) => {
                    const avatarStyle = getAvatarStyle(record.studentName)
                    const initials = getInitials(record.studentName)
                    
                    // Match visual record indices back to actual indices in records state
                    const actualIdx = records.findIndex(r => r.studentId === record.studentId)

                    return (
                      <tr key={record.studentId} className="hover:bg-slate-50/50 transition-colors">
                        
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shadow-sm ${avatarStyle}`}>
                              {initials}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[13px] font-bold text-slate-900">{record.studentName}</span>
                              {record.rollNo && (
                                <span className="text-[11px] text-slate-500 mt-0.5">Roll: {record.rollNo}</span>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center">
                            <div className="bg-slate-100/80 p-0.5 rounded-lg flex items-center gap-0.5 border border-slate-200/50 shadow-sm w-[240px]">
                              
                              <button 
                                onClick={() => markIndividual(actualIdx, 'Present')}
                                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${
                                  record.status === 'Present' 
                                    ? 'bg-green-600 text-white shadow-sm' 
                                    : 'text-slate-600 hover:bg-slate-50'
                                }`}
                              >
                                Present
                              </button>
                              
                              <button 
                                onClick={() => markIndividual(actualIdx, 'Absent')}
                                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${
                                  record.status === 'Absent' 
                                    ? 'bg-red-500 text-white shadow-sm' 
                                    : 'text-slate-600 hover:bg-slate-50'
                                }`}
                              >
                                Absent
                              </button>
                              
                              <button
                                onClick={() => markIndividual(actualIdx, 'Late')}
                                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${
                                  record.status === 'Late'
                                    ? 'bg-amber-500 text-white shadow-sm'
                                    : 'text-slate-600 hover:bg-slate-50'
                                }`}
                              >
                                Late
                              </button>

                              <button
                                onClick={() => markIndividual(actualIdx, 'Excused')}
                                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${
                                  record.status === 'Excused'
                                    ? 'bg-sky-500 text-white shadow-sm'
                                    : 'text-slate-600 hover:bg-slate-50'
                                }`}
                              >
                                Excused
                              </button>

                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4 text-right">
                          <button 
                            onClick={() => openNotesModal(actualIdx)}
                            className="relative p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors inline-flex items-center justify-center shadow-sm border border-slate-100 bg-white"
                          >
                            <FileText className="w-4 h-4" />
                            {/* Dot indicator if note is present */}
                            {record.notes && (
                              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-500 border border-white" />
                            )}
                          </button>
                        </td>

                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={3} className="text-center py-12 text-sm font-semibold text-slate-400">
                      No students found. Check your batch dropdown or add students to the roster.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* FOOTER BAR: STATS & SUBMIT */}
      <div className="bg-white border border-slate-200 shadow-lg p-5 rounded-2xl flex items-center justify-between mt-auto">
        <div className="flex items-center gap-6 text-xs font-bold uppercase tracking-wider text-slate-500 pl-2">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-600" /> Present: <strong className="text-slate-800">{presentCount}</strong></span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Absent: <strong className="text-slate-800">{absentCount}</strong></span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Late: <strong className="text-slate-800">{lateCount}</strong></span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-sky-500" /> Excused: <strong className="text-slate-800">{excusedCount}</strong></span>
        </div>
        <button 
          onClick={submitAttendance}
          disabled={submitting || records.length === 0}
          className="flex items-center gap-2 px-6 py-2.5 bg-[#0b1320] hover:bg-slate-800 text-white rounded-lg text-sm font-bold transition-all shadow-md disabled:opacity-50"
        >
          {submitting && <RefreshCw className="w-4 h-4 animate-spin" />}
          Submit Attendance
        </button>
      </div>

      {/* NOTES MODAL */}
      <AnimatePresence>
        {activeNoteRecordIdx !== null && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl p-6 shadow-xl w-full max-w-md border border-slate-100"
            >
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Student Attendance Note</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Write comments for {records[activeNoteRecordIdx].studentName}</p>
                </div>
                <button 
                  onClick={() => { setActiveNoteRecordIdx(null); setNoteText(''); }}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-0.5">Attendance Remarks / Comments</label>
                  <textarea
                    rows={4}
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="e.g. Arrived late due to bus breakdown, or left early with permission..."
                    className="w-full mt-2 p-3 border border-slate-200 rounded-lg text-sm outline-none focus:border-slate-400 transition-colors bg-slate-50 text-slate-800 placeholder-slate-400"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => { setActiveNoteRecordIdx(null); setNoteText(''); }}
                    className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={saveNote}
                    className="flex-1 py-2 bg-[#0b1320] hover:bg-slate-800 text-white font-bold rounded-xl text-sm transition-colors"
                  >
                    Save Remarks
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  )
}
