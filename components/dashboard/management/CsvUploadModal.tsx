'use client'
import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import * as XLSX from 'xlsx'
import { X, Upload, Download, Loader2, AlertCircle, CheckCircle2, FileSpreadsheet, ChevronDown } from 'lucide-react'

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

export const TEMPLATE_HEADERS = [
  'Name', 'Admission Number', 'Aadhar Number', 'Roll No',
  'Email', 'Phone', 'Parent Contact', 'Address Line 1', 'City', 'State', 'Pincode',
  'Date of Birth (YYYY-MM-DD)', 'Gender', 'Blood Group', 'Profile Image URL',
  'Previous School', 'Previous Percentage', 'Class', 'Program', 'Batch',
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
      'St. Xavier School', '82%', '9', '', '',
      '2025-06-01', 'active', 'Scores well in Physics',
      'Suresh Sharma', 'Father', '9876543210', 'suresh.sharma@example.com',
    ],
    [
      'Priya Patel', 'ADM-102', '2234-5678-9012', '102',
      'priya.patel@example.com', '9876500002', '9123456789', '45 Ring Road', 'Surat', 'Gujarat', '395001',
      '2010-09-03', 'Female', 'O+', '',
      'DPS Surat', '91%', '9', '', '',
      '2025-06-01', 'active', '',
      'Meena Patel', 'Mother', '9123456789', 'meena.patel@example.com',
    ],
    ['Amit Verma', '', '', '103', '', '', '', '', '', '', '', '', '', '', '', '', '', '9', '', '', '', 'active', '', '', '', '', ''],
  ]
  const ws = XLSX.utils.aoa_to_sheet(data)
  ws['!cols'] = TEMPLATE_HEADERS.map(h => ({ wch: Math.max(14, Math.min(28, h.length + 4)) }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Students')
  XLSX.writeFile(wb, 'student_roster_template.xlsx')
}

export default function CsvUploadModal({ students, defaultBatch, defaultProgram, onClose, onImported }: CsvUploadModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [defaults, setDefaults] = useState<Defaults>({ program: defaultProgram ?? '', batch: defaultBatch ?? '' })
  
  // Real dynamic options from Postgres
  const [realPrograms, setRealPrograms] = useState<any[]>([])
  const [realBatches, setRealBatches] = useState<any[]>([])

  useEffect(() => {
    async function loadOptions() {
      try {
        const pRes = await fetch('/api/programs')
        const pData = await pRes.json()
        if (Array.isArray(pData)) setRealPrograms(pData)

        const bRes = await fetch('/api/batches')
        const bData = await bRes.json()
        if (Array.isArray(bData)) setRealBatches(bData)
      } catch (err) {
        console.error('Failed to load dynamic options', err)
      }
    }
    loadOptions()
  }, [])

  const programOptions = Array.from(new Set([
    ...realPrograms.map(p => p.name),
    ...students.map(s => s.program)
  ])).filter(v => v && v !== 'Unassigned')

  const batchOptions = Array.from(new Set([
    ...realBatches.map(b => b.name),
    ...students.map(s => s.batch)
  ])).filter(v => v && v !== 'Unassigned')

  const [customField, setCustomField] = useState<{ program: boolean; batch: boolean }>({
    program: !!defaultProgram && !programOptions.includes(defaultProgram),
    batch: !!defaultBatch && !batchOptions.includes(defaultBatch),
  })

  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [error, setError] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{
    succeeded: number
    failed: number
    total: number
    errors: { row: string; field: string; value: string; message: string }[]
  } | null>(null)

  // Local preview check against the Program/Batch lists already fetched above —
  // lets the admin see a bad value before the round trip to the server, which
  // re-validates authoritatively regardless of what this check finds.
  const programNameSet = new Set(realPrograms.map((p) => String(p.name).trim().toLowerCase()))
  const batchByNameLower = new Map(realBatches.map((b) => [String(b.name).trim().toLowerCase(), b]))
  const programByNameLower = new Map(realPrograms.map((p) => [String(p.name).trim().toLowerCase(), p]))

  function rowValidation(row: ParsedRow): { program?: string; batch?: string } {
    const program = resolveField(row.program, defaults.program)
    const batch = resolveField(row.batch, defaults.batch)
    const errors: { program?: string; batch?: string } = {}
    if (program && !programNameSet.has(program.toLowerCase())) {
      errors.program = `"${program}" doesn't exist — create it in Academic Planning first.`
    }
    if (batch) {
      const matchedBatch = batchByNameLower.get(batch.toLowerCase())
      if (!matchedBatch) {
        errors.batch = `"${batch}" doesn't exist — create it in Academic Planning first.`
      } else if (program) {
        const matchedProgram = programByNameLower.get(program.toLowerCase())
        if (matchedProgram && matchedBatch.programId !== matchedProgram.id) {
          errors.batch = `"${batch}" belongs to a different Program.`
        }
      }
    }
    return errors
  }

  const rowsWithErrors = parsedRows.filter((r) => {
    const v = rowValidation(r)
    return !!(v.program || v.batch)
  }).length

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
      } catch (err) {
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
    <div className="flex flex-col">
      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 pl-0.5">{label}</label>
      {customField[field] ? (
        <input
          value={defaults[field]}
          onChange={(e) => setDefaults((prev) => ({ ...prev, [field]: e.target.value }))}
          placeholder={`Custom ${label.toLowerCase()}`}
          className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold transition-all text-slate-800"
        />
      ) : (
        <div className="relative w-full">
          <select
            value={defaults[field]}
            onChange={(e) => handleDefaultSelect(field, e.target.value)}
            className="w-full pl-3.5 pr-8 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50/50 hover:bg-slate-100/70 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold appearance-none cursor-pointer transition-all text-slate-800"
          >
            <option value="">No default — use CSV value</option>
            {options.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
            <option value="__other__">Other (type custom value)</option>
          </select>
          <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      )}
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl p-6 shadow-2xl w-full max-w-2xl border border-slate-250 max-h-[90vh] overflow-y-auto space-y-5"
      >
        <div className="flex justify-between items-center border-b border-slate-100 pb-3.5">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="w-5 h-5 text-indigo-500" />
            <h3 className="text-base font-bold text-slate-900">Upload CSV / Excel</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {renderDefaultSelect('program', 'Default Program', programOptions)}
          {renderDefaultSelect('batch', 'Default Batch', batchOptions)}
        </div>
        <p className="text-[11px] text-slate-400/90 font-medium pl-0.5 -mt-2">
          A default above applies to every row unless the CSV file itself has a value in that column.
        </p>

        {/* Upload Area / Dropzone */}
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/10 transition-all rounded-2xl p-7 flex flex-col items-center justify-center cursor-pointer text-center group space-y-2"
        >
          <div className="p-3 bg-indigo-50 rounded-xl text-indigo-500 group-hover:scale-105 transition-transform">
            <Upload className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-800">Drag & drop your Excel/CSV here</p>
            <p className="text-[10px] text-slate-450 mt-1">or click to browse from your device</p>
          </div>
        </div>

        <input
          ref={fileInputRef}
          id="csv-upload-file"
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Format Template / Download Sample CSV */}
        <div className="flex justify-between items-center bg-slate-50/60 px-4 py-3.5 rounded-xl border border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Format template</span>
          </div>
          <button onClick={downloadTemplate} className="text-xs text-indigo-655 font-bold hover:text-indigo-700 transition-colors flex items-center gap-1.5 cursor-pointer">
            <Download className="w-3.5 h-3.5" /> Download Sample CSV
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2.5 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" /> {error}
          </div>
        )}

        {result && (
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-emerald-700 font-bold">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
              Import complete! {result.succeeded} imported, {result.failed} failed out of {result.total} rows.
            </div>
            {result.errors.length > 0 && (
              <div className="px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 space-y-1">
                {result.errors.map((e, i) => (
                  <p key={i}><span className="font-bold">{e.row}:</span> {e.message}</p>
                ))}
              </div>
            )}
          </div>
        )}

        {parsedRows.length > 0 && (
          <div className="mt-4 space-y-3.5">
            <p className="text-xs font-bold text-slate-800">Preview — {parsedRows.length} rows (after defaults applied)</p>
            {rowsWithErrors > 0 && (
              <div className="flex items-start gap-2.5 px-4 py-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-700 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                {rowsWithErrors} row{rowsWithErrors === 1 ? '' : 's'} have a Program/Batch problem — see highlighted cells below. These rows will be skipped on import.
              </div>
            )}
            <div className="border border-slate-150 rounded-xl overflow-hidden max-h-64 overflow-y-auto shadow-inner bg-slate-50/30">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 sticky top-0 border-b border-slate-150">
                  <tr>
                    {['Name', 'Roll No', 'Class', 'Program', 'Batch', 'Contact', 'Guardian'].map((h) => (
                      <th key={h} className="px-3.5 py-2 text-left font-bold text-slate-400 uppercase tracking-wider text-[9px] bg-slate-50">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parsedRows.map((r, i) => {
                    const rowErrors = rowValidation(r)
                    return (
                      <tr key={i} className="hover:bg-slate-50/70 bg-white">
                        <td className="px-3.5 py-2 font-bold text-slate-800">{r.name}</td>
                        <td className="px-3.5 py-2 font-semibold text-slate-500">{r.rollNo || '—'}</td>
                        <td className="px-3.5 py-2 font-semibold text-slate-500">{r.class || '—'}</td>
                        <td className={`px-3.5 py-2 font-semibold ${rowErrors.program ? 'text-red-600 bg-red-50 border border-red-200 rounded' : 'text-slate-500'}`} title={rowErrors.program}>
                          {resolveField(r.program, defaults.program) || '—'}
                        </td>
                        <td className={`px-3.5 py-2 font-semibold ${rowErrors.batch ? 'text-red-600 bg-red-50 border border-red-200 rounded' : 'text-slate-500'}`} title={rowErrors.batch}>
                          {resolveField(r.batch, defaults.batch) || '—'}
                        </td>
                        <td className="px-3.5 py-2 text-slate-450">{r.parentContact || r.phone || '—'}</td>
                        <td className="px-3.5 py-2 text-slate-450">{r.guardianName || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <button
              onClick={handleImport}
              disabled={importing}
              className="w-full bg-[#0b1320] hover:bg-slate-800 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-md cursor-pointer transform active:scale-[0.98]"
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
