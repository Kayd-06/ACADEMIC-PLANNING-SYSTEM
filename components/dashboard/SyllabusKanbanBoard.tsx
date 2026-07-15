'use client'
import { useState, useEffect } from 'react'
import { Plus, X, Loader2, ChevronDown, Clock, CheckCircle } from 'lucide-react'

const SUBJECTS = ['Physics', 'Chemistry', 'Mathematics', 'Biology', 'English']

export default function SyllabusKanbanBoard({ batches }: { batches: string[] }) {
  const [selectedBatch, setSelectedBatch] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('Physics')
  const [chapters, setChapters] = useState<any[]>([])
  const [chaptersLoading, setChaptersLoading] = useState(false)
  const [chapterModal, setChapterModal] = useState<{ mode: 'add' | 'edit'; chapter?: any } | null>(null)
  const [chapterForm, setChapterForm] = useState({
    title: '', estHours: '12 hrs est.', dates: 'Aug 15 - Aug 28', notes: '', status: 'NOT STARTED'
  })
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (batches.length > 0 && !selectedBatch) setSelectedBatch(batches[0])
  }, [batches])

  useEffect(() => {
    if (selectedBatch) fetchChapters(selectedBatch, selectedSubject)
  }, [selectedBatch, selectedSubject])

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
        : { className: selectedBatch, subject: selectedSubject, ...chapterForm }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        showToast(isEdit ? 'Chapter updated' : 'New chapter added')
        setChapterModal(null)
        fetchChapters(selectedBatch, selectedSubject)
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

  function openEdit(chap: any) {
    setChapterForm({
      title: chap.title,
      estHours: chap.estHours,
      dates: chap.dates,
      notes: chap.notes || '',
      status: chap.status
    })
    setChapterModal({ mode: 'edit', chapter: chap })
  }

  const COLUMNS: { key: string; label: string; badge: string; tagClass: string; dot: string }[] = [
    { key: 'NOT STARTED', label: 'Not Started', badge: 'bg-slate-200 text-slate-600', tagClass: 'bg-slate-50 border-slate-200/60 text-slate-600', dot: 'bg-slate-300' },
    { key: 'IN PROGRESS', label: 'In Progress', badge: 'bg-indigo-50 text-indigo-700 border border-indigo-100', tagClass: 'bg-indigo-50 border-indigo-200/60 text-indigo-700', dot: 'bg-indigo-500 animate-pulse' },
    { key: 'COMPLETED', label: 'Completed', badge: 'bg-emerald-50 text-emerald-700 border border-emerald-100', tagClass: 'bg-emerald-50 border-emerald-200/60 text-emerald-700', dot: 'bg-emerald-500' },
  ]

  return (
    <div className="space-y-6 relative">
      {toast && (
        <div className="fixed bottom-8 right-8 bg-slate-900 text-white px-6 py-3 rounded-xl shadow-2xl z-50 flex items-center gap-3 font-medium animate-in slide-in-from-bottom-5">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          {toast}
        </div>
      )}

      {/* Controls */}
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

        <button
          onClick={() => {
            setChapterForm({ title: '', estHours: '10 hrs est.', dates: 'Oct 01 - Oct 15', notes: '', status: 'NOT STARTED' })
            setChapterModal({ mode: 'add' })
          }}
          className="flex items-center gap-2 px-4.5 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-md cursor-pointer transition-all transform active:scale-95 sm:self-end"
        >
          <Plus className="w-4 h-4" /> Add Chapter
        </button>
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
                        onClick={() => openEdit(chap)}
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

      {/* Chapter Form Modal */}
      {chapterModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="text-lg font-bold text-slate-900">
                {chapterModal.mode === 'edit' ? 'Edit Syllabus Chapter' : 'Add New Chapter'}
              </h3>
              <button onClick={() => setChapterModal(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={saveChapter} className="space-y-4">
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
                    className="px-5 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold shadow-md cursor-pointer transition-all transform active:scale-95"
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
