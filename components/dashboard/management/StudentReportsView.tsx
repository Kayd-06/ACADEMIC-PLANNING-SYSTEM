'use client'
import { useState, useEffect } from 'react'
import { ChevronDown, Download, Search, AlertTriangle, ChevronRight, Award, CheckCircle, Loader2 } from 'lucide-react'

// --- Interfaces ---
interface PerformanceTrend {
  _id: string
  label: string
  math: number
  science: number
}

interface UploadedReport {
  _id: string
  initials: string
  name: string
  className: string
  subject: string
  term: string
  date: string
  students: number
  theme: string
}

interface TopPerformer {
  _id: string
  rank: number
  name: string
  className?: string
  score: string
  initials: string
  bg?: string
}

interface AttentionSubject {
  _id: string
  subject: string
  avg: string
  target: string
  theme: string
}

export default function StudentReportsView() {
  const [performanceData, setPerformanceData] = useState<PerformanceTrend[]>([])
  const [uploadedReports, setUploadedReports] = useState<UploadedReport[]>([])
  const [topPerformers, setTopPerformers] = useState<TopPerformer[]>([])
  const [attentionSubjects, setAttentionSubjects] = useState<AttentionSubject[]>([])
  const [loading, setLoading] = useState(true)

  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [toast, setToast] = useState<string | null>(null)

  // Filter dropdown states
  const [selectedClass, setSelectedClass] = useState('Class 10')
  const [selectedSection, setSelectedSection] = useState('Section A')
  const [selectedTerm, setSelectedTerm] = useState('Mid-Term 2024')
  const [selectedSubject, setSelectedSubject] = useState('All Subjects')

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    fetch('/api/student-reports/dashboard')
      .then(res => res.json())
      .then(data => {
        if (!data.error) {
          setPerformanceData(data.performanceTrends || [])
          setUploadedReports(data.uploadedReports || [])
          setTopPerformers(data.topPerformers || [])
          setAttentionSubjects(data.attentionSubjects || [])
        }
        setLoading(false)
      })
      .catch(err => {
        console.error('Failed to fetch dashboard data', err)
        setLoading(false)
      })
  }, [])

  // Filtered reports
  const filteredReports = uploadedReports.filter(rep => {
    if (!searchQuery) return true
    const lowerQuery = searchQuery.toLowerCase()
    return rep.name.toLowerCase().includes(lowerQuery) || rep.subject.toLowerCase().includes(lowerQuery) || rep.className.toLowerCase().includes(lowerQuery)
  })

  // Pagination
  const itemsPerPage = 3
  const totalPages = Math.max(1, Math.ceil(filteredReports.length / itemsPerPage))
  const paginatedReports = filteredReports.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const handleExport = () => {
    showToast('Exporting reports as CSV...')
  }

  if (loading) {
    return (
      <div className="flex-1 p-8 flex items-center justify-center bg-slate-50 min-h-screen">
        <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex-1 p-8 overflow-auto bg-slate-50 min-h-screen relative">
      
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-8 right-8 bg-slate-900 text-white px-6 py-3 rounded-xl shadow-2xl z-50 flex items-center gap-3 font-medium animate-in slide-in-from-bottom-5">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Student Reports & Analytics</h1>
        <p className="text-[13px] text-slate-500 mt-1">
          Review uploaded grade reports and performance trends across classes
        </p>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center justify-between bg-white p-3 rounded-2xl border border-slate-200 shadow-sm mb-6 gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => { setSelectedClass('Class 10'); showToast('Filtered by Class 10'); }} className="flex items-center justify-between w-32 px-4 py-2 bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-100 transition-colors active:scale-95">
            {selectedClass} <ChevronDown className="w-4 h-4 text-slate-400" />
          </button>
          <button onClick={() => { setSelectedSection('Section A'); showToast('Filtered by Section A'); }} className="flex items-center justify-between w-32 px-4 py-2 bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-100 transition-colors active:scale-95">
            {selectedSection} <ChevronDown className="w-4 h-4 text-slate-400" />
          </button>
          <button onClick={() => { setSelectedTerm('Mid-Term 2024'); showToast('Filtered by Mid-Term 2024'); }} className="flex items-center justify-between w-40 px-4 py-2 bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-100 transition-colors active:scale-95">
            {selectedTerm} <ChevronDown className="w-4 h-4 text-slate-400" />
          </button>
          <button onClick={() => { setSelectedSubject('All Subjects'); showToast('Showing All Subjects'); }} className="flex items-center justify-between w-40 px-4 py-2 bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-100 transition-colors active:scale-95">
            {selectedSubject} <ChevronDown className="w-4 h-4 text-slate-400" />
          </button>
        </div>
        <button onClick={handleExport} className="flex items-center gap-2 px-5 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors shadow-sm active:scale-95">
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
              {performanceData.length === 0 ? (
                <div className="absolute inset-0 flex items-center justify-center text-sm font-medium text-slate-400">
                  No performance data available. Please upload reports.
                </div>
              ) : (
                <>
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
                    {performanceData.map((data, idx) => (
                      <div key={data._id || idx} className="flex flex-col items-center gap-2 group h-full justify-end cursor-pointer" onClick={() => showToast(`${data.label}: Math ${data.math}%, Science ${data.science}%`)}>
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
                </>
              )}
            </div>
          </div>

          {/* Uploaded Reports Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">Uploaded Reports</h2>
              <div className="relative w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Filter reports..." 
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1); // Reset page on search
                  }}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow" 
                />
              </div>
            </div>
            
            {paginatedReports.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                No reports found matching your criteria.
              </div>
            ) : (
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
                  {paginatedReports.map((rep, idx) => (
                    <tr key={rep._id || idx} className="hover:bg-slate-50/50 transition-colors cursor-pointer" onClick={() => showToast(`Viewing report from ${rep.name}`)}>
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
                        <p className="text-[13px] font-bold text-slate-900">{rep.className}</p>
                        <p className="text-[11px] text-slate-500">{rep.subject}</p>
                      </td>
                      <td className="px-6 py-4 text-[13px] text-slate-700">{rep.term}</td>
                      <td className="px-6 py-4">
                        {/* Check if date contains a comma, robust splitting */}
                        <p className="text-[13px] text-slate-700">{rep.date.includes(',') ? rep.date.split(',')[0] : rep.date}</p>
                        {rep.date.includes(',') && <p className="text-[11px] text-slate-500">{rep.date.split(',')[1]}</p>}
                      </td>
                      <td className="px-6 py-4 text-center text-[13px] font-semibold text-slate-700">{rep.students}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            
            {/* Pagination */}
            <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
              <span className="text-[12px] text-slate-500">
                Showing {Math.min((currentPage - 1) * itemsPerPage + 1, filteredReports.length)} to {Math.min(currentPage * itemsPerPage, filteredReports.length)} of {filteredReports.length} entries
              </span>
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 border border-slate-200 bg-white text-slate-500 text-[12px] font-semibold rounded-md hover:bg-slate-50 disabled:opacity-50 transition-colors"
                >
                  Prev
                </button>
                
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button 
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-8 py-1.5 text-[12px] font-semibold rounded-md transition-colors ${
                      currentPage === page 
                        ? 'bg-indigo-600 text-white font-bold' 
                        : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                
                <button 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 border border-slate-200 bg-white text-slate-600 text-[12px] font-semibold rounded-md hover:bg-slate-50 disabled:opacity-50 transition-colors"
                >
                  Next
                </button>
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
              {topPerformers.length === 0 ? (
                <div className="p-6 text-center text-sm font-medium text-slate-400 border border-dashed border-slate-200 rounded-xl">
                  No top performer data available yet.
                </div>
              ) : (
                topPerformers.map((perf) => (
                  <div key={perf._id || perf.rank} onClick={() => showToast(`View details for ${perf.name}`)} className="flex items-center justify-between p-3 border border-slate-100 rounded-xl bg-slate-50/50 cursor-pointer hover:bg-slate-100/50 transition-colors">
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
                        {perf.className && <p className="text-[11px] text-slate-500">{perf.className}</p>}
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
                ))
              )}
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
              {attentionSubjects.length === 0 ? (
                <div className="p-6 text-center text-sm font-medium text-emerald-600 bg-emerald-50/50 border border-emerald-100 rounded-xl">
                  All subjects are currently performing well!
                </div>
              ) : (
                attentionSubjects.map((sub, idx) => (
                  <div key={sub._id || idx} onClick={() => showToast(`Viewing intervention plan for ${sub.subject}`)} className={`border p-4 rounded-xl flex items-center justify-between cursor-pointer transition-colors group ${
                    sub.theme === 'red' ? 'bg-red-50/50 border-red-200 hover:bg-red-50' : 'bg-amber-50/50 border-amber-200 hover:bg-amber-50'
                  }`}>
                    <div>
                      <h4 className={`text-[14px] font-bold mb-1 ${sub.theme === 'red' ? 'text-red-700' : 'text-amber-700'}`}>{sub.subject}</h4>
                      <p className={`text-[12px] font-semibold ${sub.theme === 'red' ? 'text-red-600/80' : 'text-amber-600/80'}`}>Avg: {sub.avg} (Target: {sub.target})</p>
                    </div>
                    <ChevronRight className={`w-4 h-4 transition-colors ${
                      sub.theme === 'red' ? 'text-red-400 group-hover:text-red-600' : 'text-amber-400 group-hover:text-amber-600'
                    }`} />
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  )
}
