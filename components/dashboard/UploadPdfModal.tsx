'use client'

import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Upload, FileText, Download, CheckCircle2, AlertCircle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'

const SAMPLE_TEMPLATE = `Subject: Physics
Topic: Thermodynamics
Difficulty: Medium
Type: MCQ
Marks: 4
Negative Marks: -1
Source: Custom

1. What is the SI unit of temperature?
(A) Celsius
(B) Kelvin
(C) Fahrenheit
(D) Rankine

2. Which thermodynamic process occurs at constant temperature?
(A) Adiabatic
(B) Isochoric
(C) Isothermal
(D) Isobaric

3. In an adiabatic process, which quantity remains constant?
(A) Temperature
(B) Pressure
(C) Volume
(D) Heat

4. What is the efficiency of a Carnot engine operating between 300K and 600K?
(A) 25%
(B) 50%
(C) 75%
(D) 100%

5. Which law of thermodynamics states that energy cannot be created or destroyed?
(A) Zeroth Law
(B) First Law
(C) Second Law
(D) Third Law

ANSWER KEY
1. B
2. C
3. D
4. B
5. B
`

const NUMERICAL_SAMPLE = `Subject: Mathematics
Topic: Calculus
Difficulty: Hard
Type: Numerical
Marks: 5
Negative Marks: 0
Source: Custom

1. Evaluate the derivative of f(x) = x^3 - 3x + 5 at x = 2.

2. Find the integral of 2x dx from 0 to 3.

3. What is the value of lim(x→0) sin(x)/x?

ANSWER KEY
1. 9
2. 9
3. 1
`

