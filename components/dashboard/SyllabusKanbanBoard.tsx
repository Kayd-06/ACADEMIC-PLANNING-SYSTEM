'use client'
import { useState, useEffect, useRef } from 'react'
import { Plus, X, Loader2, ChevronDown, Clock, CheckCircle, Upload, Download, FileText, FileSpreadsheet, Image as ImageIcon, FileCode, Trash2, Check, AlertCircle, Building2, BookOpen, Layers, Book } from 'lucide-react'
import * as XLSX from 'xlsx'

const SUBJECTS = ['Physics', 'Chemistry', 'Mathematics', 'Biology', 'English', 'History', 'Geography', 'Computer Science']
const DEFAULT_PROGRAMS = ['JEE 2-Year Integrated', 'NEET Foundation', 'Foundational 1-Year', 'CBSE Class 11-12']
const DEFAULT_SCHOOLS = ['vpsss', 'Main Branch', 'North Campus', 'West Wing']

interface ParsedChapter {
  id: string
  school: string
  program: string
  batch: string
  subject: string
  title: string
  estHours: string
  dates: string
  status: string
  notes: string
}

export default function SyllabusKanbanBoard({ batches }: { batches: string[] }) {
  const [selectedBatch, setSelectedBatch] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('Physics')
  const [selectedSchool, setSelectedSchool] = useState('vpsss')
  const [selectedProgram, setSelectedProgram] = useState('JEE 2-Year Integrated')

  const [programsList, setProgramsList] = useState<string[]>(DEFAULT_PROGRAMS)
  const [schoolsList, setSchoolsList] = useState<string[]>(DEFAULT_SCHOOLS)

  const [chapters, setChapters] = useState<any[]>([])
  const [chaptersLoading, setChaptersLoading] = useState(false)
  const [chapterModal, setChapterModal] = useState<{ mode: 'add' | 'edit'; chapter?: any } | null>(null)

  // Context fields inside Add/Edit Chapter Modal
  const [chapterForm, setChapterForm] = useState({
    title: '',
    estHours: '12 hrs est.',
    dates: 'Aug 15 - Aug 28',
    notes: '',
    status: 'NOT STARTED',
    school: 'vpsss',
    program: 'JEE 2-Year Integrated',
    batch: '',
    subject: 'Physics'
  })

  // Syllabus Upload Modal States
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [uploadSchool, setUploadSchool] = useState('vpsss')
  const [uploadProgram, setUploadProgram] = useState('JEE 2-Year Integrated')
  const [uploadBatch, setUploadBatch] = useState('')
  const [uploadSubject, setUploadSubject] = useState('Physics')

  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [parsedChapters, setParsedChapters] = useState<ParsedChapter[]>([])
  const [parseError, setParseError] = useState<string | null>(null)
  const [showSamplePreview, setShowSamplePreview] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (batches.length > 0 && !selectedBatch) {
      setSelectedBatch(batches[0])
      setUploadBatch(batches[0])
    }
  }, [batches])

  useEffect(() => {
    if (selectedBatch) fetchChapters(selectedBatch, selectedSubject)
  }, [selectedBatch, selectedSubject])

  const fetchData = async () => {
    try {
      const [pRes, sRes] = await Promise.all([
        fetch('/api/programs'),
        fetch('/api/schools')
      ])
      const pData = await pRes.json()
      const sData = await sRes.json()

      if (Array.isArray(pData) && pData.length > 0) {
        const names = pData.map((p: any) => p.name || p.title)
        setProgramsList(names)
        setSelectedProgram(names[0])
        setUploadProgram(names[0])
      }
      if (Array.isArray(sData) && sData.length > 0) {
        const names = sData.map((s: any) => s.name || s.schoolName)
        setSchoolsList(names)
        setSelectedSchool(names[0])
        setUploadSchool(names[0])
      }
    } catch (err) {
      console.error('Error loading context lists', err)
    }
  }

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const fetchChapters = async (batchName: string, subjectName: string) => {
    setChaptersLoading(true)
    try {
      const res = await fetch(`/api/teacher-portal/academic-planning/chapters?class=${encodeURIComponent(batchName)}&subject=${encodeURIComponent(subjectName)}`)
      const data = await res.json()
      if (data && Array.isArray(data.chapters)) {
        setChapters(data.chapters)
      } else {
        setChapters([])
      }
    } catch (err) {
      console.error('Failed to fetch chapters', err)
      setChapters([])
    } finally {
      setChaptersLoading(false)
    }
  }

  async function handleUpdateChapterStatus(chapterId: string, newStatus: string) {
    try {
      const res = await fetch('/api/teacher-portal/academic-planning/chapters', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: chapterId, status: newStatus })
      })
      if (res.ok) {
        showToast('Chapter status updated')
        fetchChapters(selectedBatch, selectedSubject)
      } else {
        showToast('Failed to update status')
      }
    } catch (err) {
      console.error(err)
      showToast('Error updating status')
    }
  }

  async function saveChapter(e: React.FormEvent) {
    e.preventDefault()
    if (!chapterForm.title.trim()) { showToast('Chapter title is required'); return }

    try {
      const isEdit = chapterModal?.mode === 'edit'
      const url = '/api/teacher-portal/academic-planning/chapters'
      const method = isEdit ? 'PATCH' : 'POST'
      const payload = isEdit
        ? { id: chapterModal!.chapter._id, ...chapterForm }
        : { className: chapterForm.batch || selectedBatch, ...chapterForm }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        showToast(isEdit ? 'Chapter updated' : 'New chapter added')
        setChapterModal(null)
        if (chapterForm.batch && chapterForm.batch !== selectedBatch) {
          setSelectedBatch(chapterForm.batch)
        }
        if (chapterForm.subject && chapterForm.subject !== selectedSubject) {
          setSelectedSubject(chapterForm.subject)
        }
        fetchChapters(chapterForm.batch || selectedBatch, chapterForm.subject || selectedSubject)
      } else {
        const d = await res.json()
        showToast(d.error || 'Failed to save chapter')
      }
    } catch (err) {
      console.error(err)
      showToast('Error saving chapter')
    }
  }

  async function handleDeleteChapter(chapterId: string) {
    if (!confirm('Are you sure you want to delete this chapter from the syllabus?')) return
    try {
      const res = await fetch(`/api/teacher-portal/academic-planning/chapters?id=${chapterId}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        showToast('Chapter deleted')
        setChapterModal(null)
        fetchChapters(selectedBatch, selectedSubject)
      } else {
        showToast('Failed to delete chapter')
      }
    } catch (err) {
      console.error(err)
      showToast('Error deleting chapter')
    }
  }

  function openAddModal() {
    setChapterForm({
      title: '',
      estHours: '10 hrs est.',
      dates: 'Oct 01 - Oct 15',
      notes: '',
      status: 'NOT STARTED',
      school: selectedSchool,
      program: selectedProgram,
      batch: selectedBatch || (batches[0] || 'Grade 11-A'),
      subject: selectedSubject
    })
    setChapterModal({ mode: 'add' })
  }

  function openEditModal(chap: any) {
    setChapterForm({
      title: chap.title,
      estHours: chap.estHours,
      dates: chap.dates,
      notes: chap.notes || '',
      status: chap.status,
      school: selectedSchool,
      program: selectedProgram,
      batch: selectedBatch,
      subject: selectedSubject
    })
    setChapterModal({ mode: 'edit', chapter: chap })
  }

  // Sample CSV format download
  const handleDownloadSample = () => {
    const csvContent =
`School,Program,Batch,Subject,Chapter Title,Estimated Hours,Target Dates,Status,Teacher Remarks & Notes
vpsss,JEE 1A,Batch 1,Physics,Chapter 01: Physical World,10 hrs est.,Oct 01 - Oct 15,NOT STARTED,Introductory concepts clear. Ready for test.
vpsss,JEE 1A,Batch 1,Physics,Chapter 02: Units and Measurements,12 hrs est.,Oct 16 - Oct 30,IN PROGRESS,Focus on dimensional analysis.
vpsss,JEE 1A,Batch 1,Physics,Chapter 03: Motion in a Straight Line,14 hrs est.,Nov 01 - Nov 15,COMPLETED,Problem solving and numericals completed.`

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', 'syllabus_sample_template.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleUploadSubjectChange = (newSub: string) => {
    setUploadSubject(newSub)
    setParsedChapters(prev => prev.map(row => ({ ...row, subject: newSub })))
  }

  const handleUploadBatchChange = (newBatch: string) => {
    setUploadBatch(newBatch)
    setParsedChapters(prev => prev.map(row => ({ ...row, batch: newBatch })))
  }

  // Parse uploaded file
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadedFile(file)
    processFile(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    setUploadedFile(file)
    processFile(file)
  }

  const processFile = (file: File) => {
    setParseError(null)

    // Detect subject from file name (e.g. Chemistry_Syllabus.xlsx -> Chemistry)
    let fileSubject = ''
    for (const sub of SUBJECTS) {
      if (file.name.toLowerCase().includes(sub.toLowerCase())) {
        fileSubject = sub
        break
      }
    }
    if (fileSubject) {
      setUploadSubject(fileSubject)
    }

    const isSpreadsheet = file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv') || file.type.includes('spreadsheet') || file.type.includes('csv') || file.name.endsWith('.txt')

    if (isSpreadsheet) {
      const reader = new FileReader()
      reader.onload = (event) => {
        try {
          const buffer = event.target?.result as ArrayBuffer
          const data = new Uint8Array(buffer)
          const workbook = XLSX.read(data, { type: 'array' })
          const sheetName = workbook.SheetNames[0]

          if (!sheetName) {
            setParseError('The uploaded file contains no sheets or readable data.')
            setParsedChapters([])
            return
          }

          const sheet = workbook.Sheets[sheetName]
          const matrix: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

          processParsedMatrix(matrix, file.name, fileSubject)
        } catch (err) {
          console.error('Error parsing spreadsheet:', err)
          setParseError('Failed to parse spreadsheet. Please ensure it is a valid Excel (.xlsx/.xls) or CSV file.')
          setParsedChapters([])
        }
      }
      reader.readAsArrayBuffer(file)
    } else {
      setParseError('Automatic parsing of PDF/Image files is limited. Please upload an Excel (.xlsx/.xls) or CSV file for automatic chapter extraction, or manually add rows below.')
      setParsedChapters([])
    }
  }

  const processParsedMatrix = (matrix: any[][], fileName: string, fileSubject?: string) => {
    if (!matrix || matrix.length === 0) {
      setParseError('The uploaded file is empty or contains no data rows.')
      setParsedChapters([])
      return
    }

    // Filter out completely empty rows
    const nonEmpRows = matrix.filter(row => Array.isArray(row) && row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== ''))

    if (nonEmpRows.length === 0) {
      setParseError('The uploaded file contains no data rows.')
      setParsedChapters([])
      return
    }

    // Header index detection
    let headerIdx = -1
    let colSchool = -1
    let colProgram = -1
    let colBatch = -1
    let colSubject = -1
    let colTitle = -1
    let colHours = -1
    let colDates = -1
    let colStatus = -1
    let colNotes = -1

    for (let r = 0; r < Math.min(nonEmpRows.length, 5); r++) {
      const row = nonEmpRows[r].map(c => String(c || '').toLowerCase().trim())
      const titleIdx = row.findIndex(c => c.includes('chapter') || c.includes('title') || c.includes('topic') || c.includes('name'))
      if (titleIdx !== -1) {
        headerIdx = r
        colTitle = titleIdx
        colSchool = row.findIndex(c => c.includes('school'))
        colProgram = row.findIndex(c => c.includes('program'))
        colBatch = row.findIndex(c => c.includes('batch') || c.includes('class'))
        colSubject = row.findIndex(c => c.includes('subject'))
        colHours = row.findIndex(c => c.includes('hour') || c.includes('est'))
        colDates = row.findIndex(c => c.includes('date') || c.includes('target'))
        colStatus = row.findIndex(c => c.includes('status'))
        colNotes = row.findIndex(c => c.includes('note') || c.includes('remark') || c.includes('desc'))
        break
      }
    }

    const dataRows = headerIdx !== -1 ? nonEmpRows.slice(headerIdx + 1) : nonEmpRows
    const rows: ParsedChapter[] = []
    let detectedSub = fileSubject || ''

    dataRows.forEach((rowArray, idx) => {
      const getVal = (col: number, fallbackCol: number) => {
        if (col !== -1 && rowArray[col] !== undefined && rowArray[col] !== null) return String(rowArray[col]).trim()
        if (fallbackCol !== -1 && rowArray[fallbackCol] !== undefined && rowArray[fallbackCol] !== null) return String(rowArray[fallbackCol]).trim()
        return ''
      }

      let title = ''
      if (colTitle !== -1) {
        title = getVal(colTitle, -1)
      } else if (rowArray.length >= 9) {
        title = String(rowArray[4] || '').trim()
      } else {
        const firstNonEmpty = rowArray.find(c => c !== null && c !== undefined && String(c).trim() !== '')
        title = String(firstNonEmpty || '').trim()
      }

      if (!title) return

      let rowSchool = getVal(colSchool, 0) || uploadSchool || 'vpsss'
      let rowProgram = getVal(colProgram, 1) || uploadProgram || 'JEE 1A'
      let rowBatch = getVal(colBatch, 2) || uploadBatch || 'Batch 1'
      let rowSub = getVal(colSubject, 3) || detectedSub || uploadSubject || 'Physics'
      let hours = getVal(colHours, 5) || '10 hrs est.'
      let dates = getVal(colDates, 6) || 'Oct 01 - Oct 15'
      let rawStatus = getVal(colStatus, 7)
      let notes = getVal(colNotes, 8) || ''

      // Clean up status (handle nill, null, empty)
      let statusUpper = rawStatus.toUpperCase().trim()
      if (!statusUpper || statusUpper === 'NIL' || statusUpper === 'NILL' || statusUpper === 'NULL' || statusUpper === 'NONE' || statusUpper === '-') {
        statusUpper = 'NOT STARTED'
      } else if (statusUpper.includes('PROGRESS')) {
        statusUpper = 'IN PROGRESS'
      } else if (statusUpper.includes('COMPLET') || statusUpper.includes('DONE')) {
        statusUpper = 'COMPLETED'
      } else {
        statusUpper = 'NOT STARTED'
      }

      if (!detectedSub && rowSub) {
        const foundSubject = SUBJECTS.find(s => s.toLowerCase() === rowSub.toLowerCase())
        if (foundSubject) {
          detectedSub = foundSubject
          rowSub = foundSubject
        }
      }

      rows.push({
        id: String(idx + 1),
        school: rowSchool,
        program: rowProgram,
        batch: rowBatch,
        subject: rowSub,
        title,
        estHours: hours,
        dates,
        status: statusUpper,
        notes
      })
    })

    if (detectedSub) {
      setUploadSubject(detectedSub)
    }

    if (rows.length === 0) {
      setParseError('Data incomplete! No valid chapter titles found in the uploaded file. Please verify that your spreadsheet has Chapter Titles or download the Sample Format (CSV).')
      setParsedChapters([])
    } else {
      setParsedChapters(rows)
    }
  }

  const handleAddParsedRow = () => {
    setParsedChapters(prev => [
      ...prev,
      {
        id: String(Date.now()),
        school: uploadSchool || 'vpsss',
        program: uploadProgram || 'JEE 1A',
        batch: uploadBatch || 'Batch 1',
        subject: uploadSubject || 'Physics',
        title: `Chapter 0${prev.length + 1}: New Topic`,
        estHours: '10 hrs est.',
        dates: 'Oct 01 - Oct 15',
        status: 'NOT STARTED',
        notes: ''
      }
    ])
  }

  const handleUpdateParsedRow = (id: string, field: keyof ParsedChapter, value: string) => {
    setParsedChapters(prev =>
      prev.map(row => row.id === id ? { ...row, [field]: value } : row)
    )
  }

  const handleRemoveParsedRow = (id: string) => {
    setParsedChapters(prev => prev.filter(row => row.id !== id))
  }

  const handleConfirmImport = async () => {
    if (parsedChapters.length === 0) {
      setParseError('Data incomplete! Please upload a valid syllabus spreadsheet with chapter titles before importing.')
      showToast('Data incomplete: No chapters to import')
      return
    }

    const missingTitles = parsedChapters.filter(c => !c.title || !c.title.trim())
    if (missingTitles.length > 0) {
      setParseError(`Data incomplete! ${missingTitles.length} chapter row(s) have empty titles. Please fill them in before importing.`)
      showToast('Data incomplete: Chapter titles missing')
      return
    }

    setUploading(true)
    try {
      const targetSubject = parsedChapters[0]?.subject || uploadSubject || selectedSubject
      const targetBatch = parsedChapters[0]?.batch || uploadBatch || selectedBatch

      const res = await fetch('/api/teacher-portal/academic-planning/chapters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          className: targetBatch,
          subject: targetSubject,
          school: uploadSchool,
          program: uploadProgram,
          items: parsedChapters.map(c => ({
            ...c,
            batch: c.batch || targetBatch,
            subject: c.subject || targetSubject,
            school: c.school || uploadSchool,
            program: c.program || uploadProgram
          }))
        })
      })

      if (res.ok) {
        showToast(`Successfully imported ${parsedChapters.length} chapters for ${targetSubject}!`)
        setUploadModalOpen(false)
        setUploadedFile(null)
        setParsedChapters([])

        if (targetBatch) setSelectedBatch(targetBatch)
        if (targetSubject) setSelectedSubject(targetSubject)
        fetchChapters(targetBatch, targetSubject)
      } else {
        const d = await res.json()
        showToast(d.error || 'Failed to import syllabus')
      }
    } catch (err) {
      console.error(err)
      showToast('Error importing syllabus')
    } finally {
      setUploading(false)
    }
  }

  const COLUMNS: { key: string; label: string; badge: string; tagClass: string; dot: string }[] = [
    { key: 'NOT STARTED', label: 'Not Started', badge: 'bg-slate-200 text-slate-600', tagClass: 'bg-slate-50 border-slate-200/60 text-slate-600', dot: 'bg-slate-300' },
    { key: 'IN PROGRESS', label: 'In Progress', badge: 'bg-indigo-50 text-indigo-700 border border-indigo-100', tagClass: 'bg-indigo-50 border-indigo-200/60 text-indigo-700', dot: 'bg-indigo-500 animate-pulse' },
    { key: 'COMPLETED', label: 'Completed', badge: 'bg-emerald-50 text-emerald-700 border border-emerald-100', tagClass: 'bg-emerald-50 border-emerald-200/60 text-emerald-700', dot: 'bg-emerald-500' },
  ]

  return (
    <div className="space-y-6 relative">
      {toast && (
        <div className="fixed bottom-8 right-8 bg-slate-900 text-white px-6 py-3 rounded-xl shadow-2xl z-[300] flex items-center gap-3 font-medium animate-in slide-in-from-bottom-5">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          {toast}
        </div>
      )}

      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Select Batch</span>
            <div className="relative w-48">
              <select
                value={selectedBatch}
                onChange={e => setSelectedBatch(e.target.value)}
                className="w-full text-sm font-bold bg-slate-50 hover:bg-slate-100 text-slate-800 rounded-xl pl-3 pr-8 py-2 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 appearance-none cursor-pointer transition-all"
              >
                {batches.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
                {batches.length === 0 && <option value="Grade 11-A">Grade 11-A</option>}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Select Subject</span>
            <div className="relative w-40">
              <select
                value={selectedSubject}
                onChange={e => setSelectedSubject(e.target.value)}
                className="w-full text-sm font-bold bg-slate-50 hover:bg-slate-100 text-slate-800 rounded-xl pl-3 pr-8 py-2 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 appearance-none cursor-pointer transition-all"
              >
                {SUBJECTS.map(sub => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:self-end">
          <button
            onClick={() => {
              setUploadBatch(selectedBatch || batches[0] || 'Grade 11-A')
              setUploadSubject(selectedSubject)
              setUploadSchool(selectedSchool)
              setUploadProgram(selectedProgram)
              setUploadModalOpen(true)
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-bold shadow-md cursor-pointer transition-all transform active:scale-95"
          >
            <Upload className="w-4 h-4 text-indigo-300" /> Upload Syllabus
          </button>

          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-4.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md cursor-pointer transition-all transform active:scale-95"
          >
            <Plus className="w-4 h-4" /> Add Chapter
          </button>
        </div>
      </div>

      {/* Kanban Board */}
      {chaptersLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {COLUMNS.map(col => {
            const colChapters = chapters.filter(c => c.status === col.key)
            return (
              <div key={col.key} className="bg-slate-50/70 rounded-2xl p-4 border border-slate-200 flex flex-col min-h-[500px]">
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200/80">
                  <span className="font-bold text-xs uppercase tracking-wider text-slate-700">{col.label}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${col.badge}`}>
                    {colChapters.length}
                  </span>
                </div>
                <div className="space-y-3 flex-1 overflow-y-auto max-h-[550px] pr-1">
                  {colChapters.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-slate-200 rounded-xl">
                      <p className="text-xs font-semibold text-slate-400">No chapters in this stage</p>
                    </div>
                  ) : (
                    colChapters.map(chap => (
                      <div
                        key={chap._id}
                        onClick={() => openEditModal(chap)}
                        className={`bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:shadow-md hover:border-indigo-200 cursor-pointer transition-all group space-y-3 ${col.key === 'COMPLETED' ? 'opacity-90' : ''}`}
                      >
                        <div className="flex items-start justify-between">
                          <span className={`px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide rounded border ${col.tagClass}`}>
                            {selectedSubject}
                          </span>
                          <span className={`w-2.5 h-2.5 rounded-full ${col.dot}`} />
                        </div>
                        <div>
                          <h4 className={`font-bold text-xs text-slate-800 group-hover:text-indigo-600 transition-colors line-clamp-2 ${col.key === 'COMPLETED' ? 'line-through decoration-slate-300' : ''}`}>
                            {chap.title}
                          </h4>
                          <p className="text-[10px] text-slate-500 mt-1 font-medium">Target: {chap.dates}</p>
                        </div>
                        <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500 border-t border-slate-100 pt-2.5">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            {chap.estHours}
                          </span>
                        </div>
                        <div className="pt-2 border-t border-slate-100" onClick={e => e.stopPropagation()}>
                          <div className="relative w-full">
                            <select
                              value={chap.status}
                              onChange={e => handleUpdateChapterStatus(chap._id, e.target.value)}
                              className="w-full text-[10px] font-bold bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg pl-2 pr-6 py-1 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer appearance-none transition-all"
                            >
                              <option value="NOT STARTED">Not Started</option>
                              <option value="IN PROGRESS">In Progress</option>
                              <option value="COMPLETED">Completed</option>
                            </select>
                            <ChevronDown className="w-3.5 h-3.5 text-slate-450 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* SYLLABUS UPLOAD MODAL */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white w-full max-w-4xl rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-100 space-y-5 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex justify-between items-start pb-4 border-b border-slate-100">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                    <Upload className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">Upload Syllabus Document</h3>
                </div>
                <p className="text-xs text-slate-500">Import course chapters automatically using CSV, Excel, PDF, or Image files.</p>
              </div>
              <button
                onClick={() => { setUploadModalOpen(false); setParseError(null); }}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Top Banner: Supported Formats & Download Sample Template */}
            <div className="bg-gradient-to-r from-indigo-50/80 via-purple-50/50 to-slate-50 p-4 rounded-2xl border border-indigo-100/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800">Supported Formats:</span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="px-2.5 py-0.5 bg-white border border-emerald-200 text-emerald-700 text-[10px] font-bold rounded-lg flex items-center gap-1 shadow-2xs">
                      <FileSpreadsheet className="w-3 h-3 text-emerald-600" /> Excel / CSV
                    </span>
                    <span className="px-2.5 py-0.5 bg-white border border-rose-200 text-rose-700 text-[10px] font-bold rounded-lg flex items-center gap-1 shadow-2xs">
                      <FileCode className="w-3 h-3 text-rose-600" /> PDF
                    </span>
                    <span className="px-2.5 py-0.5 bg-white border border-amber-200 text-amber-700 text-[10px] font-bold rounded-lg flex items-center gap-1 shadow-2xs">
                      <ImageIcon className="w-3 h-3 text-amber-600" /> Image
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500">
                  Expected 9 columns: <span className="font-semibold text-slate-700">School, Program, Batch, Subject, Chapter Title, Est. Hours, Target Dates, Status, Notes</span>
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowSamplePreview(prev => !prev)}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-all cursor-pointer shadow-2xs"
                >
                  {showSamplePreview ? 'Hide Sample Format' : 'View Sample Format'}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadSample}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> Download Template (.CSV)
                </button>
              </div>
            </div>

            {/* Collapsible Sample Format Table */}
            {showSamplePreview && (
              <div className="bg-slate-900 text-slate-200 p-3.5 rounded-2xl border border-slate-800 text-xs overflow-x-auto space-y-2 animate-in fade-in duration-150">
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                  <span>Sample 9-Column Format Structure</span>
                  <span className="text-indigo-400">Ready to fill & import</span>
                </div>
                <table className="w-full text-left font-mono whitespace-nowrap text-[11px]">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="p-1.5 font-semibold">School</th>
                      <th className="p-1.5 font-semibold">Program</th>
                      <th className="p-1.5 font-semibold">Batch</th>
                      <th className="p-1.5 font-semibold">Subject</th>
                      <th className="p-1.5 font-semibold">Chapter Title</th>
                      <th className="p-1.5 font-semibold">Estimated Hours</th>
                      <th className="p-1.5 font-semibold">Target Dates</th>
                      <th className="p-1.5 font-semibold">Status</th>
                      <th className="p-1.5 font-semibold">Teacher Remarks & Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    <tr>
                      <td className="p-1.5">vpsss</td>
                      <td className="p-1.5">JEE 1A</td>
                      <td className="p-1.5">Batch 1</td>
                      <td className="p-1.5">Chemistry</td>
                      <td className="p-1.5">Chapter 01: Physical World</td>
                      <td className="p-1.5">10 hrs est.</td>
                      <td className="p-1.5">Oct 01 - Oct 15</td>
                      <td className="p-1.5 text-amber-400">NOT STARTED</td>
                      <td className="p-1.5 text-slate-400">Introductory concepts clear</td>
                    </tr>
                    <tr>
                      <td className="p-1.5">vpsss</td>
                      <td className="p-1.5">JEE 1A</td>
                      <td className="p-1.5">Batch 1</td>
                      <td className="p-1.5">Chemistry</td>
                      <td className="p-1.5">Chapter 02: Units & Measurements</td>
                      <td className="p-1.5">12 hrs est.</td>
                      <td className="p-1.5">Oct 16 - Oct 30</td>
                      <td className="p-1.5 text-indigo-400">IN PROGRESS</td>
                      <td className="p-1.5 text-slate-400">Focus on dimensional analysis</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Target Context Card (School, Program, Batch, Subject) */}
            <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 space-y-2">
              <span className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider block">
                Target Course Context
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                    <Building2 className="w-3 h-3 text-indigo-500" /> School
                  </label>
                  <select
                    value={uploadSchool}
                    onChange={e => setUploadSchool(e.target.value)}
                    className="w-full text-xs font-bold bg-white px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800"
                  >
                    {schoolsList.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                    <BookOpen className="w-3 h-3 text-indigo-500" /> Program
                  </label>
                  <select
                    value={uploadProgram}
                    onChange={e => setUploadProgram(e.target.value)}
                    className="w-full text-xs font-bold bg-white px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800"
                  >
                    {programsList.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                    <Layers className="w-3 h-3 text-indigo-500" /> Batch
                  </label>
                  <select
                    value={uploadBatch}
                    onChange={e => handleUploadBatchChange(e.target.value)}
                    className="w-full text-xs font-bold bg-white px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800"
                  >
                    {batches.map(b => <option key={b} value={b}>{b}</option>)}
                    {batches.length === 0 && <option value="Grade 11-A">Grade 11-A</option>}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                    <Book className="w-3 h-3 text-indigo-500" /> Subject
                  </label>
                  <select
                    value={uploadSubject}
                    onChange={e => handleUploadSubjectChange(e.target.value)}
                    className="w-full text-xs font-bold bg-white px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800"
                  >
                    {SUBJECTS.map(sub => <option key={sub} value={sub}>{sub}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Validation Warning / Error Alert */}
            {parseError && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 text-amber-900 text-xs shadow-2xs">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h5 className="font-bold text-amber-950 mb-0.5">Data Format & Validation Notice</h5>
                  <p className="leading-relaxed text-amber-800">{parseError}</p>
                </div>
              </div>
            )}

            {/* Dropzone Upload Box */}
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-indigo-200 hover:border-indigo-500 bg-gradient-to-b from-indigo-50/40 to-slate-50 hover:from-indigo-50/80 hover:to-indigo-50/30 transition-all rounded-2xl p-7 text-center cursor-pointer space-y-3 group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv, .xlsx, .xls, .pdf, .png, .jpg, .jpeg"
                onChange={handleFileSelect}
                className="hidden"
              />
              <div className="w-14 h-14 bg-white border border-indigo-100 rounded-2xl flex items-center justify-center mx-auto text-indigo-600 shadow-sm group-hover:scale-110 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                <Upload className="w-7 h-7" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">
                  {uploadedFile ? uploadedFile.name : 'Click to select or drag & drop syllabus document'}
                </p>
                <p className="text-xs text-slate-500 mt-1">Supports CSV, XLSX, XLS, PDF, PNG, JPG files up to 10MB</p>
              </div>
            </div>

            {/* Parsed Chapter Preview Grid */}
            {parsedChapters.length > 0 && (
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    Parsed Chapters Preview
                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full text-[10px] font-extrabold">
                      {parsedChapters.length} Chapters Found
                    </span>
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddParsedRow}
                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Add Row
                  </button>
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-60 overflow-y-auto shadow-2xs">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 border-b border-slate-200">
                      <tr>
                        <th className="p-3 w-8">#</th>
                        <th className="p-3 w-24">School</th>
                        <th className="p-3 w-24">Program</th>
                        <th className="p-3 w-24">Batch</th>
                        <th className="p-3 w-24">Subject</th>
                        <th className="p-3">Chapter Title</th>
                        <th className="p-3 w-24">Est. Hours</th>
                        <th className="p-3 w-28">Target Dates</th>
                        <th className="p-3 w-28">Status</th>
                        <th className="p-3 w-8 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {parsedChapters.map((row, idx) => (
                        <tr key={row.id} className="hover:bg-indigo-50/40 transition-colors">
                          <td className="p-3 text-slate-400 font-bold">{idx + 1}</td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={row.school || uploadSchool}
                              onChange={e => handleUpdateParsedRow(row.id, 'school', e.target.value)}
                              className="w-20 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={row.program || uploadProgram}
                              onChange={e => handleUpdateParsedRow(row.id, 'program', e.target.value)}
                              className="w-20 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={row.batch || uploadBatch}
                              onChange={e => handleUpdateParsedRow(row.id, 'batch', e.target.value)}
                              className="w-20 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={row.subject || uploadSubject}
                              onChange={e => handleUpdateParsedRow(row.id, 'subject', e.target.value)}
                              className="w-20 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={row.title}
                              onChange={e => handleUpdateParsedRow(row.id, 'title', e.target.value)}
                              className="w-full min-w-[180px] px-2.5 py-1 bg-white border border-slate-200 rounded-lg font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={row.estHours}
                              onChange={e => handleUpdateParsedRow(row.id, 'estHours', e.target.value)}
                              className="w-20 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={row.dates}
                              onChange={e => handleUpdateParsedRow(row.id, 'dates', e.target.value)}
                              className="w-24 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
                            />
                          </td>
                          <td className="p-2">
                            <select
                              value={row.status}
                              onChange={e => handleUpdateParsedRow(row.id, 'status', e.target.value)}
                              className="w-28 px-2 py-1 bg-white border border-slate-200 rounded-lg font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs cursor-pointer"
                            >
                              <option value="NOT STARTED">Not Started</option>
                              <option value="IN PROGRESS">In Progress</option>
                              <option value="COMPLETED">Completed</option>
                            </select>
                          </td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveParsedRow(row.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Modal Actions Footer */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => { setUploadModalOpen(false); setParseError(null); }}
                className="px-5 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={uploading}
                className="px-6 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer transform active:scale-95"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Importing...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" /> Import Syllabus
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD / EDIT CHAPTER FORM MODAL WITH SCHOOL, PROGRAM, BATCH, SUBJECT SELECTORS */}
      {chapterModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white w-full max-w-lg rounded-2xl p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="text-lg font-bold text-slate-900">
                {chapterModal.mode === 'edit' ? 'Edit Syllabus Chapter' : 'Add New Chapter'}
              </h3>
              <button onClick={() => setChapterModal(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={saveChapter} className="space-y-4">
              {/* Context Selection (School, Program, Batch, Subject) */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Target Parameters (School, Program, Batch, Subject)
                </span>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">School</label>
                    <select
                      value={chapterForm.school}
                      onChange={e => setChapterForm({ ...chapterForm, school: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-800"
                    >
                      {schoolsList.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Program</label>
                    <select
                      value={chapterForm.program}
                      onChange={e => setChapterForm({ ...chapterForm, program: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-800"
                    >
                      {programsList.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Batch *</label>
                    <select
                      value={chapterForm.batch}
                      onChange={e => setChapterForm({ ...chapterForm, batch: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-800"
                    >
                      {batches.map(b => <option key={b} value={b}>{b}</option>)}
                      {batches.length === 0 && <option value="Grade 11-A">Grade 11-A</option>}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Subject *</label>
                    <select
                      value={chapterForm.subject}
                      onChange={e => setChapterForm({ ...chapterForm, subject: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-800"
                    >
                      {SUBJECTS.map(sub => <option key={sub} value={sub}>{sub}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Chapter Title *</label>
                <input
                  type="text"
                  required
                  value={chapterForm.title}
                  onChange={e => setChapterForm({ ...chapterForm, title: e.target.value })}
                  placeholder="e.g. Chapter 01: Physical World"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50/50 hover:bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 font-medium transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Estimated Hours</label>
                  <input
                    type="text"
                    required
                    value={chapterForm.estHours}
                    onChange={e => setChapterForm({ ...chapterForm, estHours: e.target.value })}
                    placeholder="e.g. 12 hrs est."
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50/50 hover:bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 font-medium transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Target Dates</label>
                  <input
                    type="text"
                    required
                    value={chapterForm.dates}
                    onChange={e => setChapterForm({ ...chapterForm, dates: e.target.value })}
                    placeholder="e.g. Aug 15 - Aug 28"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50/50 hover:bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 font-medium transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Status</label>
                <div className="relative w-full">
                  <select
                    value={chapterForm.status}
                    onChange={e => setChapterForm({ ...chapterForm, status: e.target.value })}
                    className="w-full pl-3.5 pr-8 py-2 rounded-xl bg-slate-50/50 hover:bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 font-bold transition-all cursor-pointer appearance-none"
                  >
                    <option value="NOT STARTED">Not Started</option>
                    <option value="IN PROGRESS">In Progress</option>
                    <option value="COMPLETED">Completed</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Teacher Remarks & Notes</label>
                <textarea
                  rows={3}
                  value={chapterForm.notes}
                  onChange={e => setChapterForm({ ...chapterForm, notes: e.target.value })}
                  placeholder="e.g. Introductory concepts clear. Ready for test."
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50/50 hover:bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 font-medium transition-all"
                />
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-slate-200">
                {chapterModal.mode === 'edit' ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteChapter(chapterModal.chapter._id)}
                    className="px-4 py-2 rounded-xl border border-red-200 hover:bg-red-50 text-red-600 text-sm font-semibold cursor-pointer transition-colors"
                  >
                    Delete Chapter
                  </button>
                ) : (
                  <div />
                )}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setChapterModal(null)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-sm font-semibold cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-md cursor-pointer transition-all transform active:scale-95"
                  >
                    {chapterModal.mode === 'edit' ? 'Save Changes' : 'Create Chapter'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

