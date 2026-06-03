'use client'
import { Bell, HelpCircle, Settings } from 'lucide-react'
import { motion } from 'framer-motion'

interface TopHeaderProps {
  initials: string
}

export default function TopHeader({ initials }: TopHeaderProps) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      className="bg-white border-b border-slate-200 px-6 h-16 flex items-center gap-4 sticky top-0 z-40 shadow-sm"
    >
      {/* Brand */}
      <div className="text-xl font-bold tracking-tight text-[#002045] mr-4">EduAdmin Pro</div>

      {/* Search */}
      <div className="flex-1">
        <div className="relative max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search faculty, roles..."
            className="w-full pl-9 pr-4 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-[#002045]/20 focus:border-[#002045]/40 transition-all placeholder-gray-400"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <button className="p-2 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
        </button>
        <button className="p-2 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors">
          <HelpCircle className="w-5 h-5" />
        </button>
        <button className="p-2 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors">
          <Settings className="w-5 h-5" />
        </button>
        <div className="w-8 h-8 rounded-full bg-[#002045] flex items-center justify-center text-white text-xs font-semibold ml-2 cursor-pointer hover:bg-[#1a365d] transition-colors">
          {initials}
        </div>
      </div>
    </motion.header>
  )
}
