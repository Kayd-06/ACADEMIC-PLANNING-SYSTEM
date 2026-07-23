'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { formatDate, formatDateTime } from '@/lib/date'
import {
  Briefcase,
  Users,
  Award,
  Calendar,
  TrendingUp,
  Plus,
  Search,
  Filter,
  CheckCircle,
  Clock,
  AlertCircle,
  MoreHorizontal,
  FileText,
  ChevronRight,
  UserCheck,
  X,
  Edit,
  Trash2,
  ExternalLink,
  Shield,
  Activity,
  DollarSign,
  MapPin,
  Video,
  Phone,
  Mail,
  Star,
  CheckSquare,
  List,
  Columns,
  RefreshCw,
  Eye,
  ChevronDown,
  Building2
} from 'lucide-react'

interface RecruitmentViewProps {
  schoolId?: string
}

const avatarColors = [
  'bg-indigo-50 text-indigo-700 border border-indigo-200/60',
  'bg-emerald-50 text-emerald-700 border border-emerald-200/60',
  'bg-purple-50 text-purple-700 border border-purple-200/60',
  'bg-rose-50 text-rose-700 border border-rose-200/60',
  'bg-amber-50 text-amber-700 border border-amber-200/60',
  'bg-sky-50 text-sky-700 border border-sky-200/60'
]
const getAvatarColor = (name: string) => {
  const cleanName = name || 'XX'
  const charCode = cleanName.charCodeAt(0) + (cleanName.charCodeAt(1) || 0)
  return avatarColors[charCode % avatarColors.length]
}

