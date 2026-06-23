'use client'
import { Briefcase, Users, Calendar, CheckCircle2, Filter, Plus, Clock, CheckCircle } from 'lucide-react'

// --- Mock Data ---
const KPIS = [
  { label: 'Open Positions', value: '12', subtext: '+2 this month', icon: Briefcase, subcolor: 'text-green-600', subbg: 'bg-green-50' },
  { label: 'Active Candidates', value: '34', subtext: '+8 this week', icon: Users, subcolor: 'text-green-600', subbg: 'bg-green-50' },
  { label: 'Interviews This Week', value: '8', subtext: '3 today', icon: Calendar, subcolor: 'text-blue-600', subbg: 'bg-blue-50' },
  { label: 'Offers Extended', value: '3', subtext: 'All accepted', icon: CheckCircle2, subcolor: 'text-emerald-600', subbg: 'bg-emerald-50' }
]

const PIPELINE = {
  Requirement: [
    { initials: 'AS', name: 'Alice Smith', role: 'Mathematics HOD', dep: 'SCIENCE', theme: 'blue' },
    { initials: 'BJ', name: 'Bob Jones', role: 'Physics Teacher', dep: 'SCIENCE', theme: 'blue' }
  ],
  Shortlisted: [
    { initials: 'CW', name: 'Claire Williams', role: 'Librarian', dep: 'ADMIN', theme: 'blue' },
    { initials: 'DP', name: 'David Patel', role: 'Sports Coach', dep: 'ATHLETICS', theme: 'indigo' }
  ],
  'Interview Scheduled': [
    { initials: 'EM', name: 'Emma Martinez', role: 'English Lit', dep: 'ARTS', theme: 'blue', schedule: 'Tomorrow, 10:00 AM' }
  ]
}

const APPRAISALS = [
  { initials: 'TH', name: 'Tom Harris', dep: 'Mathematics', review: 'Annual', rating: 'Outstanding', date: 'Oct 12, 2023', checked: true },
  { initials: 'SJ', name: 'Sarah Jenkins', dep: 'Science', review: 'Probation', rating: 'Excellent', date: 'Oct 15, 2023', checked: true },
  { initials: 'MB', name: 'Michael Brown', dep: 'History', review: 'Annual', rating: 'Satisfactory', date: 'Oct 18, 2023', checked: false },
  { initials: 'LK', name: 'Laura King', dep: 'Physical Ed.', review: 'Mid-Year', rating: 'Needs Imp.', date: 'Oct 20, 2023', checked: false }
]

export default function RecruitmentView() {
  return (
    <div className="flex-1 p-8 overflow-auto bg-slate-50 min-h-screen">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Recruitment</h1>
          <p className="text-[13px] text-slate-500 mt-1">
            Track open positions, candidates, and interview pipeline.
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-[#0b1320] hover:bg-slate-800 text-white rounded-lg text-sm font-semibold transition-all shadow-sm">
          <Plus className="w-4 h-4" /> New Requirement
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {KPIS.map((kpi, idx) => (
          <div key={idx} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[13px] font-semibold text-slate-600">{kpi.label}</span>
              <div className="p-2 bg-slate-50 rounded-lg">
                <kpi.icon className="w-4 h-4 text-slate-700" />
              </div>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold text-slate-900">{kpi.value}</span>
              <span className={`px-2 py-0.5 text-[11px] font-bold rounded-full ${kpi.subbg} ${kpi.subcolor}`}>
                {kpi.subtext}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Pipeline */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900">Pipeline</h2>
          <button className="flex items-center gap-2 px-4 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors shadow-sm">
            <Filter className="w-4 h-4" /> Filter
          </button>
        </div>

        <div className="flex gap-6 overflow-x-auto pb-4">
          {Object.entries(PIPELINE).map(([columnName, items]) => (
            <div key={columnName} className="min-w-[320px] max-w-[320px] flex flex-col gap-3">
              <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl shadow-sm">
                <span className="text-sm font-bold text-slate-900">{columnName}</span>
                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-bold rounded-md">{items.length}</span>
              </div>

              {items.map((item, idx) => (
                <div key={idx} className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm hover:shadow transition-shadow">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-[#0b1320] flex items-center justify-center text-white text-sm font-bold">
                      {item.initials}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{item.name}</h4>
                      <p className="text-[12px] text-slate-500">{item.role}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-4">
                    <span className="px-2 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-bold uppercase tracking-wider rounded-md border border-indigo-100">
                      {item.dep}
                    </span>
                  </div>
                  {item.schedule && (
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-[11px] font-semibold text-indigo-600 bg-indigo-50 w-fit px-2 py-1 rounded-md">
                      <Calendar className="w-3.5 h-3.5" />
                      {item.schedule}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
          {/* Empty column placeholder to match the design's right cutoff */}
          <div className="min-w-[320px] max-w-[320px] flex flex-col gap-3 opacity-50">
             <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl shadow-sm">
                <span className="text-sm font-bold text-slate-900">Under Review</span>
                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-bold rounded-md">0</span>
              </div>
          </div>
        </div>
      </div>

      {/* Teacher Appraisals */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-8">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Teacher Appraisals</h2>
          <button className="text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors">
            View All
          </button>
        </div>
        
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50/50">
              <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Faculty Name</th>
              <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Department</th>
              <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Review Type</th>
              <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Rating</th>
              <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Scheduled Date</th>
              <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">Completed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {APPRAISALS.map((app, idx) => (
              <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#0b1320] flex items-center justify-center text-white text-xs font-bold">
                      {app.initials}
                    </div>
                    <span className="text-[13px] font-bold text-slate-900">{app.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-[13px] font-semibold text-slate-700">{app.dep}</span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-[13px] text-slate-600">{app.review}</span>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full border ${
                    app.rating === 'Outstanding' ? 'bg-green-50 text-green-700 border-green-200' :
                    app.rating === 'Excellent' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                    app.rating === 'Satisfactory' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                    'bg-red-50 text-red-700 border-red-200'
                  }`}>
                    {app.rating}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-[13px] text-slate-600">{app.date}</span>
                </td>
                <td className="px-6 py-4 text-center">
                  {app.checked ? (
                    <CheckCircle className="w-5 h-5 text-green-500 mx-auto" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-slate-300 mx-auto" />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  )
}
