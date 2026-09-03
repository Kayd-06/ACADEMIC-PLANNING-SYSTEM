'use client'

import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import * as XLSX from 'xlsx'
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
  X,
} from 'lucide-react'

interface ParsedRow {
  name: string
  rollNo: string
  marks: number | string
  maxMarks: number | string
  attendance: number | string
  remarks: string
}

interface RowError {
  row: number
  field: string
  message: string
}

interface StudentReportImportModalProps {
  onClose: () => void
  onImported: (result: { imported: number; message: string }) => void
}

export const STUDENT_REPORT_TEMPLATE_HEADERS = [
  'Name', 'RollNo', 'Marks', 'MaxMarks', 'Attendance', 'Remarks',
]

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[\s()_-]+/g, '')
}

function fieldValue(row: Record<string, unknown>, variants: string[]): unknown {
  const wanted = new Set(variants.map(normalizeHeader))
  const key = Object.keys(row).find((candidate) => wanted.has(normalizeHeader(candidate)))
  return key ? row[key] : ''
}

function textValue(value: unknown): string {
  return value === null || value === undefined ? '' : String(value).trim()
}

function validateRows(rows: ParsedRow[]): RowError[] {
  const errors: RowError[] = []
  const seenRollNumbers = new Map<string, number>()
  rows.forEach((row, index) => {
    const spreadsheetRow = index + 2
    const marks = Number(row.marks)
    const maxMarks = Number(row.maxMarks)
    const attendance = row.attendance === '' ? null : Number(row.attendance)

    if (!row.name) errors.push({ row: spreadsheetRow, field: 'Name', message: 'Required' })
    if (!row.rollNo) errors.push({ row: spreadsheetRow, field: 'RollNo', message: 'Required' })
    if (row.rollNo) {
      const earlierRow = seenRollNumbers.get(row.rollNo.toLowerCase())
      if (earlierRow) errors.push({ row: spreadsheetRow, field: 'RollNo', message: `Duplicate of row ${earlierRow}` })
      else seenRollNumbers.set(row.rollNo.toLowerCase(), spreadsheetRow)
    }
    if (row.marks === '' || !Number.isInteger(marks) || marks < 0) {
      errors.push({ row: spreadsheetRow, field: 'Marks', message: 'Use a whole number of 0 or more' })
    }
    if (row.maxMarks === '' || !Number.isInteger(maxMarks) || maxMarks <= 0) {
      errors.push({ row: spreadsheetRow, field: 'MaxMarks', message: 'Use a whole number greater than 0' })
    }
    if (Number.isFinite(marks) && Number.isFinite(maxMarks) && marks > maxMarks) {
      errors.push({ row: spreadsheetRow, field: 'Marks', message: 'Cannot exceed MaxMarks' })
    }
    if (attendance !== null && (!Number.isInteger(attendance) || attendance < 0 || attendance > 100)) {
      errors.push({ row: spreadsheetRow, field: 'Attendance', message: 'Use a whole number from 0 to 100' })
    }
  })
  return errors
}

export function downloadStudentReportTemplate() {
  const worksheet = XLSX.utils.aoa_to_sheet([STUDENT_REPORT_TEMPLATE_HEADERS])
  worksheet['!cols'] = [
    { wch: 22 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 38 },
  ]
  const instructions = XLSX.utils.aoa_to_sheet([
    ['Column', 'Required', 'Accepted value'],
    ['Name', 'Yes', 'Student full name'],
    ['RollNo', 'Yes', 'Unique roll number within this file'],
    ['Marks', 'Yes', 'Whole number, zero or greater'],
    ['MaxMarks', 'Yes', 'Whole number greater than zero; must be at least Marks'],
    ['Attendance', 'No', 'Whole-number percentage from 0 to 100'],
    ['Remarks', 'No', 'Text, up to 1,000 characters'],
  ])
  instructions['!cols'] = [{ wch: 18 }, { wch: 12 }, { wch: 58 }]
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Student Reports')
  XLSX.utils.book_append_sheet(workbook, instructions, 'Instructions')
  XLSX.writeFile(workbook, 'student_report_import_template.xlsx')
}

