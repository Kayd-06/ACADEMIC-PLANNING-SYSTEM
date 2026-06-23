'use client'
import { Calendar, ChevronDown, CheckCircle2, Flag, Send, UserCheck, UserX } from 'lucide-react'

// --- Mock Data ---
const SUBMISSIONS = [
  { date: 'Oct 23, 2023', batch: 'Grade 11-A', sub: 'Physics', status: 'On Time', isLate: false },
  { date: 'Oct 23, 2023', batch: 'Grade 12-B', sub: 'Physics', status: 'On Time', isLate: false },
  { date: 'Oct 22, 2023', batch: 'Grade 11-A', sub: 'Physics', status: 'Late', isLate: true },
  { date: 'Oct 21, 2023', batch: 'Grade 11-A', sub: 'Physics', status: 'On Time', isLate: false },
  { date: 'Oct 20, 2023', batch: 'Grade 12-B', sub: 'Physics', status: 'On Time', isLate: false },
]

export default function TeacherDailyReportView() {
  return (
    <div className="flex-1 p-8 overflow-auto bg-slate-50 min-h-screen">
      
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Daily Report</h1>
        <p className="text-[13px] text-slate-500 mt-1">
          Log what was taught today
        </p>
      </div>

      {/* Submission Form */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 mb-8 max-w-4xl">
        <form className="space-y-6">
          
          {/* Row 1: Date & Batch */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-[13px] font-bold text-slate-900 mb-2">Date</label>
              <div className="relative">
                <Calendar className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  defaultValue="10/24/2023"
                  className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow" 
                />
              </div>
            </div>
            <div>
              <label className="block text-[13px] font-bold text-slate-900 mb-2">Batch</label>
              <div className="relative">
                <select className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none transition-shadow">
                  <option>Grade 11-A</option>
                  <option>Grade 10-C</option>
                </select>
                <ChevronDown className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Row 2: Subject & Chapter */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-[13px] font-bold text-slate-900 mb-2">Subject</label>
              <div className="relative">
                <select className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none transition-shadow">
                  <option>Physics</option>
                  <option>Mathematics</option>
                </select>
                <ChevronDown className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-[13px] font-bold text-slate-900 mb-2">Chapter</label>
              <div className="relative">
                <select className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none transition-shadow">
                  <option>Kinematics</option>
                  <option>Laws of Motion</option>
                </select>
                <ChevronDown className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Topics Covered */}
          <div>
            <label className="block text-[13px] font-bold text-slate-900 mb-2">Topics Covered</label>
            <textarea 
              rows={4}
              placeholder="Briefly describe the topics discussed..."
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow resize-none"
            />
          </div>

          {/* Row 3: Attendance */}
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-xl">
              <label className="flex items-center gap-2 text-[12px] font-bold text-emerald-800 mb-2">
                <UserCheck className="w-4 h-4" /> Present Count
              </label>
              <input 
                type="number" 
                defaultValue="38"
                className="w-full px-4 py-2 bg-white border border-emerald-200 rounded-lg text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500" 
              />
            </div>
            <div className="bg-red-50/50 border border-red-100 p-4 rounded-xl">
              <label className="flex items-center gap-2 text-[12px] font-bold text-red-800 mb-2">
                <UserX className="w-4 h-4" /> Absent Count
              </label>
              <input 
                type="number" 
                defaultValue="2"
                className="w-full px-4 py-2 bg-white border border-red-200 rounded-lg text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500" 
              />
            </div>
          </div>

          {/* Row 4: Homework & Observations */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-[13px] font-bold text-slate-900 mb-2">Homework Given</label>
              <textarea 
                rows={3}
                placeholder="Assignments or readings..."
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow resize-none"
              />
            </div>
            <div>
              <label className="block text-[13px] font-bold text-slate-900 mb-2">Observations (Optional)</label>
              <textarea 
                rows={3}
                placeholder="Any behavioral or academic notes..."
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow resize-none"
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button 
              type="button"
              className="w-full py-4 bg-[#0b1320] text-white rounded-xl text-sm font-bold shadow-sm hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" /> Submit Daily Report
            </button>
          </div>

        </form>
      </div>

      {/* Recent Submissions Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden max-w-4xl">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Your Recent Submissions</h2>
          <button className="text-[12px] font-bold text-indigo-600 hover:underline transition-colors">
            View All
          </button>
        </div>
        
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50/50">
              <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Date</th>
              <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Batch</th>
              <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Subject</th>
              <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {SUBMISSIONS.map((sub, idx) => (
              <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4 text-[13px] font-semibold text-slate-700">{sub.date}</td>
                <td className="px-6 py-4 text-[13px] font-bold text-slate-900">{sub.batch}</td>
                <td className="px-6 py-4 text-[13px] text-slate-600">{sub.sub}</td>
                <td className="px-6 py-4 text-right">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold rounded-full uppercase tracking-wider ${
                    sub.isLate ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  }`}>
                    {sub.isLate ? <Flag className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                    {sub.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  )
}
