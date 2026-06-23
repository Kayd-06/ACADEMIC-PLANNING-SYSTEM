'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Calendar, 
  Clock, 
  AlertTriangle, 
  Eye, 
  Plus, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  X, 
  RefreshCw, 
  CheckCircle,
  FileText
} from 'lucide-react'

// Helper to format due date into human readable form (e.g., Oct 24)
function formatShortDate(dateStr: string) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function AssignmentsView() {
  const [assignments, setAssignments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  
  // Filter States
  const [activeTab, setActiveTab] = useState<'All' | 'Homework' | 'DPP'>('All')
  const [selectedBatch, setSelectedBatch] = useState<string>('All')
  const [searchQuery, setSearchQuery] = useState<string>('')
  
  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [selectedAssignment, setSelectedAssignment] = useState<any | null>(null)

  // Create Form Fields
  const [newTitle, setNewTitle] = useState('')
  const [newChapter, setNewChapter] = useState('')
  const [newBatch, setNewBatch] = useState('Grade 11-A')
  const [newSubject, setNewSubject] = useState('Mathematics')
  const [newType, setNewType] = useState<'Homework' | 'DPP'>('Homework')
  const [newDueDate, setNewDueDate] = useState('')
  const [newDueTime, setNewDueTime] = useState('11:59 PM')

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  async function fetchAssignments() {
    setLoading(true)
    try {
      const typeParam = activeTab === 'All' ? 'All' : activeTab
      const batchParam = selectedBatch === 'All' ? 'All' : selectedBatch
      const url = `/api/assignments?type=${typeParam}&batch=${encodeURIComponent(batchParam)}`
      
      const res = await fetch(url)
      const data = await res.json()
      if (!data.error) {
        setAssignments(data)
      }
    } catch (err) {
      console.error('Error fetching assignments:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAssignments()
    setCurrentPage(1)
  }, [activeTab, selectedBatch])

  // Filter local data on search query
  const searchedAssignments = assignments.filter(item => 
    item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.chapter.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.subject.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Pagination Calculations
  const totalItems = searchedAssignments.length
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedList = searchedAssignments.slice(startIndex, startIndex + itemsPerPage)

  // Handle create submit
  async function handleCreateAssignment(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle || !newChapter || !newDueDate) {
      alert('Please fill in all required fields.')
      return
    }

    setSubmitting(true)
    try {
      // Determine total student counts based on batch
      const totalStudents = newBatch.startsWith('Grade 11') ? 60 : 65

      const res = await fetch('/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          chapter: newChapter,
          batch: newBatch,
          subject: newSubject,
          type: newType,
          dueDate: newDueDate,
          dueTime: newDueTime,
          totalStudents
        })
      })

      const data = await res.json()
      if (!data.error) {
        setShowCreateModal(false)
        // Reset form
        setNewTitle('')
        setNewChapter('')
        setNewDueDate('')
        fetchAssignments()
      } else {
        alert(data.error)
      }
    } catch (err) {
      console.error(err)
      alert('Failed to create assignment.')
    } finally {
      setSubmitting(false)
    }
  }

  // Handle evaluation status update
  async function handleUpdateStatus(id: string, nextStatus: 'Evaluated' | 'Overdue Eval') {
    try {
      const res = await fetch('/api/assignments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: nextStatus })
      })
      const data = await res.json()
      if (!data.error) {
        setSelectedAssignment(data)
        // Update local list
        setAssignments(prev => prev.map(item => item._id === id ? data : item))
      }
    } catch (err) {
      console.error(err)
    }
  }

  // Handle submission count edit
  async function handleUpdateSubmissions(id: string, count: number) {
    try {
      const res = await fetch('/api/assignments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, submittedCount: count })
      })
      const data = await res.json()
      if (!data.error) {
        setSelectedAssignment(data)
        setAssignments(prev => prev.map(item => item._id === id ? data : item))
      }
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="flex-1 p-8 overflow-y-auto bg-slate-50 flex flex-col justify-between min-h-[calc(100vh-72px)]">
      
      <div>
        {/* Header Block */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Assignments & DPP</h1>
            <p className="text-[13px] text-slate-500 mt-1">
              Create and grade daily practice problems and homework.
            </p>
          </div>
          
          <button 
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-[#002045] hover:bg-[#1a365d] text-white rounded-lg text-xs font-bold shadow-md transition-all"
          >
            <Plus className="w-4 h-4" />
            New Assignment
          </button>
        </div>

        {/* Filters and Search Row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          {/* Tabs Filter */}
          <div className="bg-slate-100 p-0.5 rounded-lg flex items-center gap-0.5 border border-slate-200/50 shadow-sm w-fit">
            {(['All', 'Homework', 'DPP'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${
                  activeTab === tab 
                    ? 'bg-white text-slate-800 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Batch Filter Dropdown */}
            <div className="relative">
              <select
                value={selectedBatch}
                onChange={(e) => setSelectedBatch(e.target.value)}
                className="pl-3 pr-8 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-bold outline-none focus:border-slate-400 cursor-pointer appearance-none shadow-sm"
              >
                <option value="All">All Batches</option>
                <option value="Grade 11-A">Grade 11-A</option>
                <option value="Grade 11-B">Grade 11-B</option>
                <option value="Grade 10-A">Grade 10-A</option>
                <option value="Grade 10-B">Grade 10-B</option>
              </select>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none" />
            </div>

            {/* Local Search Input */}
            <div className="relative w-full sm:max-w-xs">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                placeholder="Search assignments..."
                className="w-full pl-9 pr-4 py-2 border border-slate-200 bg-white rounded-lg text-xs outline-none focus:border-slate-400 transition-colors shadow-sm"
              />
            </div>

            {/* Refresh Button */}
            <button 
              onClick={fetchAssignments}
              className="p-2 bg-white border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Roster Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Title</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Batch & Subject</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Type</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Due Date</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Submissions</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Status</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-16">
                      <RefreshCw className="w-6 h-6 text-slate-400 animate-spin mx-auto mb-2" />
                      <span className="text-xs font-bold text-slate-400">Loading assignments...</span>
                    </td>
                  </tr>
                ) : paginatedList.length > 0 ? (
                  paginatedList.map((item) => {
                    const submissionRate = item.totalStudents > 0 
                      ? Math.round((item.submittedCount / item.totalStudents) * 100)
                      : 0

                    return (
                      <tr key={item._id} className="hover:bg-slate-50/20 transition-colors">
                        
                        {/* Title Column */}
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-800">{item.title}</span>
                            <span className="text-[11px] text-slate-400 mt-1">{item.chapter}</span>
                          </div>
                        </td>

                        {/* Batch & Subject Column */}
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold text-slate-600">{item.batch}</span>
                            <span className="text-[11px] text-slate-400 mt-0.5">{item.subject}</span>
                          </div>
                        </td>

                        {/* Type Column */}
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold border ${
                            item.type === 'DPP'
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-100'
                              : 'bg-blue-50 text-blue-700 border-blue-100'
                          }`}>
                            {item.type}
                          </span>
                        </td>

                        {/* Due Date Column */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold">
                            {item.status === 'Overdue Eval' ? (
                              <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                            ) : (
                              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            )}
                            <span className={item.status === 'Overdue Eval' ? 'text-red-600 font-bold' : ''}>
                              {formatShortDate(item.dueDate)}, {item.dueTime}
                            </span>
                          </div>
                        </td>

                        {/* Submissions Column */}
                        <td className="px-6 py-4">
                          <div className="w-[180px]">
                            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 mb-1.5">
                              <span>{item.submittedCount}/{item.totalStudents} submitted</span>
                              <span>{submissionRate}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-500 ${
                                  submissionRate >= 95 ? 'bg-emerald-500' :
                                  submissionRate >= 80 ? 'bg-[#5850ec]' :
                                  'bg-amber-500'
                                }`}
                                style={{ width: `${submissionRate}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Status Column */}
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold border inline-flex items-center gap-1 shadow-sm ${
                            item.status === 'Active' ? 'bg-blue-50 text-blue-700 border-blue-150' :
                            item.status === 'Overdue Eval' ? 'bg-amber-50 text-amber-700 border-amber-150' :
                            'bg-emerald-50 text-emerald-700 border-emerald-150'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              item.status === 'Active' ? 'bg-blue-600 animate-pulse' :
                              item.status === 'Overdue Eval' ? 'bg-amber-500' :
                              'bg-emerald-600'
                            }`} />
                            {item.status}
                          </span>
                        </td>

                        {/* Action Column */}
                        <td className="px-6 py-4 text-center">
                          <button 
                            onClick={() => {
                              setSelectedAssignment(item)
                              setShowDetailsModal(true)
                            }}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-100 bg-white rounded-lg transition-colors inline-flex items-center justify-center shadow-sm"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>

                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="text-center py-16 text-xs font-bold text-slate-400">
                      No assignments found matching active filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination Controls */}
        <div className="bg-white p-4 border border-slate-200 shadow-sm rounded-2xl flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Showing {totalItems > 0 ? startIndex + 1 : 0}-{Math.min(startIndex + itemsPerPage, totalItems)} of {totalItems} assignments
          </span>
          <div className="flex items-center gap-1.5">
            <button 
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 bg-white hover:bg-slate-50 transition-colors disabled:opacity-50 flex items-center gap-1 shadow-sm"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Previous
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
              <button
                key={pageNum}
                onClick={() => setCurrentPage(pageNum)}
                className={`w-7 h-7 rounded-lg text-[10px] font-bold transition-all border ${
                  currentPage === pageNum 
                    ? 'bg-[#002045] border-[#002045] text-white' 
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {pageNum}
              </button>
            ))}
            <button 
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 bg-white hover:bg-slate-50 transition-colors disabled:opacity-50 flex items-center gap-1 shadow-sm"
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>

      {/* Footer copyright */}
      <div className="mt-8 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
        © 2026 EduAdmin Pro Suite • Secure Faculty Portal
      </div>

      {/* CREATE MODAL */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl p-6 shadow-xl w-full max-w-lg border border-slate-100"
            >
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Create New Assignment / DPP</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Assign practice work or exams to a batch</p>
                </div>
                <button 
                  onClick={() => setShowCreateModal(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateAssignment} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Title */}
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 pl-0.5">Title *</label>
                    <input 
                      type="text"
                      required
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="e.g. Calculus Integration DPP 04"
                      className="w-full px-3.5 py-2 border border-slate-200 bg-slate-50/50 rounded-lg text-xs outline-none focus:border-slate-400 focus:bg-white transition-colors"
                    />
                  </div>

                  {/* Chapter */}
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 pl-0.5">Chapter / Topic *</label>
                    <input 
                      type="text"
                      required
                      value={newChapter}
                      onChange={(e) => setNewChapter(e.target.value)}
                      placeholder="e.g. Chapter 5: Definite Integrals"
                      className="w-full px-3.5 py-2 border border-slate-200 bg-slate-50/50 rounded-lg text-xs outline-none focus:border-slate-400 focus:bg-white transition-colors"
                    />
                  </div>

                  {/* Batch Selection */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 pl-0.5">Batch *</label>
                    <select
                      value={newBatch}
                      onChange={(e) => setNewBatch(e.target.value)}
                      className="w-full px-3.5 py-2 border border-slate-200 bg-slate-50/50 rounded-lg text-xs outline-none focus:border-slate-400 focus:bg-white transition-colors cursor-pointer"
                    >
                      <option value="Grade 11-A">Grade 11-A</option>
                      <option value="Grade 11-B">Grade 11-B</option>
                      <option value="Grade 10-A">Grade 10-A</option>
                      <option value="Grade 10-B">Grade 10-B</option>
                    </select>
                  </div>

                  {/* Subject */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 pl-0.5">Subject *</label>
                    <select
                      value={newSubject}
                      onChange={(e) => setNewSubject(e.target.value)}
                      className="w-full px-3.5 py-2 border border-slate-200 bg-slate-50/50 rounded-lg text-xs outline-none focus:border-slate-400 focus:bg-white transition-colors cursor-pointer"
                    >
                      <option value="Mathematics">Mathematics</option>
                      <option value="Physics">Physics</option>
                      <option value="Chemistry">Chemistry</option>
                    </select>
                  </div>

                  {/* Assignment Type */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 pl-0.5">Type *</label>
                    <select
                      value={newType}
                      onChange={(e) => setNewType(e.target.value as 'Homework' | 'DPP')}
                      className="w-full px-3.5 py-2 border border-slate-200 bg-slate-50/50 rounded-lg text-xs outline-none focus:border-slate-400 focus:bg-white transition-colors cursor-pointer"
                    >
                      <option value="Homework">Homework</option>
                      <option value="DPP">DPP</option>
                    </select>
                  </div>

                  {/* Due Time */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 pl-0.5">Due Time</label>
                    <input 
                      type="text"
                      value={newDueTime}
                      onChange={(e) => setNewDueTime(e.target.value)}
                      placeholder="e.g. 11:59 PM"
                      className="w-full px-3.5 py-2 border border-slate-200 bg-slate-50/50 rounded-lg text-xs outline-none focus:border-slate-400 focus:bg-white transition-colors"
                    />
                  </div>

                  {/* Due Date */}
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 pl-0.5">Due Date *</label>
                    <input 
                      type="date"
                      required
                      value={newDueDate}
                      onChange={(e) => setNewDueDate(e.target.value)}
                      className="w-full px-3.5 py-2 border border-slate-200 bg-slate-50/50 rounded-lg text-xs outline-none focus:border-slate-400 focus:bg-white transition-colors cursor-pointer"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                  <button 
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={submitting}
                    className="flex-1 py-2 bg-[#002045] hover:bg-[#1a365d] text-white font-bold rounded-xl text-xs transition-colors shadow-md disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    Assign
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DETAILS / EVALUATE MODAL */}
      <AnimatePresence>
        {showDetailsModal && selectedAssignment && (
          <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl p-6 shadow-xl w-full max-w-md border border-slate-100"
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-base font-bold text-slate-900">{selectedAssignment.title}</h3>
                  <p className="text-xs text-slate-500 mt-1">{selectedAssignment.chapter}</p>
                </div>
                <button 
                  onClick={() => setShowDetailsModal(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 mb-6">
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs font-semibold text-slate-600">
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-0.5">Batch</span>
                    <strong className="text-slate-800">{selectedAssignment.batch}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-0.5">Subject</span>
                    <strong className="text-slate-800">{selectedAssignment.subject}</strong>
                  </div>
                  <div className="mt-2">
                    <span className="text-[10px] text-slate-400 block mb-0.5">Type</span>
                    <strong className="text-slate-800">{selectedAssignment.type}</strong>
                  </div>
                  <div className="mt-2">
                    <span className="text-[10px] text-slate-400 block mb-0.5">Due Date</span>
                    <strong className="text-slate-800">{formatShortDate(selectedAssignment.dueDate)}, {selectedAssignment.dueTime}</strong>
                  </div>
                </div>

                {/* Submissions stats modifier */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 pl-0.5">Adjust Submissions</label>
                  <div className="flex items-center gap-3">
                    <input 
                      type="number"
                      min={0}
                      max={selectedAssignment.totalStudents}
                      value={selectedAssignment.submittedCount}
                      onChange={(e) => handleUpdateSubmissions(selectedAssignment._id, Number(e.target.value))}
                      className="w-24 px-3 py-1.5 border border-slate-200 bg-white rounded-lg text-xs font-bold outline-none focus:border-slate-400 text-center"
                    />
                    <span className="text-xs text-slate-500 font-bold">/ {selectedAssignment.totalStudents} students submitted</span>
                  </div>
                </div>

                {/* Status Toggle buttons */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 pl-0.5">Evaluation Status</label>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleUpdateStatus(selectedAssignment._id, 'Overdue Eval')}
                      className={`flex-1 py-2 border rounded-xl text-xs font-bold transition-all ${
                        selectedAssignment.status === 'Overdue Eval'
                          ? 'bg-amber-500 border-amber-500 text-white shadow-sm'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      Overdue Eval
                    </button>
                    <button 
                      onClick={() => handleUpdateStatus(selectedAssignment._id, 'Evaluated')}
                      className={`flex-1 py-2 border rounded-xl text-xs font-bold transition-all ${
                        selectedAssignment.status === 'Evaluated'
                          ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      Mark Evaluated
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <button
                  onClick={async () => {
                    if (confirm('Are you sure you want to cancel and delete this assignment?')) {
                      try {
                        const res = await fetch(`/api/assignments?id=${selectedAssignment._id}`, { method: 'DELETE' })
                        const data = await res.json()
                        if (res.ok && !data.error) {
                          setShowDetailsModal(false)
                          setSelectedAssignment(null)
                          fetchAssignments()
                        } else {
                          alert(data.error || 'Failed to delete assignment. Please try again.')
                        }
                      } catch (err) {
                        console.error('Delete error:', err)
                        alert('Network error. Could not delete assignment.')
                      }
                    }
                  }}
                  className="px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                >
                  Delete Assignment
                </button>
                
                <button 
                  onClick={() => setShowDetailsModal(false)}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-colors shadow-sm"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  )
}
