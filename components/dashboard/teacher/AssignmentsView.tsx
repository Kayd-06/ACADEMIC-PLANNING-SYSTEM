'use client'

import { useState, useEffect, useRef } from 'react'
import { useAlert } from '@/components/dashboard/AlertProvider'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Calendar,
  AlertTriangle,
  Eye,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  X,
  RefreshCw,
  CheckCircle,
  FileText,
  Paperclip,
  ExternalLink,
  Loader2,
  BookOpen,
  Download,
  Filter,
  Pencil,
  Trash2,
  Check,
  Award,
  Lock,
  Globe,
  Video,
  GraduationCap,
  Sparkles,
  ClipboardList
} from 'lucide-react'

// Animation variants
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, type: 'spring' as const, stiffness: 320, damping: 28 },
})

// Helper to format due date into human readable form (e.g., 24 Oct 2026)
function formatShortDate(dateStr: string) {
  return formatDate(dateStr) || '—'
}

import { getBlobUrl } from '@/lib/blob'
import { formatDate } from '@/lib/date'

// Helper to get initials
function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

interface AssignmentsViewProps {
  initialTab?: 'assignments' | 'materials' | 'grading'
}

export default function AssignmentsView({ initialTab = 'assignments' }: AssignmentsViewProps) {
  const { showAlert } = useAlert()
  
  // UI Tabs State
  const [activeTab, setActiveTab] = useState<'assignments' | 'materials' | 'grading'>(initialTab)

  // Database / Seeding data states
  const [assignments, setAssignments] = useState<any[]>([])
  const [materials, setMaterials] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [submissions, setSubmissions] = useState<any[]>([])
  
  // Dynamic filter options
  const [batches, setBatches] = useState<string[]>([])
  const [subjects, setSubjects] = useState<string[]>([])

  // Loading and Submitting states
  const [loadingAssignments, setLoadingAssignments] = useState(true)
  const [loadingMaterials, setLoadingMaterials] = useState(true)
  const [loadingSubmissions, setLoadingSubmissions] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Filters State
  const [assignmentTypeFilter, setAssignmentTypeFilter] = useState<string>('All')
  const [assignmentBatchFilter, setAssignmentBatchFilter] = useState<string>('All')
  const [assignmentSearch, setAssignmentSearch] = useState<string>('')
  
  const [materialTypeFilter, setMaterialTypeFilter] = useState<string>('All')
  const [materialBatchFilter, setMaterialBatchFilter] = useState<string>('All')
  const [materialSearch, setMaterialSearch] = useState<string>('')

  const [selectedGradingAssignmentId, setSelectedGradingAssignmentId] = useState<string>('')
  const [gradingSearch, setGradingSearch] = useState<string>('')

  // Modals States
  const [showCreateAssignmentModal, setShowCreateAssignmentModal] = useState(false)
  const [showUploadMaterialModal, setShowUploadMaterialModal] = useState(false)
  const [showEditMaterialModal, setShowEditMaterialModal] = useState(false)
  const [selectedMaterial, setSelectedMaterial] = useState<any | null>(null)
  const [previewFile, setPreviewFile] = useState<{ title: string; url: string } | null>(null)

  // Create Assignment Form Fields
  const [newAsgTitle, setNewAsgTitle] = useState('')
  const [newAsgDescription, setNewAsgDescription] = useState('')
  const [newAsgChapter, setNewAsgChapter] = useState('')
  const [newAsgBatch, setNewAsgBatch] = useState('')
  const [newAsgSubject, setNewAsgSubject] = useState('')
  const [newAsgType, setNewAsgType] = useState<string>('Homework')
  const [newAsgDueDate, setNewAsgDueDate] = useState('')
  const [newAsgDueTime, setNewAsgDueTime] = useState('11:59 PM')
  const [newAsgTotalMarks, setNewAsgTotalMarks] = useState('100')
  const [newAsgFile, setNewAsgFile] = useState<File | null>(null)
  
  // Upload Material Form Fields
  const [newMatTitle, setNewMatTitle] = useState('')
  const [newMatDescription, setNewMatDescription] = useState('')
  const [newMatProvider, setNewMatProvider] = useState('')
  const [newMatSubject, setNewMatSubject] = useState('')
  const [newMatChapter, setNewMatChapter] = useState('')
  const [newMatProgram, setNewMatProgram] = useState('')
  const [newMatBatch, setNewMatBatch] = useState('')
  const [newMatType, setNewMatType] = useState('PDF')
  const [newMatIsPublic, setNewMatIsPublic] = useState(true)
  const [newMatFile, setNewMatFile] = useState<File | null>(null)

  // Edit Material Form Fields
  const [editMatTitle, setEditMatTitle] = useState('')
  const [editMatDescription, setEditMatDescription] = useState('')
  const [editMatProvider, setEditMatProvider] = useState('')
  const [editMatSubject, setEditMatSubject] = useState('')
  const [editMatChapter, setEditMatChapter] = useState('')
  const [editMatProgram, setEditMatProgram] = useState('')
  const [editMatBatch, setEditMatBatch] = useState('')
  const [editMatType, setEditMatType] = useState('PDF')
  const [editMatIsPublic, setEditMatIsPublic] = useState(true)

  // Grading Form states
  const [gradingMarks, setGradingMarks] = useState<Record<string, string>>({})
  const [gradingFeedback, setGradingFeedback] = useState<Record<string, string>>({})
  const [savingGradeId, setSavingGradeId] = useState<string | null>(null)

  const asgFileRef = useRef<HTMLInputElement>(null)
  const matFileRef = useRef<HTMLInputElement>(null)

  // Custom Delete Confirmation State
  const [asgToDelete, setAsgToDelete] = useState<string | null>(null)

  // Edit Assignment Form Fields
  const [showEditAssignmentModal, setShowEditAssignmentModal] = useState(false)
  const [selectedAssignment, setSelectedAssignment] = useState<any | null>(null)
  const [editAsgTitle, setEditAsgTitle] = useState('')
  const [editAsgDescription, setEditAsgDescription] = useState('')
  const [editAsgChapter, setEditAsgChapter] = useState('')
  const [editAsgBatch, setEditAsgBatch] = useState('')
  const [editAsgSubject, setEditAsgSubject] = useState('')
  const [editAsgType, setEditAsgType] = useState('Homework')
  const [editAsgDueDate, setEditAsgDueDate] = useState('')
  const [editAsgDueTime, setEditAsgDueTime] = useState('11:59 PM')
  const [editAsgTotalMarks, setEditAsgTotalMarks] = useState('100')
  const [editAsgFile, setEditAsgFile] = useState<File | null>(null)
  const editAsgFileRef = useRef<HTMLInputElement>(null)

  // --- Fetch Actions ---

  // Fetch student roster to extract dynamic batches & subjects
  async function fetchRoster() {
    try {
      const [rosterRes, assignmentsRes] = await Promise.all([
        fetch('/api/students/roster'),
        fetch('/api/teacher/my-assignments').catch(() => null)
      ])
      const data = await rosterRes.json()
      let assignedBatches: string[] = []
      if (assignmentsRes && assignmentsRes.ok) {
        try {
          const assignmentsData = await assignmentsRes.json()
          if (Array.isArray(assignmentsData.batches)) {
            assignedBatches = assignmentsData.batches
          }
        } catch (e) {
          console.error('Error parsing teacher assignments:', e)
        }
      }

      if (Array.isArray(data)) {
        setStudents(data)
        
        // Fetch real batches from PUT /api/daily-report
        let uniqueBatches: string[] = []
        try {
          const bRes = await fetch('/api/daily-report', { method: 'PUT' })
          const bData = await bRes.json()
          if (Array.isArray(bData)) {
            uniqueBatches = bData
          }
        } catch (e) {
          console.error('Failed to fetch batches from API:', e)
        }

        const rosterBatches = data.map((s: any) => s.batch).filter(Boolean)
        uniqueBatches = Array.from(new Set([...uniqueBatches, ...rosterBatches, ...assignedBatches])) as string[]
        
        if (uniqueBatches.length === 0) {
          uniqueBatches = ['Batch 1']
        }
        uniqueBatches.sort()
        setBatches(uniqueBatches)
        if (uniqueBatches.length > 0) {
          setNewAsgBatch(uniqueBatches[0])
          setNewMatBatch(uniqueBatches[0])
        }

        // Extrapolate subjects from program or assign standard ones
        const standardSubjects = ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English', 'Computer Science']
        setSubjects(standardSubjects)
        setNewAsgSubject(standardSubjects[0])
        setNewMatSubject(standardSubjects[0])
      }
    } catch (err) {
      console.error('Error fetching roster:', err)
    }
  }


  // Fetch Assignments from Neon
  async function fetchAssignments() {
    setLoadingAssignments(true)
    try {
      const res = await fetch('/api/assignments')
      const data = await res.json()
      if (Array.isArray(data)) {
        setAssignments(data)
      }
    } catch (err) {
      console.error('Error fetching assignments:', err)
    } finally {
      setLoadingAssignments(false)
    }
  }

  // Fetch Study Materials from Neon
  async function fetchMaterials() {
    setLoadingMaterials(true)
    try {
      const res = await fetch('/api/teacher-portal/materials')
      const data = await res.json()
      if (Array.isArray(data)) {
        setMaterials(data)
      }
    } catch (err) {
      console.error('Error fetching materials:', err)
    } finally {
      setLoadingMaterials(false)
    }
  }

  // Fetch Submissions for active assignment
  async function fetchSubmissions(assignmentId: string) {
    if (!assignmentId) return
    setLoadingSubmissions(true)
    try {
      const res = await fetch(`/api/assignments/submissions?assignmentId=${assignmentId}`)
      const data = await res.json()
      if (Array.isArray(data)) {
        setSubmissions(data)
        
        // Pre-fill grading input states
        const marksInit: Record<string, string> = {}
        const feedbackInit: Record<string, string> = {}
        data.forEach((sub: any) => {
          marksInit[sub.studentId] = sub.marksObtained !== null ? String(sub.marksObtained) : ''
          feedbackInit[sub.studentId] = sub.feedback || ''
        })
        setGradingMarks(marksInit)
        setGradingFeedback(feedbackInit)
      }
    } catch (err) {
      console.error('Error fetching submissions:', err)
    } finally {
      setLoadingSubmissions(false)
    }
  }

  useEffect(() => {
    fetchRoster()
    fetchAssignments()
    fetchMaterials()
  }, [])

  useEffect(() => {
    if (selectedGradingAssignmentId) {
      fetchSubmissions(selectedGradingAssignmentId)
    } else {
      setSubmissions([])
    }
  }, [selectedGradingAssignmentId])

  // --- CRUD Event Handlers ---

  // Create Assignment
  async function handleCreateAssignment(e: React.FormEvent) {
    e.preventDefault()
    if (!newAsgTitle || !newAsgChapter || !newAsgDueDate || !newAsgBatch || !newAsgSubject || !newAsgType) {
      showAlert({ title: 'Validation Error', message: 'Please fill in all required fields.', type: 'warning' })
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        title: newAsgTitle,
        description: newAsgDescription,
        chapter: newAsgChapter,
        batch: newAsgBatch,
        subject: newAsgSubject,
        type: newAsgType,
        dueDate: newAsgDueDate,
        dueTime: newAsgDueTime,
        totalMarks: Number(newAsgTotalMarks) || 100,
        totalStudents: students.filter((s: any) => s.batch === newAsgBatch).length || 40
      }

      const res = await fetch('/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json()

      if (res.ok && data.id) {
        // If file exists, upload it now
        if (newAsgFile) {
          const fd = new FormData()
          fd.append('file', newAsgFile)
          const uploadRes = await fetch(`/api/assignments/upload?id=${data.id}`, {
            method: 'POST',
            body: fd
          })
          if (!uploadRes.ok) {
            showAlert({ title: 'Upload Error', message: 'Assignment created, but question paper failed to upload.', type: 'warning' })
          }
        }

        showAlert({ title: 'Success', message: 'Assignment assigned successfully!', type: 'success' })
        
        // Reset fields
        setNewAsgTitle('')
        setNewAsgDescription('')
        setNewAsgChapter('')
        setNewAsgDueDate('')
        setNewAsgFile(null)
        setShowCreateAssignmentModal(false)
        fetchAssignments()
      } else {
        showAlert({ title: 'Error', message: data.error || 'Failed to create assignment.', type: 'warning' })
      }
    } catch (err) {
      console.error(err)
      showAlert({ title: 'Network Error', message: 'Failed to connect to assignments endpoint.', type: 'warning' })
    } finally {
      setSubmitting(false)
    }
  }

  // Delete Assignment
  async function handleDeleteAssignment(id: string) {
    try {
      const res = await fetch(`/api/assignments?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        showAlert({ title: 'Success', message: 'Assignment deleted successfully.', type: 'success' })
        fetchAssignments()
        if (selectedGradingAssignmentId === id) {
          setSelectedGradingAssignmentId('')
        }
      } else {
        const data = await res.json()
        showAlert({ title: 'Error', message: data.error || 'Failed to delete assignment.', type: 'warning' })
      }
    } catch (err) {
      console.error(err)
    }
  }

  // Open Edit Assignment Modal
  function handleOpenEditAssignment(asg: any) {
    setSelectedAssignment(asg)
    setEditAsgTitle(asg.title || '')
    setEditAsgDescription(asg.description || '')
    setEditAsgChapter(asg.chapter || '')
    setEditAsgBatch(asg.batch || '')
    setEditAsgSubject(asg.subject || '')
    setEditAsgType(asg.type || 'Homework')
    setEditAsgDueDate(asg.dueDate || '')
    setEditAsgDueTime(asg.dueTime || '11:59 PM')
    setEditAsgTotalMarks(String(asg.totalMarks || 100))
    setEditAsgFile(null)
    setShowEditAssignmentModal(true)
  }

  // Submit Edit Assignment
  async function handleEditAssignment(e: React.FormEvent) {
    e.preventDefault()
    if (!editAsgTitle || !editAsgChapter || !editAsgBatch || !editAsgSubject || !editAsgType || !editAsgDueDate) {
      showAlert({ title: 'Validation Error', message: 'Please fill in all required fields.', type: 'warning' })
      return
    }

    setSubmitting(true)
    try {
      let fileUrl = selectedAssignment.fileUrl || ''
      if (editAsgFile) {
        const uploadFormData = new FormData()
        uploadFormData.append('file', editAsgFile)
        const uploadRes = await fetch('/api/assignments/upload', {
          method: 'POST',
          body: uploadFormData
        })
        const uploadData = await uploadRes.json()
        if (uploadRes.ok && uploadData.fileUrl) {
          fileUrl = uploadData.fileUrl
        }
      }

      const payload = {
        id: selectedAssignment.id,
        title: editAsgTitle,
        description: editAsgDescription,
        chapter: editAsgChapter,
        batch: editAsgBatch,
        subject: editAsgSubject,
        type: editAsgType,
        dueDate: editAsgDueDate,
        dueTime: editAsgDueTime,
        totalMarks: Number(editAsgTotalMarks) || 100,
        fileUrl
      }

      const res = await fetch('/api/assignments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json()

      if (res.ok) {
        showAlert({ title: 'Success', message: 'Assignment updated successfully.', type: 'success' })
        setShowEditAssignmentModal(false)
        fetchAssignments()
      } else {
        showAlert({ title: 'Error', message: data.error || 'Failed to update assignment.', type: 'warning' })
      }
    } catch (err) {
      console.error(err)
      showAlert({ title: 'Network Error', message: 'Failed to connect to assignments endpoint.', type: 'warning' })
    } finally {
      setSubmitting(false)
    }
  }

  // Upload Study Material
  async function handleUploadMaterial(e: React.FormEvent) {
    e.preventDefault()
    if (!newMatTitle || !newMatProvider || !newMatFile) {
      showAlert({ title: 'Validation Error', message: 'Title, Provider, and File are required.', type: 'warning' })
      return
    }

    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('title', newMatTitle)
      fd.append('description', newMatDescription)
      fd.append('provider', newMatProvider)
      fd.append('subject', newMatSubject)
      fd.append('chapterId', newMatChapter)
      fd.append('programId', newMatProgram)
      fd.append('batchId', newMatBatch)
      fd.append('type', newMatType)
      fd.append('isPublic', String(newMatIsPublic))
      fd.append('file', newMatFile)
      fd.append('fileName', newMatFile.name)

      const res = await fetch('/api/teacher-portal/materials', {
        method: 'POST',
        body: fd
      })

      if (res.ok) {
        showAlert({ title: 'Success', message: 'Study material uploaded successfully!', type: 'success' })
        
        // Reset
        setNewMatTitle('')
        setNewMatDescription('')
        setNewMatProvider('')
        setNewMatChapter('')
        setNewMatProgram('')
        setNewMatFile(null)
        setShowUploadMaterialModal(false)
        fetchMaterials()
      } else {
        const errData = await res.json()
        showAlert({ title: 'Error', message: errData.error || 'Failed to upload material.', type: 'warning' })
      }
    } catch (err) {
      console.error(err)
      showAlert({ title: 'Network Error', message: 'Failed to upload file.', type: 'warning' })
    } finally {
      setSubmitting(false)
    }
  }

  // Edit Study Material
  function handleOpenEditMaterial(mat: any) {
    setSelectedMaterial(mat)
    setEditMatTitle(mat.title || mat.fileName || '')
    setEditMatDescription(mat.description || '')
    setEditMatProvider(mat.provider || '')
    setEditMatSubject(mat.subject || '')
    setEditMatChapter(mat.chapterId || '')
    setEditMatProgram(mat.programId || '')
    setEditMatBatch(mat.batchId || '')
    setEditMatType(mat.type || 'PDF')
    setEditMatIsPublic(mat.isPublic !== false)
    setShowEditMaterialModal(true)
  }

  async function handleSaveEditMaterial(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedMaterial) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/teacher-portal/materials', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedMaterial.id,
          title: editMatTitle,
          description: editMatDescription,
          provider: editMatProvider,
          subject: editMatSubject,
          chapterId: editMatChapter,
          programId: editMatProgram,
          batchId: editMatBatch,
          type: editMatType,
          isPublic: editMatIsPublic
        })
      })

      if (res.ok) {
        showAlert({ title: 'Success', message: 'Study material updated successfully.', type: 'success' })
        setShowEditMaterialModal(false)
        setSelectedMaterial(null)
        fetchMaterials()
      } else {
        showAlert({ title: 'Error', message: 'Failed to update study material.', type: 'warning' })
      }
    } catch (err) {
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  // Delete Study Material
  async function handleDeleteMaterial(id: string) {
    if (!confirm('Are you sure you want to delete this study material permanently?')) return
    try {
      const res = await fetch(`/api/teacher-portal/materials?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        showAlert({ title: 'Success', message: 'Study material deleted successfully.', type: 'success' })
        fetchMaterials()
      } else {
        showAlert({ title: 'Error', message: 'Failed to delete study material.', type: 'warning' })
      }
    } catch (err) {
      console.error(err)
    }
  }

  // Save Submission Grade
  async function handleSaveGrade(studentId: string, assignment: any) {
    const marks = gradingMarks[studentId]
    const feedback = gradingFeedback[studentId] || ''

    if (!marks || isNaN(Number(marks))) {
      showAlert({ title: 'Validation Error', message: 'Please enter a valid numerical score.', type: 'warning' })
      return
    }

    if (Number(marks) < 0 || Number(marks) > assignment.totalMarks) {
      showAlert({ title: 'Validation Error', message: `Marks obtained must be between 0 and ${assignment.totalMarks}.`, type: 'warning' })
      return
    }

    setSavingGradeId(studentId)
    try {
      const res = await fetch('/api/assignments/submissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignmentId: assignment.id,
          studentId,
          marksObtained: Number(marks),
          feedback
        })
      })

      if (res.ok) {
        // Fetch submissions again to update state
        await fetchSubmissions(assignment.id)
        // Update local assignment submission count
        fetchAssignments()
      } else {
        showAlert({ title: 'Error', message: 'Failed to save grade.', type: 'warning' })
      }
    } catch (err) {
      console.error(err)
    } finally {
      setSavingGradeId(null)
    }
  }

  // Helper: Get Icon depending on type
  function getMaterialIcon(type: string) {
    switch (type?.toLowerCase()) {
      case 'video':
      case 'video lectures':
        return <Video className="w-5 h-5 text-rose-500" />
      case 'pdf':
      case 'pdfs':
        return <FileText className="w-5 h-5 text-indigo-500" />
      default:
        return <BookOpen className="w-5 h-5 text-emerald-500" />
    }
  }

  // --- Filtering Calculations ---

  const filteredAssignments = assignments.filter((asg) => {
    if (assignmentTypeFilter !== 'All' && asg.type !== assignmentTypeFilter) return false
    if (assignmentBatchFilter !== 'All' && asg.batch !== assignmentBatchFilter) return false
    if (assignmentSearch.trim()) {
      const query = assignmentSearch.toLowerCase()
      return (
        asg.title.toLowerCase().includes(query) ||
        asg.chapter.toLowerCase().includes(query) ||
        asg.subject.toLowerCase().includes(query)
      )
    }
    return true
  })

  const filteredMaterials = materials.filter((mat) => {
    if (materialTypeFilter !== 'All' && mat.type !== materialTypeFilter) return false
    if (materialBatchFilter !== 'All' && mat.batchId !== materialBatchFilter) return false
    if (materialSearch.trim()) {
      const query = materialSearch.toLowerCase()
      const title = (mat.title || mat.fileName || '').toLowerCase()
      const desc = (mat.description || '').toLowerCase()
      const subj = (mat.subject || '').toLowerCase()
      const provider = (mat.provider || '').toLowerCase()
      return title.includes(query) || desc.includes(query) || subj.includes(query) || provider.includes(query)
    }
    return true
  })

  const filteredSubmissions = submissions.filter((sub) => {
    if (gradingSearch.trim()) {
      const query = gradingSearch.toLowerCase()
      return (
        sub.studentName.toLowerCase().includes(query) ||
        (sub.rollNo && sub.rollNo.toLowerCase().includes(query))
      )
    }
    return true
  })

  const selectedGradingAssignment = assignments.find((a) => a.id === selectedGradingAssignmentId)

  return (
    <div className="flex-1 p-6 overflow-auto bg-slate-50/50 flex flex-col min-h-[calc(100vh-72px)]">
      
      {/* Premium Header */}
      <motion.div {...fadeUp(0)} className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
              <Sparkles className="w-4 h-4" />
            </span>
            <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest">Academic Workspace</span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Study Materials & Assignments</h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Build and assign repository resources, assign tasks, and grade submissions in real-time.
          </p>
        </div>

        {/* Dynamic primary Action Buttons */}
        <div className="flex items-center gap-3">
          {activeTab === 'assignments' && (
            <button
              onClick={() => setShowCreateAssignmentModal(true)}
              className="inline-flex items-center gap-2 bg-[#002045] hover:bg-[#1a365d] text-white font-semibold px-4.5 py-2.5 rounded-xl text-sm transition shadow-sm border-none cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              New Assignment
            </button>
          )}

          {activeTab === 'materials' && (
            <button
              onClick={() => setShowUploadMaterialModal(true)}
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4.5 py-2.5 rounded-xl text-sm transition shadow-sm border-none cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Upload Material
            </button>
          )}
        </div>
      </motion.div>

      {/* Navigation Tabs */}
      <motion.div {...fadeUp(0.05)} className="flex items-center gap-2 border-b border-slate-200 mb-6 shrink-0">
        <button
          onClick={() => setActiveTab('assignments')}
          className={`px-5 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer relative ${
            activeTab === 'assignments'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4" />
            Assignments
            {assignments.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-indigo-55 text-indigo-600 text-[10px] font-bold">
                {assignments.length}
              </span>
            )}
          </div>
        </button>

        <button
          onClick={() => setActiveTab('materials')}
          className={`px-5 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer relative ${
            activeTab === 'materials'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            Study Materials
            {materials.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold">
                {materials.length}
              </span>
            )}
          </div>
        </button>

        <button
          onClick={() => setActiveTab('grading')}
          className={`px-5 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer relative ${
            activeTab === 'grading'
              ? 'border-amber-500 text-amber-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <GraduationCap className="w-4.5 h-4.5" />
            Grading & Submissions
          </div>
        </button>
      </motion.div>

      {/* --- TAB CONTENT AREA --- */}
      <div className="flex-1">

        {/* 1. ASSIGNMENTS TAB */}
        {activeTab === 'assignments' && (
          <motion.div {...fadeUp(0.1)} className="space-y-6">
            
            {/* Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
                  <Filter className="w-3.5 h-3.5" /> Filter by:
                </div>
                <select
                  value={assignmentBatchFilter}
                  onChange={(e) => setAssignmentBatchFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold focus:outline-none cursor-pointer"
                >
                  <option value="All">All Batches</option>
                  {batches.map(b => <option key={b} value={b}>{b}</option>)}
                </select>

                <select
                  value={assignmentTypeFilter}
                  onChange={(e) => setAssignmentTypeFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold focus:outline-none cursor-pointer"
                >
                  <option value="All">All Types</option>
                  <option value="Homework">Homework</option>
                  <option value="DPP">DPP</option>
                  <option value="Worksheet">Worksheet</option>
                  <option value="Project">Project</option>
                  <option value="Revision">Revision</option>
                </select>
              </div>

              {/* Search Bar */}
              <div className="relative min-w-[280px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search assignments..."
                  value={assignmentSearch}
                  onChange={(e) => setAssignmentSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 bg-slate-50/50 rounded-xl text-xs outline-none focus:bg-white focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>

            {/* Assignments Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              {loadingAssignments ? (
                <div className="py-20 text-center">
                  <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-3" />
                  <p className="text-sm font-bold text-slate-400">Loading assignments from Neon...</p>
                </div>
              ) : filteredAssignments.length === 0 ? (
                <div className="py-20 text-center text-slate-400 italic text-sm">
                  <AlertTriangle className="w-8 h-8 text-slate-350 mx-auto mb-3" />
                  No assignments found. Make sure to assign homework or DPPs.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-55/40 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        <th className="px-6 py-4">Title & Topic</th>
                        <th className="px-6 py-4">Batch & Subject</th>
                        <th className="px-6 py-4">Type</th>
                        <th className="px-6 py-4">Due Date</th>
                        <th className="px-6 py-4">Total Marks</th>
                        <th className="px-6 py-4">Submissions Rate</th>
                        <th className="px-6 py-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-650">
                      {filteredAssignments.map((asg) => {
                        const submissionRate = asg.totalStudents > 0 ? Math.round((asg.submittedCount / asg.totalStudents) * 100) : 0
                        return (
                          <tr key={asg.id} className="hover:bg-slate-50/20 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-800 text-sm">{asg.title}</span>
                                <span className="text-[11px] text-slate-450 mt-0.5">{asg.chapter}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col">
                                <span>{asg.batch}</span>
                                <span className="text-[11px] text-slate-400 mt-0.5">{asg.subject}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="px-2.5 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-bold rounded-lg uppercase tracking-wider">
                                {asg.type}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                {formatShortDate(asg.dueDate)}, {asg.dueTime}
                              </span>
                            </td>
                            <td className="px-6 py-4 font-bold text-slate-800">
                              {asg.totalMarks} pts
                            </td>
                            <td className="px-6 py-4">
                              <div className="w-[180px]">
                                <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 mb-1">
                                  <span>{asg.submittedCount} / {asg.totalStudents} graded</span>
                                  <span>{submissionRate}%</span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-indigo-650 rounded-full"
                                    style={{ width: `${submissionRate}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => {
                                    setSelectedGradingAssignmentId(asg.id)
                                    setActiveTab('grading')
                                  }}
                                  title="Grade student work"
                                  className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg border-none cursor-pointer flex items-center gap-1 transition-colors"
                                >
                                  <GraduationCap className="w-3.5 h-3.5" /> Grade
                                </button>
                                {asg.fileUrl && (
                                  <button
                                    onClick={() => setPreviewFile({ title: asg.title, url: getBlobUrl(asg.fileUrl) })}
                                    title="View question paper"
                                    className="p-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 rounded-lg cursor-pointer transition-colors"
                                  >
                                    <FileText className="w-4 h-4" />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleOpenEditAssignment(asg)}
                                  title="Edit assignment"
                                  className="p-1.5 border border-slate-200 hover:border-indigo-100 hover:bg-indigo-50 text-slate-400 hover:text-indigo-650 rounded-lg cursor-pointer transition-colors"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setAsgToDelete(asg.id)}
                                  title="Delete assignment"
                                  className="p-1.5 border border-slate-200 hover:border-red-100 hover:bg-red-50 text-slate-400 hover:text-red-650 rounded-lg cursor-pointer transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* 2. STUDY MATERIALS TAB */}
        {activeTab === 'materials' && (
          <motion.div {...fadeUp(0.1)} className="space-y-6">
            
            {/* Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
                  <Filter className="w-3.5 h-3.5" /> Filter by:
                </div>
                <select
                  value={materialBatchFilter}
                  onChange={(e) => setMaterialBatchFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold focus:outline-none cursor-pointer"
                >
                  <option value="All">All Batches</option>
                  {batches.map(b => <option key={b} value={b}>{b}</option>)}
                </select>

                <select
                  value={materialTypeFilter}
                  onChange={(e) => setMaterialTypeFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold focus:outline-none cursor-pointer"
                >
                  <option value="All">All Types</option>
                  <option value="Notes">Notes</option>
                  <option value="PDF">PDF</option>
                  <option value="Video">Video</option>
                  <option value="Practice Sheet">Practice Sheet</option>
                  <option value="DPP">DPP</option>
                  <option value="Reference">Reference</option>
                  <option value="Answer Key">Answer Key</option>
                </select>
              </div>

              {/* Search Bar */}
              <div className="relative min-w-[280px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search materials..."
                  value={materialSearch}
                  onChange={(e) => setMaterialSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 bg-slate-50/50 rounded-xl text-xs outline-none focus:bg-white focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>

            {/* Grid of Study Materials */}
            {loadingMaterials ? (
              <div className="py-20 text-center bg-white rounded-2xl border border-slate-200 shadow-sm">
                <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-400">Loading materials from Neon...</p>
              </div>
            ) : filteredMaterials.length === 0 ? (
              <div className="py-20 text-center bg-white rounded-2xl border border-slate-200 shadow-sm text-slate-400 italic text-sm">
                <AlertTriangle className="w-8 h-8 text-slate-350 mx-auto mb-3" />
                No study materials found. Upload resource notes or answer keys.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredMaterials.map((mat) => (
                  <div
                    key={mat.id}
                    className="p-5 bg-white border border-slate-200 rounded-2xl hover:shadow-md hover:border-emerald-250 transition-all flex flex-col justify-between"
                  >
                    <div>
                      {/* Top strip */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-100 text-emerald-700 text-[9px] font-bold uppercase tracking-wider rounded">
                          {mat.type}
                        </span>
                        
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleOpenEditMaterial(mat)}
                            className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-lg cursor-pointer border-none bg-transparent"
                            title="Edit study material"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteMaterial(mat.id)}
                            className="p-1 text-slate-400 hover:text-red-650 hover:bg-slate-50 rounded-lg cursor-pointer border-none bg-transparent"
                            title="Delete material"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Info */}
                      <div className="flex items-start gap-3 mb-4">
                        <div className="w-10 h-10 bg-slate-100/80 rounded-xl flex items-center justify-center shrink-0">
                          {getMaterialIcon(mat.type)}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-extrabold text-slate-800 text-base leading-tight truncate">
                            {mat.title || mat.fileName}
                          </h3>
                          <p className="text-xs font-semibold text-slate-400 mt-0.5">{mat.provider}</p>
                        </div>
                      </div>

                      {/* Description */}
                      {mat.description && (
                        <p className="text-xs text-slate-500 mb-4 line-clamp-2 leading-relaxed">
                          {mat.description}
                        </p>
                      )}

                      {/* Meta Tags */}
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {mat.batchId && (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-650 text-[10px] font-bold rounded">
                            Batch: {mat.batchId}
                          </span>
                        )}
                        {mat.subject && (
                          <span className="px-2 py-0.5 bg-indigo-50/50 text-indigo-650 text-[10px] font-bold rounded">
                            {mat.subject}
                          </span>
                        )}
                        {mat.chapterId && (
                          <span className="px-2 py-0.5 bg-amber-50 text-amber-750 text-[10px] font-bold rounded">
                            {mat.chapterId}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Footer / File Link */}
                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                      <div className="text-[10px] text-slate-400 font-semibold">
                        {mat.fileSize ? `${mat.fileSize} KB` : '—'} • {formatDate(mat.createdAt)}
                      </div>

                      {mat.fileUrl ? (
                        <a
                          href={getBlobUrl(mat.fileUrl)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 bg-slate-150 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border-none"
                        >
                          <Download className="w-3.5 h-3.5" /> Download
                        </a>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">No document</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* 3. GRADING & SUBMISSIONS TAB */}
        {activeTab === 'grading' && (
          <motion.div {...fadeUp(0.1)} className="space-y-6">
            
            {/* Control Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="flex items-center gap-3">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Select Assignment:</label>
                <select
                  value={selectedGradingAssignmentId}
                  onChange={(e) => setSelectedGradingAssignmentId(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold focus:outline-none cursor-pointer min-w-[260px]"
                >
                  <option value="">-- Choose an Assignment --</option>
                  {assignments.map(a => (
                    <option key={a.id} value={a.id}>{a.title} ({a.batch})</option>
                  ))}
                </select>
              </div>

              {selectedGradingAssignmentId && (
                <div className="relative min-w-[280px]">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search students..."
                    value={gradingSearch}
                    onChange={(e) => setGradingSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-200 bg-slate-50/50 rounded-xl text-xs outline-none focus:bg-white focus:border-indigo-500 transition-colors"
                  />
                </div>
              )}
            </div>

            {/* Submissions & Grading Sheet */}
            {!selectedGradingAssignmentId ? (
              <div className="py-20 text-center bg-white rounded-2xl border border-slate-200 shadow-sm text-slate-400 font-medium">
                <GraduationCap className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                Select an assignment from the dropdown above to view and grade student submissions.
              </div>
            ) : (
              <div className="space-y-6">
                
                {/* Selected Assignment summary details card */}
                <div className="bg-[#002045]/5 border border-[#002045]/10 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{selectedGradingAssignment?.title}</h3>
                    <p className="text-xs text-slate-550 mt-1">Topic: {selectedGradingAssignment?.chapter}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-6 text-xs text-slate-600 font-semibold">
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">Batch</span>
                      <strong className="text-slate-800">{selectedGradingAssignment?.batch}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">Subject</span>
                      <strong className="text-slate-800">{selectedGradingAssignment?.subject}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">Total Marks</span>
                      <strong className="text-slate-800">{selectedGradingAssignment?.totalMarks} Marks</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">Due Date</span>
                      <strong className="text-slate-800">{selectedGradingAssignment ? formatShortDate(selectedGradingAssignment.dueDate) : '—'}</strong>
                    </div>
                  </div>
                </div>

                {/* Submissions sheet table */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  {loadingSubmissions ? (
                    <div className="py-20 text-center">
                      <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-3" />
                      <p className="text-sm font-bold text-slate-400">Loading student submission details from Neon...</p>
                    </div>
                  ) : filteredSubmissions.length === 0 ? (
                    <div className="py-20 text-center text-slate-400 italic text-sm">
                      No students found in batch "{selectedGradingAssignment?.batch}".
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-55/40 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            <th className="px-6 py-4">Student Details</th>
                            <th className="px-6 py-4">Submission Status</th>
                            <th className="px-6 py-4">Submitted File</th>
                            <th className="px-6 py-4">Score / Marks</th>
                            <th className="px-6 py-4">Teacher's Feedback</th>
                            <th className="px-6 py-4 text-center">Save Grade</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-650">
                          {filteredSubmissions.map((sub) => {
                            const isGraded = sub.status === 'Graded'
                            const hasSubmitted = sub.status === 'Submitted' || sub.status === 'Late' || isGraded

                            return (
                              <tr key={sub.studentId} className="hover:bg-slate-50/20 transition-colors">
                                <td className="px-6 py-4">
                                  <div className="flex flex-col">
                                    <span className="font-bold text-slate-800 text-sm">{sub.studentName}</span>
                                    <span className="text-[10px] text-slate-400 mt-0.5">Roll No: {sub.rollNo || '—'}</span>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${
                                    sub.status === 'Graded' ? 'bg-emerald-50 text-emerald-700 border-emerald-150' :
                                    sub.status === 'Submitted' ? 'bg-blue-50 text-blue-700 border-blue-150' :
                                    sub.status === 'Late' ? 'bg-amber-50 text-amber-700 border-amber-150' :
                                    sub.status === 'Pending' ? 'bg-slate-50 text-slate-550 border-slate-200' :
                                    'bg-red-50 text-red-700 border-red-150'
                                  }`}>
                                    <span className={`w-1 h-1 rounded-full ${
                                      sub.status === 'Graded' ? 'bg-emerald-500' :
                                      sub.status === 'Submitted' ? 'bg-blue-500' :
                                      sub.status === 'Late' ? 'bg-amber-500' :
                                      sub.status === 'Pending' ? 'bg-slate-400' :
                                      'bg-red-500'
                                    }`} />
                                    {sub.status}
                                  </span>
                                </td>
                                <td className="px-6 py-4">
                                  {sub.fileUrl ? (
                                    <button
                                      onClick={() => setPreviewFile({ title: `${sub.studentName}'s Submission`, url: getBlobUrl(sub.fileUrl) })}
                                      className="inline-flex items-center gap-1.5 text-indigo-650 hover:underline border-none bg-transparent cursor-pointer"
                                    >
                                      <Paperclip className="w-3.5 h-3.5 shrink-0" />
                                      View Sheet
                                    </button>
                                  ) : (
                                    <span className="text-slate-400 italic">No file uploaded</span>
                                  )}
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="number"
                                      min={0}
                                      max={selectedGradingAssignment?.totalMarks || 100}
                                      value={gradingMarks[sub.studentId] || ''}
                                      onChange={(e) => setGradingMarks({ ...gradingMarks, [sub.studentId]: e.target.value })}
                                      className="w-16 px-2 py-1.5 border border-slate-200 bg-slate-50/50 rounded-lg text-center font-bold text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white"
                                      placeholder="—"
                                    />
                                    <span className="text-slate-400">/ {selectedGradingAssignment?.totalMarks}</span>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <input
                                    type="text"
                                    value={gradingFeedback[sub.studentId] || ''}
                                    onChange={(e) => setGradingFeedback({ ...gradingFeedback, [sub.studentId]: e.target.value })}
                                    className="w-full min-w-[200px] px-3 py-1.5 border border-slate-200 bg-slate-50/50 rounded-lg focus:outline-none focus:border-indigo-500 focus:bg-white text-xs font-semibold"
                                    placeholder="Enter feedback notes..."
                                  />
                                </td>
                                <td className="px-6 py-4 text-center">
                                  <button
                                    onClick={() => handleSaveGrade(sub.studentId, selectedGradingAssignment)}
                                    disabled={savingGradeId === sub.studentId}
                                    className={`px-3 py-1.5 rounded-lg font-bold border-none cursor-pointer flex items-center justify-center gap-1 transition-all mx-auto ${
                                      isGraded
                                        ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100/80'
                                        : 'bg-[#002045] text-white hover:bg-[#1a365d] shadow-sm'
                                    }`}
                                  >
                                    {savingGradeId === sub.studentId ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <Check className="w-3.5 h-3.5" />
                                    )}
                                    {isGraded ? 'Graded' : 'Save'}
                                  </button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}

      </div>

      {/* --- MODALS --- */}

      {/* A. Create Assignment Modal */}
      <AnimatePresence>
        {showCreateAssignmentModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCreateAssignmentModal(false)}
              className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-gray-150 flex items-center justify-between bg-gray-50/50">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-indigo-650" /> New Assignment / DPP
                </h2>
                <button onClick={() => setShowCreateAssignmentModal(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer border-none bg-transparent">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <form onSubmit={handleCreateAssignment} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Title *</label>
                    <input
                      required
                      type="text"
                      value={newAsgTitle}
                      onChange={e => setNewAsgTitle(e.target.value)}
                      placeholder="e.g. Electromagnetism Practice Set"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white text-xs font-semibold"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Description</label>
                    <textarea
                      rows={2}
                      value={newAsgDescription}
                      onChange={e => setNewAsgDescription(e.target.value)}
                      placeholder="Enter description, instructions or guidelines for students..."
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white text-xs font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Chapter / Topic *</label>
                    <input
                      required
                      type="text"
                      value={newAsgChapter}
                      onChange={e => setNewAsgChapter(e.target.value)}
                      placeholder="e.g. Chapter 4: Gauss's Law"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white text-xs font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Batch *</label>
                    <select
                      value={newAsgBatch}
                      onChange={e => setNewAsgBatch(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none cursor-pointer text-xs font-bold text-slate-750"
                    >
                      {batches.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Subject *</label>
                    <select
                      value={newAsgSubject}
                      onChange={e => setNewAsgSubject(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none cursor-pointer text-xs font-bold text-slate-750"
                    >
                      {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Assignment Type *</label>
                    <select
                      value={newAsgType}
                      onChange={e => setNewAsgType(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none cursor-pointer text-xs font-bold text-slate-750"
                    >
                      <option value="Homework">Homework</option>
                      <option value="DPP">DPP</option>
                      <option value="Worksheet">Worksheet</option>
                      <option value="Project">Project</option>
                      <option value="Revision">Revision</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Due Date *</label>
                    <input
                      required
                      type="date"
                      value={newAsgDueDate}
                      onChange={e => setNewAsgDueDate(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none cursor-pointer text-xs font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Due Time</label>
                    <input
                      type="text"
                      value={newAsgDueTime}
                      onChange={e => setNewAsgDueTime(e.target.value)}
                      placeholder="e.g. 11:59 PM"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-xs font-semibold"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Total Marks *</label>
                    <input
                      required
                      type="number"
                      value={newAsgTotalMarks}
                      onChange={e => setNewAsgTotalMarks(e.target.value)}
                      placeholder="100"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-xs font-semibold"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Upload Question Sheet (Optional)</label>
                    <div
                      onClick={() => asgFileRef.current?.click()}
                      className="border border-dashed border-slate-250 bg-slate-50/50 p-4 rounded-xl flex items-center justify-center gap-2 cursor-pointer hover:bg-slate-50 transition-colors"
                    >
                      <Paperclip className="w-4 h-4 text-slate-400" />
                      <span className="text-xs text-slate-500 font-bold">
                        {newAsgFile ? newAsgFile.name : 'Choose PDF, DOCX, or Image'}
                      </span>
                      <input
                        ref={asgFileRef}
                        type="file"
                        className="hidden"
                        onChange={(e) => setNewAsgFile(e.target.files?.[0] || null)}
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateAssignmentModal(false)}
                    className="flex-1 py-3 rounded-2xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 py-3 rounded-2xl bg-[#002045] hover:bg-[#1a365d] text-white text-xs font-bold shadow-lg transition-all cursor-pointer disabled:opacity-50 border-none flex items-center justify-center gap-1.5"
                  >
                    {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Create Assignment
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* E. Edit Assignment Modal */}
      <AnimatePresence>
        {showEditAssignmentModal && selectedAssignment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowEditAssignmentModal(false)}
              className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-gray-150 flex items-center justify-between bg-gray-50/50">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-indigo-650" /> Edit Assignment / DPP
                </h2>
                <button onClick={() => setShowEditAssignmentModal(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer border-none bg-transparent">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <form onSubmit={handleEditAssignment} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Title *</label>
                    <input
                      required
                      type="text"
                      value={editAsgTitle}
                      onChange={e => setEditAsgTitle(e.target.value)}
                      placeholder="e.g. Electromagnetism Practice Set"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white text-xs font-semibold"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Description</label>
                    <textarea
                      rows={2}
                      value={editAsgDescription}
                      onChange={e => setEditAsgDescription(e.target.value)}
                      placeholder="Enter description, instructions or guidelines for students..."
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white text-xs font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Chapter / Topic *</label>
                    <input
                      required
                      type="text"
                      value={editAsgChapter}
                      onChange={e => setEditAsgChapter(e.target.value)}
                      placeholder="e.g. Chapter 4: Gauss's Law"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white text-xs font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Batch *</label>
                    <select
                      value={editAsgBatch}
                      onChange={e => setEditAsgBatch(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none cursor-pointer text-xs font-bold text-slate-750"
                    >
                      {batches.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Subject *</label>
                    <select
                      value={editAsgSubject}
                      onChange={e => setEditAsgSubject(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none cursor-pointer text-xs font-bold text-slate-750"
                    >
                      {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Assignment Type *</label>
                    <select
                      value={editAsgType}
                      onChange={e => setEditAsgType(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none cursor-pointer text-xs font-bold text-slate-750"
                    >
                      <option value="Homework">Homework</option>
                      <option value="DPP">DPP</option>
                      <option value="Worksheet">Worksheet</option>
                      <option value="Project">Project</option>
                      <option value="Revision">Revision</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Due Date *</label>
                    <input
                      required
                      type="date"
                      value={editAsgDueDate}
                      onChange={e => setEditAsgDueDate(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none cursor-pointer text-xs font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Due Time</label>
                    <input
                      type="text"
                      value={editAsgDueTime}
                      onChange={e => setEditAsgDueTime(e.target.value)}
                      placeholder="e.g. 11:59 PM"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-xs font-semibold"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Total Marks *</label>
                    <input
                      required
                      type="number"
                      value={editAsgTotalMarks}
                      onChange={e => setEditAsgTotalMarks(e.target.value)}
                      placeholder="100"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-xs font-semibold"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Upload New Question Sheet (Optional)</label>
                    <div
                      onClick={() => editAsgFileRef.current?.click()}
                      className="border border-dashed border-slate-250 bg-slate-50/50 p-4 rounded-xl flex items-center justify-center gap-2 cursor-pointer hover:bg-slate-50 transition-colors"
                    >
                      <Paperclip className="w-4 h-4 text-slate-400" />
                      <span className="text-xs text-slate-500 font-bold">
                        {editAsgFile ? editAsgFile.name : 'Choose PDF, DOCX, or Image'}
                      </span>
                      <input
                        ref={editAsgFileRef}
                        type="file"
                        className="hidden"
                        onChange={(e) => setEditAsgFile(e.target.files?.[0] || null)}
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowEditAssignmentModal(false)}
                    className="flex-1 py-3 rounded-2xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 py-3 rounded-2xl bg-[#002045] hover:bg-[#1a365d] text-white text-xs font-bold shadow-lg transition-all cursor-pointer disabled:opacity-50 border-none flex items-center justify-center gap-1.5"
                  >
                    {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {asgToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setAsgToDelete(null)}
              className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 overflow-hidden"
            >
              <div className="flex items-center gap-3 text-red-600 mb-4">
                <div className="p-3 bg-red-50 rounded-2xl">
                  <AlertTriangle className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Delete Assignment</h3>
                  <p className="text-xs text-gray-500 font-medium">This action cannot be undone.</p>
                </div>
              </div>
              <p className="text-xs text-gray-600 font-semibold mb-6">
                Are you sure you want to permanently delete this assignment and all student submissions?
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setAsgToDelete(null)}
                  className="flex-1 py-3 rounded-2xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-all cursor-pointer bg-transparent"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const id = asgToDelete
                    setAsgToDelete(null)
                    handleDeleteAssignment(id)
                  }}
                  className="flex-1 py-3 rounded-2xl bg-red-600 hover:bg-red-750 text-white text-xs font-bold shadow-lg transition-all cursor-pointer border-none"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* B. Upload Study Material Modal */}
      <AnimatePresence>
        {showUploadMaterialModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowUploadMaterialModal(false)}
              className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-gray-150 flex items-center justify-between bg-gray-50/50">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-emerald-650" /> Upload Study Material
                </h2>
                <button onClick={() => setShowUploadMaterialModal(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer border-none bg-transparent">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <form onSubmit={handleUploadMaterial} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Title *</label>
                    <input
                      required
                      type="text"
                      value={newMatTitle}
                      onChange={e => setNewMatTitle(e.target.value)}
                      placeholder="e.g. Definite Integrals Notes"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white text-xs font-semibold"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Description</label>
                    <textarea
                      rows={2}
                      value={newMatDescription}
                      onChange={e => setNewMatDescription(e.target.value)}
                      placeholder="e.g. Formulas, proofs, and practice problems for calculus..."
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white text-xs font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Provider *</label>
                    <input
                      required
                      type="text"
                      value={newMatProvider}
                      onChange={e => setNewMatProvider(e.target.value)}
                      placeholder="e.g. Faculty Study Team / Allen"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white text-xs font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Chapter / Topic</label>
                    <input
                      type="text"
                      value={newMatChapter}
                      onChange={e => setNewMatChapter(e.target.value)}
                      placeholder="e.g. Chapter 5: Integrals"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white text-xs font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Batch *</label>
                    <select
                      value={newMatBatch}
                      onChange={e => setNewMatBatch(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none cursor-pointer text-xs font-bold text-slate-750"
                    >
                      {batches.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Subject *</label>
                    <select
                      value={newMatSubject}
                      onChange={e => setNewMatSubject(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none cursor-pointer text-xs font-bold text-slate-750"
                    >
                      {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Material Type *</label>
                    <select
                      value={newMatType}
                      onChange={e => setNewMatType(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none cursor-pointer text-xs font-bold text-slate-750"
                    >
                      <option value="Notes">Notes</option>
                      <option value="PDF">PDF</option>
                      <option value="Video">Video</option>
                      <option value="Practice Sheet">Practice Sheet</option>
                      <option value="DPP">DPP</option>
                      <option value="Reference">Reference</option>
                      <option value="Answer Key">Answer Key</option>
                    </select>
                  </div>

                  <div className="flex items-center mt-6 pl-2">
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newMatIsPublic}
                        onChange={e => setNewMatIsPublic(e.target.checked)}
                        className="w-4 h-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500 cursor-pointer"
                      />
                      Is Public / Visible to all
                    </label>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Upload File *</label>
                    <div
                      onClick={() => matFileRef.current?.click()}
                      className="border border-dashed border-emerald-250 bg-emerald-50/10 p-5 rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-emerald-50/20 transition-colors"
                    >
                      <ClipboardList className="w-6 h-6 text-emerald-600" />
                      <span className="text-xs text-slate-555 font-bold">
                        {newMatFile ? newMatFile.name : 'Select Study Material Document'}
                      </span>
                      <span className="text-[10px] text-slate-400 mt-0.5">Supports PDF, DOCX, ZIP, MP4 (Max 50MB)</span>
                      <input
                        ref={matFileRef}
                        type="file"
                        required
                        className="hidden"
                        onChange={(e) => setNewMatFile(e.target.files?.[0] || null)}
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowUploadMaterialModal(false)}
                    className="flex-1 py-3 rounded-2xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !newMatFile}
                    className="flex-1 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-lg transition-all cursor-pointer disabled:opacity-50 border-none flex items-center justify-center gap-1.5"
                  >
                    {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Upload Resource
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* C. Edit Study Material Modal */}
      <AnimatePresence>
        {showEditMaterialModal && selectedMaterial && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowEditMaterialModal(false)}
              className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-gray-150 flex items-center justify-between bg-gray-50/50">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Pencil className="w-5 h-5 text-indigo-650" /> Edit Study Material
                </h2>
                <button onClick={() => setShowEditMaterialModal(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer border-none bg-transparent">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <form onSubmit={handleSaveEditMaterial} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Title *</label>
                    <input
                      required
                      type="text"
                      value={editMatTitle}
                      onChange={e => setEditMatTitle(e.target.value)}
                      placeholder="e.g. Definite Integrals Notes"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white text-xs font-semibold"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Description</label>
                    <textarea
                      rows={2}
                      value={editMatDescription}
                      onChange={e => setEditMatDescription(e.target.value)}
                      placeholder="e.g. Formulas, proofs, and practice problems for calculus..."
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white text-xs font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Provider *</label>
                    <input
                      required
                      type="text"
                      value={editMatProvider}
                      onChange={e => setEditMatProvider(e.target.value)}
                      placeholder="e.g. Faculty Study Team / Allen"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white text-xs font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Chapter / Topic</label>
                    <input
                      type="text"
                      value={editMatChapter}
                      onChange={e => setEditMatChapter(e.target.value)}
                      placeholder="e.g. Chapter 5: Integrals"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white text-xs font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Batch *</label>
                    <select
                      value={editMatBatch}
                      onChange={e => setEditMatBatch(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none cursor-pointer text-xs font-bold text-slate-750"
                    >
                      {batches.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Subject *</label>
                    <select
                      value={editMatSubject}
                      onChange={e => setEditMatSubject(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none cursor-pointer text-xs font-bold text-slate-750"
                    >
                      {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Material Type *</label>
                    <select
                      value={editMatType}
                      onChange={e => setEditMatType(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none cursor-pointer text-xs font-bold text-slate-750"
                    >
                      <option value="Notes">Notes</option>
                      <option value="PDF">PDF</option>
                      <option value="Video">Video</option>
                      <option value="Practice Sheet">Practice Sheet</option>
                      <option value="DPP">DPP</option>
                      <option value="Reference">Reference</option>
                      <option value="Answer Key">Answer Key</option>
                    </select>
                  </div>

                  <div className="flex items-center mt-6 pl-2">
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editMatIsPublic}
                        onChange={e => setEditMatIsPublic(e.target.checked)}
                        className="w-4 h-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500 cursor-pointer"
                      />
                      Is Public / Visible to all
                    </label>
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowEditMaterialModal(false)}
                    className="flex-1 py-3 rounded-2xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 py-3 rounded-2xl bg-indigo-650 hover:bg-indigo-700 text-white text-xs font-bold shadow-lg transition-all cursor-pointer disabled:opacity-50 border-none flex items-center justify-center gap-1.5"
                  >
                    {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* D. Document Preview Modal */}
      <AnimatePresence>
        {previewFile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl border border-slate-200 flex flex-col"
              style={{ height: '80vh' }}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0 bg-slate-50/50">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">{previewFile.title}</h3>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={getBlobUrl(previewFile.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Open in new tab
                  </a>
                  <button onClick={() => setPreviewFile(null)} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer border-none bg-transparent">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              <div className="flex-1 overflow-hidden rounded-b-2xl bg-slate-100">
                {/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(previewFile.url) ? (
                  <div className="h-full flex items-center justify-center p-4">
                    <img src={getBlobUrl(previewFile.url)} alt={previewFile.title} className="max-h-full max-w-full object-contain rounded-lg shadow-sm" />
                  </div>
                ) : (
                  <iframe src={getBlobUrl(previewFile.url)} className="w-full h-full border-none" title="Resource preview" />
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  )
}
