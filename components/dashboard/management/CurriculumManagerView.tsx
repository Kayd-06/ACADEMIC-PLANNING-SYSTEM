'use client'
import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2, Loader2, Upload, Download, Table2, BookOpen, ChevronDown, Filter, X } from 'lucide-react'
import * as XLSX from 'xlsx'
import CurriculumCsvUploadModal from './CurriculumCsvUploadModal'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SubjectOption { id: string; name: string }
interface ProgramOption { id: string; name: string }

interface Chapter {
  id: string
  subjectId: string
  name: string
  code: string
  board: string | null
  classLevel: string | null
  programId: string | null
  expectedHours: number | null
}

interface Concept {
  id: string
  chapterId: string
  name: string
  code: string
}

interface MasterSheetRow {
  id: string
  board: string
  program: string
  classLevel: string
  subject: string
  chapterName: string
  chapterCode: string
  expectedHours: number | null
  conceptName: string
  conceptCode: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const BOARDS = ['', 'CBSE', 'ICSE', 'ISC', 'State Board']
const CLASS_LEVELS = ['', '9', '10', '11', '12', 'Repeater']

const BOARD_CHIP: Record<string, string> = {
  CBSE:        'bg-blue-50 text-blue-700 border-blue-200',
  ICSE:        'bg-purple-50 text-purple-700 border-purple-200',
  ISC:         'bg-violet-50 text-violet-700 border-violet-200',
  'State Board': 'bg-orange-50 text-orange-700 border-orange-200',
}

// ── Shared input styles ───────────────────────────────────────────────────────

const inputClass   = 'w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400 focus:bg-white transition-colors'
const labelClass   = 'block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1'
const selectClass  = 'px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-indigo-400 focus:bg-white transition-colors appearance-none cursor-pointer'

// ── Component ─────────────────────────────────────────────────────────────────

export default function CurriculumManagerView() {
  const [activeTab, setActiveTab] = useState<'editor' | 'masterSheet'>('editor')

  // ── Shared data ──
  const [subjects,  setSubjects]  = useState<SubjectOption[]>([])
  const [programs,  setPrograms]  = useState<ProgramOption[]>([])
  const [error,     setError]     = useState('')

  // ── Chapter editor ──
  const [selectedSubjectId,  setSelectedSubjectId]  = useState('')
  const [chapters,           setChapters]           = useState<Chapter[]>([])
  const [selectedChapterId,  setSelectedChapterId]  = useState('')
  const [concepts,           setConcepts]           = useState<Concept[]>([])
  const [loading,            setLoading]            = useState(false)

  const [chapterForm,        setChapterForm]        = useState({ name: '', code: '', board: '', classLevel: '', programId: '', expectedHours: '' })
  const [editingChapterId,   setEditingChapterId]   = useState<string | null>(null)

  const [conceptForm,        setConceptForm]        = useState({ name: '', code: '' })
  const [editingConceptId,   setEditingConceptId]   = useState<string | null>(null)

  const [showImportModal,    setShowImportModal]    = useState(false)

  // ── Master Sheet ──
  const [masterRows,         setMasterRows]         = useState<MasterSheetRow[]>([])
  const [masterLoading,      setMasterLoading]      = useState(false)
  const [masterError,        setMasterError]        = useState('')
  const [filterBoard,        setFilterBoard]        = useState('')
  const [filterClass,        setFilterClass]        = useState('')
  const [filterProgramId,    setFilterProgramId]    = useState('')
  const [filterSubjectId,    setFilterSubjectId]    = useState('')
  const [masterExporting,    setMasterExporting]    = useState(false)

  // ── Load shared data on mount ──────────────────────────────────────────────

  useEffect(() => {
    fetch('/api/subjects')
      .then(r => r.json())
      .then(data => {
        if (!Array.isArray(data)) return
        const options = data.filter((s: any) => s.id).map((s: any) => ({ id: s.id, name: s.name }))
        setSubjects(options)
        if (options.length > 0) setSelectedSubjectId(prev => prev || options[0].id)
      })
      .catch(() => setError('Failed to load subjects'))

    fetch('/api/programs')
      .then(r => r.json())
      .then(data => {
        if (!Array.isArray(data)) return
        setPrograms(data.filter((p: any) => p.id).map((p: any) => ({ id: p.id, name: p.name })))
      })
      .catch(() => {})
  }, [])

  // ── Chapter editor logic ───────────────────────────────────────────────────

  const loadChapters = useCallback(async (subjectId: string) => {
    if (!subjectId) { setChapters([]); return }
    setLoading(true)
    try {
      const res  = await fetch(`/api/curriculum/chapters?subjectId=${subjectId}`)
      const data = await res.json()
      if (Array.isArray(data)) setChapters(data)
    } catch {
      setError('Failed to load chapters')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadChapters(selectedSubjectId)
    setSelectedChapterId('')
    setConcepts([])
    resetChapterForm()
  }, [selectedSubjectId, loadChapters])

  const loadConcepts = useCallback(async (chapterId: string) => {
    if (!chapterId) { setConcepts([]); return }
    try {
      const res  = await fetch(`/api/curriculum/concepts?chapterId=${chapterId}`)
      const data = await res.json()
      if (Array.isArray(data)) setConcepts(data)
    } catch {
      setError('Failed to load concepts')
    }
  }, [])

  useEffect(() => {
    loadConcepts(selectedChapterId)
    resetConceptForm()
  }, [selectedChapterId, loadConcepts])

  function resetChapterForm() {
    setChapterForm({ name: '', code: '', board: '', classLevel: '', programId: '', expectedHours: '' })
    setEditingChapterId(null)
  }

  function startEditChapter(c: Chapter) {
    setEditingChapterId(c.id)
    setChapterForm({
      name: c.name,
      code: c.code,
      board: c.board ?? '',
      classLevel: c.classLevel ?? '',
      programId: c.programId ?? '',
      expectedHours: c.expectedHours ? String(c.expectedHours) : '',
    })
  }

  async function submitChapter(e: React.FormEvent) {
    e.preventDefault()
    if (!chapterForm.name.trim() || !selectedSubjectId) return
    setError('')
    const payload: any = {
      name: chapterForm.name.trim(),
      code: chapterForm.code.trim(),
      board: chapterForm.board || null,
      classLevel: chapterForm.classLevel || null,
      programId: chapterForm.programId || null,
      expectedHours: chapterForm.expectedHours ? Number(chapterForm.expectedHours) : null,
    }
    const url    = editingChapterId ? `/api/curriculum/chapters?id=${editingChapterId}` : '/api/curriculum/chapters'
    const method = editingChapterId ? 'PATCH' : 'POST'
    if (!editingChapterId) payload.subjectId = selectedSubjectId

    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error || 'Failed to save chapter')
      return
    }
    resetChapterForm()
    loadChapters(selectedSubjectId)
  }

