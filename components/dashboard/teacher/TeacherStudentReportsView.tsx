'use client'
import { useState } from 'react'
import { Plus, X, UploadCloud, FileDown, Search, Filter } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

// --- Mock Data ---
const RECENT_REPORTS = [
  { class: 'Grade 11-A', sub: 'Physics', term: 'Mid-Term 2024', students: 42, avg: '78%', date: 'Oct 15, 2024' },
  { class: 'Grade 10-C', sub: 'Physics', term: 'Mid-Term 2024', students: 38, avg: '82%', date: 'Oct 14, 2024' },
  { class: 'Grade 12-B', sub: 'Physics', term: 'Quarter 1', students: 35, avg: '85%', date: 'Sep 30, 2024' },
  { class: 'Grade 9-A', sub: 'Science', term: 'Quarter 1', students: 40, avg: '72%', date: 'Sep 28, 2024' },
]

export default function TeacherStudentReportsView() {
  const [isModalOpen, setIsModalOpen] = useState(true) // Open by default to match mockup

  return (
    <div className="flex-1 p-8 overflow-auto bg-slate-50 min-h-screen relative">
      
      {/* Background Page Content */}
      <div className={`transition-all duration-300 ${isModalOpen ? 'blur-sm pointer-events-none select-none opacity-50' : ''}`}>
        
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Student Reports</h1>
            <p className="text-[13px] text-slate-500 mt-1">
              Upload and manage grade reports for your classes
            </p>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#0b1320] hover:bg-slate-800 text-white rounded-lg text-sm font-semibold transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" /> Upload Report
          </button>
        </div>

        {/* Recent Reports Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-8">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Recent Reports</h2>
            <div className="flex items-center gap-3">
              <div className="relative w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" placeholder="Search reports..." className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none" />
              </div>
              <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold">
                <Filter className="w-4 h-4" /> Filter
              </button>
            </div>
          </div>
          
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Class</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Subject</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Term</th>
                <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">Students</th>
                <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">Avg Score</th>
                <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {RECENT_REPORTS.map((rep, idx) => (
                <tr key={idx}>
                  <td className="px-6 py-4 text-[13px] font-bold text-slate-900">{rep.class}</td>
                  <td className="px-6 py-4 text-[13px] text-slate-600">{rep.sub}</td>
                  <td className="px-6 py-4 text-[13px] text-slate-600">{rep.term}</td>
                  <td className="px-6 py-4 text-center text-[13px] font-semibold text-slate-700">{rep.students}</td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-[13px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md">{rep.avg}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-[12px] font-semibold text-indigo-600 hover:underline">View Details</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>

      {/* Upload Modal Overlay */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-[2px]">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100"
            >
              
              {/* Modal Header */}
              <div className="flex items-center justify-between p-5 border-b border-slate-100">
                <h2 className="text-base font-bold text-slate-900">Upload New Report</h2>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-6">
                
                {/* Selectors */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[12px] font-bold text-slate-700 mb-2">Class</label>
                    <select className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none">
                      <option>Select Class</option>
                      <option>Grade 11-A</option>
                      <option>Grade 10-C</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[12px] font-bold text-slate-700 mb-2">Subject</label>
                    <select className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none">
                      <option>Select Subject</option>
                      <option>Physics</option>
                      <option>Science</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[12px] font-bold text-slate-700 mb-2">Term</label>
                  <select className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none">
                    <option>Select Term</option>
                    <option>Mid-Term 2024</option>
                    <option>Quarter 1</option>
                  </select>
                </div>

                {/* Drag and Drop Area */}
                <div>
                  <label className="block text-[12px] font-bold text-slate-700 mb-2">Report File</label>
                  <div className="border-2 border-dashed border-indigo-200 bg-indigo-50/30 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:bg-indigo-50/50 transition-colors cursor-pointer group">
                    <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <UploadCloud className="w-6 h-6 text-indigo-600" />
                    </div>
                    <p className="text-[13px] font-bold text-slate-900 mb-1">
                      Drag and drop Excel/CSV here or click to browse
                    </p>
                    <p className="text-[11px] text-slate-500 mb-4">
                      Max file size 10MB. Formats: .xlsx, .csv
                    </p>
                    <button className="flex items-center gap-1.5 text-[12px] font-semibold text-indigo-600 hover:text-indigo-700">
                      Download sample format (.csv)
                    </button>
                  </div>
                </div>

              </div>

              {/* Modal Footer */}
              <div className="p-5 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50">
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button className="flex items-center gap-2 px-6 py-2.5 bg-[#0b1320] text-white text-sm font-bold rounded-lg hover:bg-slate-800 transition-colors shadow-sm">
                  <UploadCloud className="w-4 h-4" /> Upload
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  )
}
