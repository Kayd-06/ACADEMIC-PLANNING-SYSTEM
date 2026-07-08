'use client'
import { useState } from 'react'
import CalendarView from './CalendarView'
import ScheduleManagementView from './ScheduleManagementView'

// Tab wrapper for the management Calendar page:
// Academic Calendar (events) + Class Schedules (recurring slots & special classes)
export default function CalendarPageTabs() {
  const [tab, setTab] = useState<'calendar' | 'schedules'>('calendar')

  return (
    <div className="flex-1 flex flex-col overflow-y-auto max-h-[calc(100vh-72px)]">
      <div className="px-6 pt-5 bg-gray-50">
        <div className="flex gap-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200 shadow-sm w-fit">
          <button onClick={() => setTab('calendar')}
            className={`px-5 py-2 text-xs font-bold rounded-lg transition-all ${tab === 'calendar' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            Academic Calendar
          </button>
          <button onClick={() => setTab('schedules')}
            className={`px-5 py-2 text-xs font-bold rounded-lg transition-all ${tab === 'schedules' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            Class Schedules
          </button>
        </div>
      </div>

      {tab === 'calendar' ? (
        <CalendarView />
      ) : (
        <div className="flex-1 p-6 bg-gray-50">
          <ScheduleManagementView />
        </div>
      )}
    </div>
  )
}
