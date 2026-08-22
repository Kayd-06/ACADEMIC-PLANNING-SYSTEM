'use client'
import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import * as XLSX from 'xlsx'
import { X, Upload, Download, Loader2, AlertCircle, CheckCircle2, FileSpreadsheet } from 'lucide-react'

interface ParsedRow {
  chapterName: string
  chapterCode: string
  board: string
  classLevel: string
  program: string
  expectedHours: string
  conceptName: string
  conceptCode: string
}

interface SubjectOption { id: string; name: string }

interface CurriculumCsvUploadModalProps {
  subjects: SubjectOption[]
  defaultSubjectId: string
  onClose: () => void
  onImported: (subjectId: string) => void
}

export const TEMPLATE_HEADERS = [
  'Chapter Name', 'Chapter Code', 'Board', 'Class', 'Program', 'Expected Hours', 'Concept Name', 'Concept Code',
]

export function downloadTemplate() {
  const data = [
    TEMPLATE_HEADERS,
    ['Laws of Motion', 'PHY-CH3', 'CBSE', '11', 'JEE', '12', "Newton's First Law", 'C1'],
    ['Laws of Motion', '', '', '', '', '', "Newton's Second Law", 'C2'],
    ['Laws of Motion', '', '', '', '', '', "Newton's Third Law", 'C3'],
    ['Optics', 'PHY-CH4', 'CBSE', '12', 'NEET', '10', 'Refraction', ''],
    ['Thermodynamics', 'PHY-CH5', 'CBSE', '11', 'JEE', '8', '', ''],
  ]
  const ws = XLSX.utils.aoa_to_sheet(data)
  ws['!cols'] = TEMPLATE_HEADERS.map((h) => ({ wch: Math.max(14, Math.min(28, h.length + 4)) }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Curriculum')
  XLSX.writeFile(wb, 'curriculum_import_template.xlsx')
}

export default function CurriculumCsvUploadModal({ subjects, defaultSubjectId, onClose, onImported }: CurriculumCsvUploadModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [subjectId, setSubjectId] = useState(defaultSubjectId)
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [error, setError] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{
    chapters: { succeeded: number; failed: number; total: number }
    concepts: { succeeded: number; failed: number; total: number }
    errors: { row: string; level: string; message: string }[]
  } | null>(null)

  function rowValidation(row: ParsedRow): { chapterName?: string } {
    return row.chapterName ? {} : { chapterName: 'Chapter Name is required.' }
  }

  const rowsWithErrors = parsedRows.filter((r) => !!rowValidation(r).chapterName).length
  const chapterCount = new Set(parsedRows.map((r) => r.chapterName.trim().toLowerCase()).filter(Boolean)).size
  const conceptCount = parsedRows.filter((r) => r.chapterName && r.conceptName).length

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
              chapterName: get(['chaptername', 'chapter']),
              chapterCode: get(['chaptercode']),
              board: get(['board']),
              classLevel: get(['class', 'classlevel']),
              program: get(['program']),
              expectedHours: get(['expectedhours', 'hours']),
              conceptName: get(['conceptname', 'concept']),
              conceptCode: get(['conceptcode']),
            }
          })
          .filter((r) => r.chapterName || r.conceptName)

        if (rows.length === 0) {
          setError('No valid rows found. Make sure at least a Chapter Name column exists.')
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
    if (parsedRows.length === 0 || !subjectId) return
    setImporting(true)
    setResult(null)
    setError('')
    try {
      const res = await fetch('/api/curriculum/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjectId, rows: parsedRows }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Import failed')
        return
      }
      setResult(data)
      setParsedRows([])
      if (fileInputRef.current) fileInputRef.current.value = ''
      onImported(subjectId)
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
            <h3 className="text-base font-bold text-slate-900">Import Chapters & Concepts from CSV / Excel</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Import into subject</label>
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400 focus:bg-white transition-colors"
          >
            {subjects.length === 0 && <option value="">No subjects available</option>}
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
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
          id="curriculum-csv-upload-file"
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

        <p className="text-[11px] text-slate-400 leading-relaxed">
          One row per concept — repeat the chapter columns on every row belonging to that chapter. A row with only chapter columns (no concept) is fine too. Program must match an existing program's name exactly (case-insensitive) — leave it blank to skip linking a program.
        </p>

        {error && (
          <div className="flex items-start gap-2.5 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" /> {error}
          </div>
        )}

        {result && (
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-emerald-700 font-bold">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
              Import complete! {result.chapters.succeeded} chapter{result.chapters.succeeded === 1 ? '' : 's'} and {result.concepts.succeeded} concept{result.concepts.succeeded === 1 ? '' : 's'} imported.
            </div>
            {result.errors.length > 0 && (
              <div className="px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 space-y-1">
                {result.errors.map((e, i) => (
                  <p key={i}><span className="font-bold">{e.row} ({e.level}):</span> {e.message}</p>
                ))}
              </div>
            )}
          </div>
        )}

        {parsedRows.length > 0 && (
          <div className="mt-4 space-y-3.5">
            <p className="text-xs font-bold text-slate-800">Preview — {chapterCount} chapter{chapterCount === 1 ? '' : 's'}, {conceptCount} concept{conceptCount === 1 ? '' : 's'} ({parsedRows.length} rows)</p>
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
                    {['Chapter Name', 'Chapter Code', 'Board', 'Class', 'Program', 'Hours', 'Concept Name', 'Concept Code'].map((h) => (
                      <th key={h} className="px-3.5 py-2 text-left font-bold text-slate-400 uppercase tracking-wider text-[9px] bg-slate-50">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parsedRows.map((r, i) => {
                    const rowErrors = rowValidation(r)
                    return (
                      <tr key={i} className="hover:bg-slate-50/70 bg-white">
                        <td className={`px-3.5 py-2 font-bold ${rowErrors.chapterName ? 'text-red-600 bg-red-50 border border-red-200 rounded' : 'text-slate-800'}`} title={rowErrors.chapterName}>
                          {r.chapterName || '—'}
                        </td>
                        <td className="px-3.5 py-2 font-semibold text-slate-500">{r.chapterCode || '—'}</td>
                        <td className="px-3.5 py-2 font-semibold text-slate-500">{r.board || '—'}</td>
                        <td className="px-3.5 py-2 font-semibold text-slate-500">{r.classLevel || '—'}</td>
                        <td className="px-3.5 py-2 font-semibold text-slate-500">{r.program || '—'}</td>
                        <td className="px-3.5 py-2 font-semibold text-slate-500">{r.expectedHours || '—'}</td>
                        <td className="px-3.5 py-2 text-slate-600">{r.conceptName || '—'}</td>
                        <td className="px-3.5 py-2 text-slate-450">{r.conceptCode || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <button
              onClick={handleImport}
              disabled={importing || !subjectId}
              className="w-full bg-[#0b1320] hover:bg-slate-800 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-md cursor-pointer transform active:scale-[0.98]"
            >
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {importing ? 'Importing...' : `Import ${chapterCount} Chapter${chapterCount === 1 ? '' : 's'} & ${conceptCount} Concept${conceptCount === 1 ? '' : 's'}`}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  )
}
