'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import * as XLSX from 'xlsx'
import {
  Users,
  Plus,
  Upload,
  Search,
  Pencil,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Download,
  FileSpreadsheet,
  ChevronDown,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
} from 'lucide-react'

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, type: 'spring' as const, stiffness: 320, damping: 28 },
})

interface Student {
  _id: string
  name: string
  rollNo: string
  class: string
  section: string
  parentContact?: string
  isActive: boolean
}

interface ParsedRow {
  name: string
  rollNo: string
  class: string
  section: string
  parentContact: string
}

const EMPTY_FORM = { name: '', rollNo: '', class: '', section: '', parentContact: '' }

function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    ['Name', 'Roll No', 'Class', 'Section', 'Parent Contact'],
    ['Rahul Sharma', '101', 'Grade 10', 'A', '9876543210'],
    ['Priya Patel', '102', 'Grade 10', 'A', '9123456789'],
    ['Amit Verma', '103', 'Grade 10', 'B', ''],
  ])
  ws['!cols'] = [{ wch: 22 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 18 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Students')
  XLSX.writeFile(wb, 'student_roster_template.xlsx')
}

export default function StudentRoster() {
  const [tab, setTab] = useState<'roster' | 'import'>('roster')
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [classFilter, setClassFilter] = useState('')
  const [sectionFilter, setSectionFilter] = useState('')
  const [showInactive, setShowInactive] = useState(false)

  // Single-add form
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [formSuccess, setFormSuccess] = useState(false)
  const [formSaving, setFormSaving] = useState(false)

  // Edit modal
  const [editStudent, setEditStudent] = useState<Student | null>(null)
  const [editForm, setEditForm] = useState(EMPTY_FORM)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  // Import tab
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [importError, setImportError] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ succeeded: number; failed: number; total: number } | null>(null)

  const fetchStudents = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (!showInactive) params.set('activeOnly', 'true')
      if (classFilter) params.set('class', classFilter)
      if (sectionFilter) params.set('section', sectionFilter)
      const res = await fetch(`/api/students?${params}`)
      const data = await res.json()
      if (!data.error) setStudents(data)
    } finally {
      setLoading(false)
    }
  }, [showInactive, classFilter, sectionFilter])

  useEffect(() => { fetchStudents() }, [fetchStudents])

  // Unique classes/sections for filters
  const allClasses = [...new Set(students.map(s => s.class))].sort()
  const allSections = [...new Set(students.filter(s => !classFilter || s.class === classFilter).map(s => s.section))].sort()

  const filtered = students.filter(s => {
    const q = search.toLowerCase()
    return !q || s.name.toLowerCase().includes(q) || s.rollNo.toLowerCase().includes(q)
  })

  // ── Single Add ──
  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    if (!form.name.trim()) {
      setFormError('Student name is required.')
      return
    }
    setFormSaving(true)
    try {
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, class: form.class, section: form.section }),
      })
      const data = await res.json()
      if (!res.ok) { setFormError(data.error || 'Failed to add student'); return }
      setFormSuccess(true)
      setForm(EMPTY_FORM)
      await fetchStudents()
      setTimeout(() => setFormSuccess(false), 2500)
    } finally {
      setFormSaving(false)
    }
  }

  // ── Edit ──
  function openEdit(s: Student) {
    setEditStudent(s)
    setEditForm({ name: s.name, rollNo: s.rollNo, class: s.class, section: s.section, parentContact: s.parentContact || '' })
    setEditError('')
  }

  async function handleEditSave() {
    if (!editStudent) return
    setEditSaving(true)
    setEditError('')
    try {
      const res = await fetch(`/api/students?id=${editStudent._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      const data = await res.json()
      if (!res.ok) { setEditError(data.error || 'Update failed'); return }
      setEditStudent(null)
      await fetchStudents()
    } finally {
      setEditSaving(false)
    }
  }

  // ── Delete / Deactivate ──
  async function handleToggleActive(s: Student) {
    if (s.isActive && !confirm(`Deactivate ${s.name}? They'll be hidden from teacher dropdowns.`)) return
    await fetch(`/api/students?id=${s._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !s.isActive }),
    })
    await fetchStudents()
  }

  async function handleDelete(s: Student) {
    if (!confirm(`Permanently delete ${s.name}? This cannot be undone.`)) return
    await fetch(`/api/students?id=${s._id}&permanent=true`, { method: 'DELETE' })
    await fetchStudents()
  }

  // ── Excel/CSV Parse ──
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportError('')
    setParsedRows([])
    setImportResult(null)

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const raw: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' })

        // Normalize header names (case-insensitive)
        const rows: ParsedRow[] = raw.map(r => {
          const keys = Object.keys(r)
          const get = (variants: string[]) => {
            for (const v of variants) {
              const found = keys.find(k => k.toLowerCase().replace(/\s+/g, '') === v.toLowerCase())
              if (found) return String(r[found]).trim()
            }
            return ''
          }
          return {
            name: get(['name', 'studentname']),
            rollNo: get(['rollno', 'roll', 'rollnumber', 'id']),
            class: get(['class', 'grade', 'classname']),
            section: get(['section', 'div', 'division']),
            parentContact: get(['parentcontact', 'contact', 'phone', 'mobile']),
          }
        }).filter(r => r.name)

        if (rows.length === 0) {
          setImportError('No valid rows found. Make sure at least a Name column exists.')
          return
        }
        setParsedRows(rows)
      } catch {
        setImportError('Failed to parse file. Please use the provided template or a standard Excel/CSV file.')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  async function handleImport() {
    if (parsedRows.length === 0) return
    setImporting(true)
    setImportResult(null)
    try {
      const res = await fetch('/api/students/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ students: parsedRows }),
      })
      const data = await res.json()
      if (!res.ok) { setImportError(data.error || 'Import failed'); return }
      if (data.failed > 0 && data.failedReasons?.length > 0) {
        setImportError(`Failed to insert. Reason: ${data.failedReasons[0]}`);
        return;
      }
      setImportResult(data)
      setParsedRows([])
      if (fileInputRef.current) fileInputRef.current.value = ''
      await fetchStudents()
      setTab('roster')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="flex-1 p-8 overflow-auto bg-gray-50/50">
      {/* Edit Modal */}
      <AnimatePresence>
        {editStudent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl p-6 shadow-xl w-full max-w-md border border-slate-100"
            >
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-base font-bold text-gray-900">Edit Student</h3>
                <button onClick={() => setEditStudent(null)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-3">
                {[
                  { label: 'Full Name', field: 'name', placeholder: 'e.g. Rahul Sharma' },
                  { label: 'Roll No', field: 'rollNo', placeholder: 'e.g. 101' },
                  { label: 'Class', field: 'class', placeholder: 'e.g. Grade 10' },
                  { label: 'Section', field: 'section', placeholder: 'e.g. A' },
                  { label: 'Parent Contact', field: 'parentContact', placeholder: '10-digit mobile (optional)' },
                ].map(({ label, field, placeholder }) => (
                  <div key={field}>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">{label}</label>
                    <input
                      value={(editForm as any)[field]}
                      onChange={e => setEditForm({ ...editForm, [field]: e.target.value })}
                      placeholder={placeholder}
                      className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#002045]/20"
                    />
                  </div>
                ))}
                {editError && <p className="text-xs text-red-500">{editError}</p>}
                <button
                  onClick={handleEditSave}
                  disabled={editSaving}
                  className="w-full bg-[#002045] text-white font-bold py-2.5 rounded-xl hover:bg-[#1a365d] transition-colors mt-2 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {editSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {editSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Header */}
      <motion.div {...fadeUp(0)} className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Student Roster</h1>
          <p className="text-gray-500 mt-1 text-sm">Central student database. Teachers use this to fill reports without manual name entry.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={downloadTemplate}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 border border-gray-200 bg-white rounded-xl shadow-sm hover:bg-gray-50 transition-all font-semibold"
          >
            <Download className="w-3.5 h-3.5" /> Download Template
          </button>
          <button
            onClick={() => setTab('import')}
            className="flex items-center gap-2 px-4 py-2 bg-[#002045] hover:bg-[#1a365d] text-white text-sm font-bold rounded-xl shadow-sm transition-all"
          >
            <Upload className="w-4 h-4" /> Import Excel
          </button>
        </div>
      </motion.div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Students', value: students.filter(s => s.isActive).length, color: 'bg-blue-50', icon: <Users className="w-5 h-5 text-blue-600" /> },
          { label: 'Classes', value: allClasses.length, color: 'bg-indigo-50', icon: <FileSpreadsheet className="w-5 h-5 text-indigo-600" /> },
          { label: 'Sections', value: [...new Set(students.map(s => `${s.class}-${s.section}`))].length, color: 'bg-purple-50', icon: <ChevronDown className="w-5 h-5 text-purple-600" /> },
          { label: 'Inactive', value: students.filter(s => !s.isActive).length, color: 'bg-gray-50', icon: <ToggleLeft className="w-5 h-5 text-gray-400" /> },
        ].map((stat, i) => (
          <motion.div key={stat.label} {...fadeUp(i * 0.04)} className={`${stat.color} rounded-2xl p-5 shadow-sm border border-transparent hover:border-gray-200 transition-colors`}>
            <div className="flex items-center justify-between mb-3">{stat.icon}</div>
            <p className="text-2xl font-bold text-gray-900 leading-none mb-1">{stat.value}</p>
            <p className="text-xs font-semibold text-gray-500">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <motion.div {...fadeUp(0.1)} className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-6">
        {(['roster', 'import'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all capitalize ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t === 'roster' ? `Roster (${students.filter(s => s.isActive).length})` : 'Import / Add'}
          </button>
        ))}
      </motion.div>

      <AnimatePresence mode="wait">
        {/* ── ROSTER TAB ── */}
        {tab === 'roster' && (
          <motion.div key="roster" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {/* Filters row */}
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <div className="relative flex-1 min-w-[220px] max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search by name or roll no..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-[#002045]/20 shadow-sm"
                />
              </div>
              <select
                value={classFilter}
                onChange={e => { setClassFilter(e.target.value); setSectionFilter('') }}
                className="px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-[#002045]/20 shadow-sm font-medium text-gray-600"
              >
                <option value="">All Classes</option>
                {allClasses.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select
                value={sectionFilter}
                onChange={e => setSectionFilter(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-[#002045]/20 shadow-sm font-medium text-gray-600"
              >
                <option value="">All Sections</option>
                {allSections.map(s => <option key={s} value={s}>Section {s}</option>)}
              </select>
              <button
                onClick={() => setShowInactive(!showInactive)}
                className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-xl transition-all font-semibold shadow-sm ${showInactive ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-white border-gray-200 text-gray-500'}`}
              >
                {showInactive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                {showInactive ? 'Showing Inactive' : 'Show Inactive'}
              </button>
              <button onClick={fetchStudents} className="p-2 text-gray-400 hover:text-gray-600 bg-white border border-gray-200 rounded-xl shadow-sm hover:bg-gray-50 transition-all">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-24">
                <Loader2 className="w-7 h-7 animate-spin text-indigo-600" />
              </div>
            ) : filtered.length === 0 ? (
              <motion.div {...fadeUp(0.05)} className="flex flex-col items-center justify-center py-20 bg-white border border-gray-100 rounded-2xl shadow-sm text-center">
                <Users className="w-12 h-12 text-gray-200 mb-4" />
                <p className="text-lg font-bold text-gray-700">No students found</p>
                <p className="text-sm text-gray-400 max-w-sm mt-1">
                  {search ? 'Try a different search term.' : 'Import an Excel file or add students manually using the "Import / Add" tab.'}
                </p>
              </motion.div>
            ) : (
              <motion.div {...fadeUp(0.05)} className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        {['#', 'Roll No', 'Name', 'Class', 'Section', 'Parent Contact', 'Status', ''].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filtered.map((s, i) => (
                        <motion.tr
                          key={s._id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: i * 0.02 }}
                          className={`hover:bg-gray-50/60 transition-colors ${!s.isActive ? 'opacity-50' : ''}`}
                        >
                          <td className="px-4 py-3 text-xs text-gray-400">{i + 1}</td>
                          <td className="px-4 py-3 text-sm font-bold text-[#002045]">{s.rollNo}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-gray-800">{s.name}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{s.class}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">Section {s.section}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{s.parentContact || '—'}</td>
                          <td className="px-4 py-3">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}>
                              {s.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 justify-end">
                              <button
                                onClick={() => openEdit(s)}
                                className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                title="Edit"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleToggleActive(s)}
                                className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                                title={s.isActive ? 'Deactivate' : 'Reactivate'}
                              >
                                {s.isActive ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                onClick={() => handleDelete(s)}
                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                title="Delete permanently"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-3 border-t border-gray-50 text-xs text-gray-400 font-medium">
                  Showing {filtered.length} of {students.length} students
                </div>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* ── IMPORT / ADD TAB ── */}
        {tab === 'import' && (
          <motion.div key="import" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="grid grid-cols-12 gap-6">
            {/* Excel Upload */}
            <div className="col-span-7 space-y-5">
              <motion.div {...fadeUp(0.04)} className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-[#002045]" />
                    <h2 className="text-sm font-bold text-gray-900">Upload Excel / CSV</h2>
                  </div>
                  <button onClick={downloadTemplate} className="text-xs text-indigo-600 font-semibold hover:underline flex items-center gap-1">
                    <Download className="w-3.5 h-3.5" /> Download template
                  </button>
                </div>

                {/* Drop zone */}
                <label
                  htmlFor="roster-file"
                  className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-gray-200 rounded-xl p-8 cursor-pointer hover:border-[#002045]/40 hover:bg-blue-50/20 transition-all group"
                >
                  <Upload className="w-8 h-8 text-gray-300 group-hover:text-[#002045] transition-colors" />
                  <div className="text-center">
                    <p className="text-sm font-semibold text-gray-600 group-hover:text-gray-800">Click to upload or drag & drop</p>
                    <p className="text-xs text-gray-400 mt-0.5">Supports .xlsx, .xls, .csv — Max 5 MB</p>
                  </div>
                  <input
                    ref={fileInputRef}
                    id="roster-file"
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>

                {importError && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-start gap-2 mt-4 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {importError}
                  </motion.div>
                )}

                {importResult && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 mt-4 px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-xl text-sm text-emerald-700 font-semibold">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    Import complete! {importResult.succeeded} imported, {importResult.failed} failed out of {importResult.total} rows.
                  </motion.div>
                )}

                {/* Preview table */}
                {parsedRows.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-5">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-bold text-gray-800">Preview — {parsedRows.length} rows</p>
                      <button onClick={() => { setParsedRows([]); if (fileInputRef.current) fileInputRef.current.value = '' }} className="text-xs text-gray-400 hover:text-gray-600">Clear</button>
                    </div>
                    <div className="border border-gray-100 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            {['Name', 'Roll No', 'Class', 'Section', 'Parent Contact'].map(h => (
                              <th key={h} className="px-3 py-2 text-left font-bold text-gray-400 uppercase tracking-wider text-[10px]">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {parsedRows.map((r, i) => (
                            <tr key={i} className={`hover:bg-gray-50/60 ${!r.name ? 'bg-red-50/50' : ''}`}>
                              <td className="px-3 py-2 font-medium text-gray-800">{r.name || <span className="text-red-400 italic">missing</span>}</td>
                              <td className="px-3 py-2 text-gray-600">{r.rollNo || <span className="text-gray-300 italic">—</span>}</td>
                              <td className="px-3 py-2 text-gray-600">{r.class || <span className="text-gray-300 italic">—</span>}</td>
                              <td className="px-3 py-2 text-gray-600">{r.section || <span className="text-gray-300 italic">—</span>}</td>
                              <td className="px-3 py-2 text-gray-500">{r.parentContact || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <button
                      onClick={handleImport}
                      disabled={importing}
                      className="w-full mt-4 bg-[#002045] hover:bg-[#1a365d] text-white font-bold py-2.5 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      {importing ? 'Importing...' : `Import ${parsedRows.length} Students`}
                    </button>
                  </motion.div>
                )}
              </motion.div>
            </div>

            {/* Manual Add */}
            <div className="col-span-5">
              <motion.div {...fadeUp(0.06)} className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
                <div className="flex items-center gap-2 mb-5">
                  <Plus className="w-5 h-5 text-[#002045]" />
                  <h2 className="text-sm font-bold text-gray-900">Add Single Student</h2>
                </div>
                <form onSubmit={handleAdd} className="space-y-3">
                  {[
                    { label: 'Full Name *', field: 'name', placeholder: 'e.g. Rahul Sharma' },
                    { label: 'Roll No', field: 'rollNo', placeholder: 'e.g. 101 (optional)' },
                    { label: 'Class', field: 'class', placeholder: 'e.g. Grade 10 (optional)' },
                    { label: 'Section', field: 'section', placeholder: 'e.g. A (optional)' },
                    { label: 'Parent Contact', field: 'parentContact', placeholder: '10-digit mobile (optional)' },
                  ].map(({ label, field, placeholder }) => (
                    <div key={field}>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</label>
                      <input
                        value={(form as any)[field]}
                        onChange={e => setForm({ ...form, [field]: e.target.value })}
                        placeholder={placeholder}
                        className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#002045]/20 transition-all"
                      />
                    </div>
                  ))}

                  <AnimatePresence>
                    {formError && (
                      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-xs text-red-500 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" /> {formError}
                      </motion.p>
                    )}
                    {formSuccess && (
                      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-xs text-emerald-600 flex items-center gap-1 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Student added successfully!
                      </motion.p>
                    )}
                  </AnimatePresence>

                  <button
                    type="submit"
                    disabled={formSaving}
                    className="w-full bg-[#002045] hover:bg-[#1a365d] text-white font-bold py-2.5 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
                  >
                    {formSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    {formSaving ? 'Adding...' : 'Add Student'}
                  </button>
                </form>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
