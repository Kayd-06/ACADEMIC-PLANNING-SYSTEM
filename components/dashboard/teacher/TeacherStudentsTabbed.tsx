'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import StudentPerformanceDashboard from './StudentPerformanceDashboard'
import TeacherRosterUpload from './TeacherRosterUpload'

const TABS = [
  { key: 'performance', label: '📊 Performance' },
  { key: 'roster', label: '📋 Student Roster' },
] as const

export default function TeacherStudentsTabbed() {
  const [tab, setTab] = useState<'performance' | 'roster'>('performance')

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Top tab bar */}
      <div className="px-8 pt-6 pb-0 bg-white border-b border-gray-100 shadow-sm">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-4">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
                tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {tab === 'performance' ? (
          <motion.div
            key="performance"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex-1 overflow-auto"
          >
            <StudentPerformanceDashboard />
          </motion.div>
        ) : (
          <motion.div
            key="roster"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex-1 overflow-auto"
          >
            <TeacherRosterUpload />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
