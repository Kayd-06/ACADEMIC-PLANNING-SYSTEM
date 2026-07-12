'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, X, User, Phone, Briefcase, Loader2, Filter, Plus, Pencil, Trash2, Upload, Download } from 'lucide-react'
import StudentFormModal from './StudentFormModal'
import CsvUploadModal, { downloadTemplate } from './CsvUploadModal'
import StudentProfileDrawer from './StudentProfileDrawer'
import { getBlobUrl } from '@/lib/blob'

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

  // Bumped after edits so the profile drawer refetches
  const [refreshTick, setRefreshTick] = useState(0)

  useEffect(() => {
    fetchStudents()
  }, [])

  // Follow the sidebar batch switcher (localStorage + 'batchChanged' event)
  useEffect(() => {
    const applySelection = () => {
      const stored = localStorage.getItem('selectedBatch')
      setBatchFilter(stored || 'All Batches')
    }
    applySelection()
    window.addEventListener('batchChanged', applySelection)
    return () => window.removeEventListener('batchChanged', applySelection)
  }, [])

  // Follow the sidebar program switcher (localStorage + 'programChanged' event)
  // — filters the roster to that program and pre-fills the "Add Student" form.
  const [selectedProgramName, setSelectedProgramName] = useState('')
  useEffect(() => {
    const applySelection = () => {
      const stored = localStorage.getItem('selectedProgram')
      if (!stored) { setSelectedProgramName(''); return }
      try { setSelectedProgramName(JSON.parse(stored).name || '') } catch { setSelectedProgramName('') }
    }
    applySelection()
    window.addEventListener('programChanged', applySelection)
    return () => window.removeEventListener('programChanged', applySelection)
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
  const batches = ['All Batches', ...Array.from(new Set([
    ...students.map(s => s.batch).filter(Boolean),
    // Keep the sidebar-selected batch present even if it has no students yet
    ...(batchFilter !== 'All Batches' ? [batchFilter] : []),
  ]))]

  // Filter students. Program filtering matches each student's own `program`
  // field — a batch can be linked to several programs, so filtering by batch
  // alone would show students who were never enrolled in the selected program.
  const filteredStudents = students.filter(s => {
    if (classFilter !== 'All Classes' && s.rawClass !== classFilter) return false
    if (sectionFilter !== 'All Sections' && s.rawSection !== sectionFilter) return false
    if (batchFilter !== 'All Batches' && s.batch !== batchFilter) return false
    if (selectedProgramName && s.program !== selectedProgramName) return false
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
            <button onClick={downloadTemplate} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors shadow-sm">
              <Download className="w-4 h-4" /> Export Sample CSV
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
              onChange={(e) => {
                setBatchFilter(e.target.value)
                // Keep the sidebar batch switcher in sync
                if (e.target.value === 'All Batches') localStorage.removeItem('selectedBatch')
                else localStorage.setItem('selectedBatch', e.target.value)
                window.dispatchEvent(new Event('batchChanged'))
              }}
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
                          {student.profileImgUrl ? (
                            <img src={getBlobUrl(student.profileImgUrl)} alt={student.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
                          ) : (
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold ${student.color}`}>
                              {student.initials}
                            </div>
                          )}
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
            <StudentProfileDrawer
              key={`${selectedStudent._id}-${refreshTick}`}
              studentRow={selectedStudent}
              onClose={() => setSelectedStudent(null)}
              onEdit={(student) => setEditingStudent(student)}
              onDelete={handleDelete}
              showToast={showToast}
            />
          </>
        )}
      </AnimatePresence>

      {showAddModal && (
        <StudentFormModal
          mode="add"
          defaultBatch={batchFilter !== 'All Batches' ? batchFilter : ''}
          defaultProgram={selectedProgramName}
          onClose={() => setShowAddModal(false)}
          onSaved={fetchStudents}
        />
      )}

      {editingStudent && (
        <StudentFormModal
          mode="edit"
          student={editingStudent}
          onClose={() => setEditingStudent(null)}
          onSaved={() => { fetchStudents(); setRefreshTick(t => t + 1) }}
        />
      )}

      {showCsvModal && (
        <CsvUploadModal
          students={students}
          defaultBatch={batchFilter !== 'All Batches' ? batchFilter : ''}
          defaultProgram={selectedProgramName}
          onClose={() => setShowCsvModal(false)}
          onImported={fetchStudents}
        />
      )}

    </div>
  )
}