export const RecruitmentView: React.FC<RecruitmentViewProps> = ({ schoolId }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'requirements' | 'candidates' | 'appraisals' | 'audit'>('overview')
  const [loading, setLoading] = useState(true)
  const [dashboardData, setDashboardData] = useState<any>(null)
  
  // Data lists
  const [requirements, setRequirements] = useState<any[]>([])
  const [candidates, setCandidates] = useState<any[]>([])
  const [interviews, setInterviews] = useState<any[]>([])
  const [appraisals, setAppraisals] = useState<any[]>([])
  const [auditLogs, setAuditLogs] = useState<any[]>([])

  // Filter states
  const [searchTerm, setSearchTerm] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [schoolFilter, setSchoolFilter] = useState('ALL')
  const [candidateSubTab, setCandidateSubTab] = useState<'profiles' | 'interviews'>('profiles')
  const [adminSchools, setAdminSchools] = useState<any[]>([])

  // Modals
  const [showReqModal, setShowReqModal] = useState(false)
  const [editingReq, setEditingReq] = useState<any>(null)
  
  const [showCandModal, setShowCandModal] = useState(false)
  const [editingCand, setEditingCand] = useState<any>(null)
  const [candidateToDelete, setCandidateToDelete] = useState<any>(null)

  const [showIntModal, setShowIntModal] = useState(false)
  const [editingInt, setEditingInt] = useState<any>(null)

  const [showAppModal, setShowAppModal] = useState(false)
  const [editingApp, setEditingApp] = useState<any>(null)

  const [showDiffModal, setShowDiffModal] = useState(false)
  const [selectedAudit, setSelectedAudit] = useState<any>(null)
  const [showAuditEditModal, setShowAuditEditModal] = useState(false)
  const [editingAudit, setEditingAudit] = useState<any>(null)

  // Form states
  const [reqForm, setReqForm] = useState({
    jobTitle: '',
    subjectProgram: '',
    department: 'SCIENCE',
    experienceRequired: '3+ Years',
    qualificationRequired: "Master's Degree",
    vacancies: 1,
    status: 'Open',
    postingDate: '',
    closingDate: ''
  })

  const [candForm, setCandForm] = useState({
    name: '',
    contactEmail: '',
    contactPhone: '',
    qualification: '',
    resumeLink: '',
    yearsOfExperience: '3',
    currentOrganization: '',
    specialization: '',
    expectedSalary: '',
    appliedDate: '',
    workflowStatus: 'Requirement',
    roleApplied: '',
    department: 'SCIENCE',
    requirementId: '',
    schoolId: ''
  })

  const [intForm, setIntForm] = useState({
    candidateId: '',
    candidateName: '',
    dateTime: '',
    mode: 'In-person',
    locationOrLink: '',
    feedbackText: '',
    rating: 4,
    finalResult: 'Pending',
    interviewerName: 'Panel'
  })

  const [appForm, setAppForm] = useState({
    teacherName: '',
    teacherEmail: '',
    department: 'Science',
    appraiserName: 'Head of Department',
    period: 'Annual',
    academicYear: '2025-2026',
    teachingRating: '5',
    punctualityRating: '5',
    studentFeedbackAverage: '4.8',
    overallRating: 'Excellent',
    remarksGoals: '',
    improvementAreas: '',
    reviewStatus: 'Pending',
    scheduledDate: '',
    isCompleted: false
  })

  const [auditForm, setAuditForm] = useState({
    userActionType: '',
    tableName: '',
    recordId: '',
    authorName: '',
    authorRole: '',
    oldValues: '',
    newValues: ''
  })

  useEffect(() => {
    fetchAllData()
  }, [])

  const fetchAllData = async () => {
    setLoading(true)
    try {
      const [dashRes, reqRes, candRes, intRes, appRes, auditRes, schoolsRes] = await Promise.all([
        fetch('/api/recruitment/dashboard'),
        fetch('/api/recruitment/requirements'),
        fetch('/api/recruitment/candidates'),
        fetch('/api/recruitment/interviews'),
        fetch('/api/recruitment/appraisals'),
        fetch('/api/recruitment/audit-logs'),
        fetch('/api/admin/schools')
      ])

      if (dashRes.ok) setDashboardData(await dashRes.json())
      if (reqRes.ok) setRequirements(await reqRes.json())
      if (candRes.ok) setCandidates(await candRes.json())
      if (intRes.ok) setInterviews(await intRes.json())
      if (appRes.ok) setAppraisals(await appRes.json())
      if (auditRes.ok) setAuditLogs(await auditRes.json())
      if (schoolsRes.ok) {
        const schs = await schoolsRes.json()
        if (Array.isArray(schs)) setAdminSchools(schs)
      }
    } catch (err) {
      console.error('Failed to fetch recruitment data:', err)
    } finally {
      setLoading(false)
    }
  }

  const getSchoolName = (id?: string) => {
    if (!id) return null
    const found = adminSchools.find((sc: any) => sc.id === id)
    return found ? found.name : null
  }

  // Handlers for Requirements
  const handleSaveRequirement = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const url = '/api/recruitment/requirements'
      const method = editingReq ? 'PATCH' : 'POST'
      const body = editingReq ? { ...reqForm, id: editingReq.id || editingReq._id } : reqForm

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (res.ok) {
        setShowReqModal(false)
        setEditingReq(null)
        fetchAllData()
      } else {
        alert('Failed to save requirement')
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleDeleteRequirement = async (id: string) => {
    if (!confirm('Are you sure you want to delete this job requirement?')) return
    try {
      await fetch(`/api/recruitment/requirements?id=${id}`, { method: 'DELETE' })
      fetchAllData()
    } catch (err) {
      console.error(err)
    }
  }

  // Handlers for Candidates
  const handleSaveCandidate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const url = '/api/recruitment/candidates'
      const method = editingCand ? 'PATCH' : 'POST'
      const body = editingCand ? { ...candForm, id: editingCand.id || editingCand._id } : candForm

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (res.ok) {
        setShowCandModal(false)
        setEditingCand(null)
        fetchAllData()
      } else {
        alert('Failed to save candidate')
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleDeleteCandidate = async (id: string) => {
    try {
      await fetch(`/api/recruitment/candidates?id=${id}`, { method: 'DELETE' })
      fetchAllData()
      setCandidateToDelete(null)
    } catch (err) {
      console.error(err)
    }
  }

  // Handlers for Interviews
  const handleSaveInterview = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const url = '/api/recruitment/interviews'
      const method = editingInt ? 'PATCH' : 'POST'
      const body = editingInt ? { ...intForm, id: editingInt.id || editingInt._id } : intForm

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (res.ok) {
        setShowIntModal(false)
        setEditingInt(null)
        fetchAllData()
      } else {
        alert('Failed to save interview')
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleDeleteInterview = async (id: string) => {
    if (!confirm('Are you sure you want to delete this interview record?')) return
    try {
      await fetch(`/api/recruitment/interviews?id=${id}`, { method: 'DELETE' })
      fetchAllData()
    } catch (err) {
      console.error(err)
    }
  }

  // Handlers for Appraisals
  const handleSaveAppraisal = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const url = '/api/recruitment/appraisals'
      const method = editingApp ? 'PATCH' : 'POST'
      const body = editingApp ? { ...appForm, id: editingApp.id || editingApp._id } : appForm

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (res.ok) {
        setShowAppModal(false)
        setEditingApp(null)
        fetchAllData()
      } else {
        alert('Failed to save appraisal')
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleDeleteAppraisal = async (id: string) => {
    if (!confirm('Are you sure you want to delete this teacher appraisal?')) return
    try {
      await fetch(`/api/recruitment/appraisals?id=${id}`, { method: 'DELETE' })
      fetchAllData()
    } catch (err) {
      console.error(err)
    }
  }

  const handleUpdateCandidateStatus = async (cand: any, newStatus: string) => {
    try {
      await fetch('/api/recruitment/candidates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: cand.id || cand._id, workflowStatus: newStatus })
      })
      fetchAllData()
    } catch (err) {
      console.error(err)
    }
  }

  // Handlers for Audit Logs
  const handleSaveAuditLog = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const targetId = editingAudit?.id || editingAudit?._id
      if (!targetId) return

      await fetch('/api/recruitment/audit-logs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: targetId,
          ...auditForm
        })
      })
      setShowAuditEditModal(false)
      setEditingAudit(null)
      fetchAllData()
    } catch (err) {
      console.error('Failed to update audit log:', err)
    }
  }

  const handleDeleteAuditLog = async (id: string) => {
    if (!confirm('Are you sure you want to delete this audit log entry?')) return
    try {
      await fetch(`/api/recruitment/audit-logs?id=${id}`, { method: 'DELETE' })
      fetchAllData()
    } catch (err) {
      console.error('Failed to delete audit log:', err)
    }
  }

  const stages = ['Requirement', 'Shortlisted', 'Interview Scheduled', 'Under Review', 'Offer Extended', 'Hired']

  if (loading && !dashboardData) {
    return (
      <div className="flex items-center justify-center min-h-[400px] bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
          <p className="text-sm font-semibold text-slate-700">Loading Recruitment & Appraisals...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 p-8 overflow-auto space-y-6 bg-slate-50 min-h-screen">
      {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Recruitment & Staff Appraisals
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            End-to-end faculty lifecycle management, interview evaluation, and performance reviews
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchAllData}
            className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 hover:text-slate-900 text-slate-600 transition-colors shadow-xs bg-white cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          
          <button
            onClick={() => {
              if (activeTab === 'requirements') {
                setEditingReq(null)
                setReqForm({ jobTitle: '', subjectProgram: '', department: 'SCIENCE', experienceRequired: '3+ Years', qualificationRequired: "Master's Degree", vacancies: 1, status: 'Open', postingDate: new Date().toISOString().split('T')[0], closingDate: '' })
                setShowReqModal(true)
              } else if (activeTab === 'candidates' || activeTab === 'overview') {
                setEditingCand(null)
                setCandForm({ name: '', contactEmail: '', contactPhone: '', qualification: '', resumeLink: '', yearsOfExperience: '3', currentOrganization: '', specialization: '', expectedSalary: '', appliedDate: new Date().toISOString().split('T')[0], workflowStatus: 'Requirement', roleApplied: '', department: 'SCIENCE', requirementId: '', schoolId: schoolId || (adminSchools.length === 1 ? adminSchools[0].id : '') })
                setShowCandModal(true)
              } else if (activeTab === 'appraisals') {
                setEditingApp(null)
                setAppForm({ teacherName: '', teacherEmail: '', department: 'Science', appraiserName: 'Head of Department', period: 'Annual', academicYear: '2025-2026', teachingRating: '5', punctualityRating: '5', studentFeedbackAverage: '4.8', overallRating: 'Excellent', remarksGoals: '', improvementAreas: '', reviewStatus: 'Pending', scheduledDate: new Date().toISOString().split('T')[0], isCompleted: false })
                setShowAppModal(true)
              } else {
                setEditingCand(null)
                setCandForm({ name: '', contactEmail: '', contactPhone: '', qualification: '', resumeLink: '', yearsOfExperience: '3', currentOrganization: '', specialization: '', expectedSalary: '', appliedDate: new Date().toISOString().split('T')[0], workflowStatus: 'Requirement', roleApplied: '', department: 'SCIENCE', requirementId: '', schoolId: schoolId || (adminSchools.length === 1 ? adminSchools[0].id : '') })
                setShowCandModal(true)
              }
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white font-semibold text-sm rounded-xl shadow-md transition-all transform active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>
              {activeTab === 'requirements' && 'Add Requirement'}
              {activeTab === 'appraisals' && 'New Appraisal'}
              {(activeTab === 'overview' || activeTab === 'candidates' || activeTab === 'audit') && 'Add Candidate'}
            </span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 p-2 bg-white rounded-2xl border border-slate-200 shadow-sm">
        {[
          { id: 'overview', label: 'Overview & Pipeline', icon: Columns },
          { id: 'requirements', label: 'Job Requirements', icon: Briefcase, count: requirements.length },
          { id: 'candidates', label: 'Candidates & Interviews', icon: Users, count: candidates.length },
          { id: 'appraisals', label: 'Teacher Appraisals', icon: Award, count: appraisals.length },
          { id: 'audit', label: 'Audit Logs', icon: Shield, count: auditLogs.length }
        ].map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2.5 px-5 py-3 rounded-xl font-semibold text-sm transition-all cursor-pointer ${
                isActive
                  ? 'bg-indigo-500 text-white shadow-sm hover:bg-indigo-600'
                  : 'bg-white text-slate-655 hover:bg-slate-50 hover:text-slate-800 border border-slate-200'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 text-slate-500 border border-slate-200/60'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* TAB CONTENT */}
      <AnimatePresence mode="wait">
        {/* 1. OVERVIEW & PIPELINE TAB */}
        {activeTab === 'overview' && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {(dashboardData?.kpis || []).map((kpi: any, idx: number) => {
                const iconMap: Record<string, any> = {
                  Briefcase,
                  Users,
                  Calendar,
                  Award,
                  CheckCircle
                }
                const KpiIcon = iconMap[kpi.icon] || Activity
                return (
                  <div
                    key={kpi.id || idx}
                    className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        {kpi.label}
                      </span>
                      <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100/60">
                        <KpiIcon className="w-5 h-5" />
                      </div>
                    </div>
                    <div className="mt-4">
                      <span className="text-3xl font-extrabold text-slate-900">
                        {kpi.value}
                      </span>
                    </div>
                    <div className="mt-3.5 flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-500">{kpi.change}</span>
                      <span className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        kpi.trend === 'up'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
                          : kpi.trend === 'down'
                          ? 'bg-rose-50 text-rose-700 border-rose-200/60'
                          : 'bg-slate-50 text-slate-650 border-slate-200/60'
                      }`}>
                        {kpi.trend === 'up' && <TrendingUp className="w-3 h-3 text-emerald-650" />}
                        {kpi.trend === 'down' && <AlertCircle className="w-3 h-3 text-rose-650" />}
                        {kpi.trend === 'neutral' && <Clock className="w-3 h-3 text-slate-400" />}
                        <span>{kpi.trend === 'up' ? 'Active' : kpi.trend === 'down' ? 'Action' : 'Stable'}</span>
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Kanban Pipeline Board */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center flex-wrap gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Hiring Pipeline Board</h2>
                    <p className="text-xs font-medium text-slate-500 mt-0.5">
                      Drag-free interactive workflow status across all candidate stages
                    </p>
                  </div>
                  {adminSchools.length > 0 && (
                    <select
                      value={schoolFilter}
                      onChange={e => setSchoolFilter(e.target.value)}
                      className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    >
                      <option value="ALL">All Schools ({adminSchools.length})</option>
                      {adminSchools.map((s: any) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  )}
                </div>
                <button
                  onClick={() => setActiveTab('candidates')}
                  className="text-sm font-bold text-indigo-600 hover:text-indigo-700 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>View All Candidates</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 overflow-x-auto pb-4">
                {stages.map(stage => {
                  const stageCandidates = candidates.filter(c => {
                    const matchStage = (c.workflowStatus || 'Requirement').toLowerCase() === stage.toLowerCase()
                    const matchSchool = schoolFilter === 'ALL' || c.schoolId === schoolFilter
                    return matchStage && matchSchool
                  })
                  return (
                    <div
                      key={stage}
                      className="bg-slate-50/70 rounded-2xl p-3 border border-slate-200 flex flex-col min-h-[440px] shadow-xs"
                    >
                      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200/80">
                        <span className="font-bold text-xs uppercase tracking-wider text-slate-700">
                          {stage}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                          {stageCandidates.length}
                        </span>
                      </div>

                      <div className="space-y-3 flex-1 overflow-y-auto max-h-[450px] pr-1">
                        {stageCandidates.length === 0 ? (
                          <div className="h-full flex flex-col items-center justify-center text-center p-4">
                            <p className="text-xs font-medium text-slate-400">No candidates in this stage</p>
                          </div>
                        ) : (
                          stageCandidates.map(cand => (
                            <div
                              key={cand.id || cand._id}
                              className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs hover:shadow-md transition-all group"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex items-center gap-2.5">
                                  <div className={`w-8 h-8 rounded-full font-bold text-xs flex items-center justify-center shadow-xs shrink-0 ${getAvatarColor(cand.name)}`}>
                                    {cand.avatarInitials || 'XX'}
                                  </div>
                                  <div>
                                    <h4 className="font-bold text-xs text-slate-800 group-hover:text-indigo-600 transition-colors tracking-tight">
                                      {cand.name}
                                    </h4>
                                    <p className="text-[10px] text-slate-500 mt-0.5 font-medium flex items-center gap-1.5 flex-wrap">
                                      <span>{cand.roleApplied || 'General'}</span>
                                      <span className="text-slate-300">•</span>
                                      <span className="px-1.5 py-0.2 bg-slate-50 border border-slate-200/60 rounded text-[9px] font-bold text-slate-500 uppercase">{cand.department || 'SCIENCE'}</span>
                                    </p>
                                    {getSchoolName(cand.schoolId) && (
                                      <div className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200/60 text-[10px] font-bold">
                                        <Building2 className="w-3 h-3 text-indigo-600 shrink-0" />
                                        <span className="truncate max-w-[130px]">{getSchoolName(cand.schoolId)}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <button
                                  onClick={() => setCandidateToDelete(cand)}
                                  className="p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors shrink-0"
                                  title="Delete Candidate"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>

                              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-slate-600">
                                <span className="flex items-center gap-1 text-slate-500">
                                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                                  {cand.yearsOfExperience} yrs exp
                                </span>
                                {cand.expectedSalary && (
                                  <span className="font-bold text-slate-700">
                                    {cand.expectedSalary.replace(/\$/g, '₹')}
                                  </span>
                                )}
                              </div>

                              {/* Stage shifter */}
                              <div className="mt-3 pt-2 border-t border-slate-100 flex flex-col gap-1">
                                <div className="relative w-full">
                                  <select
                                    value={cand.workflowStatus || 'Requirement'}
                                    onChange={e => handleUpdateCandidateStatus(cand, e.target.value)}
                                    className="w-full text-[10px] font-bold bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg pl-2 pr-6 py-1 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer appearance-none transition-all"
                                  >
                                    {stages.map(s => (
                                      <option key={s} value={s}>{s}</option>
                                    ))}
                                  </select>
                                  <ChevronDown className="w-3 h-3 text-slate-500 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </motion.div>
        )}

        {/* 2. JOB REQUIREMENTS TAB */}
        {activeTab === 'requirements' && (
          <motion.div
            key="requirements"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* Search & Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-3 justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search role, subject, department..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50/50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 placeholder:text-slate-400 font-medium transition-all"
                />
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
                  <Filter className="w-4 h-4 text-slate-500" />
                  <select
                    value={departmentFilter}
                    onChange={e => setDepartmentFilter(e.target.value)}
                    className="bg-transparent text-sm font-bold text-slate-800 focus:outline-none cursor-pointer"
                  >
                    <option value="ALL">All Departments</option>
                    <option value="SCIENCE">Science</option>
                    <option value="MATHEMATICS">Mathematics</option>
                    <option value="ENGLISH">English</option>
                    <option value="HUMANITIES">Humanities</option>
                    <option value="COMMERCE">Commerce</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Requirements Grid/List */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-700 text-xs font-bold uppercase tracking-wider">
                      <th className="p-4">Job Title & Program</th>
                      <th className="p-4">Department</th>
                      <th className="p-4">Experience & Qual</th>
                      <th className="p-4 text-center">Vacancies</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Posting / Closing</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {requirements
                      .filter(r => {
                        const matchSearch = (r.jobTitle || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (r.subjectProgram || '').toLowerCase().includes(searchTerm.toLowerCase())
                        const matchDept = departmentFilter === 'ALL' || (r.department || '').toUpperCase() === departmentFilter
                        return matchSearch && matchDept
                      })
                      .map(req => (
                        <tr key={req.id || req._id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-4 font-bold text-slate-900">
                            <div>{req.jobTitle}</div>
                            <div className="text-xs font-medium text-slate-500 mt-0.5">
                              {req.subjectProgram || 'General Faculty'}
                            </div>
                          </td>
                          <td className="p-4">
                            <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/50">
                              {req.department || 'SCIENCE'}
                            </span>
                          </td>
                          <td className="p-4 text-slate-700">
                            <div className="font-bold">{req.qualificationRequired}</div>
                            <div className="text-xs font-medium text-slate-500 mt-0.5">{req.experienceRequired}</div>
                          </td>
                          <td className="p-4 text-center font-extrabold text-slate-900">
                            {req.vacancies}
                          </td>
                          <td className="p-4">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                              (req.status || '').toLowerCase() === 'open'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
                                : 'bg-slate-50 text-slate-600 border-slate-200/60'
                            }`}>
                              {req.status || 'Open'}
                            </span>
                          </td>
                          <td className="p-4 text-xs font-medium text-slate-600">
                            <div>Posted: {formatDate(req.postingDate) || 'N/A'}</div>
                            {req.closingDate && <div>Closes: {formatDate(req.closingDate)}</div>}
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => {
                                  setEditingReq(req)
                                  setReqForm({
                                    jobTitle: req.jobTitle || '',
                                    subjectProgram: req.subjectProgram || '',
                                    department: req.department || 'SCIENCE',
                                    experienceRequired: req.experienceRequired || '3+ Years',
                                    qualificationRequired: req.qualificationRequired || "Master's Degree",
                                    vacancies: req.vacancies || 1,
                                    status: req.status || 'Open',
                                    postingDate: req.postingDate || '',
                                    closingDate: req.closingDate || ''
                                  })
                                  setShowReqModal(true)
                                }}
                                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-indigo-650 transition-colors cursor-pointer"
                                title="Edit Requirement"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteRequirement(req.id || req._id)}
                                className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-500 hover:text-rose-600 transition-colors cursor-pointer"
                                title="Delete Requirement"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    {requirements.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-8 text-center font-medium text-slate-500">
                          No job requirements found. Click "Add Requirement" to create your first vacancy.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* 3. CANDIDATES & INTERVIEWS TAB */}
        {activeTab === 'candidates' && (
          <motion.div
            key="candidates"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* Sub-tabs for Profiles vs Interviews */}
            <div className="flex justify-between items-center flex-wrap gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex gap-2 p-1.5 bg-slate-50 border border-slate-200 rounded-xl">
                <button
                  onClick={() => setCandidateSubTab('profiles')}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                    candidateSubTab === 'profiles'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  Candidate Profiles ({candidates.length})
                </button>
                <button
                  onClick={() => setCandidateSubTab('interviews')}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                    candidateSubTab === 'interviews'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  Interview Logistics & Evaluation ({interviews.length})
                </button>
              </div>

              {candidateSubTab === 'interviews' && (
                <button
                  onClick={() => {
                    setEditingInt(null)
                    setIntForm({
                      candidateId: candidates[0]?.id || '',
                      candidateName: candidates[0]?.name || '',
                      dateTime: new Date().toISOString().slice(0, 16),
                      mode: 'In-person',
                      locationOrLink: 'Conference Room 1',
                      feedbackText: '',
                      rating: 4,
                      finalResult: 'Pending',
                      interviewerName: 'Academic Panel'
                    })
                    setShowIntModal(true)
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-all text-sm"
                >
                  <Calendar className="w-4 h-4" />
                  <span>Schedule / Log Interview</span>
                </button>
              )}
            </div>

            {/* Candidate Profiles Sub-Tab */}
            {candidateSubTab === 'profiles' && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row gap-3 justify-between items-center bg-slate-50/50">
                  <div className="relative w-full sm:w-80">
                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search candidate name, role, email..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 rounded-xl bg-white border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder:text-slate-400 font-medium"
                    />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {adminSchools.length > 0 && (
                      <select
                        value={schoolFilter}
                        onChange={e => setSchoolFilter(e.target.value)}
                        className="bg-white px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      >
                        <option value="ALL">All Schools ({adminSchools.length})</option>
                        {adminSchools.map((s: any) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    )}
                    <select
                      value={statusFilter}
                      onChange={e => setStatusFilter(e.target.value)}
                      className="bg-white px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 focus:outline-none"
                    >
                      <option value="ALL">All Stages</option>
                      {stages.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 text-xs font-bold uppercase tracking-wider">
                        <th className="p-4">Candidate Profile</th>
                        <th className="p-4">Role & Department</th>
                        <th className="p-4">Experience & Org</th>
                        <th className="p-4">Expected Salary</th>
                        <th className="p-4">Resume</th>
                        <th className="p-4">Workflow Status</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {candidates
                        .filter(c => {
                          const matchSearch = (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (c.roleApplied || '').toLowerCase().includes(searchTerm.toLowerCase())
                          const matchStatus = statusFilter === 'ALL' || (c.workflowStatus || '').toLowerCase() === statusFilter.toLowerCase()
                          const matchSchool = schoolFilter === 'ALL' || c.schoolId === schoolFilter
                          return matchSearch && matchStatus && matchSchool
                        })
                        .map(cand => (
                          <tr key={cand.id || cand._id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold text-sm flex items-center justify-center shrink-0">
                                  {cand.avatarInitials || 'XX'}
                                </div>
                                <div>
                                  <div className="font-bold text-slate-900">{cand.name}</div>
                                  <div className="text-xs font-medium text-slate-500 mt-0.5">
                                    {cand.contactEmail || cand.contactPhone || 'No contact provided'}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="font-bold text-slate-900">{cand.roleApplied || 'General Faculty'}</div>
                              <div className="flex items-center gap-1.5 flex-wrap mt-1">
                                <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                  {cand.department || 'SCIENCE'}
                                </span>
                                {getSchoolName(cand.schoolId) && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                    <Building2 className="w-3 h-3 text-indigo-600" />
                                    <span>{getSchoolName(cand.schoolId)}</span>
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="p-4 text-slate-700">
                              <div className="font-bold">{cand.yearsOfExperience} yrs exp</div>
                              <div className="text-xs font-medium text-slate-500 mt-0.5">{cand.currentOrganization || 'N/A'}</div>
                            </td>
                            <td className="p-4 font-extrabold text-slate-900">
                              {cand.expectedSalary ? cand.expectedSalary.replace(/\$/g, '₹') : 'Negotiable'}
                            </td>
                            <td className="p-4">
                              {cand.resumeLink ? (
                                <a
                                  href={cand.resumeLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold text-xs transition-colors border border-blue-200"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  <span>View CV</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              ) : (
                                <span className="text-xs font-medium text-slate-400">No link</span>
                              )}
                            </td>
                            <td className="p-4">
                              <div className="relative inline-block w-40">
                                <select
                                  value={cand.workflowStatus || 'Requirement'}
                                  onChange={e => handleUpdateCandidateStatus(cand, e.target.value)}
                                  className="w-full text-xs font-bold pl-3 pr-8 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-900 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 appearance-none cursor-pointer transition-all"
                                >
                                  {stages.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                                <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                              </div>
                            </td>
                            <td className="p-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => {
                                    setEditingCand(cand)
                                    setCandForm({
                                      name: cand.name || '',
                                      contactEmail: cand.contactEmail || '',
                                      contactPhone: cand.contactPhone || '',
                                      qualification: cand.qualification || '',
                                      resumeLink: cand.resumeLink || '',
                                      yearsOfExperience: cand.yearsOfExperience || '3',
                                      currentOrganization: cand.currentOrganization || '',
                                      specialization: cand.specialization || '',
                                      expectedSalary: cand.expectedSalary || '',
                                      appliedDate: cand.appliedDate || '',
                                      workflowStatus: cand.workflowStatus || 'Requirement',
                                      roleApplied: cand.roleApplied || '',
                                      department: cand.department || 'SCIENCE',
                                      requirementId: cand.requirementId || '',
                                      schoolId: cand.schoolId || ''
                                    })
                                    setShowCandModal(true)
                                  }}
                                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-700 hover:text-blue-600 transition-colors"
                                  title="Edit Profile"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setCandidateToDelete(cand)}
                                  className="p-1.5 rounded-lg hover:bg-red-50 text-slate-700 hover:text-red-600 transition-colors"
                                  title="Delete Profile"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      {candidates.length === 0 && (
                        <tr>
                          <td colSpan={7} className="p-8 text-center font-medium text-slate-500">
                            No candidate profiles found. Click "Add Candidate" to get started.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Interview Logistics & Evaluation Sub-Tab */}
            {candidateSubTab === 'interviews' && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 text-xs font-bold uppercase tracking-wider">
                        <th className="p-4">Candidate & Panel</th>
                        <th className="p-4">Date & Mode</th>
                        <th className="p-4">Location / Link</th>
                        <th className="p-4">Rating</th>
                        <th className="p-4">Feedback Evaluation</th>
                        <th className="p-4">Final Result</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {interviews.map(int => (
                        <tr key={int.id || int._id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-4 font-bold text-slate-900">
                            <div>{int.candidateName || 'Unknown Candidate'}</div>
                            <div className="text-xs font-medium text-slate-500 mt-0.5">
                              Panel: {int.interviewerName || 'Academic Panel'}
                            </div>
                          </td>
                          <td className="p-4 text-slate-800">
                            <div className="font-bold">{int.dateTime || 'Not scheduled'}</div>
                            <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[11px] font-bold ${
                              int.mode === 'Online'
                                ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                : 'bg-blue-100 text-blue-800 border border-blue-200'
                            }`}>
                              {int.mode || 'In-person'}
                            </span>
                          </td>
                          <td className="p-4 text-xs font-semibold text-slate-700 max-w-[200px] truncate">
                            {int.locationOrLink || 'N/A'}
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-1 text-amber-500">
                              {[1, 2, 3, 4, 5].map(star => (
                                <Star
                                  key={star}
                                  className={`w-4 h-4 ${star <= (int.rating || 3) ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`}
                                />
                              ))}
                            </div>
                          </td>
                          <td className="p-4 text-xs font-medium text-slate-700 max-w-[250px]">
                            <p className="line-clamp-2">{int.feedbackText || 'No feedback recorded yet.'}</p>
                          </td>
                          <td className="p-4">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                              int.finalResult === 'Offer' || int.finalResult === 'Pass'
                                ? 'bg-emerald-100 text-emerald-800'
                                : int.finalResult === 'Fail'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}>
                              {int.finalResult || 'Pending'}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => {
                                  setEditingInt(int)
                                  setIntForm({
                                    candidateId: int.candidateId || '',
                                    candidateName: int.candidateName || '',
                                    dateTime: int.dateTime || '',
                                    mode: int.mode || 'In-person',
                                    locationOrLink: int.locationOrLink || '',
                                    feedbackText: int.feedbackText || '',
                                    rating: int.rating || 4,
                                    finalResult: int.finalResult || 'Pending',
                                    interviewerName: int.interviewerName || 'Panel'
                                  })
                                  setShowIntModal(true)
                                }}
                                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-700 hover:text-blue-600 transition-colors"
                                title="Edit Interview"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteInterview(int.id || int._id)}
                                className="p-1.5 rounded-lg hover:bg-red-50 text-slate-700 hover:text-red-600 transition-colors"
                                title="Delete Interview"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {interviews.length === 0 && (
                        <tr>
                          <td colSpan={7} className="p-8 text-center font-medium text-slate-500">
                            No interview evaluations recorded yet. Click "Schedule / Log Interview" to add one.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* 4. TEACHER APPRAISALS TAB */}
        {activeTab === 'appraisals' && (
          <motion.div
            key="appraisals"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* Search & Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-3 justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search teacher, appraiser, department..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder:text-slate-400 font-medium"
                />
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
                  <Filter className="w-4 h-4 text-slate-500" />
                  <select
                    value={departmentFilter}
                    onChange={e => setDepartmentFilter(e.target.value)}
                    className="bg-transparent text-sm font-bold text-slate-800 focus:outline-none"
                  >
                    <option value="ALL">All Departments</option>
                    <option value="Science">Science</option>
                    <option value="Mathematics">Mathematics</option>
                    <option value="English">English</option>
                    <option value="Humanities">Humanities</option>
                    <option value="Commerce">Commerce</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Appraisals Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {appraisals
                .filter(a => {
                  const matchSearch = (a.teacherName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                    (a.appraiserName || '').toLowerCase().includes(searchTerm.toLowerCase())
                  const matchDept = departmentFilter === 'ALL' || (a.department || '').toLowerCase() === departmentFilter.toLowerCase()
                  return matchSearch && matchDept
                })
                .map(app => (
                  <div
                    key={app.id || app._id}
                    className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-purple-600 text-white font-bold text-base flex items-center justify-center shadow-md shrink-0">
                            {app.avatarInitials || 'XX'}
                          </div>
                          <div>
                            <h3 className="font-bold text-base text-slate-900">{app.teacherName}</h3>
                            <p className="text-xs font-medium text-slate-500">
                              {app.department || 'Science'} • {app.academicYear || '2025-2026'}
                            </p>
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          app.overallRating === 'Excellent' || app.overallRating === '5'
                            ? 'bg-emerald-100 text-emerald-800'
                            : app.overallRating === 'Good' || app.overallRating === '4'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {app.overallRating || 'Excellent'}
                        </span>
                      </div>

                      <div className="mt-5 grid grid-cols-3 gap-2 py-3 px-4 bg-slate-50 rounded-xl border border-slate-200 text-center">
                        <div>
                          <div className="text-[11px] font-semibold text-slate-500">Teaching</div>
                          <div className="font-extrabold text-sm text-slate-900 mt-0.5">{app.teachingRating}/5</div>
                        </div>
                        <div className="border-x border-slate-200">
                          <div className="text-[11px] font-semibold text-slate-500">Punctuality</div>
                          <div className="font-extrabold text-sm text-slate-900 mt-0.5">{app.punctualityRating}/5</div>
                        </div>
                        <div>
                          <div className="text-[11px] font-semibold text-slate-500">Student Avg</div>
                          <div className="font-extrabold text-sm text-blue-600 mt-0.5">{app.studentFeedbackAverage}</div>
                        </div>
                      </div>

                      <div className="mt-4 space-y-2 text-xs text-slate-700">
                        <div>
                          <span className="font-bold text-slate-900">Remarks & Goals: </span>
                          <span className="line-clamp-2 font-medium">{app.remarksGoals || 'No remarks recorded.'}</span>
                        </div>
                        {app.improvementAreas && (
                          <div>
                            <span className="font-bold text-slate-900">Improvement Areas: </span>
                            <span className="line-clamp-1 font-semibold text-amber-700">{app.improvementAreas}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                      <div className="text-xs font-medium text-slate-500">
                        Appraiser: <span className="font-bold text-slate-800">{app.appraiserName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setEditingApp(app)
                            setAppForm({
                              teacherName: app.teacherName || '',
                              teacherEmail: app.teacherEmail || '',
                              department: app.department || 'Science',
                              appraiserName: app.appraiserName || 'Head of Department',
                              period: app.period || 'Annual',
                              academicYear: app.academicYear || '2025-2026',
                              teachingRating: app.teachingRating || '5',
                              punctualityRating: app.punctualityRating || '5',
                              studentFeedbackAverage: app.studentFeedbackAverage || '4.8',
                              overallRating: app.overallRating || 'Excellent',
                              remarksGoals: app.remarksGoals || '',
                              improvementAreas: app.improvementAreas || '',
                              reviewStatus: app.reviewStatus || 'Pending',
                              scheduledDate: app.scheduledDate || '',
                              isCompleted: Boolean(app.isCompleted)
                            })
                            setShowAppModal(true)
                          }}
                          className="p-2 rounded-xl bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-600 transition-colors border border-slate-200"
                          title="Edit Appraisal"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteAppraisal(app.id || app._id)}
                          className="p-2 rounded-xl bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-red-600 transition-colors border border-slate-200"
                          title="Delete Appraisal"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              {appraisals.length === 0 && (
                <div className="col-span-full bg-white p-12 rounded-2xl text-center border border-slate-200 text-slate-500 font-medium">
                  No teacher appraisals found. Click "New Appraisal" to begin performance review cycles.
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* 5. AUDIT LOGS TAB */}
        {activeTab === 'audit' && (
          <motion.div
            key="audit"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-blue-600" />
                    <span>Immutable System Audit Trail</span>
                  </h2>
                  <p className="text-xs font-medium text-slate-500 mt-0.5">
                    Real-time monitoring of all recruitment and appraisal database mutations
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200">
                  {auditLogs.length} Events Logged
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 text-xs font-bold uppercase tracking-wider">
                      <th className="p-4">Action Type</th>
                      <th className="p-4">Table & Record ID</th>
                      <th className="p-4">Author</th>
                      <th className="p-4">IP Address & Agent</th>
                      <th className="p-4">Timestamp</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {auditLogs.map(log => (
                      <tr key={log.id || log._id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-4 font-bold">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                            log.userActionType?.startsWith('CREATE')
                              ? 'bg-emerald-100 text-emerald-800'
                              : log.userActionType?.startsWith('DELETE')
                              ? 'bg-red-100 text-red-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {log.userActionType}
                          </span>
                        </td>
                        <td className="p-4 text-slate-800 font-mono text-xs font-semibold">
                          <div>{log.tableName}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[150px]">{log.recordId}</div>
                        </td>
                        <td className="p-4">
                          <div className="font-bold text-slate-900">{log.authorName}</div>
                          <div className="text-xs font-medium text-slate-500">{log.authorRole}</div>
                        </td>
                        <td className="p-4 text-xs font-medium text-slate-700">
                          <div className="font-mono">{log.ipAddress}</div>
                          <div className="text-[10px] truncate max-w-[180px] text-slate-500">{log.userAgent}</div>
                        </td>
                        <td className="p-4 text-xs font-semibold text-slate-600">
                          {formatDateTime(log.timestamp)}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setSelectedAudit(log)
                                setShowDiffModal(true)
                              }}
                              className="p-2 rounded-xl bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 transition-colors inline-flex items-center gap-1 text-xs font-bold border border-slate-200"
                              title="Inspect Diffs"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Diffs</span>
                            </button>
                            <button
                              onClick={() => {
                                setEditingAudit(log)
                                setAuditForm({
                                  userActionType: log.userActionType || '',
                                  tableName: log.tableName || '',
                                  recordId: log.recordId || '',
                                  authorName: log.authorName || '',
                                  authorRole: log.authorRole || '',
                                  oldValues: log.oldValues || '',
                                  newValues: log.newValues || ''
                                })
                                setShowAuditEditModal(true)
                              }}
                              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-700 hover:text-blue-600 transition-colors"
                              title="Edit Audit Log Entry"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteAuditLog(log.id || log._id)}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-slate-700 hover:text-red-600 transition-colors"
                              title="Delete Audit Log Entry"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {auditLogs.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-8 text-center font-medium text-slate-500">
                          No audit logs recorded yet. Any create, update, or delete action will appear here in real time.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODALS */}
      {/* 1. Job Requirement Modal */}
      <AnimatePresence>
        {showReqModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-xl rounded-2xl p-6 shadow-2xl border border-slate-200 space-y-4"
            >
              <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                <h3 className="text-lg font-bold text-slate-900">
                  {editingReq ? 'Edit Job Requirement' : 'Add New Job Requirement'}
                </h3>
                <button onClick={() => setShowReqModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveRequirement} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Job Title *</label>
                    <input
                      type="text"
                      required
                      value={reqForm.jobTitle}
                      onChange={e => setReqForm({ ...reqForm, jobTitle: e.target.value })}
                      placeholder="e.g. Senior Physics Teacher"
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-50/50 hover:bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 font-medium transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Subject / Program *</label>
                    <input
                      type="text"
                      required
                      value={reqForm.subjectProgram}
                      onChange={e => setReqForm({ ...reqForm, subjectProgram: e.target.value })}
                      placeholder="e.g. High School Physics"
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-50/50 hover:bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 font-medium transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Department</label>
                    <select
                      value={reqForm.department}
                      onChange={e => setReqForm({ ...reqForm, department: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-50/50 hover:bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 font-bold transition-all cursor-pointer"
                    >
                      <option value="SCIENCE">Science</option>
                      <option value="MATHEMATICS">Mathematics</option>
                      <option value="ENGLISH">English</option>
                      <option value="HUMANITIES">Humanities</option>
                      <option value="COMMERCE">Commerce</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Vacancies</label>
                    <input
                      type="number"
                      min="1"
                      value={reqForm.vacancies}
                      onChange={e => setReqForm({ ...reqForm, vacancies: Number(e.target.value) })}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-50/50 hover:bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 font-bold transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Status</label>
                    <select
                      value={reqForm.status}
                      onChange={e => setReqForm({ ...reqForm, status: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-50/50 hover:bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 font-bold transition-all cursor-pointer"
                    >
                      <option value="Open">Open</option>
                      <option value="Closed">Closed</option>
                      <option value="Draft">Draft</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Experience Required</label>
                    <input
                      type="text"
                      value={reqForm.experienceRequired}
                      onChange={e => setReqForm({ ...reqForm, experienceRequired: e.target.value })}
                      placeholder="e.g. 3+ Years in CBSE/IB"
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-50/50 hover:bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 font-medium transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Qualification Required</label>
                    <input
                      type="text"
                      value={reqForm.qualificationRequired}
                      onChange={e => setReqForm({ ...reqForm, qualificationRequired: e.target.value })}
                      placeholder="e.g. M.Sc Physics + B.Ed"
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-50/50 hover:bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 font-medium transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Posting Date</label>
                    <input
                      type="date"
                      value={reqForm.postingDate}
                      onChange={e => setReqForm({ ...reqForm, postingDate: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-50/50 hover:bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 font-medium transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Closing Date (Optional)</label>
                    <input
                      type="date"
                      value={reqForm.closingDate}
                      onChange={e => setReqForm({ ...reqForm, closingDate: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-50/50 hover:bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 font-medium transition-all"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setShowReqModal(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-sm font-semibold cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold shadow-md cursor-pointer transition-all transform active:scale-95"
                  >
                    Save Requirement
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. Candidate Profile Modal */}
      <AnimatePresence>
        {showCandModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-2xl rounded-2xl p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                <h3 className="text-lg font-bold text-slate-900">
                  {editingCand ? 'Edit Candidate Profile' : 'Add New Candidate Profile'}
                </h3>
                <button onClick={() => setShowCandModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveCandidate} className="space-y-4">
                {/* Target School Selection */}
                <div className="bg-indigo-50/60 p-4 rounded-xl border border-indigo-100 shadow-xs">
                  <label className="block text-xs font-bold text-indigo-900 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-indigo-600" />
                    <span>Target School * (Connected to {adminSchools.length} school{adminSchools.length === 1 ? '' : 's'} you manage)</span>
                  </label>
                  <select
                    value={candForm.schoolId}
                    onChange={e => setCandForm({ ...candForm, schoolId: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-indigo-200/80 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 font-bold transition-all cursor-pointer shadow-sm"
                  >
                    <option value="">-- General / All Schools --</option>
                    {adminSchools.map((s: any) => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.board ? `(${s.board})` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-indigo-700/80 mt-1.5 font-medium flex items-center gap-1">
                    <span>💡 Admin can select from the schools connected to their account.</span>
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={candForm.name}
                      onChange={e => setCandForm({ ...candForm, name: e.target.value })}
                      placeholder="e.g. Dr. Sarah Jenkins"
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-50/50 hover:bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 font-medium transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Role Applied *</label>
                    <input
                      type="text"
                      required
                      value={candForm.roleApplied}
                      onChange={e => setCandForm({ ...candForm, roleApplied: e.target.value })}
                      placeholder="e.g. Physics Faculty"
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-50/50 hover:bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 font-medium transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Email Address</label>
                    <input
                      type="email"
                      value={candForm.contactEmail}
                      onChange={e => setCandForm({ ...candForm, contactEmail: e.target.value })}
                      placeholder="sarah.j@example.com"
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-50/50 hover:bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 font-medium transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Phone Number</label>
                    <input
                      type="text"
                      value={candForm.contactPhone}
                      onChange={e => setCandForm({ ...candForm, contactPhone: e.target.value })}
                      placeholder="+1 (555) 019-2834"
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-50/50 hover:bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 font-medium transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Department</label>
                    <select
                      value={candForm.department}
                      onChange={e => setCandForm({ ...candForm, department: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-50/50 hover:bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 font-bold transition-all cursor-pointer"
                    >
                      <option value="SCIENCE">Science</option>
                      <option value="MATHEMATICS">Mathematics</option>
                      <option value="ENGLISH">English</option>
                      <option value="HUMANITIES">Humanities</option>
                      <option value="COMMERCE">Commerce</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Experience (Years)</label>
                    <input
                      type="text"
                      value={candForm.yearsOfExperience}
                      onChange={e => setCandForm({ ...candForm, yearsOfExperience: e.target.value })}
                      placeholder="5"
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-50/50 hover:bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 font-medium transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Workflow Status</label>
                    <select
                      value={candForm.workflowStatus}
                      onChange={e => setCandForm({ ...candForm, workflowStatus: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-50/50 hover:bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 font-bold transition-all cursor-pointer"
                    >
                      {stages.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Qualification</label>
                    <input
                      type="text"
                      value={candForm.qualification}
                      onChange={e => setCandForm({ ...candForm, qualification: e.target.value })}
                      placeholder="Ph.D in Applied Physics"
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-50/50 hover:bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 font-medium transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Current Organization</label>
                    <input
                      type="text"
                      value={candForm.currentOrganization}
                      onChange={e => setCandForm({ ...candForm, currentOrganization: e.target.value })}
                      placeholder="St. Jude International School"
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-50/50 hover:bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 font-medium transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Expected Salary</label>
                    <input
                      type="text"
                      value={candForm.expectedSalary}
                      onChange={e => setCandForm({ ...candForm, expectedSalary: e.target.value })}
                      placeholder="₹75,000 / yr"
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-50/50 hover:bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 font-medium transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Resume / CV Link (URL)</label>
                    <input
                      type="url"
                      value={candForm.resumeLink}
                      onChange={e => setCandForm({ ...candForm, resumeLink: e.target.value })}
                      placeholder="https://drive.google.com/..."
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-50/50 hover:bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 font-medium transition-all"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setShowCandModal(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-sm font-semibold cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold shadow-md cursor-pointer transition-all transform active:scale-95"
                  >
                    Save Candidate
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 3. Interview Schedule Modal */}
      <AnimatePresence>
        {showIntModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-lg rounded-2xl p-6 shadow-2xl border border-slate-200 space-y-4"
            >
              <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                <h3 className="text-lg font-bold text-slate-900">
                  {editingInt ? 'Edit Interview Evaluation' : 'Schedule / Log Interview'}
                </h3>
                <button onClick={() => setShowIntModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveInterview} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Select Candidate *</label>
                  <select
                    required
                    value={intForm.candidateId}
                    onChange={e => {
                      const sel = candidates.find(c => (c.id || c._id) === e.target.value)
                      setIntForm({
                        ...intForm,
                        candidateId: e.target.value,
                        candidateName: sel?.name || e.target.value
                      })
                    }}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50/50 hover:bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 font-bold transition-all cursor-pointer"
                  >
                    <option value="">-- Select Candidate --</option>
                    {candidates.map(c => (
                      <option key={c.id || c._id} value={c.id || c._id}>{c.name} ({c.roleApplied})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Date & Time *</label>
                    <input
                      type="text"
                      required
                      value={intForm.dateTime}
                      onChange={e => setIntForm({ ...intForm, dateTime: e.target.value })}
                      placeholder="e.g. July 12, 2026 10:00 AM"
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-50/50 hover:bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 font-medium transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Interview Mode</label>
                    <select
                      value={intForm.mode}
                      onChange={e => setIntForm({ ...intForm, mode: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-50/50 hover:bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 font-bold transition-all cursor-pointer"
                    >
                      <option value="In-person">In-person</option>
                      <option value="Online">Online (Zoom / Meet)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Location / Link</label>
                    <input
                      type="text"
                      value={intForm.locationOrLink}
                      onChange={e => setIntForm({ ...intForm, locationOrLink: e.target.value })}
                      placeholder="Room 4B / Meet Link"
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-50/50 hover:bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 font-medium transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Interviewer Panel</label>
                    <input
                      type="text"
                      value={intForm.interviewerName}
                      onChange={e => setIntForm({ ...intForm, interviewerName: e.target.value })}
                      placeholder="Dr. Kumar & Prof. Sharma"
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-50/50 hover:bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 font-medium transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Evaluation Rating (1-5)</label>
                    <select
                      value={intForm.rating}
                      onChange={e => setIntForm({ ...intForm, rating: Number(e.target.value) })}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-50/50 hover:bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 font-bold transition-all cursor-pointer"
                    >
                      <option value={5}>⭐⭐⭐⭐⭐ (5 - Exceptional)</option>
                      <option value={4}>⭐⭐⭐⭐ (4 - Very Good)</option>
                      <option value={3}>⭐⭐⭐ (3 - Satisfactory)</option>
                      <option value={2}>⭐⭐ (2 - Below Avg)</option>
                      <option value={1}>⭐ (1 - Poor)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Final Result</label>
                    <select
                      value={intForm.finalResult}
                      onChange={e => setIntForm({ ...intForm, finalResult: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-50/50 hover:bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 font-extrabold transition-all cursor-pointer"
                    >
                      <option value="Pending">Pending</option>
                      <option value="Pass">Pass / Shortlisted</option>
                      <option value="Offer">Offer Recommended</option>
                      <option value="Hold">On Hold</option>
                      <option value="Fail">Fail / Rejected</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Feedback & Notes</label>
                  <textarea
                    rows={3}
                    value={intForm.feedbackText}
                    onChange={e => setIntForm({ ...intForm, feedbackText: e.target.value })}
                    placeholder="Excellent subject mastery, strong classroom communication..."
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50/50 hover:bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 font-medium transition-all"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setShowIntModal(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-sm font-semibold cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold shadow-md cursor-pointer transition-all transform active:scale-95"
                  >
                    Save Interview
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 4. Teacher Appraisal Modal */}
      <AnimatePresence>
        {showAppModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-xl rounded-2xl p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                <h3 className="text-lg font-bold text-slate-900">
                  {editingApp ? 'Edit Teacher Appraisal' : 'Start New Teacher Appraisal'}
                </h3>
                <button onClick={() => setShowAppModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveAppraisal} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Teacher Name *</label>
                    <input
                      type="text"
                      required
                      value={appForm.teacherName}
                      onChange={e => setAppForm({ ...appForm, teacherName: e.target.value })}
                      placeholder="e.g. Prof. Alan Turing"
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-50/50 hover:bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 font-medium transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Department</label>
                    <select
                      value={appForm.department}
                      onChange={e => setAppForm({ ...appForm, department: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-50/50 hover:bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 font-bold transition-all cursor-pointer"
                    >
                      <option value="Science">Science</option>
                      <option value="Mathematics">Mathematics</option>
                      <option value="English">English</option>
                      <option value="Humanities">Humanities</option>
                      <option value="Commerce">Commerce</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Period</label>
                    <select
                      value={appForm.period}
                      onChange={e => setAppForm({ ...appForm, period: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-50/50 hover:bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 font-bold transition-all cursor-pointer"
                    >
                      <option value="Annual">Annual</option>
                      <option value="Mid-Term">Mid-Term</option>
                      <option value="Probation">Probation Review</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Academic Year</label>
                    <input
                      type="text"
                      value={appForm.academicYear}
                      onChange={e => setAppForm({ ...appForm, academicYear: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-50/50 hover:bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 font-medium transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Review Status</label>
                    <select
                      value={appForm.reviewStatus}
                      onChange={e => setAppForm({ ...appForm, reviewStatus: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-50/50 hover:bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 font-bold transition-all cursor-pointer"
                    >
                      <option value="Pending">Pending</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Teaching (1-5)</label>
                    <input
                      type="text"
                      value={appForm.teachingRating}
                      onChange={e => setAppForm({ ...appForm, teachingRating: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-sm font-extrabold text-center text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Punctuality (1-5)</label>
                    <input
                      type="text"
                      value={appForm.punctualityRating}
                      onChange={e => setAppForm({ ...appForm, punctualityRating: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-sm font-extrabold text-center text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Student Avg</label>
                    <input
                      type="text"
                      value={appForm.studentFeedbackAverage}
                      onChange={e => setAppForm({ ...appForm, studentFeedbackAverage: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-sm font-extrabold text-center text-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Overall Badge</label>
                    <select
                      value={appForm.overallRating}
                      onChange={e => setAppForm({ ...appForm, overallRating: e.target.value })}
                      className="w-full px-2 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
                    >
                      <option value="Excellent">Excellent</option>
                      <option value="Good">Good</option>
                      <option value="Satisfactory">Satisfactory</option>
                      <option value="Needs Improvement">Needs Impr.</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Remarks & Performance Goals</label>
                  <textarea
                    rows={3}
                    value={appForm.remarksGoals}
                    onChange={e => setAppForm({ ...appForm, remarksGoals: e.target.value })}
                    placeholder="Consistently achieves top exam results. Goal: Lead STEM curriculum revision."
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50/50 hover:bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 font-medium transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Improvement Areas</label>
                  <input
                    type="text"
                    value={appForm.improvementAreas}
                    onChange={e => setAppForm({ ...appForm, improvementAreas: e.target.value })}
                    placeholder="e.g. Integrate more digital labs in coursework"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50/50 hover:bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 font-medium transition-all"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setShowAppModal(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-sm font-semibold cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold shadow-md cursor-pointer transition-all transform active:scale-95"
                  >
                    Save Appraisal
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5. Audit Log Diffs Inspector Modal */}
      <AnimatePresence>
        {showDiffModal && selectedAudit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-2xl rounded-2xl p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[85vh] overflow-y-auto font-mono text-xs"
            >
              <div className="flex justify-between items-center border-b border-slate-200 pb-3 font-sans">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-indigo-600" />
                    <span>Audit Event Diff Inspector</span>
                  </h3>
                  <p className="text-xs font-medium text-slate-500 mt-0.5">
                    {selectedAudit.userActionType} on {selectedAudit.tableName}
                  </p>
                </div>
                <button onClick={() => setShowDiffModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <span className="font-sans font-bold text-slate-800">Previous Values (Old):</span>
                  <pre className="mt-1 p-3 rounded-xl bg-slate-50 overflow-x-auto text-slate-900 border border-slate-200/60 font-semibold">
                    {selectedAudit.oldValues ? JSON.stringify(JSON.parse(selectedAudit.oldValues || '{}'), null, 2) : 'None (Created)'}
                  </pre>
                </div>

                <div>
                  <span className="font-sans font-bold text-slate-800">New Values (Modified):</span>
                  <pre className="mt-1 p-3 rounded-xl bg-emerald-50 overflow-x-auto text-emerald-950 border border-emerald-200/60 font-semibold">
                    {selectedAudit.newValues ? JSON.stringify(JSON.parse(selectedAudit.newValues || '{}'), null, 2) : 'None (Deleted)'}
                  </pre>
                </div>
              </div>

              <div className="flex justify-end pt-3 border-t border-slate-200 font-sans">
                <button
                  onClick={() => setShowDiffModal(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-sm font-bold border border-slate-200/60 cursor-pointer transition-all active:scale-95"
                >
                  Close Inspector
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 6. Audit Log Edit Modal */}
      <AnimatePresence>
        {showAuditEditModal && editingAudit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-lg rounded-2xl p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Edit className="w-5 h-5 text-indigo-600" />
                  <span>Edit Audit Log Entry</span>
                </h3>
                <button onClick={() => setShowAuditEditModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveAuditLog} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Action Type *</label>
                    <input
                      type="text"
                      required
                      value={auditForm.userActionType}
                      onChange={e => setAuditForm({ ...auditForm, userActionType: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-50/50 hover:bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Table Name *</label>
                    <input
                      type="text"
                      required
                      value={auditForm.tableName}
                      onChange={e => setAuditForm({ ...auditForm, tableName: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-50/50 hover:bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 font-medium"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Record ID</label>
                    <input
                      type="text"
                      value={auditForm.recordId}
                      onChange={e => setAuditForm({ ...auditForm, recordId: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-50/50 hover:bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 font-medium font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Author Name *</label>
                    <input
                      type="text"
                      required
                      value={auditForm.authorName}
                      onChange={e => setAuditForm({ ...auditForm, authorName: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-50/50 hover:bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Author Role *</label>
                    <input
                      type="text"
                      required
                      value={auditForm.authorRole}
                      onChange={e => setAuditForm({ ...auditForm, authorRole: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-50/50 hover:bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Old Values (JSON / Text)</label>
                  <textarea
                    rows={3}
                    value={auditForm.oldValues}
                    onChange={e => setAuditForm({ ...auditForm, oldValues: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50/50 hover:bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">New Values (JSON / Text)</label>
                  <textarea
                    rows={3}
                    value={auditForm.newValues}
                    onChange={e => setAuditForm({ ...auditForm, newValues: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50/50 hover:bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 font-mono"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setShowAuditEditModal(false)}
                    className="px-5 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-sm font-bold border border-slate-200/60 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-md transition-all cursor-pointer"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Delete Candidate Confirmation Modal */}
      <AnimatePresence>
        {candidateToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl border border-slate-200 text-center space-y-4"
            >
              <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-2">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Delete Candidate?</h3>
              <p className="text-sm font-medium text-slate-500">
                Are you sure you want to permanently remove <span className="text-slate-800 font-bold">{candidateToDelete.name}</span> from the system? This action cannot be undone.
              </p>
              <div className="flex justify-center gap-3 pt-4">
                <button
                  onClick={() => setCandidateToDelete(null)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-sm font-semibold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteCandidate(candidateToDelete.id || candidateToDelete._id)}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold shadow-md cursor-pointer transition-all transform active:scale-95"
                >
                  Yes, Delete Candidate
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default RecruitmentView
