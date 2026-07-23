'use client'
import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import * as XLSX from 'xlsx'
import { X, Upload, Download, Loader2, AlertCircle, CheckCircle2, FileSpreadsheet } from 'lucide-react'
import { isValidPhone, PHONE_FORMAT_ERROR } from '@/lib/validation/phone'
import { isValidEmail, EMAIL_FORMAT_ERROR } from '@/lib/validation/email'

interface ParsedRow {
  name: string
  employeeId: string
  email: string
  phone: string
  altPhone: string
  dob: string
  gender: string
  addressLine1: string
  city: string
  state: string
  pincode: string
  subject: string
  specialization: string
  qualification: string
  experienceYears: string
  joiningDate: string
  status: string
  batches: string
  bio: string
  profileImgUrl: string
}

interface FacultyCsvUploadModalProps {
  onClose: () => void
  onImported: () => void
}

export const TEMPLATE_HEADERS = [
  'Name', 'Employee ID', 'Email', 'Phone', 'Alt Phone',
  'Date of Birth (YYYY-MM-DD)', 'Gender',
  'Address Line 1', 'City', 'State', 'Pincode',
  'Subject', 'Specialization', 'Qualification',
  'Experience (Years)', 'Joining Date (YYYY-MM-DD)', 'Status', 'Batches',
  'Bio', 'Profile Image URL',
]