  async function removeChapter(id: string) {
    if (!confirm('Delete this chapter? This also removes its concepts and any batch syllabus progress tracked against it.')) return
    await fetch(`/api/curriculum/chapters?id=${id}`, { method: 'DELETE' })
    if (selectedChapterId === id) setSelectedChapterId('')
    loadChapters(selectedSubjectId)
  }

  function resetConceptForm() {
    setConceptForm({ name: '', code: '' })
    setEditingConceptId(null)
  }

  function startEditConcept(c: Concept) {
    setEditingConceptId(c.id)
    setConceptForm({ name: c.name, code: c.code })
  }

  async function submitConcept(e: React.FormEvent) {
    e.preventDefault()
    if (!conceptForm.name.trim() || !selectedChapterId) return
    setError('')
    const payload: any = { name: conceptForm.name.trim(), code: conceptForm.code.trim() }
    const url    = editingConceptId ? `/api/curriculum/concepts?id=${editingConceptId}` : '/api/curriculum/concepts'
    const method = editingConceptId ? 'PATCH' : 'POST'
    if (!editingConceptId) payload.chapterId = selectedChapterId

    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error || 'Failed to save concept')
      return
    }
    resetConceptForm()
    loadConcepts(selectedChapterId)
  }

  async function removeConcept(id: string) {
    if (!confirm('Delete this concept?')) return
    await fetch(`/api/curriculum/concepts?id=${id}`, { method: 'DELETE' })
    loadConcepts(selectedChapterId)
  }

  // ── Master Sheet logic ─────────────────────────────────────────────────────

  const loadMasterSheet = useCallback(async (board: string, classLevel: string, programId: string, subjectId: string) => {
    setMasterLoading(true)
    setMasterError('')
    try {
      const params = new URLSearchParams()
      if (board)      params.set('board',      board)
      if (classLevel) params.set('classLevel', classLevel)
      const programName = programs.find(p => p.id === programId)?.name
      if (programName) params.set('program', programName)
      const subjectName = subjects.find(s => s.id === subjectId)?.name
      if (subjectName) params.set('subject', subjectName)

      const res  = await fetch(`/api/curriculum/master-curriculum?${params.toString()}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load master sheet')
      setMasterRows(Array.isArray(data) ? data : [])
    } catch (err: any) {
      setMasterError(err.message)
    } finally {
      setMasterLoading(false)
    }
  }, [])

  // Load master sheet whenever the tab becomes active or filters change
  useEffect(() => {
    if (activeTab === 'masterSheet') {
      loadMasterSheet(filterBoard, filterClass, filterProgramId, filterSubjectId)
    }
  }, [activeTab, filterBoard, filterClass, filterProgramId, filterSubjectId, loadMasterSheet])

  function clearMasterFilters() {
    setFilterBoard('')
    setFilterClass('')
    setFilterProgramId('')
    setFilterSubjectId('')
  }

  const hasActiveFilters = !!(filterBoard || filterClass || filterProgramId || filterSubjectId)

  // ── Excel export ──────────────────────────────────────────────────────────

  async function handleExportExcel() {
    if (masterRows.length === 0) return
    setMasterExporting(true)
    try {
      const sheetData = [
        // Header row — exact 8 columns matching spec
        ['Board', 'Program', 'Class', 'Subject', 'Chapter Name', 'Chapter Code', 'Concept Name', 'Concept Code'],
        // Data rows
        ...masterRows.map(r => [
          r.board        ?? '',
          r.program      ?? '',
          r.classLevel   ?? '',
          r.subject,
          r.chapterName,
          r.chapterCode,
          r.conceptName  ?? '',
          r.conceptCode  ?? '',
        ]),
      ]

      const ws = XLSX.utils.aoa_to_sheet(sheetData)
      // Auto-width columns
      const colWidths = sheetData[0].map((_, colIdx) =>
        Math.max(...sheetData.map(row => String(row[colIdx] ?? '').length), 12)
      )
      ws['!cols'] = colWidths.map(w => ({ wch: Math.min(w + 2, 40) }))

      // Style header row bold (xlsx-style not available in free xlsx, skip)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Master Sheet')

      const filterSuffix = [filterBoard, filterClass, filterProgramId ? programs.find(p => p.id === filterProgramId)?.name : '', filterSubjectId ? subjects.find(s => s.id === filterSubjectId)?.name : ''].filter(Boolean).join('_') || 'All'
      XLSX.writeFile(wb, `Curriculum_Master_Sheet_${filterSuffix}.xlsx`)
    } finally {
      setMasterExporting(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* ── Page Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Curriculum Manager</h1>
          <p className="text-sm text-slate-500 mt-1">Manage chapters and concepts across boards, programs, and class levels.</p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === 'editor' && (
            <button
              type="button"
              onClick={() => setShowImportModal(true)}
              disabled={subjects.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-[#0b1320] text-white text-xs font-bold rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Upload className="w-3.5 h-3.5" /> Import CSV
            </button>
          )}
          {activeTab === 'masterSheet' && (
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={masterExporting || masterRows.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {masterExporting
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Download className="w-3.5 h-3.5" />
              }
              Export to Excel
            </button>
          )}
        </div>
      </div>

      {/* ── Tab Bar ── */}
      <div className="flex items-center gap-1 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('editor')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-t-lg border-b-2 transition-colors cursor-pointer -mb-px ${
            activeTab === 'editor'
              ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          Chapters &amp; Concepts
        </button>
        <button
          onClick={() => setActiveTab('masterSheet')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-t-lg border-b-2 transition-colors cursor-pointer -mb-px ${
            activeTab === 'masterSheet'
              ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <Table2 className="w-3.5 h-3.5" />
          Master Sheet
          <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-extrabold ${activeTab === 'masterSheet' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
            8 Fields
          </span>
        </button>
      </div>

      {/* ── Shared error banner ── */}
      {error && (
        <p className="text-sm text-rose-600 font-medium bg-rose-50 border border-rose-100 rounded-lg px-4 py-2.5">{error}</p>
      )}

      {/* ── Tab: Chapters & Concepts Editor ── */}
      {activeTab === 'editor' && (
        <>
          <div>
            <label className={labelClass}>Subject</label>
            <select value={selectedSubjectId} onChange={e => setSelectedSubjectId(e.target.value)} className={inputClass + ' max-w-xs'}>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              {subjects.length === 0 && <option value="">No subjects available</option>}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* Chapters panel */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Chapters</h2>

              <form onSubmit={submitChapter} className="grid grid-cols-2 gap-2">
                <input placeholder="Chapter name *" value={chapterForm.name} onChange={e => setChapterForm(f => ({ ...f, name: e.target.value }))} className={inputClass} />
                <input placeholder="Chapter Code (e.g. PHY-11-CH03)" value={chapterForm.code} onChange={e => setChapterForm(f => ({ ...f, code: e.target.value }))} className={inputClass} />
                <select value={chapterForm.board} onChange={e => setChapterForm(f => ({ ...f, board: e.target.value }))} className={inputClass}>
                  {BOARDS.map(b => <option key={b} value={b}>{b || 'No board'}</option>)}
                </select>
                <select value={chapterForm.classLevel} onChange={e => setChapterForm(f => ({ ...f, classLevel: e.target.value }))} className={inputClass}>
                  {CLASS_LEVELS.map(c => <option key={c} value={c}>{c ? `Class ${c}` : 'No class'}</option>)}
                </select>
                <select value={chapterForm.programId} onChange={e => setChapterForm(f => ({ ...f, programId: e.target.value }))} className={inputClass}>
                  <option value="">No program</option>
                  {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <input type="number" min="0" placeholder="Expected hours" value={chapterForm.expectedHours} onChange={e => setChapterForm(f => ({ ...f, expectedHours: e.target.value }))} className={inputClass} />
                <div className="col-span-2 flex gap-2">
                  <button type="submit" className="flex items-center gap-1.5 px-3 py-2 bg-[#0b1320] text-white text-xs font-bold rounded-lg hover:bg-slate-800 transition-colors">
                    <Plus className="w-3.5 h-3.5" /> {editingChapterId ? 'Save Chapter' : 'Add Chapter'}
                  </button>
                  {editingChapterId && (
                    <button type="button" onClick={resetChapterForm} className="px-3 py-2 border border-slate-200 text-xs font-bold rounded-lg hover:bg-slate-50 transition-colors">
                      Cancel
                    </button>
                  )}
                </div>
              </form>

              <div className="space-y-1.5">
                {loading && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                {chapters.map(c => (
                  <div
                    key={c.id}
                    onClick={() => setSelectedChapterId(c.id)}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg border cursor-pointer transition-colors ${selectedChapterId === c.id ? 'border-indigo-400 bg-indigo-50' : 'border-slate-100 hover:bg-slate-50'}`}
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{c.name}</p>
                      <p className="text-[11px] text-slate-400">
                        {c.code || 'No code'}
                        {c.board     ? ` · ${c.board}`                                                    : ''}
                        {c.classLevel ? ` · Class ${c.classLevel}`                                        : ''}
                        {c.programId  ? ` · ${programs.find(p => p.id === c.programId)?.name ?? 'Program'}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={e => { e.stopPropagation(); startEditChapter(c) }} className="p-1.5 text-slate-400 hover:text-slate-700 cursor-pointer">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" onClick={e => { e.stopPropagation(); removeChapter(c.id) }} className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
                {!loading && chapters.length === 0 && <p className="text-xs text-slate-400">No chapters yet for this subject.</p>}
              </div>
            </div>

            {/* Concepts panel */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                Concepts {selectedChapterId ? `— ${chapters.find(c => c.id === selectedChapterId)?.name ?? ''}` : ''}
              </h2>

              {!selectedChapterId ? (
                <p className="text-xs text-slate-400">Select a chapter to manage its concepts.</p>
              ) : (
                <>
                  <form onSubmit={submitConcept} className="grid grid-cols-2 gap-2">
                    <input placeholder="Concept name *" value={conceptForm.name} onChange={e => setConceptForm(f => ({ ...f, name: e.target.value }))} className={inputClass} />
                    <input placeholder="Concept Code (e.g. PHY-11-CH03-CP02)" value={conceptForm.code} onChange={e => setConceptForm(f => ({ ...f, code: e.target.value }))} className={inputClass} />
                    <div className="col-span-2 flex gap-2">
                      <button type="submit" className="flex items-center gap-1.5 px-3 py-2 bg-[#0b1320] text-white text-xs font-bold rounded-lg hover:bg-slate-800 transition-colors">
                        <Plus className="w-3.5 h-3.5" /> {editingConceptId ? 'Save Concept' : 'Add Concept'}
                      </button>
                      {editingConceptId && (
                        <button type="button" onClick={resetConceptForm} className="px-3 py-2 border border-slate-200 text-xs font-bold rounded-lg hover:bg-slate-50 transition-colors">
                          Cancel
                        </button>
                      )}
                    </div>
                  </form>

                  <div className="space-y-1.5">
                    {concepts.map(c => (
                      <div key={c.id} className="flex items-center justify-between px-3 py-2 rounded-lg border border-slate-100">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{c.name}</p>
                          <p className="text-[11px] text-slate-400 font-mono">{c.code || 'No code'}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => startEditConcept(c)} className="p-1.5 text-slate-400 hover:text-slate-700 cursor-pointer">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" onClick={() => removeConcept(c.id)} className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {concepts.length === 0 && <p className="text-xs text-slate-400">No concepts yet for this chapter.</p>}
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Tab: Master Sheet ─────────────────────────────────────────────── */}
      {activeTab === 'masterSheet' && (
        <div className="space-y-4">
          {/* Filter bar */}
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1">
                <Filter className="w-3.5 h-3.5" /> Filters
              </div>

              {/* Board */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Board</span>
                <div className="relative">
                  <select value={filterBoard} onChange={e => setFilterBoard(e.target.value)} className={selectClass + ' pr-7 pl-2.5'}>
                    <option value="">All Boards</option>
                    {BOARDS.filter(Boolean).map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                  <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Class */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Class</span>
                <div className="relative">
                  <select value={filterClass} onChange={e => setFilterClass(e.target.value)} className={selectClass + ' pr-7 pl-2.5'}>
                    <option value="">All Classes</option>
                    {CLASS_LEVELS.filter(Boolean).map(c => <option key={c} value={c}>Class {c}</option>)}
                  </select>
                  <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Program */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Program</span>
                <div className="relative">
                  <select value={filterProgramId} onChange={e => setFilterProgramId(e.target.value)} className={selectClass + ' pr-7 pl-2.5'}>
                    <option value="">All Programs</option>
                    {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Subject */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Subject</span>
                <div className="relative">
                  <select value={filterSubjectId} onChange={e => setFilterSubjectId(e.target.value)} className={selectClass + ' pr-7 pl-2.5'}>
                    <option value="">All Subjects</option>
                    {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {hasActiveFilters && (
                <button
                  onClick={clearMasterFilters}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer self-end"
                >
                  <X className="w-3 h-3" /> Clear
                </button>
              )}

              {/* Row count badge */}
              <div className="ml-auto self-end flex items-center gap-2">
                {masterLoading
                  ? <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                  : (
                    <span className="text-[11px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg">
                      {masterRows.length} row{masterRows.length !== 1 ? 's' : ''}
                    </span>
                  )
                }
              </div>
            </div>
          </div>

          {/* Master sheet error */}
          {masterError && (
            <p className="text-sm text-rose-600 font-medium bg-rose-50 border border-rose-100 rounded-lg px-4 py-2.5">{masterError}</p>
          )}

          {/* 8-column master table */}
          {masterLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : masterRows.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl flex flex-col items-center justify-center py-16 text-center gap-3">
              <Table2 className="w-8 h-8 text-slate-300" />
              <p className="text-sm font-semibold text-slate-400">No curriculum data found</p>
              <p className="text-xs text-slate-400">Add chapters &amp; concepts via the editor tab or import a CSV, then return here.</p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      {['Board', 'Program', 'Class', 'Subject', 'Chapter Name', 'Chapter Code', 'Concept Name', 'Concept Code'].map((h, i) => (
                        <th
                          key={h}
                          className={`px-3.5 py-3 text-left font-extrabold text-[10px] text-slate-500 uppercase tracking-wider whitespace-nowrap ${i === 0 ? 'pl-4' : ''}`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {masterRows.map((row, idx) => (
                      <tr key={row.id} className="hover:bg-slate-50/60 transition-colors">
                        {/* Board */}
                        <td className="px-3.5 py-2.5 pl-4">
                          {row.board ? (
                            <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold border ${BOARD_CHIP[row.board] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                              {row.board}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        {/* Program */}
                        <td className="px-3.5 py-2.5">
                          {row.program
                            ? <span className="font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">{row.program}</span>
                            : <span className="text-slate-300">—</span>
                          }
                        </td>
                        {/* Class */}
                        <td className="px-3.5 py-2.5 font-semibold text-slate-600">
                          {row.classLevel ? `Class ${row.classLevel}` : <span className="text-slate-300">—</span>}
                        </td>
                        {/* Subject */}
                        <td className="px-3.5 py-2.5 font-semibold text-slate-800">{row.subject}</td>
                        {/* Chapter Name */}
                        <td className="px-3.5 py-2.5 font-bold text-slate-900 max-w-[200px]">
                          <span className="line-clamp-2">{row.chapterName}</span>
                        </td>
                        {/* Chapter Code */}
                        <td className="px-3.5 py-2.5">
                          {row.chapterCode
                            ? <code className="text-[11px] font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded">{row.chapterCode}</code>
                            : <span className="text-slate-300">—</span>
                          }
                        </td>
                        {/* Concept Name */}
                        <td className="px-3.5 py-2.5 text-slate-700 max-w-[200px]">
                          {row.conceptName
                            ? <span className="line-clamp-2">{row.conceptName}</span>
                            : <span className="text-slate-300">—</span>
                          }
                        </td>
                        {/* Concept Code */}
                        <td className="px-3.5 py-2.5">
                          {row.conceptCode
                            ? <code className="text-[11px] font-mono bg-emerald-50 text-emerald-800 border border-emerald-100 px-2 py-0.5 rounded">{row.conceptCode}</code>
                            : <span className="text-slate-300">—</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Table footer */}
              <div className="border-t border-slate-100 px-4 py-2.5 flex items-center justify-between">
                <p className="text-[11px] text-slate-400">
                  Showing <span className="font-bold text-slate-600">{masterRows.length}</span> rows — 8 field alignment matching Excel Master Sheet spec
                </p>
                <button
                  onClick={handleExportExcel}
                  disabled={masterExporting}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" />
                  {masterExporting ? 'Exporting…' : 'Export .xlsx'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Import CSV Modal ── */}
      {showImportModal && (
        <CurriculumCsvUploadModal
          subjects={subjects}
          programs={programs}
          defaultSubjectId={selectedSubjectId}
          onClose={() => setShowImportModal(false)}
          onImported={importedSubjectId => {
            setShowImportModal(false)
            if (importedSubjectId === selectedSubjectId) {
              loadChapters(selectedSubjectId)
              if (selectedChapterId) loadConcepts(selectedChapterId)
            } else {
              setSelectedSubjectId(importedSubjectId)
            }
          }}
        />
      )}
    </div>
  )
}
