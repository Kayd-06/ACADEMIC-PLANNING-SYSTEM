'use client'
import { useState } from 'react'
import { ClipboardList, Award } from 'lucide-react'
import DailyReportsViewer from './DailyReportsViewer'
import ProgressReportView from './ProgressReportView'

export default function ManagementReportsHub() {
  const [activeTab, setActiveTab] = useState<'daily' | 'progress'>('daily')

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-gray-50/50">
      {/* Top Tabs Bar */}
      <div className="bg-white border-b border-gray-200 px-8 pt-4">
        <div className="flex items-center gap-8">
          <button
            onClick={() => setActiveTab('daily')}
            className={`flex items-center gap-2 pb-4 text-sm font-bold border-b-2 transition-all ${
              activeTab === 'daily'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            Daily Teacher Reports
          </button>

          <button
            onClick={() => setActiveTab('progress')}
            className={`flex items-center gap-2 pb-4 text-sm font-bold border-b-2 transition-all ${
              activeTab === 'progress'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <Award className="w-4 h-4" />
            Student Progress Reports
          </button>
        </div>
      </div>

      {/* Active Tab Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {activeTab === 'daily' ? <DailyReportsViewer /> : <ProgressReportView />}
      </div>
    </div>
  )
}
