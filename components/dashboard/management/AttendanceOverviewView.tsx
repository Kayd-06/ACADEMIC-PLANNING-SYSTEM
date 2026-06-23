'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Calendar as CalendarIcon, 
  BarChart2, 
  AlertTriangle, 
  Star, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  Filter,
  RefreshCw,
  TrendingUp,
  Info
} from 'lucide-react'

// Helper to format date into human readable form (e.g., Jun 18)
function formatShortDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Helper to get day name (Mon, Tue...)
function getDayName(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { weekday: 'short' })
}

export default function AttendanceOverviewView() {
  // Filter States
  const [range, setRange] = useState('30')
  const [program, setProgram] = useState('All')
  const [batch, setBatch] = useState('All')
  
  // Data States
  const [data, setData] = useState<any>({
    overallRate: 92.4,
    batchesBelow75: 3,
    perfectAttendanceCount: 142,
    heatmap: [],
    batchesAttention: [],
    studentTable: []
  })
  
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [tablePage, setTablePage] = useState(1)
  const itemsPerPage = 8

  async function fetchOverviewData() {
    setLoading(true)
    try {
      const url = `/api/attendance/overview?range=${range}&program=${encodeURIComponent(program)}&batch=${encodeURIComponent(batch)}`
      const res = await fetch(url)
      const resData = await res.json()
      if (!resData.error) {
        setData(resData)
      }
    } catch (err) {
      console.error('Error fetching overview:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOverviewData()
    setTablePage(1) // reset page on filter changes
  }, [range, program, batch])

  // Filter students based on search query
  const filteredStudents = data.studentTable.filter((st: any) => 
    st.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    st.batch.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Pagination calculations
  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage) || 1
  const paginatedStudents = filteredStudents.slice(
    (tablePage - 1) * itemsPerPage,
    tablePage * itemsPerPage
  )

  // Color mapping helper for the heatmap blocks
  function getHeatmapColor(rate: number | null) {
    if (rate === null) return 'bg-slate-100 text-slate-300' // Sunday / No data
    if (rate >= 95) return 'bg-emerald-600 hover:bg-emerald-700 text-white'
    if (rate >= 90) return 'bg-emerald-400 hover:bg-emerald-500 text-slate-900'
    if (rate >= 80) return 'bg-amber-300 hover:bg-amber-400 text-slate-900'
    if (rate >= 70) return 'bg-orange-400 hover:bg-orange-500 text-white'
    return 'bg-rose-500 hover:bg-rose-600 text-white'
  }

  return (
    <div className="flex-1 p-8 overflow-y-auto bg-slate-50 flex flex-col justify-between h-full">
      <div>
        
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Attendance Overview</h1>
            <p className="text-[13px] text-slate-500 mt-1">
              Track daily attendance trends across batches and subjects
            </p>
          </div>
          <button 
            onClick={fetchOverviewData}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-semibold shadow-sm transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Filter Row */}
        <div className="flex flex-wrap items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm mb-8">
          
          {/* Time range dropdown */}
          <div className="flex-1 min-w-[140px]">
            <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5 pl-0.5">Date Range</label>
            <div className="relative">
              <select
                value={range}
                onChange={(e) => setRange(e.target.value)}
                className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-xs font-bold outline-none focus:border-slate-400 cursor-pointer appearance-none"
              >
                <option value="7">Last 7 Days</option>
                <option value="30">Last 30 Days</option>
                <option value="90">Last 90 Days</option>
              </select>
              <CalendarIcon className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Program filter */}
          <div className="flex-1 min-w-[150px]">
            <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5 pl-0.5">Program</label>
            <div className="relative">
              <select
                value={program}
                onChange={(e) => {
                  setProgram(e.target.value)
                  setBatch('All') // reset batch when changing program
                }}
                className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-xs font-bold outline-none focus:border-slate-400 cursor-pointer appearance-none"
              >
                <option value="All">All Programs</option>
                <option value="JEE Integrated">JEE Integrated</option>
                <option value="NEET Crash">NEET Crash</option>
                <option value="Foundational">Foundational</option>
              </select>
              <Filter className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Batch filter */}
          <div className="flex-1 min-w-[150px]">
            <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5 pl-0.5">Batch</label>
            <div className="relative">
              <select
                value={batch}
                onChange={(e) => setBatch(e.target.value)}
                disabled={program !== 'All' && program !== 'JEE Integrated' && program !== 'Foundational'}
                className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-xs font-bold outline-none focus:border-slate-400 cursor-pointer appearance-none disabled:opacity-50"
              >
                <option value="All">All Batches</option>
                {program === 'All' || program === 'JEE Integrated' ? (
                  <>
                    <option value="Grade 11-A">Grade 11-A</option>
                    <option value="Grade 11-B">Grade 11-B</option>
                  </>
                ) : null}
                {program === 'All' || program === 'Foundational' ? (
                  <>
                    <option value="Grade 10-A">Grade 10-A</option>
                    <option value="Grade 10-B">Grade 10-B</option>
                  </>
                ) : null}
              </select>
              <Filter className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

        </div>

        {/* KPI Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          
          {/* Card 1: Overall Attendance */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between hover:shadow-md transition-all">
            <div className="space-y-1">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Overall Attendance Rate</span>
              <div className="flex items-baseline gap-2.5">
                <span className="text-3xl font-extrabold text-slate-900">{data.overallRate}%</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5 border ${
                  !data.trend || data.trend.startsWith('-')
                    ? 'text-rose-600 bg-rose-50 border-rose-100'
                    : 'text-green-600 bg-green-50 border-green-100'
                }`}>
                  {(!data.trend || !data.trend.startsWith('-')) && <TrendingUp className="w-2.5 h-2.5" />}
                  {data.trend || '+2.1%'}
                </span>
              </div>
            </div>
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
              <BarChart2 className="w-6 h-6" />
            </div>
          </div>

          {/* Card 2: Batches Below 75% */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between hover:shadow-md transition-all">
            <div className="space-y-1">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Batches Below 75%</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-red-600">{data.batchesBelow75}</span>
                <span className="text-[12px] font-bold text-slate-500">Needs attention</span>
              </div>
            </div>
            <div className="p-3 bg-red-50 text-red-500 rounded-2xl">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </div>

          {/* Card 3: Perfect Attendance */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between hover:shadow-md transition-all">
            <div className="space-y-1">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Perfect Attendance</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-green-600">{data.perfectAttendanceCount}</span>
                <span className="text-[12px] font-bold text-slate-500">Students</span>
              </div>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-500 rounded-2xl">
              <Star className="w-6 h-6" />
            </div>
          </div>

        </div>

        {/* Main Section: Heatmap (Left 8) + Attention Batches (Right 4) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
          
          {/* Heatmap Grid (8 cols) */}
          <div className="lg:col-span-8 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-900">Daily Attendance Heatmap</h3>
                <div className="flex items-center gap-4 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-rose-500" /> &lt;70%</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-orange-400" /> 70-80%</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-amber-300" /> 80-90%</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-400" /> 90-95%</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-600" /> &gt;=95%</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 mb-6">
                Hover over blocks to see exact attendance rate. Grey blocks indicate Sundays or days with no records marked.
              </p>
            </div>

            {loading ? (
              <div className="py-12 text-center text-xs font-bold text-slate-400">Loading Heatmap...</div>
            ) : (
              <div className="grid grid-cols-6 sm:grid-cols-10 gap-3">
                {data.heatmap.map((day: any, i: number) => {
                  const dayName = getDayName(day.date)
                  const isSunday = dayName === 'Sun'
                  const colorClass = getHeatmapColor(isSunday ? null : day.rate)

                  return (
                    <div 
                      key={day.date}
                      className={`p-3 rounded-xl flex flex-col items-center justify-between border border-slate-200/40 relative group cursor-pointer shadow-sm transition-all hover:scale-105 ${colorClass}`}
                      style={{ minHeight: '68px' }}
                    >
                      <span className="text-[9px] uppercase tracking-wider font-extrabold opacity-75">{dayName}</span>
                      <span className="text-sm font-extrabold mt-1">{day.date.split('-')[2]}</span>
                      
                      {/* Tooltip on Hover */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 bg-slate-900 text-white rounded text-[10px] font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-md">
                        {formatShortDate(day.date)}: {day.rate !== null ? `${day.rate}%` : 'No Data'}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Batches Needing Attention (4 cols) */}
          <div className="lg:col-span-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 mb-2">Batches Needing Attention</h3>
              <p className="text-[11px] text-slate-500 mb-6">Batches with low or declining attendance</p>
            </div>

            {loading ? (
              <div className="py-12 text-center text-xs font-bold text-slate-400">Loading Batches...</div>
            ) : (
              <div className="space-y-4">
                {data.batchesAttention.map((ba: any, i: number) => (
                  <div 
                    key={i}
                    className={`p-4 rounded-xl border flex items-center justify-between shadow-sm transition-all hover:shadow-md ${
                      ba.needsAttention 
                        ? 'bg-rose-50/50 border-rose-100 hover:bg-rose-50' 
                        : 'bg-slate-50/70 border-slate-100 hover:bg-slate-50'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <h4 className="text-xs font-extrabold text-slate-800">{ba.name}</h4>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{ba.subject}</p>
                    </div>

                    <div className="text-right flex items-center gap-3">
                      {/* Small visual indicator */}
                      <span className={`text-[12px] font-extrabold ${
                        ba.rate < 75 ? 'text-red-600' : 'text-slate-700'
                      }`}>
                        {ba.rate}%
                      </span>
                      {ba.rate < 75 && (
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Detailed Table Section */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <h3 className="text-sm font-bold text-slate-900">Student Attendance Detail</h3>
            
            {/* Search Input */}
            <div className="relative w-full sm:max-w-xs">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setTablePage(1); }}
                placeholder="Search student or batch..."
                className="w-full pl-9 pr-4 py-2 border border-slate-200 bg-slate-50 rounded-lg text-xs outline-none focus:border-slate-400 transition-colors shadow-sm"
              />
            </div>
          </div>

          <div className="border border-slate-100 rounded-xl overflow-hidden mb-6">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Student</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Batch</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Present Days</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Absent Days</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Attendance %</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">Last Absent Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-xs font-bold text-slate-400">Loading Student Details...</td>
                  </tr>
                ) : paginatedStudents.length > 0 ? (
                  paginatedStudents.map((st: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-50/30 transition-colors">
                      <td className="px-6 py-4 text-xs font-bold text-slate-800">{st.name}</td>
                      <td className="px-6 py-4 text-xs font-semibold text-slate-500">{st.batch}</td>
                      <td className="px-6 py-4 text-center text-xs font-semibold text-slate-600">{st.present}</td>
                      <td className="px-6 py-4 text-center text-xs font-semibold text-slate-600">{st.absent}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          st.rate >= 90 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                          st.rate >= 75 ? 'bg-amber-50 text-amber-700 border-amber-100' :
                          'bg-red-50 text-red-700 border-red-100'
                        }`}>
                          {st.rate}%
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-xs font-semibold text-slate-500">{st.lastAbsent}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-xs font-bold text-slate-400">No student records match search criteria.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="p-4 border border-slate-100 bg-slate-50/50 rounded-xl flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Showing {filteredStudents.length > 0 ? (tablePage - 1) * itemsPerPage + 1 : 0}-
              {Math.min(tablePage * itemsPerPage, filteredStudents.length)} of {filteredStudents.length} entries
            </span>
            <div className="flex items-center gap-1.5">
              <button 
                onClick={() => setTablePage(prev => Math.max(prev - 1, 1))}
                disabled={tablePage === 1}
                className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 bg-white hover:bg-slate-50 transition-colors disabled:opacity-50 flex items-center gap-1 shadow-sm"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Previous
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
                <button
                  key={pageNum}
                  onClick={() => setTablePage(pageNum)}
                  className={`w-7 h-7 rounded-lg text-[10px] font-bold transition-all border ${
                    tablePage === pageNum 
                      ? 'bg-[#0b1320] border-[#0b1320] text-white' 
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {pageNum}
                </button>
              ))}
              <button 
                onClick={() => setTablePage(prev => Math.min(prev + 1, totalPages))}
                disabled={tablePage === totalPages}
                className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 bg-white hover:bg-slate-50 transition-colors disabled:opacity-50 flex items-center gap-1 shadow-sm"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

        </div>

      </div>

      {/* Footer copyright */}
      <div className="mt-8 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
        © 2026 EduAdmin Pro Suite • Secure Attendance Tracking
      </div>

    </div>
  )
}
