'use client'
import { ChevronDown, Download, Search, AlertTriangle, ChevronRight, Award, Medal } from 'lucide-react'

// --- Mock Data ---
const PERFORMANCE_DATA = [
  { label: 'Q1', math: 60, science: 75 },
  { label: 'Q2', math: 68, science: 78 },
  { label: 'Mid', math: 65, science: 75 },
  { label: 'Q3', math: 80, science: 82 },
  { label: 'Final', math: 88, science: 86 },
]

const UPLOADED_REPORTS = [
  { initials: 'SJ', name: 'Sarah Jenkins', class: 'Class 10-A', sub: 'Mathematics', term: "Mid-Term '24", date: 'Oct 12, 2024', students: 32, theme: 'indigo' },
  { initials: 'MR', name: 'Michael Ross', class: 'Class 10-A', sub: 'Science', term: "Mid-Term '24", date: 'Oct 11, 2024', students: 32, theme: 'emerald' },
  { initials: 'ED', name: 'Emily Davis', class: 'Class 10-B', sub: 'English', term: "Mid-Term '24", date: 'Oct 10, 2024', students: 28, theme: 'blue' },
]

const TOP_PERFORMERS = [
  { rank: 1, name: 'Alex Johnson', class: 'Class 10-A', score: '98.5%', initials: 'AJ', bg: 'bg-[#0b1320]' },
  { rank: 2, name: 'Chloe Wu', class: 'Class 10-C', score: '96.2%', initials: 'CW', bg: 'bg-indigo-100 text-indigo-700' },
  { rank: 3, name: 'Daniel Patel', class: 'Class 10-A', score: '95.8%', initials: 'DP', bg: 'bg-purple-100 text-purple-700' },
  { rank: 4, name: 'Emma Stone', score: '94.1%', initials: '4' },
  { rank: 5, name: 'Liam Smith', score: '93.5%', initials: '5' },
]

