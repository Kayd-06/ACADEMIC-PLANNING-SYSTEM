'use client'
import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2, Loader2, Upload } from 'lucide-react'
import CurriculumCsvUploadModal from './CurriculumCsvUploadModal'

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

const BOARDS = ['', 'CBSE', 'ICSE', 'ISC']
const CLASS_LEVELS = ['', '9', '10', '11', '12', 'Repeater']

const inputClass = 'w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400 focus:bg-white transition-colors'
const labelClass = 'block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1'

export default function CurriculumManagerView() {
  const [subjects, setSubjects] = useState<SubjectOption[]>([])
  const [programs, setPrograms] = useState<ProgramOption[]>([])
  const [selectedSubjectId, setSelectedSubjectId] = useState('')
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [selectedChapterId, setSelectedChapterId] = useState('')
  const [concepts, setConcepts] = useState<Concept[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [chapterForm, setChapterForm] = useState({ name: '', code: '', board: '', classLevel: '', programId: '', expectedHours: '' })
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null)

  const [conceptForm, setConceptForm] = useState({ name: '', code: '' })
  const [editingConceptId, setEditingConceptId] = useState<string | null>(null)

  const [showImportModal, setShowImportModal] = useState(false)

  useEffect(() => {
    fetch('/api/subjects')
      .then((res) => res.json())
      .then((data) => {
        if (!Array.isArray(data)) return
        const options = data.filter((s: any) => s.id).map((s: any) => ({ id: s.id, name: s.name }))
        setSubjects(options)
        if (options.length > 0) setSelectedSubjectId((prev) => prev || options[0].id)
      })
      .catch(() => setError('Failed to load subjects'))

    fetch('/api/programs')
      .then((res) => res.json())
      .then((data) => {
        if (!Array.isArray(data)) return
        setPrograms(data.filter((p: any) => p.id).map((p: any) => ({ id: p.id, name: p.name })))
      })
      .catch(() => {})
  }, [])

  const loadChapters = useCallback(async (subjectId: string) => {
    if (!subjectId) { setChapters([]); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/curriculum/chapters?subjectId=${subjectId}`)
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
      const res = await fetch(`/api/curriculum/concepts?chapterId=${chapterId}`)
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
    const url = editingChapterId ? `/api/curriculum/chapters?id=${editingChapterId}` : '/api/curriculum/chapters'
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
    const url = editingConceptId ? `/api/curriculum/concepts?id=${editingConceptId}` : '/api/curriculum/concepts'
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

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Curriculum Manager</h1>
          <p className="text-sm text-slate-500 mt-1">Manage chapters and concepts used to tag questions and track syllabus progress.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowImportModal(true)}
          disabled={subjects.length === 0}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-[#0b1320] text-white text-xs font-bold rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          <Upload className="w-3.5 h-3.5" /> Import CSV
        </button>
      </div>

      {error && <p className="text-sm text-rose-600 font-medium bg-rose-50 border border-rose-100 rounded-lg px-4 py-2.5">{error}</p>}

      <div>
        <label className={labelClass}>Subject</label>
        <select value={selectedSubjectId} onChange={(e) => setSelectedSubjectId(e.target.value)} className={inputClass + ' max-w-xs'}>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          {subjects.length === 0 && <option value="">No subjects available</option>}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Chapters</h2>

          <form onSubmit={submitChapter} className="grid grid-cols-2 gap-2">
            <input placeholder="Chapter name" value={chapterForm.name} onChange={(e) => setChapterForm((f) => ({ ...f, name: e.target.value }))} className={inputClass} />
            <input placeholder="Code" value={chapterForm.code} onChange={(e) => setChapterForm((f) => ({ ...f, code: e.target.value }))} className={inputClass} />
            <select value={chapterForm.board} onChange={(e) => setChapterForm((f) => ({ ...f, board: e.target.value }))} className={inputClass}>
              {BOARDS.map((b) => <option key={b} value={b}>{b || 'No board'}</option>)}
            </select>
            <select value={chapterForm.classLevel} onChange={(e) => setChapterForm((f) => ({ ...f, classLevel: e.target.value }))} className={inputClass}>
              {CLASS_LEVELS.map((c) => <option key={c} value={c}>{c ? `Class ${c}` : 'No class'}</option>)}
            </select>
            <select value={chapterForm.programId} onChange={(e) => setChapterForm((f) => ({ ...f, programId: e.target.value }))} className={inputClass}>
              <option value="">No program</option>
              {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input type="number" placeholder="Expected hours" value={chapterForm.expectedHours} onChange={(e) => setChapterForm((f) => ({ ...f, expectedHours: e.target.value }))} className={inputClass} />
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
            {chapters.map((c) => (
              <div
                key={c.id}
                onClick={() => setSelectedChapterId(c.id)}
                className={`flex items-center justify-between px-3 py-2 rounded-lg border cursor-pointer transition-colors ${selectedChapterId === c.id ? 'border-indigo-400 bg-indigo-50' : 'border-slate-100 hover:bg-slate-50'}`}
              >
                <div>
                  <p className="text-sm font-semibold text-slate-800">{c.name}</p>
                  <p className="text-[11px] text-slate-400">
                    {c.code || 'No code'}
                    {c.board ? ` · ${c.board}` : ''}
                    {c.classLevel ? ` · Class ${c.classLevel}` : ''}
                    {c.programId ? ` · ${programs.find((p) => p.id === c.programId)?.name ?? 'Program'}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={(e) => { e.stopPropagation(); startEditChapter(c) }} className="p-1.5 text-slate-400 hover:text-slate-700">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" onClick={(e) => { e.stopPropagation(); removeChapter(c.id) }} className="p-1.5 text-slate-400 hover:text-rose-600">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
            {!loading && chapters.length === 0 && <p className="text-xs text-slate-400">No chapters yet for this subject.</p>}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
            Concepts {selectedChapterId ? `— ${chapters.find((c) => c.id === selectedChapterId)?.name ?? ''}` : ''}
          </h2>

          {!selectedChapterId ? (
            <p className="text-xs text-slate-400">Select a chapter to manage its concepts.</p>
          ) : (
            <>
              <form onSubmit={submitConcept} className="grid grid-cols-2 gap-2">
                <input placeholder="Concept name" value={conceptForm.name} onChange={(e) => setConceptForm((f) => ({ ...f, name: e.target.value }))} className={inputClass} />
                <input placeholder="Code" value={conceptForm.code} onChange={(e) => setConceptForm((f) => ({ ...f, code: e.target.value }))} className={inputClass} />
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
                {concepts.map((c) => (
                  <div key={c.id} className="flex items-center justify-between px-3 py-2 rounded-lg border border-slate-100">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{c.name}</p>
                      <p className="text-[11px] text-slate-400">{c.code || 'No code'}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => startEditConcept(c)} className="p-1.5 text-slate-400 hover:text-slate-700">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" onClick={() => removeConcept(c.id)} className="p-1.5 text-slate-400 hover:text-rose-600">
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

      {showImportModal && (
        <CurriculumCsvUploadModal
          subjects={subjects}
          defaultSubjectId={selectedSubjectId}
          onClose={() => setShowImportModal(false)}
          onImported={(importedSubjectId) => {
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
