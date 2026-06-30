'use client'
import { useState, useEffect, useRef } from 'react'
import { Plus, X, UploadCloud, Search, Filter, FileText, Loader2, CheckCircle2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import * as XLSX from 'xlsx'
import ReportDetailModal from '@/components/dashboard/ReportDetailModal'

function downloadSampleFormat() {
  const headers = ['Name', 'RollNo', 'Marks', 'MaxMarks', 'Attendance', 'Remarks']
  const data = [
    headers,
    ['Rahul Sharma', '101', '75', '100', '95', 'Good grasp of basics.'],
    ['Priya Patel', '102', '90', '100', '98', 'Excellent performance.'],
    ['Amit Verma', '103', '', '', '', ''],
  ]
  const ws = XLSX.utils.aoa_to_sheet(data)
  ws['!cols'] = [{ wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 30 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Report Template')
  XLSX.writeFile(wb, 'student_report_template.xlsx')
}

export default function TeacherStudentReportsView() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [reports, setReports] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [toastMessage, setToastMessage] = useState<{ title: string; desc?: string; type: 'success' | 'info' | 'error' } | null>(null)
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null)

  const [uploadClass, setUploadClass] = useState('')
  const [uploadSubject, setUploadSubject] = useState('')
  const [uploadTerm, setUploadTerm] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { fetchReports() }, [])

  const fetchReports = async () => {
    try {
      const res = await fetch('/api/teacher-portal/reports')
      if (res.ok) setReports(await res.json())
    } catch (error) {
      console.error('Failed to fetch reports', error)
    } finally {
      setIsLoading(false)
    }
  }

  const showToast = (title: string, type: 'success' | 'info' | 'error' = 'info', desc?: string) => {
    setToastMessage({ title, type, desc })
    setTimeout(() => setToastMessage(null), 3500)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) setFile(e.target.files[0])
  }

  const handleUploadSubmit = async () => {
    if (!uploadClass || !uploadSubject || !uploadTerm || !file) {
      showToast('Missing Fields', 'error', 'Please fill all fields and select a file.')
      return
    }
    setIsUploading(true)
    try {
      const reader = new FileReader()
      reader.onload = async (e) => {
        try {
          const workbook = XLSX.read(e.target?.result, { type: 'binary' })
          const worksheet = workbook.Sheets[workbook.SheetNames[0]]
          const jsonData = XLSX.utils.sheet_to_json(worksheet)

          const studentsData = jsonData.map((row: any) => {
            const marks = Number(row['Marks'] || row['Score'] || 0)
            const maxMarks = Number(row['MaxMarks'] || row['Total'] || 100)
            const p = (marks / maxMarks) * 100
            let grade = 'C'
            if (p >= 90) grade = 'A+'
            else if (p >= 80) grade = 'A'
            else if (p >= 70) grade = 'B'

            const rawAttendance = row['Attendance']
            const attendance = rawAttendance !== undefined && rawAttendance !== '' ? Number(rawAttendance) : null
            const rawRemarks = row['Remarks']
            const remarks = rawRemarks !== undefined && rawRemarks !== '' ? String(rawRemarks) : null

            return {
              name: row['Name'] || row['Student Name'] || 'Unknown',
              rollNo: row['RollNo'] || row['Roll Number'] || 'N/A',
              marks,
              maxMarks,
              grade,
              attendance,
              remarks,
            }
          })

          const res = await fetch('/api/teacher-portal/reports', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ className: uploadClass, subject: uploadSubject, term: uploadTerm, students: studentsData }),
          })

          if (res.ok) {
            showToast('Report Uploaded!', 'success', 'Grades have been successfully saved.')
            setIsModalOpen(false)
            setFile(null)
            setUploadClass('')
            setUploadSubject('')
            setUploadTerm('')
            fetchReports()
          } else {
            const data = await res.json().catch(() => ({}))
            showToast('Upload Failed', 'error', data.error || 'Server rejected the report data.')
          }
        } catch (err) {
          console.error(err)
          showToast('Parsing Error', 'error', 'Failed to read the Excel/CSV file.')
        } finally {
          setIsUploading(false)
        }
      }
      reader.readAsBinaryString(file)
    } catch (error) {
      console.error(error)
      showToast('Error', 'error', 'An unexpected error occurred.')
      setIsUploading(false)
    }
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
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Student Reports</h1>
            <p className="text-[13px] text-slate-500 mt-1">Upload and manage grade reports for your classes</p>
          </div>
          <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 px-5 py-2.5 bg-[#0b1320] hover:bg-slate-800 text-white rounded-lg text-sm font-semibold transition-all shadow-sm">
            <Plus className="w-4 h-4" /> Upload Report
          </button>
        </div>

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
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-[2px]">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]"
            >
              <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-white z-10 shrink-0">
                <h2 className="text-base font-bold text-slate-900">Upload New Report</h2>
                <button onClick={() => setIsModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors" disabled={isUploading}>
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6 overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[12px] font-bold text-slate-700 mb-2">Class</label>
                    <input type="text" placeholder="e.g. Grade 11-A" value={uploadClass} onChange={e => setUploadClass(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-[12px] font-bold text-slate-700 mb-2">Subject</label>
                    <input type="text" placeholder="e.g. Physics" value={uploadSubject} onChange={e => setUploadSubject(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-[12px] font-bold text-slate-700 mb-2">Term</label>
                  <input type="text" placeholder="e.g. Mid-Term 2024" value={uploadTerm} onChange={e => setUploadTerm(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-[12px] font-bold text-slate-700 mb-2">Report File</label>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed ${file ? 'border-emerald-400 bg-emerald-50/30 hover:bg-emerald-50' : 'border-indigo-200 bg-indigo-50/30 hover:bg-indigo-50/50'} rounded-xl p-8 flex flex-col items-center justify-center text-center transition-colors cursor-pointer group`}
                  >
                    <input type="file" accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
                    {file ? (
                      <>
                        <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mb-4"><CheckCircle2 className="w-6 h-6 text-emerald-600" /></div>
                        <p className="text-[13px] font-bold text-emerald-800 mb-1">{file.name} selected</p>
                        <p className="text-[11px] text-emerald-600/80 mb-4">Ready to upload and process</p>
                      </>
                    ) : (
                      <>
                        <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><UploadCloud className="w-6 h-6 text-indigo-600" /></div>
                        <p className="text-[13px] font-bold text-slate-900 mb-1">Click to browse for Excel/CSV file</p>
                        <p className="text-[11px] text-slate-500 mb-4">Columns: Name, RollNo, Marks, MaxMarks (Attendance, Remarks optional)</p>
                      </>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); downloadSampleFormat() }} className="flex items-center gap-1.5 text-[12px] font-semibold text-indigo-600 hover:text-indigo-700 z-10 relative">
                      Download sample format (.xlsx)
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-5 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50 shrink-0">
                <button onClick={() => setIsModalOpen(false)} disabled={isUploading} className="px-5 py-2.5 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50">Cancel</button>
                <button onClick={handleUploadSubmit} disabled={isUploading || !file || !uploadClass || !uploadSubject || !uploadTerm} className="flex items-center gap-2 px-6 py-2.5 bg-[#0b1320] text-white text-sm font-bold rounded-lg hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
                  {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                  {isUploading ? 'Processing...' : 'Upload Data Sheet'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {selectedReportId && (
        <ReportDetailModal reportId={selectedReportId} onClose={() => setSelectedReportId(null)} />
      )}

    </div>
  )
}
