'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import * as XLSX from 'xlsx'
import {
  Upload,
  Plus,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Search,
  Users,
  X,
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

export default function TeacherRosterUpload() {
  const [tab, setTab] = useState<'upload' | 'add' | 'view'>('upload')

  // Existing roster (view tab)
  const [students, setStudents] = useState<Student[]>([])
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [search, setSearch] = useState('')
  const [classFilter, setClassFilter] = useState('')

  const fetchStudents = useCallback(async () => {
    setLoadingStudents(true)
    try {
      const res = await fetch('/api/students?activeOnly=true')
      const data = await res.json()
      if (!data.error) setStudents(data)
    } finally {
      setLoadingStudents(false)
    }
  }, [])

  useEffect(() => { fetchStudents() }, [fetchStudents])

  const allClasses = [...new Set(students.map(s => s.class))].sort()
  const filtered = students.filter(s => {
    const q = search.toLowerCase()
    const matchSearch = !q || s.name.toLowerCase().includes(q) || s.rollNo.toLowerCase().includes(q)
    const matchClass = !classFilter || s.class === classFilter
    return matchSearch && matchClass
  })

  // ── Upload Tab ──
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [importError, setImportError] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ succeeded: number; failed: number; total: number } | null>(null)

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
        setImportError('Could not parse this file. Use the template or a standard Excel/CSV.')
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
    } finally {
      setImporting(false)
    }
  }

  // ── Add Tab ──
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [formSuccess, setFormSuccess] = useState(false)
  const [formSaving, setFormSaving] = useState(false)

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
        body: JSON.stringify(form),
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

  return (
    <div className="flex-1 p-8 overflow-auto bg-gray-50/50">
      {/* Header */}
      <motion.div {...fadeUp(0)} className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Student Roster</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Upload your class student list so reports auto-fill correctly.
          </p>
        </div>
        <button
          onClick={downloadTemplate}
          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 border border-gray-200 bg-white rounded-xl shadow-sm hover:bg-gray-50 transition-all font-semibold"
        >
          <Download className="w-3.5 h-3.5" /> Download Template
        </button>
      </motion.div>

      {/* Stat strip */}
      <motion.div {...fadeUp(0.04)} className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Total Students', value: students.length, color: 'bg-blue-50 text-blue-600' },
          { label: 'Classes on Roster', value: allClasses.length, color: 'bg-indigo-50 text-indigo-600' },
          { label: 'Sections', value: [...new Set(students.map(s => `${s.class}-${s.section}`))].length, color: 'bg-violet-50 text-violet-600' },
        ].map((s, i) => (
          <motion.div key={s.label} {...fadeUp(0.06 + i * 0.03)} className={`${s.color.split(' ')[0]} rounded-2xl p-5 shadow-sm border border-transparent`}>
            <p className={`text-2xl font-bold ${s.color.split(' ')[1]} mb-1`}>{s.value}</p>
            <p className="text-xs font-semibold text-gray-500">{s.label}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Tabs */}
      <motion.div {...fadeUp(0.1)} className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-6">
        {([
          { key: 'upload', label: '↑ Upload Excel / CSV' },
          { key: 'add', label: '+ Add Single Student' },
          { key: 'view', label: `View Roster (${students.length})` },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t.label}
          </button>
        ))}
      </motion.div>

      <AnimatePresence mode="wait">

        {/* ── UPLOAD TAB ── */}
        {tab === 'upload' && (
          <motion.div key="upload" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="max-w-2xl">
              <motion.div {...fadeUp(0.04)} className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
                <div className="flex items-center gap-2 mb-6">
                  <FileSpreadsheet className="w-5 h-5 text-[#002045]" />
                  <h2 className="text-sm font-bold text-gray-900">Upload Excel or CSV</h2>
                  <span className="ml-auto text-xs text-gray-400">Only <strong>Name</strong> is required; Roll No, Class, Section are optional</span>
                </div>

                {/* Drop zone */}
                <label
                  htmlFor="teacher-roster-file"
                  className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-gray-200 rounded-xl p-10 cursor-pointer hover:border-[#002045]/40 hover:bg-blue-50/20 transition-all group"
                >
                  <Upload className="w-10 h-10 text-gray-200 group-hover:text-[#002045] transition-colors" />
                  <div className="text-center">
                    <p className="text-sm font-semibold text-gray-600 group-hover:text-gray-800">Click to upload or drag & drop</p>
                    <p className="text-xs text-gray-400 mt-1">Supports .xlsx, .xls, .csv</p>
                  </div>
                  <button
                    type="button"
                    onClick={e => { e.preventDefault(); downloadTemplate() }}
                    className="text-xs text-indigo-600 font-semibold hover:underline flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" /> Download the template first
                  </button>
                  <input
                    ref={fileInputRef}
                    id="teacher-roster-file"
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>

                <AnimatePresence>
                  {importError && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="flex items-start gap-2 mt-4 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {importError}
                    </motion.div>
                  )}
                  {importResult && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="flex items-center gap-2 mt-4 px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-xl text-sm text-emerald-700 font-semibold">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      Done! {importResult.succeeded} students added/updated
                      {importResult.failed > 0 && `, ${importResult.failed} failed`}.
                      <button onClick={() => setTab('view')} className="ml-auto text-xs font-bold underline">View Roster →</button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Preview table */}
                {parsedRows.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-6">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-bold text-gray-800">Preview — {parsedRows.length} students found</p>
                      <button
                        onClick={() => { setParsedRows([]); if (fileInputRef.current) fileInputRef.current.value = '' }}
                        className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
                      >
                        <X className="w-3 h-3" /> Clear
                      </button>
                    </div>
                    <div className="border border-gray-100 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            {['Name', 'Roll No', 'Class', 'Section', 'Parent Contact'].map(h => (
                              <th key={h} className="px-3 py-2.5 text-left font-bold text-gray-400 uppercase tracking-wider text-[10px]">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {parsedRows.map((r, i) => {
                            const hasError = !r.name
                            return (
                              <tr key={i} className={hasError ? 'bg-red-50/60' : 'hover:bg-gray-50/60'}>
                                <td className="px-3 py-2 font-medium text-gray-800">{r.name || <span className="text-red-400 italic">missing</span>}</td>
                                <td className="px-3 py-2 text-gray-600">{r.rollNo || <span className="text-gray-300 italic">—</span>}</td>
                                <td className="px-3 py-2 text-gray-600">{r.class || <span className="text-gray-300 italic">—</span>}</td>
                                <td className="px-3 py-2 text-gray-600">{r.section || <span className="text-gray-300 italic">—</span>}</td>
                                <td className="px-3 py-2 text-gray-500">{r.parentContact || '—'}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                    <motion.button
                      onClick={handleImport}
                      disabled={importing}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      className="w-full mt-4 bg-[#002045] hover:bg-[#1a365d] text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-md shadow-blue-900/10"
                    >
                      {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      {importing ? 'Importing…' : `Import ${parsedRows.length} Students`}
                    </motion.button>
                  </motion.div>
                )}
              </motion.div>

              {/* Note */}
              <p className="text-xs text-gray-400 mt-4 text-center">
                Already-existing students (matched by Roll No + Class + Section) will be <strong>updated</strong>, not duplicated.
              </p>
            </div>
          </motion.div>
        )}

        {/* ── ADD SINGLE STUDENT TAB ── */}
        {tab === 'add' && (
          <motion.div key="add" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="max-w-md">
              <motion.div {...fadeUp(0.04)} className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
                <div className="flex items-center gap-2 mb-5">
                  <Plus className="w-5 h-5 text-[#002045]" />
                  <h2 className="text-sm font-bold text-gray-900">Add a Student Manually</h2>
                </div>
                <form onSubmit={handleAdd} className="space-y-3">
                  {[
                    { label: 'Full Name *', field: 'name', placeholder: 'e.g. Rahul Sharma' },
                    { label: 'Roll No', field: 'rollNo', placeholder: 'e.g. 101 (optional)' },
                    { label: 'Class', field: 'class', placeholder: 'e.g. Grade 10 (optional)' },
                    { label: 'Section', field: 'section', placeholder: 'e.g. A (optional)' },
                    { label: 'Parent Contact', field: 'parentContact', placeholder: 'Mobile number (optional)' },
                  ].map(({ label, field, placeholder }) => (
                    <div key={field}>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</label>
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
                      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="text-xs text-red-500 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" /> {formError}
                      </motion.p>
                    )}
                    {formSuccess && (
                      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="text-xs text-emerald-600 flex items-center gap-1 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Student added successfully!
                      </motion.p>
                    )}
                  </AnimatePresence>

                  <motion.button
                    type="submit"
                    disabled={formSaving}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    className="w-full bg-[#002045] hover:bg-[#1a365d] text-white font-bold py-2.5 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-1 shadow-md shadow-blue-900/10"
                  >
                    {formSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    {formSaving ? 'Adding…' : 'Add Student'}
                  </motion.button>
                </form>
              </motion.div>
            </div>
          </motion.div>
        )}

        {/* ── VIEW ROSTER TAB ── */}
        {tab === 'view' && (
          <motion.div key="view" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {/* Filters */}
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search name or roll no…"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-[#002045]/20 shadow-sm"
                />
              </div>
              <select
                value={classFilter}
                onChange={e => setClassFilter(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-[#002045]/20 shadow-sm text-gray-600 font-medium"
              >
                <option value="">All Classes</option>
                {allClasses.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {loadingStudents ? (
              <div className="flex items-center justify-center py-24">
                <Loader2 className="w-7 h-7 animate-spin text-indigo-400" />
              </div>
            ) : filtered.length === 0 ? (
              <motion.div {...fadeUp(0.05)} className="flex flex-col items-center justify-center py-20 bg-white border border-gray-100 rounded-2xl shadow-sm text-center">
                <Users className="w-12 h-12 text-gray-200 mb-4" />
                <p className="text-base font-bold text-gray-700">No students in the roster yet</p>
                <p className="text-sm text-gray-400 mt-1">Use the Upload or Add tabs to get started.</p>
                <button
                  onClick={() => setTab('upload')}
                  className="mt-4 px-5 py-2 bg-[#002045] text-white text-sm font-bold rounded-xl"
                >
                  Upload Students
                </button>
              </motion.div>
            ) : (
              <motion.div {...fadeUp(0.05)} className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        {['#', 'Roll No', 'Name', 'Class', 'Section', 'Parent Contact'].map(h => (
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
                          transition={{ delay: i * 0.015 }}
                          className="hover:bg-gray-50/60 transition-colors"
                        >
                          <td className="px-4 py-3 text-xs text-gray-400">{i + 1}</td>
                          <td className="px-4 py-3 text-sm font-bold text-[#002045]">{s.rollNo || <span className="text-gray-300">—</span>}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-gray-800">{s.name}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{s.class || <span className="text-gray-300">—</span>}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{s.section ? `Section ${s.section}` : <span className="text-gray-300">—</span>}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{s.parentContact || '—'}</td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-3 border-t border-gray-50 text-xs text-gray-400 font-medium">
                  {filtered.length} student{filtered.length !== 1 ? 's' : ''} shown
                </div>
              </motion.div>
            )}
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  )
}
