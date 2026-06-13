'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { BookOpen, FileText, Download, Search, Filter } from 'lucide-react'

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, type: 'spring' as const, stiffness: 320, damping: 28 },
})

export default function TeacherCourses({ firstName }: { firstName: string }) {
  const [materials, setMaterials] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/teacher-portal')
      .then(res => res.json())
      .then(data => {
        if (!data.error && data.materials) {
          setMaterials(data.materials)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="flex-1 p-6 overflow-auto bg-gray-50/50">
      <motion.div {...fadeUp(0)} className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Courses & Materials</h1>
          <p className="text-sm text-gray-500 mt-1">Access study materials and resources uploaded by the administration.</p>
        </div>
      </motion.div>

      <motion.div {...fadeUp(0.1)} className="grid grid-cols-12 gap-6">
        <div className="col-span-12">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2 font-semibold text-gray-900">
                <BookOpen className="w-5 h-5 text-indigo-500" />
                Study Material Repository
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input 
                    type="text" 
                    placeholder="Search materials..." 
                    className="pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all w-64"
                  />
                </div>
                <button className="p-2 border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50 transition-colors">
                  <Filter className="w-4 h-4" />
                </button>
              </div>
            </div>

            {loading ? (
              <div className="py-12 flex justify-center text-gray-400 text-sm">Loading materials...</div>
            ) : materials.length === 0 ? (
              <div className="py-12 flex justify-center text-gray-400 text-sm italic">No study materials available at the moment.</div>
            ) : (
              <div className="grid grid-cols-3 gap-5">
                {materials.map((m: any, i: number) => (
                  <div key={m._id || i} className="p-5 border border-gray-100 rounded-2xl hover:border-indigo-200 hover:shadow-md transition-all group bg-gray-50/30">
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 bg-white border border-gray-100 shadow-sm rounded-xl flex items-center justify-center text-sm font-bold text-gray-600 group-hover:bg-indigo-50 group-hover:text-indigo-600 group-hover:border-indigo-100 transition-colors">
                        {m.initials}
                      </div>
                      <span className="px-2.5 py-1 bg-white border border-gray-200 text-gray-500 text-[10px] font-bold uppercase tracking-wider rounded-lg shadow-sm">
                        {m.type}
                      </span>
                    </div>
                    
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg mb-1">{m.provider}</h3>
                      <p className="text-xs text-gray-500 font-medium">{m.subject} • {m.count} items</p>
                    </div>

                    {m.fileName && (
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        {m.fileUrl ? (
                          <a href={m.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-2.5 bg-white border border-gray-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50/50 transition-all group/link">
                            <div className="flex items-center gap-2 overflow-hidden">
                              <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                              <span className="text-xs font-semibold text-gray-700 truncate group-hover/link:text-indigo-700">{m.fileName}</span>
                            </div>
                            <Download className="w-3.5 h-3.5 text-gray-400 group-hover/link:text-indigo-600 shrink-0" />
                          </a>
                        ) : (
                          <div className="flex items-center gap-2 p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-500">
                            <FileText className="w-4 h-4 shrink-0" />
                            <span className="text-xs font-medium truncate">{m.fileName}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  )
}