interface UploadPdfModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function UploadPdfModal({ isOpen, onClose, onSuccess }: UploadPdfModalProps) {
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<{ inserted: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showGuide, setShowGuide] = useState(true)
  const [sampleType, setSampleType] = useState<'mcq' | 'numerical'>('mcq')
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFile(f: File) {
    if (!f.name.toLowerCase().endsWith('.pdf')) {
      setError('Only PDF files are supported.')
      return
    }
    setFile(f)
    setError(null)
    setResult(null)
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) handleFile(dropped)
  }, [])

  async function handleUpload() {
    if (!file) return
    setUploading(true)
    setError(null)
    setResult(null)

    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/tests/questions/upload-pdf', { method: 'POST', body: form })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
      } else {
        setResult({ inserted: data.inserted })
        onSuccess()
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  function downloadSample() {
    const content = sampleType === 'mcq' ? SAMPLE_TEMPLATE : NUMERICAL_SAMPLE
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = sampleType === 'mcq' ? 'sample_mcq_question_bank.txt' : 'sample_numerical_question_bank.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleClose() {
    setFile(null)
    setError(null)
    setResult(null)
    setUploading(false)
    onClose()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-100 max-h-[92vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-xl">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Upload PDF Question Bank</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">Bulk import questions from a structured PDF</p>
                </div>
              </div>
              <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">

              {/* ── Format Guide ───────────────────────────────────────── */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setShowGuide(g => !g)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
                >
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">📋 PDF Format Guide</span>
                  {showGuide ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </button>

                {showGuide && (
                  <div className="p-4 space-y-4">
                    {/* Tab selector */}
                    <div className="flex gap-2">
                      {(['mcq', 'numerical'] as const).map(t => (
                        <button
                          key={t}
                          onClick={() => setSampleType(t)}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                            sampleType === t ? 'bg-[#0b1320] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {t === 'mcq' ? 'MCQ Format' : 'Numerical / Subjective Format'}
                        </button>
                      ))}
                    </div>

                    {/* Format Rules */}
                    <div className="grid grid-cols-1 gap-1.5">
                      {[
                        ['Subject:', 'e.g. Physics, Chemistry, Mathematics, Biology'],
                        ['Topic:', 'e.g. Thermodynamics, Optics, Algebra'],
                        ['Difficulty:', 'Easy | Medium | Hard'],
                        ['Type:', 'MCQ | Numerical | Integer | Subjective'],
                        ['Marks:', 'Points per question (default: 4)'],
                        ['Negative Marks:', '0 to -9 (default: 0)'],
                        ['Source:', 'e.g. JEE PYQ, NEET PYQ, Custom (default: PDF Upload)'],
                      ].map(([field, desc]) => (
                        <div key={field} className="flex items-start gap-2 text-xs">
                          <span className="font-bold text-[#0b1320] w-32 shrink-0">{field}</span>
                          <span className="text-slate-500">{desc}</span>
                        </div>
                      ))}
                    </div>

                    {/* Sample preview */}
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Sample Format Preview</p>
                      <pre className="bg-slate-900 text-green-300 text-[10px] leading-5 rounded-xl p-4 overflow-x-auto font-mono whitespace-pre-wrap">
                        {sampleType === 'mcq' ? SAMPLE_TEMPLATE.slice(0, 320) + '\n...' : NUMERICAL_SAMPLE}
                      </pre>
                    </div>

                    {/* Key rules */}
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1">
                      <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-1.5">Important Rules</p>
                      {[
                        'Header block (Subject, Topic, etc.) must be at the TOP of the file',
                        'Questions must be numbered: 1. 2. 3. or Q1. Q2. Q3.',
                        'MCQ options must use (A) (B) (C) (D) format',
                        'The ANSWER KEY section must be the LAST block',
                        'Answer format: 1. B  or  1. 4 seconds  (number + answer)',
                        'PDF must contain selectable text — scanned images are not supported',
                      ].map(rule => (
                        <p key={rule} className="text-[11px] text-amber-800 flex items-start gap-1.5">
                          <span className="text-amber-500 mt-0.5">•</span> {rule}
                        </p>
                      ))}
                    </div>

                    {/* Download sample */}
                    <button
                      onClick={downloadSample}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download Sample Template ({sampleType === 'mcq' ? 'MCQ' : 'Numerical'})
                    </button>
                  </div>
                )}
              </div>

              {/* ── Drop Zone ──────────────────────────────────────────── */}
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all ${
                  dragging ? 'border-blue-400 bg-blue-50' : file ? 'border-green-400 bg-green-50' : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }}
                />
                {file ? (
                  <>
                    <div className="p-3 bg-green-100 rounded-full">
                      <FileText className="w-6 h-6 text-green-600" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-green-700">{file.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{(file.size / 1024).toFixed(1)} KB — click to change</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="p-3 bg-slate-200 rounded-full">
                      <Upload className="w-6 h-6 text-slate-500" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-slate-700">Drag & drop your PDF here</p>
                      <p className="text-xs text-slate-400 mt-1">or click to browse · PDF files only</p>
                    </div>
                  </>
                )}
              </div>

              {/* ── Error / Success ─────────────────────────────────────── */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl"
                >
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-xs font-semibold text-red-700">{error}</p>
                </motion.div>
              )}

              {result && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl"
                >
                  <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-green-800">
                      ✅ {result.inserted} question{result.inserted !== 1 ? 's' : ''} imported successfully!
                    </p>
                    <p className="text-xs text-green-600 mt-0.5">Questions are now available in your Question Bank.</p>
                  </div>
                </motion.div>
              )}

              {/* ── Actions ────────────────────────────────────────────── */}
              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  onClick={handleClose}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  {result ? 'Close' : 'Cancel'}
                </button>
                {!result && (
                  <button
                    onClick={handleUpload}
                    disabled={!file || uploading}
                    className="flex items-center gap-2 px-5 py-2 bg-[#0b1320] hover:bg-slate-800 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50 shadow-sm"
                  >
                    {uploading ? (
                      <><RefreshCw className="w-4 h-4 animate-spin" /> Processing PDF...</>
                    ) : (
                      <><Upload className="w-4 h-4" /> Import Questions</>
                    )}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
