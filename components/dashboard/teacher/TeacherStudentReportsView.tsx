'use client'
import { useState, useEffect } from 'react'
import { Plus, X, Search, Filter, FileText, Loader2, CheckCircle2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import ReportDetailModal from '@/components/dashboard/ReportDetailModal'
import StudentReportImportModal from '@/components/dashboard/StudentReportImportModal'

import StudentFullReportsView from '@/components/dashboard/reports/StudentFullReportsView'

interface UploadedReportSummary {
  _id: string
  class: string
  sub: string
  term: string
  students: number
  avg: string
  date: string
}

export default function TeacherStudentReportsView() {
  const [mainTab, setMainTab] = useState<'hub' | 'uploaded'>('hub')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [reports, setReports] = useState<UploadedReportSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [toastMessage, setToastMessage] = useState<{ title: string; desc?: string; type: 'success' | 'info' | 'error' } | null>(null)
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null)

  async function fetchReports() {
    try {
      const res = await fetch('/api/teacher-portal/reports')
      if (res.ok) setReports(await res.json())
    } catch (error) {
      console.error('Failed to fetch reports', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    fetch('/api/teacher-portal/reports')
      .then(async (res) => res.ok ? res.json() : [])
      .then((data) => { if (!cancelled) setReports(data) })
      .catch((error) => console.error('Failed to fetch reports', error))
      .finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
  }, [])

  const showToast = (title: string, type: 'success' | 'info' | 'error' = 'info', desc?: string) => {
    setToastMessage({ title, type, desc })
    setTimeout(() => setToastMessage(null), 3500)
  }

  return (
    <div className="flex-1 p-8 overflow-auto bg-slate-50 min-h-screen relative">

      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className={`fixed bottom-6 right-6 ${toastMessage.type === 'success' ? 'bg-emerald-600' : toastMessage.type === 'error' ? 'bg-rose-600' : 'bg-[#0b1320]'} text-white px-6 py-4 rounded-xl shadow-2xl flex items-start gap-4 z-[100] max-w-sm`}
          >
            {toastMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5 text-emerald-100" /> :
             toastMessage.type === 'error' ? <X className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-100" /> :
             <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse mt-2 flex-shrink-0" />}
            <div>
              <h4 className="text-sm font-bold">{toastMessage.title}</h4>
              {toastMessage.desc && <p className="text-[13px] text-white/80 mt-1">{toastMessage.desc}</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={`transition-all duration-300 ${isModalOpen ? 'blur-sm pointer-events-none select-none opacity-50' : ''}`}>
        <div className="flex flex-wrap items-center justify-between mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Student Reports & Analytics</h1>
            <p className="text-[13px] text-slate-500 mt-1">Search student analytics and manage class grade reports</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-slate-100 p-1.5 rounded-2xl flex gap-1 border border-slate-200">
              <button
                onClick={() => setMainTab('hub')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  mainTab === 'hub'
                    ? 'bg-slate-900 text-white shadow-md'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                Student Reports Hub (5-in-1)
              </button>
              <button
                onClick={() => setMainTab('uploaded')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  mainTab === 'uploaded'
                    ? 'bg-slate-900 text-white shadow-md'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                Uploaded Reports Overview
              </button>
            </div>
            {mainTab === 'uploaded' && (
              <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 px-5 py-2.5 bg-[#0b1320] hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm">
                <Plus className="w-4 h-4" /> Upload Report
              </button>
            )}
          </div>
        </div>

        {mainTab === 'hub' ? (
          <StudentFullReportsView />
        ) : (
          <>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-8 min-h-[400px] flex flex-col">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Recent Reports</h2>
            <div className="flex items-center gap-3">
              <div className="relative w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" placeholder="Search reports..." className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none" />
              </div>
              <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors">
                <Filter className="w-4 h-4" /> Filter
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-12">
              <Loader2 className="w-8 h-8 animate-spin mb-4" />
              <p className="text-sm font-medium">Loading reports...</p>
            </div>
          ) : reports.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-12">
              <FileText className="w-12 h-12 mb-4 text-slate-300" />
              <p className="text-base font-bold text-slate-600 mb-1">No Reports Found</p>
              <p className="text-sm font-medium">Upload a grading sheet to get started.</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/50">
                  {['Class', 'Subject', 'Term', 'Students', 'Avg Score', ''].map(h => (
                    <th key={h} className={`px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest ${h === 'Students' || h === 'Avg Score' ? 'text-center' : h === '' ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reports.map((rep) => (
                  <tr key={rep._id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-[13px] font-bold text-slate-900">{rep.class}</td>
                    <td className="px-6 py-4 text-[13px] text-slate-600">{rep.sub}</td>
                    <td className="px-6 py-4 text-[13px] text-slate-600">{rep.term}</td>
                    <td className="px-6 py-4 text-center text-[13px] font-semibold text-slate-700">{rep.students}</td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-[13px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md">{rep.avg}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => setSelectedReportId(rep._id)} className="text-[12px] font-semibold text-indigo-600 hover:underline">View Details</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        </>
        )}
      </div>

      {isModalOpen && (
        <StudentReportImportModal
          onClose={() => setIsModalOpen(false)}
          onImported={(result) => {
            setIsModalOpen(false)
            showToast('Report imported!', 'success', result.message)
            fetchReports()
          }}
        />
      )}

      {selectedReportId && (
        <ReportDetailModal reportId={selectedReportId} onClose={() => setSelectedReportId(null)} />
      )}

    </div>
  )
}
