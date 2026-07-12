'use client'
import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import * as XLSX from 'xlsx'
import { X, Upload, Download, Loader2, AlertCircle, CheckCircle2, FileSpreadsheet } from 'lucide-react'

interface ParsedRow {
  name: string
  admissionNumber: string
  aadharNumber: string
  rollNo: string
  email: string
  phone: string
  parentContact: string
  addressLine1: string
  city: string
  state: string
  pincode: string
  dob: string
  gender: string
  bloodGroup: string
  profileImgUrl: string
  previousSchool: string
  previousPercentage: string
  class: string
  section: string
  program: string
  batch: string
  admissionDate: string
  status: string
  notes: string
  guardianName: string
  guardianRelationship: string
  guardianPhone: string
  guardianEmail: string
}

interface Defaults {
  program: string
  batch: string
  section: string
}

interface CsvUploadModalProps {
  students: any[]
  defaultBatch?: string
  defaultProgram?: string
  onClose: () => void
  onImported: () => void
}

function resolveField(rowValue: string, defaultValue: string): string {
  return defaultValue.trim() ? defaultValue.trim() : rowValue
}

// Every column the roster & guardian tables can store, so a filled-in copy
// of this file leaves nothing empty after import. Column headers here must
// stay in sync with the `get()` variants in handleFileChange below.
export const TEMPLATE_HEADERS = [
  'Name', 'Admission Number', 'Aadhar Number', 'Roll No',
  'Email', 'Phone', 'Parent Contact', 'Address Line 1', 'City', 'State', 'Pincode',
  'Date of Birth (YYYY-MM-DD)', 'Gender', 'Blood Group', 'Profile Image URL',
  'Previous School', 'Previous Percentage', 'Class', 'Section', 'Program', 'Batch',
  'Admission Date (YYYY-MM-DD)', 'Status', 'Notes',
  'Guardian Name', 'Guardian Relationship', 'Guardian Phone', 'Guardian Email',
]

export function downloadTemplate() {
  const data = [
    TEMPLATE_HEADERS,
    [
      'Rahul Sharma', 'ADM-101', '1234-5678-9012', '101',
      'rahul.sharma@example.com', '9876500001', '9876543210', '12 MG Road', 'Ahmedabad', 'Gujarat', '380001',
      '2010-04-12', 'Male', 'B+', 'https://example.com/photos/rahul.jpg',
      'St. Xavier School', '82%', '9', 'A', 'JEE Foundation for 9th', 'Batch A',
      '2025-06-01', 'active', 'Scores well in Physics',
      'Suresh Sharma', 'Father', '9876543210', 'suresh.sharma@example.com',
    ],
    [
      'Priya Patel', 'ADM-102', '2234-5678-9012', '102',
      'priya.patel@example.com', '9876500002', '9123456789', '45 Ring Road', 'Surat', 'Gujarat', '395001',
      '2010-09-03', 'Female', 'O+', '',
      'DPS Surat', '91%', '9', 'A', 'NEET Foundation for 9th', 'Batch A',
      '2025-06-01', 'active', '',
      'Meena Patel', 'Mother', '9123456789', 'meena.patel@example.com',
    ],
    // Minimal row — only Name is required, every other column may be left blank
    ['Amit Verma', '', '', '103', '', '', '', '', '', '', '', '', '', '', '', '', '', '9', 'B', '', '', '', 'active', '', '', '', '', ''],
  ]
  const ws = XLSX.utils.aoa_to_sheet(data)
  ws['!cols'] = TEMPLATE_HEADERS.map(h => ({ wch: Math.max(14, Math.min(28, h.length + 4)) }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Students')
  XLSX.writeFile(wb, 'student_roster_template.xlsx')
}

export default function CsvUploadModal({ students, defaultBatch, defaultProgram, onClose, onImported }: CsvUploadModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  // Pre-fill from the sidebar's current Program/Batch switcher selection —
  // when a specific one is selected (not "All Programs"/"All Batches"),
  // every imported row should land there rather than wherever the CSV's own
  // columns happen to say.
  const [defaults, setDefaults] = useState<Defaults>({ program: defaultProgram ?? '', batch: defaultBatch ?? '', section: '' })
  // Render the pre-filled default as an editable "custom" field rather than
  // a <select> whenever it isn't (yet) among the existing students' values —
  // otherwise the select would silently show blank despite a default being
  // active, since a value with no matching <option> renders unselected.
  const [customField, setCustomField] = useState<{ program: boolean; batch: boolean; section: boolean }>({
    program: !!defaultProgram && !students.some((s) => s.program === defaultProgram),
    batch: !!defaultBatch && !students.some((s) => s.batch === defaultBatch),
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
                const found = keys.find((k) => k.toLowerCase().replace(/[\s()_-]+/g, '') === v.toLowerCase())
                if (found) return String(r[found]).trim()
              }
              return ''
            }
            return {
              name: get(['name', 'studentname', 'fullname']),
              admissionNumber: get(['admissionnumber', 'admissionno', 'admission']),
              aadharNumber: get(['aadharnumber', 'aadhaarnumber', 'aadhar', 'aadhaar']),
              rollNo: get(['rollno', 'roll', 'rollnumber', 'id']),
              email: get(['email', 'studentemail']),
              phone: get(['phone', 'studentphone', 'mobile']),
              parentContact: get(['parentcontact', 'contact']),
              addressLine1: get(['addressline1', 'address']),
              city: get(['city']),
              state: get(['state']),
              pincode: get(['pincode', 'zip', 'zipcode']),
              dob: get(['dateofbirthyyyymmdd', 'dateofbirth', 'dob']),
              gender: get(['gender']),
              bloodGroup: get(['bloodgroup']),
              profileImgUrl: get(['profileimageurl', 'profileimgurl', 'photourl']),
              previousSchool: get(['previousschool']),
              previousPercentage: get(['previouspercentage']),
              class: get(['class', 'grade', 'classname']),
              section: get(['section', 'div', 'division']),
              program: get(['program']),
              batch: get(['batch']),
              admissionDate: get(['admissiondateyyyymmdd', 'admissiondate']),
              status: get(['status']),
              notes: get(['notes']),
              guardianName: get(['guardianname']),
              guardianRelationship: get(['guardianrelationship']),
              guardianPhone: get(['guardianphone']),
              guardianEmail: get(['guardianemail']),
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
            <Download className="w-3.5 h-3.5" /> Download Sample CSV
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
                    {['Name', 'Roll No', 'Class', 'Section', 'Program', 'Batch', 'Contact', 'Guardian'].map((h) => (
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
                      <td className="px-3 py-2 text-slate-500">{r.parentContact || r.phone || '—'}</td>
                      <td className="px-3 py-2 text-slate-500">{r.guardianName || '—'}</td>
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
