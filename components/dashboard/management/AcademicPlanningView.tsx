'use client'
import { useState } from 'react'
import { Plus, MoreVertical } from 'lucide-react'

const PROGRAMS = [
  {
    title: 'JEE 2-Year Integrated',
    target: 'JEE ADVANCED 2026',
    batches: 4,
    students: 180,
    subjects: 3,
    colorTheme: 'blue' // mapped to classes
  },
  {
    title: 'NEET One-Year Crash',
    target: 'NEET 2025',
    batches: 2,
    students: 95,
    subjects: 4,
    colorTheme: 'green'
  },
  {
    title: 'Foundational (Grade 8-10)',
    target: 'BOARD EXAMS',
    batches: 6,
    students: 240,
    subjects: 5,
    colorTheme: 'purple'
  }
]

export default function AcademicPlanningView() {
  const [activeTab, setActiveTab] = useState('Programs')

  return (
    <div className="flex-1 p-8 overflow-auto bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Academic Planning</h1>
          <p className="text-[13px] text-slate-500 mt-1">
            Manage programs, batches, subjects, and syllabus coverage across the institution
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-[#0b1320] hover:bg-slate-800 text-white rounded-lg text-sm font-semibold transition-all shadow-sm">
          <Plus className="w-4 h-4" /> New Program
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 mb-8">
        <div className="flex gap-8">
          {['Programs', 'Batches', 'Syllabus Tracker'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-4 text-sm font-bold transition-colors relative ${
                activeTab === tab ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {tab}
              {activeTab === tab && (
                <div className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-slate-900" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {activeTab === 'Programs' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {PROGRAMS.map((prog, idx) => (
            <div key={idx} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative">
              {/* Top color border */}
              <div className={`h-1.5 w-full ${
                prog.colorTheme === 'blue' ? 'bg-[#002045]' : 
                prog.colorTheme === 'green' ? 'bg-[#22c55e]' : 
                'bg-[#8b5cf6]'
              }`} />
              
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">{prog.title}</h3>
                    <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 rounded-md">
                      TARGET: {prog.target}
                    </span>
                  </div>
                  <button className="p-1 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-50 transition-colors">
                    <MoreVertical className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-6 mt-8">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Batches</p>
                    <p className="text-base font-bold text-slate-900">{prog.batches}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Students</p>
                    <p className="text-base font-bold text-slate-900">{prog.students}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Subjects</p>
                    <p className="text-base font-bold text-slate-900">{prog.subjects}</p>
                  </div>
                </div>

                <button className="w-full py-2.5 border border-slate-200 text-slate-700 text-sm font-bold rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all">
                  Manage
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
