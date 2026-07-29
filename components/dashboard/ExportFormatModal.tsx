'use client'
import { useState } from 'react'
import { X, Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react'

export default function ExportFormatModal({
  title,
  onClose,
  onExport,
}: {
  title: string
  onClose: () => void
  onExport: (format: 'PDF' | 'CSV') => Promise<void> | void
}) {
  const [format, setFormat] = useState<'PDF' | 'CSV'>('PDF')
  const [exporting, setExporting] = useState(false)

  async function handleExport() {
    setExporting(true)
    try {
      await onExport(format)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">Export Format</label>
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            onClick={() => setFormat('PDF')}
            className={`p-3.5 rounded-2xl border flex flex-col items-center gap-1.5 text-xs font-bold transition-all cursor-pointer ${format === 'PDF' ? 'border-emerald-600 bg-emerald-50 text-emerald-800 shadow-xs' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
          >
            <FileText className="w-5 h-5" /> PDF
          </button>
          <button
            onClick={() => setFormat('CSV')}
            className={`p-3.5 rounded-2xl border flex flex-col items-center gap-1.5 text-xs font-bold transition-all cursor-pointer ${format === 'CSV' ? 'border-emerald-600 bg-emerald-50 text-emerald-800 shadow-xs' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
          >
            <FileSpreadsheet className="w-5 h-5" /> CSV
          </button>
        </div>

        <div className="flex justify-end gap-3">
          <button onClick={onClose} disabled={exporting} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-all disabled:opacity-50 cursor-pointer">
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition-all disabled:opacity-50 cursor-pointer"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span>{format === 'PDF' ? 'Generate & Export PDF' : 'Download CSV'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
