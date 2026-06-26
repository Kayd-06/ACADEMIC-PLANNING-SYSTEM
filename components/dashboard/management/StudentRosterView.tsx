'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, X, User, Phone, Briefcase, Loader2, Filter, Plus, Pencil, Trash2, Upload } from 'lucide-react'
import StudentFormModal from './StudentFormModal'
import CsvUploadModal from './CsvUploadModal'

export default function StudentRosterView() {
  const [selectedStudent, setSelectedStudent] = useState<any>(null)
  const [students, setStudents] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Filters
  const [classFilter, setClassFilter] = useState('All Classes')
  const [sectionFilter, setSectionFilter] = useState('All Sections')
  const [batchFilter, setBatchFilter] = useState('All Batches')
  
  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Add Student modal
  const [showAddModal, setShowAddModal] = useState(false)

  // Edit/Delete
  const [editingStudent, setEditingStudent] = useState<any>(null)

  // CSV upload
  const [showCsvModal, setShowCsvModal] = useState(false)

  useEffect(() => {
    fetchStudents()
  }, [])

  const fetchStudents = async () => {
    try {
      const res = await fetch('/api/students/roster')
      if (res.ok) {
        const data = await res.json()
        // /api/students/roster intentionally returns inactive students too;
        // filter them out here so a soft-deleted student doesn't reappear on refresh.
        setStudents(data.filter((s: any) => s.isActive !== false))
      }
    } catch (error) {
      console.error('Failed to fetch students', error)
    } finally {
      setIsLoading(false)
    }
  }

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3000)
  }

  const handleDelete = async (student: any) => {
    if (!confirm(`Remove ${student.name} from the active roster?`)) return
    try {
      const res = await fetch(`/api/students?id=${student._id}`, { method: 'DELETE' })
      if (res.ok) {
        setStudents((prev) => prev.filter((s) => s._id !== student._id))
        if (selectedStudent?._id === student._id) {
          setSelectedStudent(null)
        }
        showToast(`${student.name} removed from roster`)
      } else {
        showToast('Failed to remove student')
      }
    } catch {
      showToast('Failed to remove student')
    }
  }

  // Get unique filter options
  const classes = ['All Classes', ...Array.from(new Set(students.map(s => s.rawClass).filter(Boolean)))]
  const sections = ['All Sections', ...Array.from(new Set(students.map(s => s.rawSection).filter(Boolean)))]
  const batches = ['All Batches', ...Array.from(new Set(students.map(s => s.batch).filter(Boolean)))]

  // Filter students
  const filteredStudents = students.filter(s => {
    if (classFilter !== 'All Classes' && s.rawClass !== classFilter) return false
    if (sectionFilter !== 'All Sections' && s.rawSection !== sectionFilter) return false
    if (batchFilter !== 'All Batches' && s.batch !== batchFilter) return false
    return true
  })

  return (
    <div className="flex-1 overflow-hidden bg-slate-50 relative flex h-screen">
      
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 right-6 bg-[#0b1320] text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 z-[100]"
          >
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            <span className="text-sm font-medium">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className={`flex-1 p-8 overflow-auto transition-all duration-300 ${selectedStudent ? 'mr-[450px] blur-[2px] opacity-70 pointer-events-none' : ''}`}>
        
        {/* Header */}
        <div className="mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Student Roster</h1>
            <p className="text-[13px] text-slate-500 mt-1">
              Manage student records, batches, and parent/guardian details
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 bg-[#0b1320] text-white rounded-lg text-sm font-semibold hover:bg-slate-800 transition-colors shadow-sm">
              <Plus className="w-4 h-4" /> Add Student
            </button>
            <button onClick={() => setShowCsvModal(true)} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors shadow-sm">
              <Upload className="w-4 h-4" /> Upload CSV
            </button>
            <button onClick={() => showToast('Syncing with SIS...')} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors shadow-sm">
              <Filter className="w-4 h-4" /> Sync Data
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mb-6">
          <div className="flex-1">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 pl-1">Class</label>
            <select 
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-100 transition-colors outline-none appearance-none cursor-pointer"
            >
              {classes.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 pl-1">Section</label>
            <select 
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-100 transition-colors outline-none appearance-none cursor-pointer"
            >
              {sections.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 pl-1">Batch</label>
            <select 
              value={batchFilter}
              onChange={(e) => setBatchFilter(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-100 transition-colors outline-none appearance-none cursor-pointer"
            >
              {batches.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[400px]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-[400px] text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin mb-4" />
              <p className="text-sm font-medium">Loading roster...</p>
            </div>
          ) : filteredStudents.length === 0 ? (
             <div className="flex flex-col items-center justify-center h-[400px] text-slate-400">
              <User className="w-12 h-12 mb-4 text-slate-300" />
              <p className="text-base font-bold text-slate-600 mb-1">No Students Found</p>
              <p className="text-sm font-medium">Try adjusting your filters or add students to the database.</p>
            </div>
          ) : (
            <>
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Roll No</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Student Name</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Class & Sec</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Program</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Batch</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Contact</th>
                    <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStudents.map((student) => (
                    <tr 
                      key={student._id} 
                      onClick={() => setSelectedStudent(student)}
                      className="hover:bg-indigo-50/50 transition-colors cursor-pointer group"
                    >
                      <td className="px-6 py-4 text-[13px] font-semibold text-slate-600">{student.roll}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold ${student.color}`}>
                            {student.initials}
                          </div>
                          <span className="text-[13px] font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{student.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-[13px] text-slate-700 font-medium">{student.class}</td>
                      <td className="px-6 py-4 text-[13px] text-slate-700 font-medium">{student.program}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full uppercase tracking-wider ${
                          student.batchTheme === 'blue' ? 'bg-blue-50 text-blue-700' :
                          student.batchTheme === 'green' ? 'bg-emerald-50 text-emerald-700' :
                          'bg-purple-50 text-purple-700'
                        }`}>
                          {student.batch}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-[13px] text-slate-600">{student.contact}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditingStudent(student) }}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(student) }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                <span className="text-[12px] text-slate-500 font-medium">Showing 1 to {filteredStudents.length} entries</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Side Drawer */}
      <AnimatePresence>
        {selectedStudent && (
          <>
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelectedStudent(null)}
              className="absolute inset-0 z-40 bg-slate-900/10 cursor-pointer"
            />
            
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute right-0 top-0 bottom-0 w-[450px] bg-white shadow-2xl border-l border-slate-200 z-50 flex flex-col"
            >
              
              {/* Drawer Header */}
              <div className="flex items-center justify-between p-6 border-b border-slate-100">
                <h2 className="text-lg font-bold text-slate-900">Student Profile</h2>
                <button 
                  onClick={() => setSelectedStudent(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                
                {/* Profile Identity */}
                <div className="flex flex-col items-center mb-8">
                  <div className={`w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold mb-4 shadow-sm border-4 border-white ring-2 ring-slate-100 ${selectedStudent.color}`}>
                    {selectedStudent.initials}
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-1">{selectedStudent.name}</h3>
                  <p className="text-[13px] text-slate-500 font-medium mb-4">Roll No: {selectedStudent.roll}</p>
                  
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full border ${
                      selectedStudent.batchTheme === 'blue' ? 'border-blue-200 text-blue-700 bg-blue-50/50' :
                      selectedStudent.batchTheme === 'green' ? 'border-emerald-200 text-emerald-700 bg-emerald-50/50' :
                      'border-purple-200 text-purple-700 bg-purple-50/50'
                    }`}>
                      {selectedStudent.batch} BATCH
                    </span>
                    <span className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full border border-indigo-200 text-indigo-700 bg-indigo-50/50">
                      CLASS {selectedStudent.class}
                    </span>
                  </div>
                </div>

                {/* Personal Information */}
                <div className="mb-8">
                  <h4 className="text-[13px] font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100">Personal Information</h4>
                  <div className="grid grid-cols-2 gap-y-4 gap-x-4">
                    <div>
                      <p className="text-[11px] font-semibold text-slate-500 mb-0.5">Status</p>
                      <p className="text-[13px] font-medium text-slate-900">{selectedStudent.isActive ? 'Active' : 'Inactive'}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-[11px] font-semibold text-slate-500 mb-0.5">Database ID</p>
                      <p className="text-[13px] font-mono text-slate-500">{selectedStudent._id}</p>
                    </div>
                  </div>
                </div>

                {/* Parents/Guardians */}
                <div className="mb-8">
                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                    <h4 className="text-[13px] font-bold text-slate-900">Parents / Guardians</h4>
                    <button onClick={() => showToast('Edit mode enabled')} className="text-[11px] font-semibold text-indigo-600 hover:underline">Edit</button>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 flex-shrink-0">
                          <User className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <h5 className="text-[14px] font-bold text-slate-900">Primary Contact</h5>
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest bg-white px-2 py-0.5 rounded border border-slate-200">Parent</span>
                          </div>
                          <div className="space-y-1 mt-2">
                            <p className="text-[12px] text-slate-600 flex items-center gap-2"><Phone className="w-3 h-3" /> {selectedStudent.contact}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Fee Status */}
                <div>
                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                    <h4 className="text-[13px] font-bold text-slate-900">Fee Status</h4>
                    <button onClick={() => showToast('Opening Ledger...')} className="text-[11px] font-semibold text-indigo-600 hover:underline">View Ledger →</button>
                  </div>
                </div>

              </div>

              {/* Drawer Footer Actions */}
              <div className="p-6 border-t border-slate-100 bg-white grid grid-cols-3 gap-3">
                <button onClick={() => setEditingStudent(selectedStudent)} className="py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-bold rounded-lg hover:bg-slate-50 transition-colors shadow-sm">
                  Edit Profile
                </button>
                <button onClick={() => handleDelete(selectedStudent)} className="py-2.5 bg-white border border-rose-200 text-rose-600 text-sm font-bold rounded-lg hover:bg-rose-50 transition-colors shadow-sm">
                  Remove
                </button>
                <button onClick={() => showToast(`Drafting message to ${selectedStudent.contact}`)} className="py-2.5 bg-[#0b1320] text-white text-sm font-bold rounded-lg hover:bg-slate-800 transition-colors shadow-sm">
                  Message Parent
                </button>
              </div>

            </motion.div>
          </>
        )}
      </AnimatePresence>

      {showAddModal && (
        <StudentFormModal mode="add" onClose={() => setShowAddModal(false)} onSaved={fetchStudents} />
      )}

      {editingStudent && (
        <StudentFormModal
          mode="edit"
          student={editingStudent}
          onClose={() => setEditingStudent(null)}
          onSaved={fetchStudents}
        />
      )}

      {showCsvModal && (
        <CsvUploadModal
          students={students}
          onClose={() => setShowCsvModal(false)}
          onImported={fetchStudents}
        />
      )}

    </div>
  )
}