export default function StudentReportImportModal({ onClose, onImported }: StudentReportImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [className, setClassName] = useState('')
  const [subject, setSubject] = useState('')
  const [term, setTerm] = useState('')
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [errors, setErrors] = useState<RowError[]>([])
  const [error, setError] = useState('')
  const [importing, setImporting] = useState(false)

  function parseFile(file: File) {
    setFileName(file.name)
    setRows([])
    setErrors([])
    setError('')

    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      setError('Choose an .xlsx, .xls, or .csv file.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('The selected file is larger than 5 MB. Split it into smaller files and try again.')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const workbook = XLSX.read(new Uint8Array(event.target?.result as ArrayBuffer), { type: 'array' })
        const worksheet = workbook.Sheets[workbook.SheetNames[0]]
        if (!worksheet) throw new Error('The workbook does not contain a worksheet.')
        const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' })
        const parsed = rawRows.map((row) => ({
          name: textValue(fieldValue(row, ['Name', 'Student Name', 'Full Name'])),
          rollNo: textValue(fieldValue(row, ['RollNo', 'Roll No', 'Roll Number'])),
          marks: fieldValue(row, ['Marks', 'Score']) as number | string,
          maxMarks: fieldValue(row, ['MaxMarks', 'Max Marks', 'Total Marks', 'Total']) as number | string,
          attendance: fieldValue(row, ['Attendance', 'Attendance Percentage', 'Attendance %']) as number | string,
          remarks: textValue(fieldValue(row, ['Remarks', 'Comments', 'Teacher Remarks'])),
        })).filter((row) => Object.values(row).some((value) => value !== ''))

        if (parsed.length === 0) {
          setError('No data rows were found. Download the sample and keep its header row unchanged.')
          return
        }
        if (parsed.length > 1000) {
          setError('A single file can contain at most 1,000 student rows.')
          return
        }

        const rowErrors = validateRows(parsed)
        setRows(parsed)
        setErrors(rowErrors)
      } catch {
        setError('This file could not be read. Use a valid .xlsx, .xls, or .csv file based on the sample.')
      }
    }
    reader.onerror = () => setError('This file could not be read. Please choose it again.')
    reader.readAsArrayBuffer(file)
  }

  async function handleImport() {
    if (!className.trim() || !subject.trim() || !term.trim()) {
      setError('Enter the class, subject, and term before importing.')
      return
    }
    if (rows.length === 0 || errors.length > 0) return

    setImporting(true)
    setError('')
    try {
      const response = await fetch('/api/student-reports/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ className, subject, term, sourceFileName: fileName, entries: rows }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(result.errors?.[0]
          ? `Row ${result.errors[0].row}, ${result.errors[0].field}: ${result.errors[0].message}`
          : result.error || 'The report could not be imported.')
        return
      }
      onImported({ imported: result.imported, message: result.message })
    } catch {
      setError('The report could not be imported. Check your connection and try again.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <FileSpreadsheet className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900">Import student report</h2>
              <p className="mt-0.5 text-[11px] text-slate-500">Excel or CSV · up to 1,000 students per file</p>
            </div>
          </div>
          <button onClick={onClose} disabled={importing} aria-label="Close import dialog" className="rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-50">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              { label: 'Class', value: className, setValue: setClassName, placeholder: 'e.g. Grade 11-A' },
              { label: 'Subject', value: subject, setValue: setSubject, placeholder: 'e.g. Physics' },
              { label: 'Term', value: term, setValue: setTerm, placeholder: 'e.g. Mid-Term 2026' },
            ].map((field) => (
              <label key={field.label} className="block">
                <span className="mb-1.5 block text-[11px] font-bold text-slate-700">{field.label} <span className="text-rose-500">*</span></span>
                <input value={field.value} onChange={(event) => field.setValue(event.target.value)} placeholder={field.placeholder} maxLength={255} className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
              </label>
            ))}
          </div>

          <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-slate-800">Use the sample format</p>
                <p className="mt-1 text-[11px] leading-5 text-slate-600"><strong>Required:</strong> Name, RollNo, Marks, MaxMarks. <strong>Optional:</strong> Attendance (0–100), Remarks. Grades are calculated automatically.</p>
              </div>
              <button onClick={downloadStudentReportTemplate} className="flex shrink-0 items-center gap-2 rounded-lg border border-indigo-200 bg-white px-3.5 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-50">
                <Download className="h-4 w-4" /> Download sample (.xlsx)
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => { event.preventDefault(); const dropped = event.dataTransfer.files[0]; if (dropped) parseFile(dropped) }}
            className="flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 px-5 py-7 text-center transition-colors hover:border-indigo-400 hover:bg-indigo-50/30"
          >
            {rows.length > 0 && errors.length === 0 ? <CheckCircle2 className="mb-2 h-7 w-7 text-emerald-500" /> : <Upload className="mb-2 h-7 w-7 text-indigo-500" />}
            <span className="text-sm font-bold text-slate-800">{fileName || 'Choose or drop an Excel/CSV file'}</span>
            <span className="mt-1 text-[11px] text-slate-500">Accepted formats: .xlsx, .xls, .csv</span>
          </button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(event) => { const selected = event.target.files?.[0]; if (selected) parseFile(selected) }} />

          {error && (
            <div className="flex items-start gap-2.5 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
            </div>
          )}

          {rows.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="flex items-center justify-between bg-slate-50 px-4 py-3">
                <p className="text-xs font-bold text-slate-800">Preview · {rows.length} {rows.length === 1 ? 'row' : 'rows'}</p>
                <span className={`text-[11px] font-bold ${errors.length ? 'text-rose-600' : 'text-emerald-600'}`}>{errors.length ? `${errors.length} validation ${errors.length === 1 ? 'error' : 'errors'}` : 'Ready to import'}</span>
              </div>
              <div className="max-h-48 overflow-auto">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-white text-[10px] uppercase tracking-wide text-slate-500">
                    <tr>{['Row', ...STUDENT_REPORT_TEMPLATE_HEADERS].map((header) => <th key={header} className="border-b border-slate-100 px-3 py-2">{header}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.slice(0, 20).map((row, index) => {
                      const rowNumber = index + 2
                      const rowHasError = errors.some((item) => item.row === rowNumber)
                      return (
                        <tr key={rowNumber} className={rowHasError ? 'bg-rose-50' : ''}>
                          <td className="px-3 py-2 font-bold text-slate-400">{rowNumber}</td>
                          <td className="px-3 py-2 font-medium text-slate-800">{row.name || '—'}</td>
                          <td className="px-3 py-2">{row.rollNo || '—'}</td>
                          <td className="px-3 py-2">{row.marks === '' ? '—' : row.marks}</td>
                          <td className="px-3 py-2">{row.maxMarks === '' ? '—' : row.maxMarks}</td>
                          <td className="px-3 py-2">{row.attendance === '' ? '—' : row.attendance}</td>
                          <td className="max-w-48 truncate px-3 py-2 text-slate-500">{row.remarks || '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {errors.length > 0 && <p className="border-t border-rose-100 bg-rose-50 px-4 py-2 text-[11px] text-rose-700">Row {errors[0].row}, {errors[0].field}: {errors[0].message}{errors.length > 1 ? ` · and ${errors.length - 1} more` : ''}</p>}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50/70 px-6 py-4">
          <button onClick={onClose} disabled={importing} className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
          <button onClick={handleImport} disabled={importing || rows.length === 0 || errors.length > 0 || !className.trim() || !subject.trim() || !term.trim()} className="flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40">
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {importing ? 'Importing…' : `Import ${rows.length || ''} ${rows.length === 1 ? 'row' : 'rows'}`}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