export function downloadTemplate() {
  const data = [
    TEMPLATE_HEADERS,
    [
      'Anita Rao', 'EMP-201', 'anita.rao@example.com', '9876500011', '9876500012',
      '1985-03-14', 'Female',
      '22 Park Street', 'Ahmedabad', 'Gujarat', '380001',
      'Physics', 'Mechanics', 'M.Sc. Physics',
      '8', '2020-06-01', 'ACTIVE', 'JEE Batch A, JEE Batch B',
      'Specializes in mechanics and thermodynamics.', '',
    ],
    ['Vikram Singh', '', '', '', '', '', '', '', '', '', '', 'Chemistry', 'Organic Chemistry', '', '', '', 'ACTIVE', '', '', ''],
  ]
  const ws = XLSX.utils.aoa_to_sheet(data)
  ws['!cols'] = TEMPLATE_HEADERS.map(h => ({ wch: Math.max(14, Math.min(28, h.length + 4)) }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Faculty')
  XLSX.writeFile(wb, 'faculty_import_template.xlsx')
}

export default function FacultyCsvUploadModal({ onClose, onImported }: FacultyCsvUploadModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [realBatches, setRealBatches] = useState<any[]>([])

  useEffect(() => {
    async function loadBatches() {
      try {
        const res = await fetch('/api/batches')
        const data = await res.json()
        if (Array.isArray(data)) setRealBatches(data)
      } catch (err) {
        console.error('Failed to load batches', err)
      }
    }
    loadBatches()
  }, [])

  const batchNameSet = new Set(realBatches.map((b) => String(b.name).trim().toLowerCase()))

  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [error, setError] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{
    succeeded: number
    failed: number
    total: number
    errors: { row: string; field: string; value: string; message: string }[]
  } | null>(null)

  // Local preview check — the server re-validates authoritatively regardless
  // of what this finds.
  function rowValidation(row: ParsedRow): { name?: string; subject?: string; specialization?: string; batches?: string; phone?: string; altPhone?: string; email?: string } {
    const errors: { name?: string; subject?: string; specialization?: string; batches?: string; phone?: string; altPhone?: string; email?: string } = {}
    if (!row.name) errors.name = 'Name is required.'
    if (!row.subject) errors.subject = 'Subject is required.'
    if (!row.specialization) errors.specialization = 'Specialization is required.'
    if (row.phone && !isValidPhone(row.phone)) errors.phone = PHONE_FORMAT_ERROR
    if (row.altPhone && !isValidPhone(row.altPhone)) errors.altPhone = 'Alt phone must be 10 digits.'
    if (row.email && !isValidEmail(row.email)) errors.email = EMAIL_FORMAT_ERROR
    const requestedNames = row.batches.split(',').map((b) => b.trim()).filter(Boolean)
    const invalidNames = requestedNames.filter((b) => !batchNameSet.has(b.toLowerCase()))
    if (invalidNames.length > 0) {
      errors.batches = `${invalidNames.join(', ')} — not found. Create in Academic Planning first.`
    }
    return errors
  }

  const rowsWithErrors = parsedRows.filter((r) => {
    const v = rowValidation(r)
    return !!(v.name || v.subject || v.specialization || v.batches || v.phone || v.altPhone || v.email)
  }).length

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
              name: get(['name', 'facultyname', 'teachername']),
              employeeId: get(['employeeid', 'empid']),
              email: get(['email']),
              phone: get(['phone', 'mobile']),
              altPhone: get(['altphone', 'alternatephone']),
              dob: get(['dateofbirthyyyymmdd', 'dateofbirth', 'dob']),
              gender: get(['gender']),
              addressLine1: get(['addressline1', 'address']),
              city: get(['city']),
              state: get(['state']),
              pincode: get(['pincode', 'zip', 'zipcode']),
              subject: get(['subject']),
              specialization: get(['specialization']),
              qualification: get(['qualification']),
              experienceYears: get(['experienceyears', 'experience']),
              joiningDate: get(['joiningdateyyyymmdd', 'joiningdate']),
              status: get(['status']),
              batches: get(['batches', 'batch']),
              bio: get(['bio']),
              profileImgUrl: get(['profileimageurl', 'profileimgurl', 'photourl']),
            }
          })
          .filter((r) => r.name || r.subject || r.specialization)

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
      const res = await fetch('/api/teacher-portal/faculty/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ faculty: parsedRows }),
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
            <h3 className="text-base font-bold text-slate-900">Import Faculty from CSV / Excel</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

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
          id="faculty-csv-upload-file"
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileChange}
          className="hidden"
        />

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
            <p className="text-xs font-bold text-slate-800">Preview — {parsedRows.length} rows</p>
            {rowsWithErrors > 0 && (
              <div className="flex items-start gap-2.5 px-4 py-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-700 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                {rowsWithErrors} row{rowsWithErrors === 1 ? '' : 's'} have a problem — see highlighted cells below.
              </div>
            )}
            <div className="border border-slate-150 rounded-xl overflow-hidden max-h-64 overflow-y-auto shadow-inner bg-slate-50/30">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 sticky top-0 border-b border-slate-150">
                  <tr>
                    {['Name', 'Employee ID', 'Subject', 'Specialization', 'Batches', 'Status'].map((h) => (
                      <th key={h} className="px-3.5 py-2 text-left font-bold text-slate-400 uppercase tracking-wider text-[9px] bg-slate-50">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parsedRows.map((r, i) => {
                    const rowErrors = rowValidation(r)
                    return (
                      <tr key={i} className="hover:bg-slate-50/70 bg-white">
                        <td className={`px-3.5 py-2 font-bold ${rowErrors.name ? 'text-red-600 bg-red-50 border border-red-200 rounded' : 'text-slate-800'}`} title={rowErrors.name}>
                          {r.name || '—'}
                        </td>
                        <td className="px-3.5 py-2 font-semibold text-slate-500">{r.employeeId || '—'}</td>
                        <td className={`px-3.5 py-2 font-semibold ${rowErrors.subject ? 'text-red-600 bg-red-50 border border-red-200 rounded' : 'text-slate-500'}`} title={rowErrors.subject}>
                          {r.subject || '—'}
                        </td>
                        <td className={`px-3.5 py-2 font-semibold ${rowErrors.specialization ? 'text-red-600 bg-red-50 border border-red-200 rounded' : 'text-slate-500'}`} title={rowErrors.specialization}>
                          {r.specialization || '—'}
                        </td>
                        <td className={`px-3.5 py-2 font-semibold ${rowErrors.batches ? 'text-red-600 bg-red-50 border border-red-200 rounded' : 'text-slate-500'}`} title={rowErrors.batches}>
                          {r.batches || '—'}
                        </td>
                        <td className="px-3.5 py-2 text-slate-450">{r.status || '—'}</td>
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
              {importing ? 'Importing...' : `Import ${parsedRows.length} Faculty`}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  )
}