export default function StudentReportsView() {
  return (
    <div className="flex-1 p-8 overflow-auto bg-slate-50 min-h-screen">
      
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Student Reports & Analytics</h1>
        <p className="text-[13px] text-slate-500 mt-1">
          Review uploaded grade reports and performance trends across classes
        </p>
      </div>

      {/* Filters Bar */}
      <div className="flex items-center justify-between bg-white p-3 rounded-2xl border border-slate-200 shadow-sm mb-6">
        <div className="flex items-center gap-3">
          <button className="flex items-center justify-between w-32 px-4 py-2 bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-100 transition-colors">
            Class 10 <ChevronDown className="w-4 h-4 text-slate-400" />
          </button>
          <button className="flex items-center justify-between w-32 px-4 py-2 bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-100 transition-colors">
            Section A <ChevronDown className="w-4 h-4 text-slate-400" />
          </button>
          <button className="flex items-center justify-between w-40 px-4 py-2 bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-100 transition-colors">
            Mid-Term 2024 <ChevronDown className="w-4 h-4 text-slate-400" />
          </button>
          <button className="flex items-center justify-between w-40 px-4 py-2 bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-100 transition-colors">
            All Subjects <ChevronDown className="w-4 h-4 text-slate-400" />
          </button>
        </div>
        <button className="flex items-center gap-2 px-5 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors shadow-sm">
          <Download className="w-4 h-4" /> Export
        </button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Chart Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-sm font-bold text-slate-900">Class Performance Trend</h2>
              <div className="flex items-center gap-4 text-xs font-semibold text-slate-600">
                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-indigo-600"/> Mathematics</div>
                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500"/> Science</div>
              </div>
            </div>

            {/* CSS Bar Chart */}
            <div className="relative h-64 flex items-end justify-between px-4 pb-8 pt-4">
              {/* Y-Axis lines */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-8">
                {[100, 75, 50, 25, 0].map(val => (
                  <div key={val} className="flex items-center w-full">
                    <span className="text-[10px] text-slate-400 w-6 mr-2 text-right font-medium">{val}</span>
                    <div className="flex-1 border-t border-dashed border-slate-100" />
                  </div>
                ))}
              </div>

              {/* Bars */}
              <div className="relative z-10 w-full flex justify-around items-end h-full ml-8">
                {PERFORMANCE_DATA.map((data, idx) => (
                  <div key={idx} className="flex flex-col items-center gap-2 group h-full justify-end">
                    <div className="flex items-end gap-1.5 h-full">
                      {/* Math Bar */}
                      <div className="w-4 bg-indigo-600 rounded-t-sm hover:opacity-80 transition-opacity relative group-hover:bg-indigo-500" style={{ height: `${data.math}%` }}></div>
                      {/* Science Bar */}
                      <div className="w-4 bg-emerald-500 rounded-t-sm hover:opacity-80 transition-opacity relative group-hover:bg-emerald-400" style={{ height: `${data.science}%` }}></div>
                    </div>
                    <span className="text-[11px] font-semibold text-slate-500 absolute -bottom-6">{data.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Uploaded Reports Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">Uploaded Reports</h2>
              <div className="relative w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" placeholder="Filter reports..." className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow" />
              </div>
            </div>
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Teacher</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Class / Subject</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Term</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Uploaded</th>
                  <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">Students</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {UPLOADED_REPORTS.map((rep, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                          rep.theme === 'indigo' ? 'bg-indigo-100 text-indigo-700' :
                          rep.theme === 'emerald' ? 'bg-emerald-100 text-emerald-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {rep.initials}
                        </div>
                        <span className="text-[13px] font-bold text-slate-900">{rep.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-[13px] font-bold text-slate-900">{rep.class}</p>
                      <p className="text-[11px] text-slate-500">{rep.sub}</p>
                    </td>
                    <td className="px-6 py-4 text-[13px] text-slate-700">{rep.term}</td>
                    <td className="px-6 py-4">
                      <p className="text-[13px] text-slate-700">{rep.date.split(',')[0]}</p>
                      <p className="text-[11px] text-slate-500">{rep.date.split(',')[1]}</p>
                    </td>
                    <td className="px-6 py-4 text-center text-[13px] font-semibold text-slate-700">{rep.students}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
              <span className="text-[12px] text-slate-500">Showing 1 to 3 of 12 entries</span>
              <div className="flex items-center gap-1">
                <button className="px-3 py-1.5 border border-slate-200 bg-white text-slate-500 text-[12px] font-semibold rounded-md hover:bg-slate-50">Prev</button>
                <button className="w-8 py-1.5 bg-indigo-600 text-white text-[12px] font-bold rounded-md">1</button>
                <button className="w-8 py-1.5 border border-slate-200 bg-white text-slate-600 text-[12px] font-semibold rounded-md hover:bg-slate-50">2</button>
                <button className="px-3 py-1.5 border border-slate-200 bg-white text-slate-600 text-[12px] font-semibold rounded-md hover:bg-slate-50">Next</button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (1/3) */}
        <div className="space-y-6">
          
          {/* Top Performers */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-sm font-bold text-slate-900 mb-6">Top Performers</h2>
            <div className="space-y-4">
              {TOP_PERFORMERS.map((perf) => (
                <div key={perf.rank} className="flex items-center justify-between p-3 border border-slate-100 rounded-xl bg-slate-50/50">
                  <div className="flex items-center gap-3 relative">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${perf.bg || 'bg-slate-200 text-slate-600'}`}>
                      {perf.bg ? perf.initials : perf.rank}
                    </div>
                    {perf.rank <= 3 && (
                      <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-black ${
                        perf.rank === 1 ? 'bg-amber-400 text-white' : 
                        perf.rank === 2 ? 'bg-slate-300 text-slate-700' : 
                        'bg-amber-700 text-white'
                      }`}>
                        {perf.rank}
                      </div>
                    )}
                    <div>
                      <h4 className="text-[13px] font-bold text-slate-900 leading-tight">{perf.name}</h4>
                      {perf.class && <p className="text-[11px] text-slate-500">{perf.class}</p>}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[15px] font-black text-slate-900">{perf.score}</span>
                    {perf.rank <= 3 && (
                      <Award className={`w-3.5 h-3.5 ml-auto mt-0.5 ${
                        perf.rank === 1 ? 'text-amber-400' : 
                        perf.rank === 2 ? 'text-slate-400' : 
                        'text-amber-700'
                      }`} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Needs Attention */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <h2 className="text-sm font-bold text-slate-900">Needs Attention</h2>
            </div>
            <p className="text-[13px] text-slate-600 mb-6 leading-relaxed">
              Subjects with average scores below the 65% threshold across Class 10.
            </p>

            <div className="space-y-3">
              <div className="bg-red-50/50 border border-red-200 p-4 rounded-xl flex items-center justify-between cursor-pointer hover:bg-red-50 transition-colors group">
                <div>
                  <h4 className="text-[14px] font-bold text-red-700 mb-1">Physics</h4>
                  <p className="text-[12px] font-semibold text-red-600/80">Avg: 58% (Target: 65%)</p>
                </div>
                <ChevronRight className="w-4 h-4 text-red-400 group-hover:text-red-600 transition-colors" />
              </div>
              <div className="bg-amber-50/50 border border-amber-200 p-4 rounded-xl flex items-center justify-between cursor-pointer hover:bg-amber-50 transition-colors group">
                <div>
                  <h4 className="text-[14px] font-bold text-amber-700 mb-1">History</h4>
                  <p className="text-[12px] font-semibold text-amber-600/80">Avg: 62% (Target: 65%)</p>
                </div>
                <ChevronRight className="w-4 h-4 text-amber-400 group-hover:text-amber-600 transition-colors" />
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  )
}
