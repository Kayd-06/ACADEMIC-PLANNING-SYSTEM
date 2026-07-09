'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { Building2, Zap, FileText, TrendingUp, Plus, ChevronRight, CheckCircle2, Clock, AlertTriangle, ShieldCheck, Copy, Check } from 'lucide-react'
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
  const [schoolData, setSchoolData] = useState<{
    board: string; classes: string; programs: string; mouStatus: string; joinCode: string
  } | null>(null)
  const [schoolLoading, setSchoolLoading] = useState(true)
  const [codeCopied, setCodeCopied] = useState(false)
  const [audits, setAudits] = useState(auditRows)
  const [protocols, setProtocols] = useState<Protocol[]>([])

  useEffect(() => {
    fetch('/api/school')
      .then(res => res.json())
      .then(data => { if (!data.error) setSchoolData(data) })
      .finally(() => setSchoolLoading(false))
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

  function copyCode() {
    if (!schoolData?.joinCode) return
    navigator.clipboard.writeText(schoolData.joinCode)
    setCodeCopied(true)
    setTimeout(() => setCodeCopied(false), 2000)
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
        initialData={schoolData ?? { board: '', classes: '', programs: '', mouStatus: '', joinCode: '' }}
        onSave={handleSave}
      />
      <ProtocolsModal
        isOpen={isProtocolsModalOpen}
        onClose={() => setIsProtocolsModalOpen(false)}
        onUpdate={fetchProtocols}
      />

      {/* Page title */}
      <motion.div {...fadeUp(0)} className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Institutional Dashboard</h1>
          <p className="text-[13px] font-medium text-slate-500 mt-1">Overview of academic background, protocols, and ongoing management tasks</p>
        </div>
        <Link href="/management/recruitment">
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-1.5 bg-[#0b1320] hover:bg-[#1a2333] text-white text-sm font-bold px-5 py-2.5 rounded-lg shadow-sm transition-all cursor-pointer"
          >
            New Recruitment
          </motion.div>
        </Link>
      </motion.div>

      {/* Top grid: School Background + Quick Actions + Protocols */}
      <div className="grid grid-cols-12 gap-4 mb-4">

        {/* School Background — 7 cols */}
        <motion.div {...fadeUp(0.04)} className="col-span-7 bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2 font-bold text-slate-900 text-[15px]">
              <Building2 className="w-5 h-5 text-slate-700" /> School Background
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {schoolLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-xl p-4 border border-slate-100 bg-slate-50/70">
                  <div className="h-2.5 w-20 rounded bg-slate-200 animate-pulse mb-2.5" />
                  <div className="h-3.5 w-32 rounded bg-slate-200 animate-pulse" />
                </div>
              ))
            ) : (
              [
                { label: 'CURRENT BOARD', value: schoolData?.board || 'Not set' },
                { label: 'ACTIVE CLASSES', value: schoolData?.classes || 'Not set' },
                { label: 'PROGRAMS OFFERED', value: schoolData?.programs || 'Not set' },
                { label: 'MOU STATUS', value: schoolData?.mouStatus || 'Not set', primary: true },
              ].map(item => (
                <div key={item.label} className={`rounded-xl p-4 border flex flex-col justify-center relative ${item.primary ? 'bg-indigo-50/40 border-indigo-200/60' : 'bg-slate-50/70 border-slate-100'}`}>
                  <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${item.primary ? 'text-indigo-600' : 'text-slate-500'}`}>{item.label}</p>
                  <p className="text-[13px] font-bold text-slate-800">
                    {item.value}
                  </p>
                  {item.primary && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border-2 border-indigo-600 flex items-center justify-center">
                      <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
          {schoolData?.joinCode && (
            <div className="mt-4 rounded-xl p-4 border border-amber-200 bg-amber-50/60 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-1">School Invite Code</p>
                <p className="text-[15px] font-black text-amber-900 tracking-widest font-mono">{schoolData.joinCode}</p>
                <p className="text-[11px] text-amber-600 mt-0.5">Share this code with teachers &amp; staff to join your school</p>
              </div>
              <button
                onClick={copyCode}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-800 text-[12px] font-bold transition-all"
              >
                {codeCopied ? <><Check className="w-3.5 h-3.5" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
              </button>
            </div>
          )}
        </motion.div>

        {/* Quick Actions — 3 cols */}
        <motion.div {...fadeUp(0.08)} className="col-span-3 bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 font-bold text-slate-900 text-[15px] mb-5">
            <Zap className="w-5 h-5 text-slate-700" /> Quick Actions
          </div>
          <div className="space-y-3">
            {[
              { label: 'Initiate Recruitment', href: '/management/recruitment', icon: <Plus className="w-4 h-4 text-indigo-600" /> },
              { label: 'Update Macro Plan', href: '/management/academic-planning', icon: <Clock className="w-4 h-4 text-indigo-600" /> },
              { label: 'Upload Compliance Doc', href: '#', onClick: () => setIsProtocolsModalOpen(true), icon: <FileText className="w-4 h-4 text-indigo-600" /> },
            ].map(action => (
              action.href !== '#' ? (
                <Link key={action.label} href={action.href!} className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all group text-left">
                  <div className="flex items-center gap-3 text-[13px] font-bold text-slate-800">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                      {action.icon}
                    </div>
                    {action.label}
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500" />
                </Link>
              ) : (
                <button key={action.label} onClick={action.onClick} className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all group text-left cursor-pointer">
                  <div className="flex items-center gap-3 text-[13px] font-bold text-slate-800">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                      {action.icon}
                    </div>
                    {action.label}
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500" />
                </button>
              )
            ))}
          </div>
        </motion.div>

        {/* Protocols — 2 cols */}
        <motion.div {...fadeUp(0.12)} className="col-span-2 bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 font-bold text-slate-900 text-[15px] mb-5">
            <ShieldCheck className="w-5 h-5 text-slate-700" /> Protocols
          </div>
          <div className="space-y-5">
            {protocols.length === 0 && <p className="text-[12px] text-slate-400 italic">Loading...</p>}
            {protocols.slice(0, 3).map(p => (
              <div key={p._id} className="flex gap-4 items-start">
                <div className={`mt-0.5 shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  p.status === 'completed' ? 'bg-emerald-50 text-emerald-500' :
                  p.status === 'overdue' ? 'bg-red-50 text-red-500' :
                  'bg-amber-50 text-amber-500'
                }`}>
                  {p.status === 'completed' ? <CheckCircle2 className="w-4 h-4" /> :
                   p.status === 'overdue' ? <AlertTriangle className="w-4 h-4" /> :
                   <Clock className="w-4 h-4" />}
                </div>
                <div>
                  <p className="text-[13px] font-bold text-slate-800 leading-tight">{p.label}</p>
                  <p className={`text-[11px] mt-1 font-medium ${p.status === 'overdue' ? 'text-red-500' : 'text-slate-500'}`}>{p.sub}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 pt-4 border-t border-slate-100 flex justify-center">
            <button
              onClick={() => setIsProtocolsModalOpen(true)}
              className="text-[13px] text-indigo-600 hover:text-indigo-700 font-bold transition-colors"
            >
              Manage All
            </button>
          </div>
        </motion.div>
      </div>

      {/* Academic Quality Monitoring table */}
      <motion.div {...fadeUp(0.16)} className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div className="flex items-center gap-2 font-bold text-slate-900 text-[15px]">
            <TrendingUp className="w-5 h-5 text-slate-700" /> Academic Quality Monitoring
          </div>
          <div className="flex items-center gap-2">
            <button className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors">
              <span className="text-xl leading-none">⋮</span>
            </button>
          </div>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100">
              {['Department', 'Audit Cycle', 'Lead Coordinator', 'Status', 'Action'].map(h => (
                <th key={h} className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">{h}</th>
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
                className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors"
              >
                <td className="px-6 py-4 text-[13px] text-slate-800 font-bold">{row.dept}</td>
                <td className="px-6 py-4 text-[13px] text-slate-600 font-medium">{row.cycle}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-700">{row.initials}</div>
                    <span className="text-[13px] font-semibold text-slate-800">{row.coordinator}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`text-[11px] font-bold px-3 py-1.5 rounded-full ${
                    row.status === 'Completed' ? 'bg-emerald-50 text-emerald-600' :
                    row.status === 'Delayed' ? 'bg-red-50 text-red-600' :
                    row.status === 'Upcoming' ? 'bg-blue-50 text-blue-600' :
                    'bg-amber-50 text-amber-600'
                  }`}>
                    {row.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <button className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 transition-colors">
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
