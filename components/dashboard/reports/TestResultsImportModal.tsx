'use client'

import { useEffect, useRef, useState } from 'react'
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
import { MISTAKE_TYPES } from '@/lib/reports/mistake-types'
import { RATING_VALUES } from '@/lib/reports/test-results-import'

interface TestSummary {
  id: string
  title: string
  batch: string
  subject: string
  date: string
  status: string
}

interface AttachedQuestion {
  id: string
  topic: string
  type: 'MCQ' | 'Numerical' | 'Integer' | 'Subjective'
  options: string // JSON-encoded array
  marks: number
}

interface RosterStudent {
  studentId: string
  studentName: string
  rollNo: string
}

interface ParsedRow {
  rollNo: string
  studentName: string
  answers: Record<string, string>
  mistakeTypes: Record<string, string>
  attitude: string
  behaviour: string
  focus: string
  interaction: string
  ptmParentAttended: string
  ptmParentName: string
  ptmDiscussionNotes: string
  ptmActionItems: string
  ptmFollowUpDate: string
}

interface TestResultsImportModalProps {
  onClose: () => void
  onImported: (summary: { written: number; skippedCount: number }) => void
}

export default function TestResultsImportModal({ onClose, onImported }: TestResultsImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [tests, setTests] = useState<TestSummary[]>([])
  const [selectedTestId, setSelectedTestId] = useState('')
  const [questions, setQuestions] = useState<AttachedQuestion[]>([])
  const [roster, setRoster] = useState<RosterStudent[]>([])
  const [loadingTestDetail, setLoadingTestDetail] = useState(false)
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [unknownRollNumbers, setUnknownRollNumbers] = useState<string[]>([])
  const [error, setError] = useState('')
  const [importing, setImporting] = useState(false)
  const [resultSummary, setResultSummary] = useState<{ written: number; skipped: { rollNo: string; reason: string }[]; rowErrors: { row: number; rollNo: string; field: string; message: string }[]; unresolvableQuestions: { questionId: string; topic: string }[] } | null>(null)

  useEffect(() => {
    fetch('/api/tests/schedule')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => Array.isArray(data) && setTests(data))
      .catch(() => setTests([]))
  }, [])

  useEffect(() => {
    if (!selectedTestId) {
      setQuestions([])
      setRoster([])
      return
    }
    setLoadingTestDetail(true)
    setRows([])
    setFileName('')
    setResultSummary(null)
    fetch(`/api/tests/${selectedTestId}/responses`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return
        setQuestions(data.questions || [])
        setRoster((data.studentResults || []).map((s: any) => ({ studentId: s.studentId, studentName: s.studentName, rollNo: s.rollNo })))
      })
      .finally(() => setLoadingTestDetail(false))
  }, [selectedTestId])

  const selectedTest = tests.find((t) => t.id === selectedTestId) || null

  function questionOptions(q: AttachedQuestion): string[] {
    try {
      return JSON.parse(q.options)
    } catch {
      return []
    }
  }

  function downloadTemplate() {
    if (!selectedTest) return
    const headerRow1: string[] = ['Name', 'RollNo']
    const headerRow2: string[] = ['', '']
    questions.forEach((q, i) => {
      headerRow1.push(`Q${i + 1}_Answer`, `Q${i + 1}_MistakeType`)
      headerRow2.push(q.topic, '')
    })
    headerRow1.push('Attitude', 'Behaviour', 'Focus', 'Interaction', 'PTM_ParentAttended', 'PTM_ParentName', 'PTM_DiscussionNotes', 'PTM_ActionItems', 'PTM_FollowUpDate')

    const dataRows = roster.map((s) => {
      const row = [s.studentName, s.rollNo]
      questions.forEach(() => row.push('', ''))
      row.push('', '', '', '', '', '', '', '', '')
      return row
    })

    const sheet = XLSX.utils.aoa_to_sheet([headerRow1, ...dataRows])
    const instructions = XLSX.utils.aoa_to_sheet([
      ['Column', 'Format'],
      ...questions.map((q, i) => [`Q${i + 1}_Answer (${q.topic})`, q.type === 'MCQ'
        ? `Letter A-D matching: ${questionOptions(q).map((opt, idx) => `${String.fromCharCode(65 + idx)}=${opt}`).join(', ')}`
        : q.type === 'Subjective'
          ? 'Not auto-graded — leave blank or grade manually in the Test Grading screen.'
          : 'A number.']),
      ['Qn_MistakeType', `Optional. One of: ${MISTAKE_TYPES.join(', ')} — only used when the answer is Incorrect.`],
      ['Attitude / Behaviour / Focus / Interaction', `Optional per row, but all four together. One of: ${RATING_VALUES.join(', ')}`],
      ['PTM_ParentAttended', 'Optional. Yes or No.'],
      ['PTM_ParentName / PTM_DiscussionNotes / PTM_ActionItems / PTM_FollowUpDate', 'Optional free text (PTM_FollowUpDate as YYYY-MM-DD).'],
    ])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, sheet, 'Results')
    XLSX.utils.book_append_sheet(workbook, instructions, 'Instructions')
    XLSX.writeFile(workbook, `${selectedTest.title.replace(/\s+/g, '_')}_results_template.xlsx`)
  }

  function parseFile(file: File) {
    setFileName(file.name)
    setRows([])
    setUnknownRollNumbers([])
    setError('')
    setResultSummary(null)

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

        const rosterRollNumbers = new Set(roster.map((s) => s.rollNo.toLowerCase()))
        const unknown = new Set<string>()

        const parsed: ParsedRow[] = rawRows.map((raw) => {
          const rollNo = String(raw['RollNo'] ?? '').trim()
          if (rollNo && !rosterRollNumbers.has(rollNo.toLowerCase())) unknown.add(rollNo)

          const answers: Record<string, string> = {}
          const mistakeTypes: Record<string, string> = {}
          questions.forEach((q, i) => {
            const answer = String(raw[`Q${i + 1}_Answer`] ?? '').trim()
            const mistakeType = String(raw[`Q${i + 1}_MistakeType`] ?? '').trim()
            if (answer) answers[q.id] = answer
            if (mistakeType) mistakeTypes[q.id] = mistakeType
          })

          return {
            rollNo,
            studentName: String(raw['Name'] ?? '').trim(),
            answers,
            mistakeTypes,
            attitude: String(raw['Attitude'] ?? '').trim(),
            behaviour: String(raw['Behaviour'] ?? '').trim(),
            focus: String(raw['Focus'] ?? '').trim(),
            interaction: String(raw['Interaction'] ?? '').trim(),
            ptmParentAttended: String(raw['PTM_ParentAttended'] ?? '').trim(),
            ptmParentName: String(raw['PTM_ParentName'] ?? '').trim(),
            ptmDiscussionNotes: String(raw['PTM_DiscussionNotes'] ?? '').trim(),
            ptmActionItems: String(raw['PTM_ActionItems'] ?? '').trim(),
            ptmFollowUpDate: String(raw['PTM_FollowUpDate'] ?? '').trim(),
          }
        }).filter((row) => row.rollNo)

        if (parsed.length === 0) {
          setError('No data rows were found. Download the template and keep its header row unchanged.')
          return
        }
        if (parsed.length > 1000) {
          setError('A single file can contain at most 1,000 student rows.')
          return
        }

        setRows(parsed)
        setUnknownRollNumbers([...unknown])
      } catch {
        setError('This file could not be read. Use a valid .xlsx, .xls, or .csv file based on the template.')
      }
    }
    reader.onerror = () => setError('This file could not be read. Please choose it again.')
    reader.readAsArrayBuffer(file)
  }

  async function handleImport() {
    if (!selectedTest || rows.length === 0) return
    setImporting(true)
    setError('')
    try {
      const response = await fetch(`/api/tests/${selectedTest.id}/import-results`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedTest.date, rows }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(result.error || 'The results could not be imported.')
        return
      }
      setResultSummary(result.summary)
      onImported({ written: result.summary.written, skippedCount: result.summary.skipped.length })
    } catch {
      setError('The results could not be imported. Check your connection and try again.')
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
              <h2 className="text-base font-bold text-slate-900">Import test results</h2>
              <p className="mt-0.5 text-[11px] text-slate-500">Bulk-grade a test and update the Student Reports Hub · up to 1,000 students per file</p>
            </div>
          </div>
          <button onClick={onClose} disabled={importing} aria-label="Close import dialog" className="rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-50">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto p-6">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold text-slate-700">Test <span className="text-rose-500">*</span></span>
            <select
              value={selectedTestId}
              onChange={(e) => setSelectedTestId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="">Select a test…</option>
              {tests.map((t) => (
                <option key={t.id} value={t.id}>{t.title} — {t.subject} ({t.batch}) — {t.date}</option>
              ))}
            </select>
          </label>

          {selectedTestId && loadingTestDetail && (
            <p className="text-xs font-medium text-slate-500">Loading questions and roster…</p>
          )}

          {selectedTestId && !loadingTestDetail && (
            <>
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-slate-800">{questions.length} question{questions.length === 1 ? '' : 's'} · {roster.length} student{roster.length === 1 ? '' : 's'} in roster</p>
                    <p className="mt-1 text-[11px] leading-5 text-slate-600">MCQ answers use letters A-D. Numerical/Integer use a number. Behavioral ratings and PTM fields are optional.</p>
                  </div>
                  <button onClick={downloadTemplate} disabled={questions.length === 0} className="flex shrink-0 items-center gap-2 rounded-lg border border-indigo-200 bg-white px-3.5 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50">
                    <Download className="h-4 w-4" /> Download template (.xlsx)
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
                {rows.length > 0 ? <CheckCircle2 className="mb-2 h-7 w-7 text-emerald-500" /> : <Upload className="mb-2 h-7 w-7 text-indigo-500" />}
                <span className="text-sm font-bold text-slate-800">{fileName || 'Choose or drop the filled-in template'}</span>
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
                    <span className={`text-[11px] font-bold ${unknownRollNumbers.length ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {unknownRollNumbers.length ? `${unknownRollNumbers.length} unknown roll ${unknownRollNumbers.length === 1 ? 'number' : 'numbers'} will be skipped` : 'All roll numbers match the roster'}
                    </span>
                  </div>
                  <div className="max-h-40 overflow-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 bg-white text-[10px] uppercase tracking-wide text-slate-500">
                        <tr><th className="border-b border-slate-100 px-3 py-2">Row</th><th className="border-b border-slate-100 px-3 py-2">Name</th><th className="border-b border-slate-100 px-3 py-2">RollNo</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {rows.slice(0, 20).map((row, index) => (
                          <tr key={index} className={unknownRollNumbers.includes(row.rollNo) ? 'bg-amber-50' : ''}>
                            <td className="px-3 py-2 font-bold text-slate-400">{index + 2}</td>
                            <td className="px-3 py-2 font-medium text-slate-800">{row.studentName || '—'}</td>
                            <td className="px-3 py-2">{row.rollNo}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {resultSummary && (
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
                  <p className="font-bold">Imported: {resultSummary.written} row{resultSummary.written === 1 ? '' : 's'} written.</p>
                  {resultSummary.skipped.length > 0 && <p className="mt-1">Skipped {resultSummary.skipped.length}: {resultSummary.skipped.map((s) => s.rollNo).join(', ')}</p>}
                  {resultSummary.unresolvableQuestions.length > 0 && (
                    <p className="mt-1 text-amber-700">{resultSummary.unresolvableQuestions.length} question{resultSummary.unresolvableQuestions.length === 1 ? '' : 's'} could not be auto-graded — fix its correct answer in Test Bank: {resultSummary.unresolvableQuestions.map((q) => q.topic).join(', ')}</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50/70 px-6 py-4">
          <button onClick={onClose} disabled={importing} className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">Close</button>
          <button onClick={handleImport} disabled={importing || rows.length === 0} className="flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40">
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {importing ? 'Importing…' : `Import ${rows.length || ''} ${rows.length === 1 ? 'row' : 'rows'}`}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
