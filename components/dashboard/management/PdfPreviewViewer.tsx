'use client'

import { Loader2 } from 'lucide-react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

interface PdfPreviewViewerProps {
  url: string
  numPages: number | null
  onLoadSuccess: (numPages: number) => void
}

export default function PdfPreviewViewer({ url, numPages, onLoadSuccess }: PdfPreviewViewerProps) {
  return (
    <Document
      file={url}
      onLoadSuccess={({ numPages }) => onLoadSuccess(numPages)}
      loading={
        <div className="flex flex-col items-center justify-center p-12 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-4" />
          <p className="text-sm font-bold">Rendering Document...</p>
        </div>
      }
    >
      {numPages && Array.from(new Array(numPages), (el, index) => (
        <Page
          key={`page_${index + 1}`}
          pageNumber={index + 1}
          renderTextLayer={false}
          renderAnnotationLayer={false}
          className="shadow-xl mb-6 last:mb-0 bg-white"
          width={700}
        />
      ))}
    </Document>
  )
}
