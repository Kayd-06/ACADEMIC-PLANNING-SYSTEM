'use client'
import { useState } from 'react'
import { ChevronDown, Calendar, Lock } from 'lucide-react'

// --- Mock Data ---
const CHAPTERS = [
  {
    id: 1,
    status: 'COMPLETED',
    statusTheme: 'green',
    estHours: '12 hrs est.',
    title: 'Chapter 01: Physical World',
    dates: 'Aug 15 - Aug 28',
    activeState: 'Completed',
    notes: 'Introductory concepts clear. Ready f'
  },
  {
    id: 4,
    status: 'IN PROGRESS',
    statusTheme: 'gray',
    estHours: '15 hrs est.',
    title: 'Chapter 04: Kinematics',
    dates: 'Oct 12 - Oct 25',
    activeState: 'In Progress',
    notes: 'Requires extra doubt session for rel'
  },
  {
    id: 5,
    status: 'NOT STARTED',
    statusTheme: 'blue',
    estHours: '10 hrs est.',
    title: 'Chapter 05: Laws of Motion',
    dates: 'Oct 26 - Nov 05',
    activeState: 'Not Started',
    notes: ''
  }
]

export default function FacultyAcademicPlanningView() {
  return (
    <div className="flex-1 p-8 overflow-auto bg-slate-50 min-h-screen">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Academic Planning</h1>
          <p className="text-[13px] text-slate-500 mt-1">
            Track syllabus coverage for your assigned batches and subjects.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button className="flex items-center gap-8 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors shadow-sm">
            Grade 11-A <ChevronDown className="w-4 h-4 text-slate-400" />
          </button>
          <button className="flex items-center gap-8 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors shadow-sm">
            Physics <ChevronDown className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Overall Progress Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-8">
        <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Overall Syllabus Completion</h3>
        <div className="flex items-end gap-16">
          <div className="flex items-baseline">
            <span className="text-5xl font-bold text-slate-900">62</span>
            <span className="text-xl font-bold text-slate-400 ml-1">%</span>
          </div>
          
          <div className="flex-1 pb-1">
            <div className="flex justify-between text-[11px] font-bold text-slate-500 mb-2">
              <span>Total Chapters: 24</span>
              <div className="flex gap-4">
                <span className="text-emerald-500">Completed: 15</span>
                <span>Remaining: 9</span>
              </div>
            </div>
            {/* Progress Bar */}
            <div className="w-full h-3 bg-indigo-50 rounded-full overflow-hidden">
              <div className="h-full bg-[#0b1320] rounded-full" style={{ width: '62%' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Chapter List */}
      <div className="space-y-4">
        {CHAPTERS.map((chap) => (
          <div key={chap.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between hover:shadow transition-shadow">
            
            {/* Left Info */}
            <div className="w-1/3">
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded border ${
                  chap.statusTheme === 'green' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                  chap.statusTheme === 'gray' ? 'bg-slate-100 text-slate-700 border-slate-200' :
                  'bg-blue-50 text-blue-700 border-blue-200'
                }`}>
                  {chap.status}
                </span>
                <span className="text-[11px] font-semibold text-slate-500">{chap.estHours}</span>
              </div>
              <h4 className="text-[15px] font-bold text-slate-900 mb-1.5">{chap.title}</h4>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                <Calendar className="w-3.5 h-3.5" />
                {chap.dates}
              </div>
            </div>

            {/* Segmented Control */}
            <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100">
              {['Not Started', 'In Progress', 'Completed'].map((state) => (
                <button
                  key={state}
                  className={`px-4 py-2 text-[13px] font-bold rounded-lg transition-all ${
                    chap.activeState === state 
                      ? (state === 'Not Started' ? 'bg-indigo-100 text-indigo-700 shadow-sm' : 'bg-[#0b1320] text-white shadow-sm') 
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {state}
                </button>
              ))}
            </div>

            {/* Faculty Notes */}
            <div className="w-1/3 pl-8">
              <label className="block text-[10px] font-bold text-slate-500 mb-1.5">Faculty Notes</label>
              <div className="flex items-center gap-3">
                <input 
                  type="text" 
                  readOnly
                  placeholder="Add notes here..."
                  value={chap.notes}
                  className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[13px] text-slate-700 focus:outline-none"
                />
                <button className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
                  <Lock className="w-5 h-5" />
                </button>
              </div>
            </div>

          </div>
        ))}
      </div>

    </div>
  )
}
