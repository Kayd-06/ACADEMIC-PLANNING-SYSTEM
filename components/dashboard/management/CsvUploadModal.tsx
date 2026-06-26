'use client'
import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import * as XLSX from 'xlsx'
import { X, Upload, Download, Loader2, AlertCircle, CheckCircle2, FileSpreadsheet } from 'lucide-react'

interface ParsedRow {
  name: string
  rollNo: string
  class: string
  section: string
  program: string
  batch: string
  parentContact: string
}

interface Defaults {
  program: string
  batch: string
  section: string
}

interface CsvUploadModalProps {
  students: any[]
  onClose: () => void
  onImported: () => void
}

function resolveField(rowValue: string, defaultValue: string): string {
  return defaultValue.trim() ? defaultValue.trim() : rowValue
}

function downloadTemplate() {
  const headers = ['Name', 'Roll No', 'Class', 'Section', 'Program', 'Batch', 'Parent Contact']
  const data = [
    headers,
    ['Rahul Sharma', '101', 'Grade 10', 'A', 'Science', 'Morning', '9876543210'],
    ['Priya Patel', '102', 'Grade 10', 'A', 'Science', 'Morning', '9123456789'],
    ['Amit Verma', '103', 'Grade 10', 'B', '', '', ''],
  ]
  const ws = XLSX.utils.aoa_to_sheet(data)
  ws['!cols'] = [{ wch: 22 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 18 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Students')
  XLSX.writeFile(wb, 'student_roster_template.xlsx')
}

export default function CsvUploadModal({ students, onClose, onImported }: CsvUploadModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [defaults, setDefaults] = useState<Defaults>({ program: '', batch: '', section: '' })
  const [customField, setCustomField] = useState<{ program: boolean; batch: boolean; section: boolean }>({
    program: false,
    batch: false,
    section: false,
  })
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [error, setError] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ succeeded: number; failed: number; total: number } | null>(null)

  const programOptions = Array.from(new Set(students.map((s) => s.program).filter((v) => v && v !== 'Unassigned')))
  const batchOptions = Array.from(new Set(students.map((s) => s.batch).filter((v) => v && v !== 'Unassigned')))
  const sectionOptions = Array.from(new Set(students.map((s) => s.rawSection).filter(Boolean)))

  const handleDefaultSelect = (field: keyof Defaults, value: string) => {
    if (value === '__other__') {
      setCustomField((prev) => ({ ...prev, [field]: true }))
      setDefaults((prev) => ({ ...prev, [field]: '' }))
    } else {
      setCustomField((prev) => ({ ...prev, [field]: false }))
      setDefaults((prev) => ({ ...prev, [field]: value }))
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setParsedRows([])
    setResult(null)

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const raw: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' })

        const rows: ParsedRow[] = raw
          .map((r) => {
            const keys = Object.keys(r)
            const get = (variants: string[]) => {
              for (const v of variants) {
                const found = keys.find((k) => k.toLowerCase().replace(/\s+/g, '') === v.toLowerCase())
                if (found) return String(r[found]).trim()
              }
              return ''
            }
            return {
              name: get(['name', 'studentname']),
              rollNo: get(['rollno', 'roll', 'rollnumber', 'id']),
              class: get(['class', 'grade', 'classname']),
              section: get(['section', 'div', 'division']),
              program: get(['program']),
              batch: get(['batch']),
              parentContact: get(['parentcontact', 'contact', 'phone', 'mobile']),
            }
          })
          .filter((r) => r.name)

        if (rows.length === 0) {
          setError('No valid rows found. Make sure at least a Name column exists.')
          return
        }
        setParsedRows(rows)
      } catch {
        setError('Failed to parse file. Please use the provided template or a standard Excel/CSV file.')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const handleImport = async () => {
    if (parsedRows.length === 0) return
    setImporting(true)
    setResult(null)
    setError('')
    try {
      const res = await fetch('/api/students/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ students: parsedRows, defaults }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Import failed')
        return
      }
      setResult(data)
      setParsedRows([])
      if (fileInputRef.current) fileInputRef.current.value = ''
      onImported()
    } catch {
      setError('Import failed. Please check your connection and try again.')
    } finally {
      setImporting(false)
    }
  }

  const renderDefaultSelect = (field: keyof Defaults, label: string, options: string[]) => (
    <div>
      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">{label}</label>
      {customField[field] ? (
        <input
          value={defaults[field]}
          onChange={(e) => setDefaults((prev) => ({ ...prev, [field]: e.target.value }))}
          placeholder={`Custom ${label.toLowerCase()}`}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20"
        />
      ) : (
        <select
          value={defaults[field]}
          onChange={(e) => handleDefaultSelect(field, e.target.value)}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white"
        >
          <option value="">No default — use CSV value</option>
          {options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
          <option value="__other__">Other (type custom value)</option>
        </select>
      )}
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl p-6 shadow-xl w-full max-w-2xl border border-slate-100 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-5">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
            <h3 className="text-base font-bold text-slate-900">Upload CSV / Excel</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-5">
          {renderDefaultSelect('program', 'Default Program', programOptions)}
          {renderDefaultSelect('batch', 'Default Batch', batchOptions)}
          {renderDefaultSelect('section', 'Default Section', sectionOptions)}
        </div>
        <p className="text-[11px] text-slate-500 mb-5">
          A default above applies to every row unless the CSV file itself has a value in that column.
        </p>

        <div className="flex items-center justify-between mb-3">
          <label
            htmlFor="csv-upload-file"
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <Upload className="w-4 h-4" /> Choose File
          </label>
          <input
            ref={fileInputRef}
            id="csv-upload-file"
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            className="hidden"
          />
          <button onClick={downloadTemplate} className="text-xs text-indigo-600 font-semibold hover:underline flex items-center gap-1">
            <Download className="w-3.5 h-3.5" /> Download Template
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2 mt-3 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
          </div>
        )}

        {result && (
          <div className="flex items-center gap-2 mt-3 px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-xl text-sm text-emerald-700 font-semibold">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            Import complete! {result.succeeded} imported, {result.failed} failed out of {result.total} rows.
          </div>
        )}

        {parsedRows.length > 0 && (
          <div className="mt-4">
            <p className="text-sm font-bold text-slate-800 mb-2">Preview — {parsedRows.length} rows (after defaults applied)</p>
            <div className="border border-slate-100 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    {['Name', 'Roll No', 'Class', 'Section', 'Program', 'Batch', 'Contact'].map((h) => (
                      <th key={h} className="px-3 py-2 text-left font-bold text-slate-400 uppercase tracking-wider text-[10px]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {parsedRows.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50/60">
                      <td className="px-3 py-2 font-medium text-slate-800">{r.name}</td>
                      <td className="px-3 py-2 text-slate-600">{r.rollNo || '—'}</td>
                      <td className="px-3 py-2 text-slate-600">{r.class || '—'}</td>
                      <td className="px-3 py-2 text-slate-600">{resolveField(r.section, defaults.section) || '—'}</td>
                      <td className="px-3 py-2 text-slate-600">{resolveField(r.program, defaults.program) || '—'}</td>
                      <td className="px-3 py-2 text-slate-600">{resolveField(r.batch, defaults.batch) || '—'}</td>
                      <td className="px-3 py-2 text-slate-500">{r.parentContact || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              onClick={handleImport}
              disabled={importing}
              className="w-full mt-4 bg-[#0b1320] hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {importing ? 'Importing...' : `Import ${parsedRows.length} Students`}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  )
}
