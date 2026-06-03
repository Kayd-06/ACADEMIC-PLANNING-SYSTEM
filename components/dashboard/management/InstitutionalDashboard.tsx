'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Building2, Zap, FileText, TrendingUp, Plus, Filter, Download, ChevronRight, CheckCircle2, Clock, AlertTriangle, ShieldCheck } from 'lucide-react'
import SchoolDetailsModal from './SchoolDetailsModal'
import ProtocolsModal from './ProtocolsModal'

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, type: 'spring' as const, stiffness: 320, damping: 28 },
})

const STATUS_STYLES: Record<string, string> = {
  'In Progress': 'bg-blue-50 text-blue-700 border border-blue-100',
  'Completed': 'bg-emerald-50 text-emerald-700 border border-emerald-100',
  'Delayed': 'bg-red-50 text-red-600 border border-red-100',
}

const auditRows = [
  { dept: 'Mathematics', cycle: 'Q1 2024', coordinator: 'Dr. Sarah Jenkins', initials: 'SJ', status: 'In Progress' },
  { dept: 'Sciences (Physics/Chem)', cycle: 'Q4 2023', coordinator: 'Prof. Alan Turing', initials: 'AT', status: 'Completed' },
  { dept: 'Humanities', cycle: 'Q2 2024', coordinator: 'Ms. Maria Bauer', initials: 'MB', status: 'Delayed' },
]

interface Protocol {
  _id: string
  label: string
  sub: string
  status: 'completed' | 'pending' | 'overdue'
}

