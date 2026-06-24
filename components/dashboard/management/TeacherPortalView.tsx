'use client'
import { useState, useEffect } from 'react'
import { Plus, User, GraduationCap, FileText, MessageSquare, Filter, MoreVertical, FileIcon, MessageCircle, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function TeacherPortalView() {
  const [data, setData] = useState<{kpis: any, faculty: any[], materials: any[], counseling: any[]} | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      const res = await fetch('/api/teacher-portal/dashboard')
      if (res.ok) {
        const json = await res.json()
        setData(json)
      }
    } catch (error) {
      console.error('Failed to fetch teacher portal data', error)
    } finally {
      setIsLoading(false)
    }
  }

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3000)
  }

  if (isLoading) {
    return (
      <div className="flex-1 p-8 bg-slate-50 min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin mb-4" />
          <p className="text-sm font-medium">Loading Teacher Portal...</p>
        </div>
      </div>
    )
  }

  const KPIS = data ? [
    { label: 'Total Faculty', value: data.kpis.totalFaculty.toString(), icon: User },
    { label: 'Active Batches Covered', value: data.kpis.activeBatches.toString(), icon: GraduationCap },
    { label: 'Materials Uploaded', value: data.kpis.materialsThisWeek.toString(), icon: FileText },
    { label: 'Counseling Sessions Logged', value: data.kpis.counselingSessions.toString(), icon: MessageSquare },
  ] : []

  return (
    <div className="flex-1 p-8 overflow-auto bg-slate-50 min-h-screen relative">
      
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 right-6 bg-[#0b1320] text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 z-[100]"
          >
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            <span className="text-sm font-medium">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Teacher Portal</h1>
          <p className="text-[13px] text-slate-500 mt-1">
            Monitor faculty schedules, materials, and counseling activity
          </p>
        </div>
        <button onClick={() => showToast('Opening Add Faculty modal...')} className="flex items-center gap-2 px-5 py-2.5 bg-[#0b1320] hover:bg-slate-800 text-white rounded-lg text-sm font-semibold transition-all shadow-sm">
          <Plus className="w-4 h-4" /> Add Faculty
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {KPIS.map((kpi, idx) => (
          <div key={idx} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-start gap-4">
            <div className="p-3 bg-slate-100 rounded-xl">
              <kpi.icon className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500 mb-1 leading-tight">{kpi.label}</p>
              <p className="text-2xl font-bold text-slate-900">{kpi.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column (2/3) */}
        <div className="lg:col-span-2">
          
          {/* Faculty Directory Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[400px]">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Faculty Directory</h2>
              <div className="flex items-center gap-3 text-slate-400">
                <button onClick={() => showToast('Filter menu opened')} className="hover:text-slate-600 transition-colors"><Filter className="w-4 h-4" /></button>
                <button onClick={() => showToast('Options menu opened')} className="hover:text-slate-600 transition-colors"><MoreVertical className="w-4 h-4" /></button>
              </div>
            </div>
            
            {data?.faculty.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-400">
                <User className="w-12 h-12 mb-4 text-slate-300" />
                <p className="text-base font-bold text-slate-600 mb-1">No Faculty Members</p>
                <p className="text-sm font-medium">Click "Add Faculty" to build your directory.</p>
              </div>
            ) : (
              <>
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Faculty Name</th>
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Specialization</th>
                      <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">Batches</th>
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Experience</th>
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data?.faculty.map((fac, idx) => (
                      <tr key={fac._id || idx} onClick={() => showToast(`Viewing profile for ${fac.name}`)} className="hover:bg-slate-50/50 transition-colors cursor-pointer">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-sm ${fac.color}`}>
                              {fac.initials}
                            </div>
                            <div>
                              <h4 className="text-[13px] font-bold text-slate-900 leading-tight">{fac.name}</h4>
                              <p className="text-[11px] text-slate-500">{fac.sub}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 text-[10px] font-bold rounded border uppercase tracking-wider ${
                            fac.specTheme === 'blue' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                            fac.specTheme === 'green' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            'bg-purple-50 text-purple-700 border-purple-200'
                          }`}>
                            {fac.spec}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[11px] font-bold mx-auto">
                            {fac.batches}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-[13px] font-medium text-slate-600">{fac.exp}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full border uppercase tracking-wider ${
                            fac.status === 'ACTIVE' ? 'border-emerald-200 text-emerald-700 bg-emerald-50' :
                            fac.status === 'ON_LEAVE' ? 'border-amber-200 text-amber-700 bg-amber-50' :
                            'border-slate-200 text-slate-700 bg-slate-50'
                          }`}>
                            {fac.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="p-4 border-t border-slate-100 bg-slate-50/50 text-center mt-auto">
                  <button onClick={() => showToast('Opening full directory view...')} className="text-[13px] font-bold text-slate-700 hover:text-slate-900 transition-colors w-full h-full">
                    View All Faculty
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right Column (1/3) */}
        <div className="space-y-6">
          
          {/* Recent Study Material Uploads */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">Recent Study Material Uploads</h2>
            </div>
            
            {data?.materials.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <FileText className="w-8 h-8 mx-auto mb-3 text-slate-300" />
                <p className="text-sm font-medium">No materials uploaded yet.</p>
              </div>
            ) : (
              <div className="p-2">
                {data?.materials.map((mat, idx) => (
                  <div key={mat._id || idx} onClick={() => showToast(`Previewing ${mat.title}`)} className="flex items-start gap-4 p-4 hover:bg-slate-50 rounded-xl transition-colors border-b border-slate-50 last:border-0 cursor-pointer">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${mat.iconBg}`}>
                      <FileIcon className={`w-5 h-5 ${mat.iconColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-1">
                        <h4 className="text-[13px] font-bold text-slate-900 truncate">{mat.title}</h4>
                        <span className="text-[10px] font-semibold text-slate-400 whitespace-nowrap ml-2">{mat.time}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded border uppercase tracking-wider ${
                          mat.specTheme === 'blue' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>
                          {mat.spec}
                        </span>
                        <span className="text-[11px] text-slate-500 truncate">{mat.author}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 text-center mt-auto">
              <button onClick={() => showToast('Opening Resource Library...')} className="text-[13px] font-bold text-slate-700 hover:text-slate-900 transition-colors w-full">
                View Resource Library
              </button>
            </div>
          </div>

          {/* Recent Counseling Logs */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Recent Counseling Logs</h2>
              <button onClick={() => showToast('Options menu opened')} className="text-slate-400 hover:text-slate-600 transition-colors"><MoreVertical className="w-4 h-4" /></button>
            </div>
            
            {data?.counseling.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <MessageSquare className="w-8 h-8 mx-auto mb-3 text-slate-300" />
                <p className="text-sm font-medium">No counseling logs found.</p>
              </div>
            ) : (
              <div className="p-2">
                {data?.counseling.map((log, idx) => (
                  <div key={log._id || idx} onClick={() => showToast(`Viewing session details for ${log.student}`)} className="flex items-center justify-between p-4 hover:bg-slate-50 rounded-xl transition-colors border-b border-slate-50 last:border-0 cursor-pointer">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                        <MessageCircle className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-[13px] font-bold text-slate-900 leading-tight">{log.student}</h4>
                        <p className="text-[11px] text-slate-500">{log.teacher}</p>
                      </div>
                    </div>
                    <span className="text-[11px] font-semibold text-slate-500">{log.date}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  )
}
