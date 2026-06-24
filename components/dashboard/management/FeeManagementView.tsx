'use client'

import { useState, useEffect } from 'react'
import { useAlert } from '@/components/dashboard/AlertProvider'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  CreditCard, 
  Calendar, 
  AlertTriangle, 
  Search, 
  Plus, 
  Filter, 
  Edit2, 
  Trash2, 
  X, 
  TrendingUp, 
  DollarSign, 
  CheckCircle,
  HelpCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  RefreshCw
} from 'lucide-react'

// Formatting helper for currency in INR
function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount)
}

export default function FeeManagementView() {
  const { showAlert } = useAlert()
  // Tabs: 'structure' or 'payments'
  const [activeTab, setActiveTab] = useState<'structure' | 'payments'>('structure')

  // Data states
  const [stats, setStats] = useState({
    totalCollectedThisMonth: 450000,
    pendingDues: 120000,
    activeStudentsWithDuesCount: 45,
    overdueAccounts: 18,
    collectionRate: 78
  })
  const [feeTypes, setFeeTypes] = useState<any[]>([])
  const [paymentRecords, setPaymentRecords] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])
  
  // Loading and action states
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  
  // Modal states
  const [showFeeModal, setShowFeeModal] = useState(false)
  const [editingFee, setEditingFee] = useState<any>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)

  // Form states
  const [feeForm, setFeeForm] = useState({
    name: '',
    description: '',
    programBatch: '',
    amount: '',
    frequency: 'Monthly',
    academicYear: '2024-25'
  })

  const [paymentForm, setPaymentForm] = useState({
    studentId: '',
    feeTypeId: '',
    amount: '',
    paymentMethod: 'UPI',
    transactionId: '',
    dueDate: ''
  })

  // Pagination states
  const [feePage, setFeePage] = useState(1)
  const [paymentPage, setPaymentPage] = useState(1)
  const itemsPerPage = 5

  // Fetch all necessary data from APIs
  async function fetchData() {
    try {
      setLoading(true)
      // 1. Fetch stats
      const statsRes = await fetch('/api/fees/stats')
      const statsData = await statsRes.json()
      if (!statsData.error) {
        setStats(statsData)
      }

      // 2. Fetch structures
      const structuresRes = await fetch('/api/fees/structures')
      const structuresData = await structuresRes.json()
      if (!structuresData.error) {
        setFeeTypes(structuresData)
      }

      // 3. Fetch payment records
      const paymentsRes = await fetch('/api/fees/payments')
      const paymentsData = await paymentsRes.json()
      if (!paymentsData.error) {
        setPaymentRecords(paymentsData)
      }

      // 4. Fetch students (for dropdown in payment modal)
      const studentsRes = await fetch('/api/students')
      const studentsData = await studentsRes.json()
      if (!studentsData.error) {
        setStudents(studentsData)
      }
    } catch (err) {
      console.error('Error fetching fee data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Submit fee helper to support retry
  async function submitFee(payload: any, editingFeeId?: string) {
    setActionLoading(true)
    try {
      const url = editingFeeId 
        ? `/api/fees/structures?id=${editingFeeId}`
        : '/api/fees/structures'
      const method = editingFeeId ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (!data.error) {
        setShowFeeModal(false)
        setEditingFee(null)
        setFeeForm({
          name: '',
          description: '',
          programBatch: '',
          amount: '',
          frequency: 'Monthly',
          academicYear: '2024-25'
        })
        fetchData()
      } else {
        showAlert({
          title: editingFeeId ? 'Failed to Update Fee Structure' : 'Failed to Create Fee Structure',
          message: data.error,
          type: 'warning',
          onRetry: () => submitFee(payload, editingFeeId)
        })
      }
    } catch (err) {
      console.error(err)
      showAlert({
        title: 'Error Saving Fee Structure',
        message: 'Network error. Could not save fee structure.',
        type: 'warning',
        onRetry: () => submitFee(payload, editingFeeId)
      })
    } finally {
      setActionLoading(false)
    }
  }

  // Handle Fee Structure Form Submit (Create or Update)
  async function handleFeeSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!feeForm.name || !feeForm.programBatch || !feeForm.amount) return

    const payload = {
      ...feeForm,
      amount: Number(feeForm.amount)
    }
    await submitFee(payload, editingFee?._id)
  }

  // Delete fee structure helper to support retry
  async function deleteFee(id: string) {
    try {
      const res = await fetch(`/api/fees/structures?id=${id}`, {
        method: 'DELETE'
      })
      const data = await res.json()
      if (!data.error) {
        fetchData()
      } else {
        const fee = feeTypes.find(f => f._id === id)
        const feeName = fee ? fee.name : 'fee structure'
        showAlert({
          title: 'Failed to Delete Fee Structure',
          message: `Could not delete ${feeName}. ${data.error}`,
          type: 'trash',
          onRetry: () => deleteFee(id)
        })
      }
    } catch (err) {
      console.error(err)
      showAlert({
        title: 'Error Deleting Fee Structure',
        message: 'Network error. Could not delete fee structure.',
        type: 'trash',
        onRetry: () => deleteFee(id)
      })
    }
  }

  // Handle Fee Structure Delete
  async function handleFeeDelete(id: string) {
    if (!confirm('Are you sure you want to delete this fee structure?')) return
    await deleteFee(id)
  }

  // Submit payment helper to support retry
  async function submitPayment(payload: any) {
    setActionLoading(true)
    try {
      const res = await fetch('/api/fees/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (!data.error) {
        setShowPaymentModal(false)
        setPaymentForm({
          studentId: '',
          feeTypeId: '',
          amount: '',
          paymentMethod: 'UPI',
          transactionId: '',
          dueDate: ''
        })
        fetchData()
      } else {
        const student = students.find(s => s._id === payload.studentId)
        const studentName = student ? student.name : 'Student'
        showAlert({
          title: `Payment for ${studentName} was unsuccessful`,
          message: `The payment for ${studentName} couldn't be completed. ${data.error}`,
          type: 'card',
          onRetry: () => submitPayment(payload)
        })
      }
    } catch (err) {
      console.error(err)
      const student = students.find(s => s._id === payload.studentId)
      const studentName = student ? student.name : 'Student'
      showAlert({
        title: `Payment for ${studentName} was unsuccessful`,
        message: `Network error. The payment for ${studentName} couldn't be completed.`,
        type: 'card',
        onRetry: () => submitPayment(payload)
      })
    } finally {
      setActionLoading(false)
    }
  }

  // Handle Payment Record Form Submit
  async function handlePaymentSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!paymentForm.studentId || !paymentForm.feeTypeId || !paymentForm.amount) return

    const payload = {
      ...paymentForm,
      amount: Number(paymentForm.amount)
    }
    await submitPayment(payload)
  }

  // Open Edit Fee structure modal
  function openEditFee(fee: any) {
    setEditingFee(fee)
    setFeeForm({
      name: fee.name,
      description: fee.description || '',
      programBatch: fee.programBatch,
      amount: String(fee.amount),
      frequency: fee.frequency,
      academicYear: fee.academicYear
    })
    setShowFeeModal(true)
  }

  // Filters & Search logic
  const filteredFeeTypes = feeTypes.filter(fee => {
    const matchesSearch = 
      fee.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      fee.programBatch.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (fee.description && fee.description.toLowerCase().includes(searchQuery.toLowerCase()))
    return matchesSearch
  })

  const filteredPayments = paymentRecords.filter(record => {
    const matchesSearch = 
      record.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (record.rollNo && record.rollNo.toLowerCase().includes(searchQuery.toLowerCase())) ||
      record.feeName.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesStatus = statusFilter === 'All' || record.status === statusFilter
    
    return matchesSearch && matchesStatus
  })

  // Pagination calculation
  const totalFeePages = Math.ceil(filteredFeeTypes.length / itemsPerPage) || 1
  const paginatedFeeTypes = filteredFeeTypes.slice(
    (feePage - 1) * itemsPerPage,
    feePage * itemsPerPage
  )

  const totalPaymentPages = Math.ceil(filteredPayments.length / itemsPerPage) || 1
  const paginatedPayments = filteredPayments.slice(
    (paymentPage - 1) * itemsPerPage,
    paymentPage * itemsPerPage
  )

  // Circular progress math for Collection Rate KPI
  const circleRadius = 22
  const strokeWidth = 5
  const circumference = 2 * Math.PI * circleRadius
  const collectionPercentage = stats.collectionRate || 0
  const strokeDashoffset = circumference - (collectionPercentage / 100) * circumference

  return (
    <div className="flex-1 p-8 overflow-auto bg-slate-50 min-h-screen">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Fee Management</h1>
          <p className="text-[13px] text-slate-500 mt-1">
            Track fee structures, collections, and outstanding dues
          </p>
        </div>
        <button 
          onClick={fetchData}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-semibold shadow-sm transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* KPI Overview Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        
        {/* KPI 1: Collected this month */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Collected This Month</span>
            <div className="p-2 bg-green-50 text-green-600 rounded-xl">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-2xl font-bold text-slate-900 mb-1">
              {formatCurrency(stats.totalCollectedThisMonth)}
            </span>
            <span className="flex items-center gap-1 text-[11px] font-bold text-green-600">
              <TrendingUp className="w-3.5 h-3.5" /> +12% vs last month
            </span>
          </div>
        </div>

        {/* KPI 2: Pending Dues */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pending Dues</span>
            <div className="p-2 bg-amber-50 text-amber-500 rounded-xl">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-2xl font-bold text-slate-900 mb-1">
              {formatCurrency(stats.pendingDues)}
            </span>
            <span className="text-[11px] font-semibold text-slate-500">
              Across {stats.activeStudentsWithDuesCount} active students
            </span>
          </div>
        </div>

        {/* KPI 3: Overdue Accounts */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Overdue Accounts</span>
            <div className="p-2 bg-red-50 text-red-500 rounded-xl">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-2xl font-bold text-red-600 mb-1">
              {stats.overdueAccounts}
            </span>
            <span className="text-[11px] font-bold text-red-500">
              Requires immediate action
            </span>
          </div>
        </div>

        {/* KPI 4: Collection Rate */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
          <div className="flex flex-col justify-between h-full">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Collection Rate</span>
            <div>
              <span className="text-2xl font-bold text-slate-900 mb-1 block">
                {collectionPercentage}%
              </span>
              <span className="text-[11px] font-semibold text-slate-500">
                Target: 95%
              </span>
            </div>
          </div>
          <div className="relative w-16 h-16 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
              <circle 
                cx="32" cy="32" r={circleRadius} 
                stroke="#e2e8f0" strokeWidth={strokeWidth} fill="transparent" 
              />
              <motion.circle 
                cx="32" cy="32" r={circleRadius} 
                stroke="#0b1320" strokeWidth={strokeWidth} fill="transparent" 
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset }}
                transition={{ duration: 1, ease: 'easeOut' }}
              />
            </svg>
            <span className="absolute text-[11px] font-bold text-slate-800">{collectionPercentage}%</span>
          </div>
        </div>

      </div>

      {/* Tabs Menu */}
      <div className="flex items-center gap-6 border-b border-slate-200 mb-6">
        <button 
          onClick={() => { setActiveTab('structure'); setSearchQuery(''); }}
          className={`pb-3 text-sm font-bold transition-all relative ${
            activeTab === 'structure' ? 'text-[#0b1320]' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          Fee Structure
          {activeTab === 'structure' && (
            <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0b1320]" />
          )}
        </button>
        <button 
          onClick={() => { setActiveTab('payments'); setSearchQuery(''); }}
          className={`pb-3 text-sm font-bold transition-all relative ${
            activeTab === 'payments' ? 'text-[#0b1320]' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          Payment Records
          {activeTab === 'payments' && (
            <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0b1320]" />
          )}
        </button>
      </div>

      {/* Controls: Search, filter, action buttons */}
      <div className="flex items-center justify-between mb-6 gap-4">
        
        <div className="flex-1 max-w-md relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input 
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setFeePage(1)
              setPaymentPage(1)
            }}
            placeholder={activeTab === 'structure' ? "Search fee types..." : "Search student, roll number..."}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:border-slate-400 transition-colors shadow-sm"
          />
        </div>

        <div className="flex items-center gap-3">
          
          {activeTab === 'payments' && (
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select 
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value)
                  setPaymentPage(1)
                }}
                className="text-xs font-semibold text-slate-700 bg-transparent outline-none cursor-pointer"
              >
                <option value="All">All Statuses</option>
                <option value="Paid">Paid</option>
                <option value="Pending">Pending</option>
                <option value="Overdue">Overdue</option>
              </select>
            </div>
          )}

          {activeTab === 'structure' ? (
            <button 
              onClick={() => {
                setEditingFee(null)
                setFeeForm({
                  name: '',
                  description: '',
                  programBatch: '',
                  amount: '',
                  frequency: 'Monthly',
                  academicYear: '2024-25'
                })
                setShowFeeModal(true)
              }}
              className="flex items-center gap-2 px-4 py-2 bg-[#0b1320] hover:bg-slate-800 text-white rounded-lg text-sm font-semibold transition-all shadow-sm"
            >
              <Plus className="w-4 h-4" /> Add Fee Type
            </button>
          ) : (
            <button 
              onClick={() => setShowPaymentModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#0b1320] hover:bg-slate-800 text-white rounded-lg text-sm font-semibold transition-all shadow-sm"
            >
              <Plus className="w-4 h-4" /> Record Payment
            </button>
          )}

        </div>

      </div>

      {/* Main Tables */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-8 h-8 text-slate-400 animate-spin" />
          <span className="text-sm font-semibold text-slate-500">Loading data from database...</span>
        </div>
      ) : activeTab === 'structure' ? (
        
        // Fee Structure Table
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between min-h-[400px]">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Fee Name</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Program/Batch</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Amount</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Frequency</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Academic Year</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedFeeTypes.length > 0 ? (
                  paginatedFeeTypes.map((fee) => (
                    <tr key={fee._id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-[13px] font-bold text-slate-900">{fee.name}</span>
                          {fee.description && (
                            <span className="text-[11px] text-slate-500 mt-0.5">{fee.description}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-[13px] font-medium text-slate-700">
                        {fee.programBatch}
                      </td>
                      <td className="px-6 py-4 text-[13px] font-bold text-slate-900">
                        {formatCurrency(fee.amount)}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded-full border border-blue-100 uppercase tracking-wider">
                          {fee.frequency}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-[13px] font-medium text-slate-600">
                        {fee.academicYear}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => openEditFee(fee)}
                            className="p-1.5 text-slate-400 hover:text-[#0b1320] hover:bg-slate-100 rounded transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => handleFeeDelete(fee._id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-sm font-semibold text-slate-400">
                      No fee types found. Add a fee type to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Showing {filteredFeeTypes.length > 0 ? (feePage - 1) * itemsPerPage + 1 : 0}-
              {Math.min(feePage * itemsPerPage, filteredFeeTypes.length)} of {filteredFeeTypes.length} fee types
            </span>
            <div className="flex items-center gap-1.5">
              <button 
                onClick={() => setFeePage(prev => Math.max(prev - 1, 1))}
                disabled={feePage === 1}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 transition-colors disabled:opacity-50 flex items-center gap-1 shadow-sm"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Previous
              </button>
              {Array.from({ length: totalFeePages }, (_, i) => i + 1).map(pageNum => (
                <button
                  key={pageNum}
                  onClick={() => setFeePage(pageNum)}
                  className={`w-8 h-8 rounded-lg text-xs font-bold transition-all border ${
                    feePage === pageNum 
                      ? 'bg-[#0b1320] border-[#0b1320] text-white' 
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {pageNum}
                </button>
              ))}
              <button 
                onClick={() => setFeePage(prev => Math.min(prev + 1, totalFeePages))}
                disabled={feePage === totalFeePages}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 transition-colors disabled:opacity-50 flex items-center gap-1 shadow-sm"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

      ) : (

        // Payment Records Table
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between min-h-[400px]">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Student Name</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Roll No</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Fee Name</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Amount Paid</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Total Amount</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Due Date</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedPayments.length > 0 ? (
                  paginatedPayments.map((record) => (
                    <tr key={record._id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-[13px] font-bold text-slate-900">{record.studentName}</span>
                          {record.class && (
                            <span className="text-[11px] text-slate-500 mt-0.5">Class {record.class}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-[13px] font-semibold text-slate-600">
                        {record.rollNo || 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-[13px] font-medium text-slate-700">
                        {record.feeName}
                      </td>
                      <td className="px-6 py-4 text-[13px] font-bold text-slate-900">
                        {formatCurrency(record.amountPaid)}
                      </td>
                      <td className="px-6 py-4 text-[13px] font-bold text-slate-700">
                        {formatCurrency(record.totalAmount)}
                      </td>
                      <td className="px-6 py-4 text-[13px] font-medium text-slate-600">
                        {new Date(record.dueDate).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full border uppercase tracking-wider ${
                          record.status === 'Paid' ? 'bg-green-50 text-green-700 border-green-200' :
                          record.status === 'Pending' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                          'bg-red-50 text-red-700 border-red-200'
                        }`}>
                          {record.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-sm font-semibold text-slate-400">
                      No payment records found. Record a payment to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Showing {filteredPayments.length > 0 ? (paymentPage - 1) * itemsPerPage + 1 : 0}-
              {Math.min(paymentPage * itemsPerPage, filteredPayments.length)} of {filteredPayments.length} records
            </span>
            <div className="flex items-center gap-1.5">
              <button 
                onClick={() => setPaymentPage(prev => Math.max(prev - 1, 1))}
                disabled={paymentPage === 1}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 transition-colors disabled:opacity-50 flex items-center gap-1 shadow-sm"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Previous
              </button>
              {Array.from({ length: totalPaymentPages }, (_, i) => i + 1).map(pageNum => (
                <button
                  key={pageNum}
                  onClick={() => setPaymentPage(pageNum)}
                  className={`w-8 h-8 rounded-lg text-xs font-bold transition-all border ${
                    paymentPage === pageNum 
                      ? 'bg-[#0b1320] border-[#0b1320] text-white' 
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {pageNum}
                </button>
              ))}
              <button 
                onClick={() => setPaymentPage(prev => Math.min(prev + 1, totalPaymentPages))}
                disabled={paymentPage === totalPaymentPages}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 transition-colors disabled:opacity-50 flex items-center gap-1 shadow-sm"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

      )}

      {/* MODAL 1: ADD/EDIT FEE TYPE */}
      <AnimatePresence>
        {showFeeModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl p-6 shadow-xl w-full max-w-md border border-slate-100"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-slate-900">
                  {editingFee ? 'Edit Fee Structure' : 'Add New Fee Type'}
                </h3>
                <button 
                  onClick={() => { setShowFeeModal(false); setEditingFee(null); }} 
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleFeeSubmit} className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-0.5">Fee Name *</label>
                  <input 
                    type="text"
                    required
                    value={feeForm.name}
                    onChange={(e) => setFeeForm({...feeForm, name: e.target.value})}
                    placeholder="e.g. Tuition Fee - Core"
                    className="w-full mt-1.5 px-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-slate-400 transition-colors"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-0.5">Description</label>
                  <input 
                    type="text"
                    value={feeForm.description}
                    onChange={(e) => setFeeForm({...feeForm, description: e.target.value})}
                    placeholder="e.g. Standard curriculum fee"
                    className="w-full mt-1.5 px-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-slate-400 transition-colors"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-0.5">Program/Batch *</label>
                  <input 
                    type="text"
                    required
                    value={feeForm.programBatch}
                    onChange={(e) => setFeeForm({...feeForm, programBatch: e.target.value})}
                    placeholder="e.g. JEE 2026-A"
                    className="w-full mt-1.5 px-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-slate-400 transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-0.5">Amount (₹) *</label>
                    <input 
                      type="number"
                      required
                      min="0"
                      value={feeForm.amount}
                      onChange={(e) => setFeeForm({...feeForm, amount: e.target.value})}
                      placeholder="5000"
                      className="w-full mt-1.5 px-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-slate-400 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-0.5">Frequency *</label>
                    <select
                      value={feeForm.frequency}
                      onChange={(e) => setFeeForm({...feeForm, frequency: e.target.value})}
                      className="w-full mt-1.5 px-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-slate-400 transition-colors cursor-pointer"
                    >
                      <option value="One-time">One-time</option>
                      <option value="Monthly">Monthly</option>
                      <option value="Quarterly">Quarterly</option>
                      <option value="Yearly">Yearly</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-0.5">Academic Year *</label>
                  <input 
                    type="text"
                    required
                    value={feeForm.academicYear}
                    onChange={(e) => setFeeForm({...feeForm, academicYear: e.target.value})}
                    placeholder="2024-25"
                    className="w-full mt-1.5 px-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-slate-400 transition-colors"
                  />
                </div>

                <button 
                  type="submit"
                  disabled={actionLoading}
                  className="w-full bg-[#0b1320] text-white font-bold py-2.5 rounded-xl hover:bg-slate-800 transition-colors mt-2 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {actionLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                  {editingFee ? 'Save Changes' : 'Create Fee Type'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: RECORD PAYMENT */}
      <AnimatePresence>
        {showPaymentModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl p-6 shadow-xl w-full max-w-md border border-slate-100"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-slate-900">Record Student Payment</h3>
                <button 
                  onClick={() => setShowPaymentModal(false)} 
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handlePaymentSubmit} className="space-y-4">
                
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-0.5">Select Student *</label>
                  <select
                    required
                    value={paymentForm.studentId}
                    onChange={(e) => setPaymentForm({...paymentForm, studentId: e.target.value})}
                    className="w-full mt-1.5 px-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-slate-400 transition-colors cursor-pointer"
                  >
                    <option value="">-- Choose Student --</option>
                    {students.map((st) => (
                      <option key={st._id} value={st._id}>
                        {st.name} ({st.rollNo || 'No Roll'} - Class {st.class || 'N/A'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-0.5">Select Fee Type *</label>
                  <select
                    required
                    value={paymentForm.feeTypeId}
                    onChange={(e) => setPaymentForm({...paymentForm, feeTypeId: e.target.value})}
                    className="w-full mt-1.5 px-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-slate-400 transition-colors cursor-pointer"
                  >
                    <option value="">-- Choose Fee Type --</option>
                    {feeTypes.map((type) => (
                      <option key={type._id} value={type._id}>
                        {type.name} (Amount: {formatCurrency(type.amount)} - {type.programBatch})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-0.5">Amount Paid (₹) *</label>
                    <input 
                      type="number"
                      required
                      min="0"
                      value={paymentForm.amount}
                      onChange={(e) => setPaymentForm({...paymentForm, amount: e.target.value})}
                      placeholder="e.g. 5000"
                      className="w-full mt-1.5 px-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-slate-400 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-0.5">Payment Method *</label>
                    <select
                      value={paymentForm.paymentMethod}
                      onChange={(e) => setPaymentForm({...paymentForm, paymentMethod: e.target.value})}
                      className="w-full mt-1.5 px-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-slate-400 transition-colors cursor-pointer"
                    >
                      <option value="UPI">UPI</option>
                      <option value="Cash">Cash</option>
                      <option value="Card">Card</option>
                      <option value="Net Banking">Net Banking</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-0.5">Transaction ID</label>
                    <input 
                      type="text"
                      value={paymentForm.transactionId}
                      onChange={(e) => setPaymentForm({...paymentForm, transactionId: e.target.value})}
                      placeholder="e.g. TXN-12345"
                      className="w-full mt-1.5 px-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-slate-400 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-0.5">Due Date (If new billing)</label>
                    <input 
                      type="date"
                      value={paymentForm.dueDate}
                      onChange={(e) => setPaymentForm({...paymentForm, dueDate: e.target.value})}
                      className="w-full mt-1.5 px-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-slate-400 transition-colors cursor-pointer"
                    />
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={actionLoading}
                  className="w-full bg-[#0b1320] text-white font-bold py-2.5 rounded-xl hover:bg-slate-800 transition-colors mt-2 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {actionLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                  Submit Payment
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  )
}
