'use client'
import { Calendar, ChevronDown, Download, AlertTriangle, Bell } from 'lucide-react'

// --- Mock Data ---
const REPORTS = [
  {
    id: 1,
    type: 'submitted',
    author: 'Dr. Rajesh Kumar',
    avatar: 'RK',
    color: 'bg-indigo-600 text-white',
    batches: ['JEE 2026-A', 'Physics'],
    status: 'Submitted',
    time: '14:30 PM',
    topics: 'Laws of Thermodynamics, specifically focused on the Second Law and entropy changes in reversible processes. Completed numerical examples from HC Verma Chapter 24.',
    present: 42,
    absent: 3
  },
  {
    id: 2,
    type: 'missing',
    expectedTime: '15:00 PM',
    batch: 'NEET 2025-B'
  },
  {
    id: 3,
    type: 'submitted',
    author: 'Sarah Mitchell',
    avatar: 'SM',
    color: 'bg-blue-200 text-blue-700',
    batches: ['Foundation 10', 'Mathematics'],
    status: 'Submitted',
    time: '15:10 PM',
    topics: 'Quadratic Equations. Covered factorization method and introduction to the quadratic formula. Solved standard form problems.',
    present: 38,
    absent: 0
  }
]

export default function DailyReportsTrackingView() {
  return (
    <div className="flex-1 p-8 overflow-auto bg-slate-50 min-h-screen">
      
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Daily Reports</h1>
          <p className="text-[13px] text-slate-500 mt-1">
            Review what was taught across all batches today.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <button className="flex items-center justify-between w-40 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors shadow-sm">
              10/27/2023 <Calendar className="w-4 h-4 text-slate-400" />
            </button>
          </div>
          <button className="flex items-center justify-between w-36 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors shadow-sm">
            All Batches <ChevronDown className="w-4 h-4 text-slate-400" />
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors shadow-sm">
            <Download className="w-4 h-4" /> Export All
          </button>
        </div>
      </div>

      {/* Timeline Layout */}
      <div className="max-w-4xl mx-auto">
        <div className="relative border-l-2 border-slate-200 space-y-8 pb-12 ml-4">
          
          {REPORTS.map((report) => (
            <div key={report.id} className="relative pl-8">
              
              {/* Timeline Dot */}
              <div className={`absolute -left-[9px] top-6 w-4 h-4 rounded-full border-4 border-slate-50 flex items-center justify-center ${
                report.type === 'missing' ? 'bg-red-500 ring-4 ring-red-50' : 'bg-[#0b1320] ring-4 ring-slate-100'
              }`} />

              {/* Submitted Card */}
              {report.type === 'submitted' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:border-slate-300 transition-colors">
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-sm ${report.color}`}>
                          {report.avatar}
                        </div>
                        <div>
                          <h3 className="text-[15px] font-bold text-slate-900 mb-1">{report.author}</h3>
                          <div className="flex gap-2">
                            {report.batches?.map(b => (
                              <span key={b} className="px-2 py-0.5 text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 rounded">
                                {b}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{report.status}</p>
                        <p className="text-[14px] font-bold text-slate-900">{report.time}</p>
                      </div>
                    </div>

                    <div className="mb-6">
                      <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Topics Covered</h4>
                      <p className="text-[13px] text-slate-700 leading-relaxed">{report.topics}</p>
                    </div>

                    <div className="flex gap-4">
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-100">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="text-[12px] font-bold text-slate-700">Present: {report.present}</span>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-100">
                        <div className="w-2 h-2 rounded-full bg-red-500" />
                        <span className="text-[12px] font-bold text-slate-700">Absent: {report.absent}</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Accordion Footer */}
                  <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors">
                    <span className="text-[12px] font-bold text-slate-700">View Homework & Observations</span>
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  </div>
                </div>
              )}

              {/* Missing Card */}
              {report.type === 'missing' && (
                <div className="bg-red-50 border border-red-200 border-l-4 border-l-red-500 rounded-r-2xl rounded-l-md shadow-sm p-5 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-500">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-[14px] font-bold text-red-600 mb-0.5">No report submitted</h3>
                      <p className="text-[12px] text-red-500/80 font-medium">Expected by {report.expectedTime}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-1 text-[11px] font-bold bg-white text-slate-700 border border-red-100 rounded-md shadow-sm">
                      {report.batch}
                    </span>
                    <button className="w-8 h-8 flex items-center justify-center bg-white border border-red-200 rounded-md text-red-500 hover:bg-red-100 transition-colors shadow-sm">
                      <Bell className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

            </div>
          ))}

        </div>

        <p className="text-center text-[12px] text-slate-400 font-medium mt-8">
          Showing all records for selected date.
        </p>
      </div>

    </div>
  )
}
