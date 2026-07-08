'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Printer, Search, CheckSquare, Square, FileText } from 'lucide-react'

interface ExportQuestionsModalProps {
  isOpen: boolean
  onClose: () => void
  filteredQuestions: any[]
  activeSubjectFilter?: string
}

export default function ExportQuestionsModal({
  isOpen,
  onClose,
  filteredQuestions,
  activeSubjectFilter = 'All'
}: ExportQuestionsModalProps) {
  // Form fields
  const [instituteName, setInstituteName] = useState('EduAdmin Pro')
  const [testTitle, setTestTitle] = useState('Weekly Assessment Test')
  const [subject, setSubject] = useState('')
  const [batch, setBatch] = useState('JEE 2026-A')
  const [timeAllowed, setTimeAllowed] = useState('180 Minutes')
  const [customMaxMarks, setCustomMaxMarks] = useState('')
  const [instructions, setInstructions] = useState(
    "1. All questions are compulsory.\n2. Read the questions carefully before answering.\n3. There is no negative marking."
  )
  
  // Custom toggles
  const [includeAnswerKey, setIncludeAnswerKey] = useState(true)
  const [showMarks, setShowMarks] = useState(true)
  
  // Question selection states
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  // Sync selected questions when filteredQuestions changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedIds(filteredQuestions.map(q => q.id))
      setSubject(activeSubjectFilter === 'All' ? '' : activeSubjectFilter)
    }
  }, [isOpen, filteredQuestions, activeSubjectFilter])

  if (!isOpen) return null

  // Filter questions list inside modal based on search query
  const modalQuestions = filteredQuestions.filter(q =>
    q.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
    q.topic.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Toggle selection
  const handleToggle = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    )
  }

  const handleSelectAll = () => {
    setSelectedIds(filteredQuestions.map(q => q.id))
  }

  const handleDeselectAll = () => {
    setSelectedIds([])
  }

  // Calculate stats
  const selectedQuestions = filteredQuestions.filter(q => selectedIds.includes(q.id))
  const calculatedMaxMarks = selectedQuestions.reduce((sum, q) => sum + (q.marks || 4), 0)
  const maxMarksDisplay = customMaxMarks.trim() !== '' ? customMaxMarks : `${calculatedMaxMarks} Marks`

  const handleGeneratePdf = () => {
    if (selectedQuestions.length === 0) {
      alert('Please select at least one question to export.')
      return
    }

    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      alert('Please allow popups to export the PDF.')
      return
    }

    // Parse instructions
    const instructionsList = instructions
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)

    // Generate Questions HTML
    const questionsHtml = selectedQuestions.map((q, idx) => {
      let optionsHtml = ''
      if (q.type === 'MCQ' && Array.isArray(q.options) && q.options.length > 0) {
        const isLong = q.options.some((opt: string) => opt.length > 25)
        const gridClass = isLong ? 'grid-cols-1' : 'grid-cols-2'
        
        optionsHtml = `
          <div class="options-grid ${gridClass}">
            ${q.options.map((opt: string, i: number) => `
              <div class="option-item">
                <span class="option-label">(${String.fromCharCode(65 + i)})</span>
                <span class="option-text">${opt}</span>
              </div>
            `).join('')}
          </div>
        `
      }

      const marksLabel = showMarks ? `<span class="question-marks">[${q.marks || 4} M]</span>` : ''

      return `
        <div class="question-container avoid-break">
          <div class="question-header">
            <div class="question-text-wrapper">
              <span class="question-number">Q${idx + 1}.</span>
              <span class="question-text">${q.text}</span>
            </div>
            ${marksLabel}
          </div>
          ${optionsHtml}
        </div>
      `
    }).join('')

    // Generate Answer Key HTML
    let answerKeyHtml = ''
    if (includeAnswerKey) {
      answerKeyHtml = `
        <div class="page-break"></div>
        <div class="answer-key-section">
          <h2 class="answer-key-title">ANSWER KEY</h2>
          <div class="answer-key-subtitle">${testTitle} - ${subject || 'General'}</div>
          
          <table class="answer-key-table">
            <thead>
              <tr>
                <th style="width: 15%">Q. No.</th>
                <th style="width: 25%">Correct Answer</th>
                <th style="width: 35%">Topic</th>
                <th style="width: 25%">Marks</th>
              </tr>
            </thead>
            <tbody>
              ${selectedQuestions.map((q, idx) => `
                <tr>
                  <td style="text-align: center; font-weight: bold;">${idx + 1}</td>
                  <td style="text-align: center; font-weight: bold; color: #0b1320;">
                    ${q.correctAnswer || '—'}
                  </td>
                  <td>${q.topic || '—'}</td>
                  <td style="text-align: center;">${q.marks || 4}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `
    }

    // Generate final HTML content
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${testTitle}</title>
          <meta charset="utf-8">
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
            
            @page {
              size: A4;
              margin: 20mm;
            }
            
            @media print {
              body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .page-break {
                page-break-before: always;
                break-before: page;
              }
              .avoid-break {
                page-break-inside: avoid;
                break-inside: avoid;
              }
            }

            body {
              font-family: 'Inter', sans-serif;
              color: #0f172a;
              margin: 0;
              padding: 0;
              font-size: 13px;
              line-height: 1.6;
            }

            .header-container {
              border-bottom: 2px solid #0f172a;
              padding-bottom: 12px;
              margin-bottom: 20px;
            }

            .institute-name {
              font-size: 20px;
              font-weight: 700;
              text-align: center;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin: 0 0 4px 0;
              color: #0f172a;
            }

            .test-title {
              font-size: 14px;
              font-weight: 600;
              text-align: center;
              margin: 0 0 16px 0;
              color: #334155;
            }

            .metadata-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 12px;
            }

            .metadata-table td {
              padding: 4px 0;
              font-size: 12px;
            }

            .metadata-label {
              font-weight: 600;
              color: #475569;
            }

            .metadata-value {
              font-weight: 500;
              color: #0f172a;
            }

            .instructions-box {
              background-color: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 6px;
              padding: 12px;
              margin-bottom: 24px;
            }

            .instructions-title {
              font-size: 11px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 6px;
              color: #475569;
            }

            .instructions-list {
              margin: 0;
              padding-left: 18px;
              font-size: 11px;
              color: #475569;
            }

            .instructions-list li {
              margin-bottom: 3px;
            }

            .question-container {
              margin-bottom: 20px;
              padding-bottom: 12px;
            }

            .question-header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              gap: 12px;
              margin-bottom: 8px;
            }

            .question-text-wrapper {
              display: flex;
              gap: 6px;
            }

            .question-number {
              font-weight: 600;
              color: #0f172a;
              white-space: nowrap;
            }

            .question-text {
              font-weight: 500;
              color: #0f172a;
            }

            .question-marks {
              font-size: 11px;
              font-weight: 600;
              color: #475569;
              white-space: nowrap;
              background-color: #f1f5f9;
              padding: 2px 6px;
              border-radius: 4px;
            }

            .options-grid {
              display: grid;
              gap: 8px;
              padding-left: 28px;
              margin-top: 6px;
            }

            .grid-cols-1 {
              grid-template-columns: repeat(1, minmax(0, 1fr));
            }

            .grid-cols-2 {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }

            .option-item {
              display: flex;
              gap: 8px;
              align-items: baseline;
            }

            .option-label {
              font-weight: 600;
              color: #475569;
            }

            .option-text {
              color: #334155;
            }

            /* Answer Key Styles */
            .answer-key-section {
              padding-top: 10px;
            }

            .answer-key-title {
              font-size: 18px;
              font-weight: 700;
              text-align: center;
              text-transform: uppercase;
              letter-spacing: 1px;
              margin-bottom: 4px;
              color: #0f172a;
            }

            .answer-key-subtitle {
              font-size: 12px;
              text-align: center;
              color: #475569;
              margin-bottom: 24px;
            }

            .answer-key-table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
            }

            .answer-key-table th {
              background-color: #f1f5f9;
              border: 1px solid #cbd5e1;
              padding: 8px;
              font-size: 11px;
              font-weight: 700;
              text-transform: uppercase;
              color: #475569;
            }

            .answer-key-table td {
              border: 1px solid #cbd5e1;
              padding: 8px 12px;
              font-size: 12px;
              color: #334155;
            }

            .answer-key-table tr:nth-child(even) {
              background-color: #f8fafc;
            }
          </style>
        </head>
        <body>
          <!-- Header -->
          <div class="header-container">
            <h1 class="institute-name">${instituteName}</h1>
            <h2 class="test-title">${testTitle}</h2>
            
            <table class="metadata-table">
              <tr>
                <td style="width: 50%;">
                  <span class="metadata-label">Subject:</span> 
                  <span class="metadata-value">${subject || 'General'}</span>
                </td>
                <td style="width: 50%; text-align: right;">
                  <span class="metadata-label">Time Allowed:</span> 
                  <span class="metadata-value">${timeAllowed}</span>
                </td>
              </tr>
              <tr>
                <td style="width: 50%;">
                  <span class="metadata-label">Class/Batch:</span> 
                  <span class="metadata-value">${batch || 'General'}</span>
                </td>
                <td style="width: 50%; text-align: right;">
                  <span class="metadata-label">Max Marks:</span> 
                  <span class="metadata-value">${maxMarksDisplay}</span>
                </td>
              </tr>
            </table>
          </div>

          <!-- Instructions -->
          ${instructionsList.length > 0 ? `
            <div class="instructions-box">
              <div class="instructions-title">Instructions:</div>
              <ul class="instructions-list">
                ${instructionsList.map(ins => `<li>${ins}</li>`).join('')}
              </ul>
            </div>
          ` : ''}

          <!-- Questions -->
          <div class="questions-section">
            ${questionsHtml}
          </div>

          <!-- Answer Key -->
          ${answerKeyHtml}

          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 300);
            }
          </script>
        </body>
      </html>
    `

    printWindow.document.write(htmlContent)
    printWindow.document.close()
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-4xl border border-slate-100 max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* Modal Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#0b1320]" />
            <h3 className="text-lg font-bold text-slate-900">Export Question Paper to PDF</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column: Form Configuration */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
              1. Header Settings
            </h4>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-0.5">
                School/Institute Name
              </label>
              <input
                type="text"
                value={instituteName}
                onChange={(e) => setInstituteName(e.target.value)}
                placeholder="e.g. EduAdmin Pro Academy"
                className="w-full mt-1.5 px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-slate-400 transition-colors"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-0.5">
                Test Title
              </label>
              <input
                type="text"
                value={testTitle}
                onChange={(e) => setTestTitle(e.target.value)}
                placeholder="e.g. Midterm Examination"
                className="w-full mt-1.5 px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-slate-400 transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-0.5">
                  Subject
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Physics"
                  className="w-full mt-1.5 px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-slate-400 transition-colors"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-0.5">
                  Class/Batch
                </label>
                <input
                  type="text"
                  value={batch}
                  onChange={(e) => setBatch(e.target.value)}
                  placeholder="e.g. Grade 11-A"
                  className="w-full mt-1.5 px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-slate-400 transition-colors"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-0.5">
                  Time Allowed
                </label>
                <input
                  type="text"
                  value={timeAllowed}
                  onChange={(e) => setTimeAllowed(e.target.value)}
                  placeholder="e.g. 180 Minutes"
                  className="w-full mt-1.5 px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-slate-400 transition-colors"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-0.5 flex justify-between">
                  <span>Max Marks</span>
                  <span className="text-[9px] text-slate-400 normal-case font-semibold">
                    (Auto: {calculatedMaxMarks})
                  </span>
                </label>
                <input
                  type="text"
                  value={customMaxMarks}
                  onChange={(e) => setCustomMaxMarks(e.target.value)}
                  placeholder="Leave empty for auto"
                  className="w-full mt-1.5 px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-slate-400 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-0.5">
                Instructions (One per line)
              </label>
              <textarea
                rows={3}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Enter instructions..."
                className="w-full mt-1.5 px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-slate-400 transition-colors"
              />
            </div>

            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 pt-2">
              2. Formatting Options
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeAnswerKey}
                  onChange={(e) => setIncludeAnswerKey(e.target.checked)}
                  className="rounded border-slate-300 text-[#0b1320] focus:ring-slate-500 w-4 h-4 cursor-pointer"
                />
                <span className="text-xs font-semibold text-slate-700">Include Answer Key</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showMarks}
                  onChange={(e) => setShowMarks(e.target.checked)}
                  className="rounded border-slate-300 text-[#0b1320] focus:ring-slate-500 w-4 h-4 cursor-pointer"
                />
                <span className="text-xs font-semibold text-slate-700">Show Question Marks</span>
              </label>
            </div>
          </div>

          {/* Right Column: Question Checklist */}
          <div className="flex flex-col h-full min-h-[300px] border border-slate-100 rounded-xl overflow-hidden bg-slate-50/50">
            {/* Checklist Header Controls */}
            <div className="p-4 border-b border-slate-100 bg-white space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  3. Select Questions ({selectedIds.length} of {filteredQuestions.length})
                </h4>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleSelectAll}
                    className="text-[10px] font-bold text-blue-600 hover:text-blue-800 transition-colors uppercase tracking-wider"
                  >
                    Select All
                  </button>
                  <span className="text-slate-300 text-xs">|</span>
                  <button
                    onClick={handleDeselectAll}
                    className="text-[10px] font-bold text-slate-500 hover:text-slate-700 transition-colors uppercase tracking-wider"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              {/* Inner search bar */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter list by text..."
                  className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 outline-none focus:border-slate-300 transition-colors"
                />
              </div>
            </div>

            {/* Checklist Scroll Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 max-h-[380px]">
              {modalQuestions.length > 0 ? (
                modalQuestions.map((q) => {
                  const isChecked = selectedIds.includes(q.id)
                  return (
                    <div
                      key={q.id}
                      onClick={() => handleToggle(q.id)}
                      className={`p-3 bg-white border rounded-xl hover:border-slate-300 transition-all cursor-pointer select-none flex items-start gap-3 ${
                        isChecked ? 'border-indigo-100 bg-indigo-50/10' : 'border-slate-100'
                      }`}
                    >
                      <button className="mt-0.5 shrink-0 text-slate-400 hover:text-slate-600 transition-colors" type="button">
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-[#0b1320]" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-medium text-slate-800 line-clamp-2 leading-relaxed">
                          {q.text}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[8px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                            {q.subject}
                          </span>
                          <span className="text-[8px] font-bold text-slate-400 truncate max-w-[120px]">
                            {q.topic}
                          </span>
                          <span className="text-[8px] font-bold text-slate-400">
                            ·
                          </span>
                          <span className="text-[8px] font-bold text-slate-500">
                            {q.marks || 4} Marks
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="py-12 text-center text-xs font-semibold text-slate-400">
                  No matching questions found in this list.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-700">
              Total questions to export: {selectedQuestions.length}
            </span>
            <span className="text-[10px] font-semibold text-slate-400 mt-0.5">
              Subject: {subject || 'All Subjects'} · Time: {timeAllowed} · Marks: {maxMarksDisplay}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              type="button"
              className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-semibold transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleGeneratePdf}
              disabled={selectedQuestions.length === 0}
              type="button"
              className="flex items-center gap-2 px-5 py-2 bg-[#0b1320] hover:bg-slate-800 disabled:bg-slate-300 text-white rounded-lg text-sm font-semibold transition-all shadow-sm disabled:cursor-not-allowed"
            >
              <Printer className="w-4 h-4" />
              Generate PDF
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