export default function InstitutionalDashboard() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isProtocolsModalOpen, setIsProtocolsModalOpen] = useState(false)
  const [schoolData, setSchoolData] = useState({
    board: 'CBSE Affiliated',
    classes: 'Nursery – XII',
    programs: 'STEM, Humanities, Arts',
    mouStatus: 'Active (2025)'
  })
  const [audits, setAudits] = useState(auditRows)
  const [protocols, setProtocols] = useState<Protocol[]>([])

  useEffect(() => {
    fetch('/api/school')
      .then(res => res.json())
      .then(data => { if (!data.error) setSchoolData(data) })
    fetchProtocols()
  }, [])

  async function fetchProtocols() {
    const res = await fetch('/api/protocols')
    const data = await res.json()
    if (!data.error) setProtocols(data)
  }

  async function handleSave(newData: any) {
    const res = await fetch('/api/school', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newData)
    })
    const data = await res.json()
    if (!data.error) setSchoolData(data)
  }

  const protocolIcon = (status: Protocol['status']) => {
    if (status === 'completed') return <CheckCircle2 className="w-4 h-4 text-emerald-500" />
    if (status === 'overdue') return <AlertTriangle className="w-4 h-4 text-red-500" />
    return <Clock className="w-4 h-4 text-[#1a365d]" />
  }

  return (
    <div className="flex-1 p-6 overflow-auto">
      <SchoolDetailsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialData={schoolData}
        onSave={handleSave}
      />
      <ProtocolsModal
        isOpen={isProtocolsModalOpen}
        onClose={() => setIsProtocolsModalOpen(false)}
        onUpdate={fetchProtocols}
      />

      {/* Page title */}
      <motion.div {...fadeUp(0)} className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Institutional Dashboard</h1>
          <p className="text-sm text-gray-400 mt-0.5">Overview of academic background, protocols, and ongoing management tasks.</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center gap-1.5 bg-[#002045] hover:bg-[#1a365d] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> New Recruitment
        </motion.button>
      </motion.div>

      {/* Top grid: School Background + Quick Actions + Protocols */}
      <div className="grid grid-cols-12 gap-4 mb-4">

        {/* School Background — 7 cols */}
        <motion.div {...fadeUp(0.04)} className="col-span-7 bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 font-medium text-gray-900 text-sm">
              <Building2 className="w-4 h-4 text-gray-400" /> School Background
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="text-xs text-[#002045] hover:text-[#1a365d] font-semibold transition-colors"
            >
              View Details
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'CURRENT BOARD', value: schoolData.board },
              { label: 'ACTIVE CLASSES', value: schoolData.classes },
              { label: 'PROGRAMS', value: schoolData.programs },
              { label: 'MOU STATUS', value: schoolData.mouStatus, primary: true },
            ].map(item => (
              <div key={item.label} className={`rounded-lg p-3.5 ${item.primary ? 'bg-[#002045]/5 border-l-4 border-[#1a365d]' : 'bg-gray-50'}`}>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">{item.label}</p>
                <p className={`text-sm font-medium ${item.primary ? 'text-[#002045] flex items-center gap-1' : 'text-gray-900'}`}>
                  {item.primary && <CheckCircle2 className="w-3.5 h-3.5" />}
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Quick Actions — 3 cols */}
        <motion.div {...fadeUp(0.08)} className="col-span-3 bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 font-medium text-gray-900 text-sm mb-4">
            <Zap className="w-4 h-4 text-gray-400" /> Quick Actions
          </div>
          <div className="space-y-2.5">
            {[
              { label: 'Initiate Recruitment', icon: <Plus className="w-3.5 h-3.5" /> },
              { label: 'Update Macro Plan', icon: <Clock className="w-3.5 h-3.5" /> },
              { label: 'Upload Compliance Doc', icon: <FileText className="w-3.5 h-3.5" /> },
            ].map(action => (
              <button key={action.label} className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-gray-200 hover:border-[#002045]/30 hover:bg-[#002045]/5 transition-all group text-left">
                <div className="flex items-center gap-2 text-xs font-medium text-gray-700 group-hover:text-[#002045]">
                  <span className="text-gray-400 group-hover:text-[#1a365d]">{action.icon}</span>
                  {action.label}
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-[#1a365d]" />
              </button>
            ))}
          </div>
        </motion.div>

        {/* Protocols — 2 cols */}
        <motion.div {...fadeUp(0.12)} className="col-span-2 bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 font-medium text-gray-900 text-sm mb-4">
            <ShieldCheck className="w-4 h-4 text-gray-400" /> Protocols
          </div>
          <div className="space-y-3">
            {protocols.length === 0 && <p className="text-[11px] text-gray-400 italic">Loading...</p>}
            {protocols.slice(0, 3).map(p => (
              <div key={p._id} className="flex gap-2.5">
                <div className="mt-0.5 shrink-0">{protocolIcon(p.status)}</div>
                <div>
                  <p className="text-xs font-semibold text-gray-800 leading-tight">{p.label}</p>
                  <p className={`text-[11px] mt-0.5 ${p.status === 'overdue' ? 'text-red-500' : 'text-gray-400'}`}>{p.sub}</p>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() => setIsProtocolsModalOpen(true)}
            className="text-xs text-[#002045] hover:text-[#1a365d] font-semibold mt-4 transition-colors"
          >
            Manage All
          </button>
        </motion.div>
      </div>

      {/* Academic Quality Monitoring table */}
      <motion.div {...fadeUp(0.16)} className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2 font-medium text-gray-900 text-sm">
            <TrendingUp className="w-4 h-4 text-gray-400" /> Academic Quality Monitoring
          </div>
          <div className="flex items-center gap-2">
            <button className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors">
              <Filter className="w-3.5 h-3.5" />
            </button>
            <button className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors">
              <Download className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-50">
              {['Department', 'Audit Cycle', 'Lead Coordinator', 'Status', 'Action'].map(h => (
                <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {audits.map((row, i) => (
              <motion.tr
                key={row.dept}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 + i * 0.05 }}
                className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors"
              >
                <td className="px-5 py-3.5 text-sm text-gray-800 font-medium">{row.dept}</td>
                <td className="px-5 py-3.5 text-sm text-gray-500">{row.cycle}</td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-[#002045]/10 flex items-center justify-center text-[10px] font-bold text-[#002045]">{row.initials}</div>
                    <span className="text-sm text-gray-800">{row.coordinator}</span>
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <select
                    value={row.status}
                    onChange={(e) => {
                      const newRows = [...audits];
                      newRows[i].status = e.target.value;
                      setAudits(newRows);
                    }}
                    className={`text-[11px] font-bold uppercase px-2 py-1 rounded-full border cursor-pointer outline-none appearance-none text-center transition-colors ${STATUS_STYLES[row.status] || STATUS_STYLES['In Progress']}`}
                  >
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                    <option value="Delayed">Delayed</option>
                  </select>
                </td>
                <td className="px-5 py-3.5">
                  <button className="p-1.5 rounded-lg text-gray-400 hover:text-[#002045] hover:bg-gray-100 transition-colors">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
        <div className="px-5 py-3 border-t border-gray-50 text-center">
          <p className="text-xs text-gray-400">© 2024 EduAdmin Management System. Institutional Grade Security.</p>
        </div>
      </motion.div>
    </div>
  )
}
