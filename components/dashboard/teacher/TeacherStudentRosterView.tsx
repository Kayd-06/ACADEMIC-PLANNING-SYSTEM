'use client'
import { useState } from 'react'
import { ChevronDown, Filter, Mail, Phone, MessageSquare } from 'lucide-react'

// --- Mock Data ---
const STUDENTS = [
  { id: 1, name: 'Emma Thompson', roll: '10A-42', att: '92%', attColor: 'text-emerald-600 bg-emerald-50 border-emerald-200', initials: 'ET', color: 'bg-slate-800 text-white' },
  { id: 2, name: 'Michael Chen', roll: '10A-18', att: '98%', attColor: 'text-emerald-600 bg-emerald-50 border-emerald-200', initials: 'MC', color: 'bg-indigo-600 text-white' },
  { id: 3, name: 'Sarah Jenkins', roll: '10A-33', att: '85%', attColor: 'text-amber-600 bg-amber-50 border-amber-200', initials: 'SJ', color: 'bg-blue-200 text-blue-700' },
  { id: 4, name: 'David Rodriguez', roll: '10A-05', att: '100%', attColor: 'text-emerald-600 bg-emerald-50 border-emerald-200', initials: 'DR', color: 'bg-emerald-600 text-white' },
]

export default function TeacherStudentRosterView() {
  const [activeStudent, setActiveStudent] = useState(STUDENTS[0])

  return (
    <div className="flex-1 p-8 overflow-hidden bg-slate-50 flex flex-col h-screen">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-8 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Student Roster</h1>
          <p className="text-[13px] text-slate-500 mt-1">
            View and track students in your assigned batches
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold shadow-sm">
            Grade 10
          </button>
          <button className="flex items-center gap-6 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold shadow-sm">
            Batch A - Science <ChevronDown className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Main Split Content */}
      <div className="flex gap-6 flex-1 overflow-hidden">
        
        {/* Left List (Master) */}
        <div className="w-80 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex-shrink-0">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h2 className="text-sm font-bold text-slate-900">Students (24)</h2>
            <button className="p-1 text-slate-400 hover:text-slate-600 transition-colors">
              <Filter className="w-4 h-4" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {STUDENTS.map((student) => (
              <div 
                key={student.id}
                onClick={() => setActiveStudent(student)}
                className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all border ${
                  activeStudent.id === student.id 
                    ? 'bg-slate-50 border-slate-200 shadow-sm' 
                    : 'bg-white border-transparent hover:bg-slate-50/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-sm ${student.color}`}>
                    {student.initials}
                  </div>
                  <div>
                    <h4 className="text-[13px] font-bold text-slate-900">{student.name}</h4>
                    <p className="text-[11px] text-slate-500">Roll: {student.roll}</p>
                  </div>
                </div>
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${student.attColor}`}>
                  {student.att} Att.
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Detail (Detail) */}
        <div className="flex-1 overflow-y-auto pr-2 pb-8 space-y-6">
          
          {/* Top Profile Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex items-start justify-between">
            <div className="flex items-center gap-6">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold shadow-sm border-[3px] border-white ring-1 ring-slate-100 ${activeStudent.color}`}>
                {activeStudent.initials}
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 mb-1">{activeStudent.name}</h2>
                <p className="text-[13px] text-slate-600 font-medium mb-3">
                  Grade 10 • Batch A (Science) • Roll No. {activeStudent.roll}
                </p>
                <div className="flex items-center gap-6 text-[12px] text-slate-500 font-medium">
                  <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> parent@example.com</span>
                  <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> +1 (555) 123-4567</span>
                </div>
              </div>
            </div>
            <button className="flex items-center gap-2 px-5 py-2.5 bg-[#0b1320] text-white text-sm font-bold rounded-lg shadow-sm hover:bg-slate-800 transition-colors">
              <MessageSquare className="w-4 h-4" /> Message Parent
            </button>
          </div>

          <div className="grid grid-cols-2 gap-6">
            
            {/* Left Column in Detail */}
            <div className="space-y-6">
              {/* Current Performance */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <h3 className="text-sm font-bold text-slate-900 mb-6">Current Performance</h3>
                
                <div className="space-y-5 mb-8">
                  <div>
                    <div className="flex justify-between text-[12px] font-bold text-slate-700 mb-1.5">
                      <span>Physics</span>
                      <span>88%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#0b1320] rounded-full" style={{ width: '88%' }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[12px] font-bold text-slate-700 mb-1.5">
                      <span>Mathematics</span>
                      <span>94%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#0b1320] rounded-full" style={{ width: '94%' }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[12px] font-bold text-slate-700 mb-1.5">
                      <span>Chemistry</span>
                      <span>82%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#0b1320] rounded-full" style={{ width: '82%' }} />
                    </div>
                  </div>
                </div>

                {/* Circular Gauge Card */}
                <div className="p-4 border border-emerald-100 bg-emerald-50/30 rounded-xl flex items-center gap-6">
                  {/* CSS Circle Gauge approximation */}
                  <div className="w-16 h-16 rounded-full border-[4px] border-emerald-100 flex items-center justify-center relative">
                    <div className="absolute inset-0 rounded-full border-[4px] border-emerald-500 border-r-transparent border-b-transparent transform rotate-45" />
                    <span className="text-sm font-bold text-slate-900">92%</span>
                  </div>
                  <div>
                    <h4 className="text-[14px] font-bold text-slate-900">Attendance</h4>
                    <p className="text-[12px] text-slate-500 font-medium">Present 42/45 days</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column in Detail */}
            <div className="space-y-6">
              
              {/* Recent Tests */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900">Recent Tests</h3>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50/50">
                      <th className="px-5 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Test</th>
                      <th className="px-5 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Date</th>
                      <th className="px-5 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="px-5 py-3 text-[13px] font-semibold text-slate-700">Midterm - Math</td>
                      <td className="px-5 py-3 text-[12px] text-slate-500">Oct 15</td>
                      <td className="px-5 py-3 text-[13px] font-bold text-slate-900">94/100</td>
                    </tr>
                    <tr>
                      <td className="px-5 py-3 text-[13px] font-semibold text-slate-700">Unit 3 - Physics</td>
                      <td className="px-5 py-3 text-[12px] text-slate-500">Oct 02</td>
                      <td className="px-5 py-3 text-[13px] font-bold text-slate-900">88/100</td>
                    </tr>
                    <tr>
                      <td className="px-5 py-3 text-[13px] font-semibold text-slate-700">Lab Practical</td>
                      <td className="px-5 py-3 text-[12px] text-slate-500">Sep 28</td>
                      <td className="px-5 py-3 text-[13px] font-bold text-slate-900">45/50</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Counseling Notes */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <h3 className="text-sm font-bold text-slate-900 mb-6">Counseling Notes</h3>
                
                <div className="space-y-6 relative before:absolute before:inset-0 before:ml-2 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                  
                  <div className="relative flex items-start gap-4">
                    <div className="w-4 h-4 rounded-full bg-[#0b1320] border-4 border-white ring-1 ring-slate-200 z-10 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">OCT 12, 2023</p>
                      <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                        <p className="text-[12px] text-slate-600 leading-relaxed">Career guidance session. Showed strong interest in pursuing Engineering. Recommended advanced calculus prep.</p>
                      </div>
                    </div>
                  </div>

                  <div className="relative flex items-start gap-4">
                    <div className="w-4 h-4 rounded-full bg-slate-300 border-4 border-white ring-1 ring-slate-200 z-10 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">SEP 05, 2023</p>
                      <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                        <p className="text-[12px] text-slate-600 leading-relaxed">General check-in. Settling well into the new semester batch.</p>
                      </div>
                    </div>
                  </div>

                </div>
              </div>

            </div>
          </div>

        </div>

      </div>

    </div>
  )
}
