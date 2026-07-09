'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useAlert } from '@/components/dashboard/AlertProvider'
import { motion, AnimatePresence } from 'framer-motion'
import * as XLSX from 'xlsx'
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
  CheckCircle,
  HelpCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  FileText,
  Printer,
  DollarSign,
  Layers,
  Users,
  Building,
  Tag,
  Percent,
  CheckSquare,
  Square,
  ShieldCheck,
  Database,
  FileSpreadsheet,
  Upload,
  Download,
  Check,
  AlertCircle,
  Table,
  Info
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
  const [activeTab, setActiveTab] = useState<'structure' | 'payments'>('structure')

  // Real-time dynamic states from Postgres database
  const [stats, setStats] = useState({
    totalCollectedThisMonth: 0,
    totalCollectedAllTime: 0,
    pendingDues: 0,
    activeStudentsWithDuesCount: 0,
    overdueAccounts: 0,
    collectionRate: 0,
    totalPaymentRecordsCount: 0
  })
  const [feeTypes, setFeeTypes] = useState<any[]>([])
  const [paymentRecords, setPaymentRecords] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])
  
  // Loading & action states
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [seeding, setSeeding] = useState(false)
  
  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [feeTypeFilter, setFeeTypeFilter] = useState('All')
  
  // Modals
  const [showFeeModal, setShowFeeModal] = useState(false)
  const [editingFee, setEditingFee] = useState<any>(null)
  
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [editingPayment, setEditingPayment] = useState<any>(null)
  
  const [showReceiptModal, setShowReceiptModal] = useState(false)
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null)

  // EXCEL UPLOAD & FORMATTING GUIDE MODAL STATES
  const [showExcelModal, setShowExcelModal] = useState(false)
  const [excelTab, setExcelTab] = useState<'structures' | 'payments'>('structures')
  const [excelFile, setExcelFile] = useState<File | null>(null)
  const [parsedExcelRows, setParsedExcelRows] = useState<any[]>([])
  const [excelUploading, setExcelUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Fee Structure Form matching Mind Map
  const [feeForm, setFeeForm] = useState({
    name: '',
    feeType: 'Monthly Tuition', // Registration Fee, Monthly Tuition, Exam Fee, Material Fee, Other
    description: '',
    amount: '',
    frequency: 'Monthly', // One-time, Monthly, Quarterly, Yearly
    dueDay: 5, // 1-31
    isMandatory: true,
    programAssociation: 'All Programs',
    batchAssociation: 'All Batches',
    academicYear: '2024-25'
  })

  // Fee Payment Form matching Mind Map
  const [paymentForm, setPaymentForm] = useState({
    studentId: '',
    feeStructureId: '',
    amountDue: '',
    discount: '0',
    lateFee: '0',
    amountPaid: '',
    paymentMethod: 'UPI', // Cash, Online, Cheque, DD, UPI, Card, Net Banking
    transactionId: '',
    receiptNumber: '',
    dueDate: new Date().toISOString().split('T')[0],
    paidDate: new Date().toISOString().split('T')[0],
    status: 'Paid', // Pending, Partial, Paid, Overdue, Waived
    notes: ''
  })

  // Pagination states
  const [feePage, setFeePage] = useState(1)
  const [paymentPage, setPaymentPage] = useState(1)
  const itemsPerPage = 6

  // Fetch true data from Postgres database API endpoints
  async function fetchData() {
    try {
      setLoading(true)
      // 1. Fetch real stats
      const statsRes = await fetch('/api/fees/stats')
      const statsData = await statsRes.json()
      if (!statsData.error) {
        setStats(statsData)
      }

      // 2. Fetch fee structures
      const structuresRes = await fetch('/api/fees/structures')
      const structuresData = await structuresRes.json()
      if (!structuresData.error && Array.isArray(structuresData)) {
        setFeeTypes(structuresData)
      }

      // 3. Fetch payment records
      const paymentsRes = await fetch('/api/fees/payments')
      const paymentsData = await paymentsRes.json()
      if (!paymentsData.error && Array.isArray(paymentsData)) {
        setPaymentRecords(paymentsData)
      }

      // 4. Fetch students for dropdowns
      const studentsRes = await fetch('/api/students?activeOnly=true')
      const studentsData = await studentsRes.json()
      if (!studentsData.error && Array.isArray(studentsData)) {
        setStudents(studentsData)
      }
    } catch (err) {
      console.error('Error fetching fee management data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Seed sample database data handler
  async function handleSeedData() {
    setSeeding(true)
    try {
      const res = await fetch('/api/fees/seed', { method: 'POST' })
      const data = await res.json()
      if (!data.error) {
        showAlert({
          title: 'Database Seeded Successfully',
          message: data.message || 'Sample fee structures and payment records added.',
          type: 'success'
        })
        fetchData()
      } else {
        showAlert({
          title: 'Seed Notice',
          message: data.error || data.message,
          type: 'info'
        })
      }
    } catch (err) {
      console.error(err)
      showAlert({
        title: 'Seed Failed',
        message: 'Could not connect to seed server.',
        type: 'warning'
      })
    } finally {
      setSeeding(false)
    }
  }

  // Open Excel Upload Modal and default to active tab
  function openExcelUploadModal() {
    setExcelTab(activeTab === 'structure' ? 'structures' : 'payments')
    setExcelFile(null)
    setParsedExcelRows([])
    setShowExcelModal(true)
  }

  // Handle SheetJS Excel / CSV File Parsing right inside browser
  function handleExcelFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setExcelFile(file)

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const binaryString = evt.target?.result
        const workbook = XLSX.read(binaryString, { type: 'binary' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonRows = XLSX.utils.sheet_to_json(worksheet)
        setParsedExcelRows(jsonRows)
      } catch (err) {
        console.error('Excel parse error:', err)
        showAlert({
          title: 'Parse Error',
          message: 'Could not read file. Please upload a valid .xlsx, .xls, or .csv file.',
          type: 'warning'
        })
      }
    }
    reader.readAsBinaryString(file)
  }

  // Download pre-formatted Excel template matching the required schema
  function downloadSampleTemplate(targetTab: 'structures' | 'payments') {
    if (targetTab === 'structures') {
      const sampleData = [
        {
          "Fee Name": "Tuition Fee - Core JEE",
          "Fee Category": "Monthly Tuition",
          "Amount (INR)": 12500,
          "Frequency": "Monthly",
          "Due Day": 5,
          "Mandatory": "Yes",
          "Program": "STEM",
          "Batch": "JEE 2026-A",
          "Academic Year": "2024-25",
          "Description": "Standard monthly tuition for JEE Core"
        },
        {
          "Fee Name": "Term 1 Mid-Year Examination Fee",
          "Fee Category": "Exam Fee",
          "Amount (INR)": 2500,
          "Frequency": "Quarterly",
          "Due Day": 15,
          "Mandatory": "Yes",
          "Program": "All Programs",
          "Batch": "All Batches",
          "Academic Year": "2024-25",
          "Description": "Evaluation and invigilation fee"
        },
        {
          "Fee Name": "Annual Study Material Fee",
          "Fee Category": "Material Fee",
          "Amount (INR)": 15000,
          "Frequency": "Yearly",
          "Due Day": 10,
          "Mandatory": "No",
          "Program": "STEM",
          "Batch": "JEE 2026-A",
          "Academic Year": "2024-25",
          "Description": "Printed comprehensive modules & LMS access"
        }
      ]
      const worksheet = XLSX.utils.json_to_sheet(sampleData)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, "Fee Structures")
      XLSX.writeFile(workbook, "Fee_Structures_Upload_Template.xlsx")
    } else {
      const sampleData = [
        {
          "Student Roll No": "RN-101",
          "Student Name": "Aarav Sharma",
          "Fee Structure Name": "Tuition Fee - Core JEE",
          "Amount Due": 12500,
          "Amount Paid": 12500,
          "Discount": 0,
          "Late Fee": 0,
          "Payment Method": "UPI",
          "Transaction ID": "TXN-2026-849201",
          "Receipt Number": "REC-2026-1001",
          "Due Date": "2026-07-05",
          "Paid Date": "2026-07-05",
          "Status": "Paid",
          "Notes": "Paid via PhonePe QR"
        },
        {
          "Student Roll No": "RN-102",
          "Student Name": "Diya Patel",
          "Fee Structure Name": "Term 1 Mid-Year Examination Fee",
          "Amount Due": 2500,
          "Amount Paid": 1500,
          "Discount": 1000,
          "Late Fee": 0,
          "Payment Method": "Card",
          "Transaction ID": "TXN-2026-849202",
          "Receipt Number": "REC-2026-1002",
          "Due Date": "2026-07-15",
          "Paid Date": "2026-07-10",
          "Status": "Paid",
          "Notes": "Merit scholarship concession of ₹1,000 applied"
        },
        {
          "Student Roll No": "RN-103",
          "Student Name": "Rohan Verma",
          "Fee Structure Name": "Tuition Fee - Core JEE",
          "Amount Due": 12500,
          "Amount Paid": 5000,
          "Discount": 0,
          "Late Fee": 500,
          "Payment Method": "Cash",
          "Transaction ID": "",
          "Receipt Number": "REC-2026-1003",
          "Due Date": "2026-07-05",
          "Paid Date": "2026-07-08",
          "Status": "Partial",
          "Notes": "First installment received in cash"
        }
      ]
      const worksheet = XLSX.utils.json_to_sheet(sampleData)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, "Fee Payments")
      XLSX.writeFile(workbook, "Fee_Payments_Upload_Template.xlsx")
    }
  }

  // Bulk import parsed rows to Postgres database
  async function handleConfirmBulkImport() {
    if (parsedExcelRows.length === 0) return
    setExcelUploading(true)
    try {
      const res = await fetch('/api/fees/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: excelTab,
          records: parsedExcelRows
        })
      })
      const data = await res.json()
      if (!data.error) {
        showAlert({
          title: 'Bulk Import Complete',
          message: `${data.message} ${data.failedCount > 0 ? `(${data.failedCount} rows skipped)` : ''}`,
          type: 'success'
        })
        setShowExcelModal(false)
        setExcelFile(null)
        setParsedExcelRows([])
        fetchData()
      } else {
        showAlert({
          title: 'Import Failed',
          message: data.error,
          type: 'warning'
        })
      }
    } catch (err) {
      console.error(err)
      showAlert({
        title: 'Upload Error',
        message: 'Network error while importing records.',
        type: 'warning'
      })
    } finally {
      setExcelUploading(false)
    }
  }

  // Handle Fee Structure Form Submit
  async function handleFeeSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!feeForm.name || !feeForm.amount) return

    setActionLoading(true)
    try {
      const url = editingFee 
        ? `/api/fees/structures?id=${editingFee._id || editingFee.id}`
        : '/api/fees/structures'
      const method = editingFee ? 'PUT' : 'POST'

      const payload = {
        ...feeForm,
        amount: Number(feeForm.amount),
        dueDay: Number(feeForm.dueDay)
      }

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
          feeType: 'Monthly Tuition',
          description: '',
          amount: '',
          frequency: 'Monthly',
          dueDay: 5,
          isMandatory: true,
          programAssociation: 'All Programs',
          batchAssociation: 'All Batches',
          academicYear: '2024-25'
        })
        fetchData()
      } else {
        showAlert({
          title: editingFee ? 'Update Failed' : 'Creation Failed',
          message: data.error,
          type: 'warning'
        })
      }
    } catch (err) {
      console.error(err)
      showAlert({
        title: 'Network Error',
        message: 'Could not save fee structure.',
        type: 'warning'
      })
    } finally {
      setActionLoading(false)
    }
  }

  // Handle Fee Structure Delete
  async function handleFeeDelete(id: string) {
    if (!confirm('Are you sure you want to delete this fee structure and its associations?')) return
    try {
      const res = await fetch(`/api/fees/structures?id=${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!data.error) {
        fetchData()
      } else {
        showAlert({ title: 'Delete Failed', message: data.error, type: 'trash' })
      }
    } catch (err) {
      console.error(err)
      showAlert({ title: 'Error', message: 'Could not delete fee structure.', type: 'trash' })
    }
  }

  // Open Edit Fee Structure modal
  function openEditFee(fee: any) {
    setEditingFee(fee)
    setFeeForm({
      name: fee.name || '',
      feeType: fee.feeType || 'Monthly Tuition',
      description: fee.description || '',
      amount: String(fee.amount ?? ''),
      frequency: fee.frequency || 'Monthly',
      dueDay: fee.dueDay || 5,
      isMandatory: fee.isMandatory !== undefined ? fee.isMandatory : true,
      programAssociation: fee.programAssociation || 'All Programs',
      batchAssociation: fee.batchAssociation || 'All Batches',
      academicYear: fee.academicYear || '2024-25'
    })
    setShowFeeModal(true)
  }

  // Handle Payment Form when fee structure is selected (auto fill amountDue)
  function handlePaymentFeeSelection(feeId: string) {
    const selectedFee = feeTypes.find(f => (f._id || f.id) === feeId)
    if (selectedFee) {
      setPaymentForm(prev => ({
        ...prev,
        feeStructureId: feeId,
        amountDue: String(selectedFee.amount),
        amountPaid: prev.amountPaid || String(selectedFee.amount)
      }))
    } else {
      setPaymentForm(prev => ({ ...prev, feeStructureId: feeId }))
    }
  }

  // Handle Payment Record Form Submit
  async function handlePaymentSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!paymentForm.studentId || !paymentForm.feeStructureId || paymentForm.amountDue === '') return

    setActionLoading(true)
    try {
      const url = editingPayment
        ? `/api/fees/payments?id=${editingPayment._id || editingPayment.id}`
        : '/api/fees/payments'
      const method = editingPayment ? 'PUT' : 'POST'

      const payload = {
        ...paymentForm,
        amountDue: Number(paymentForm.amountDue),
        amountPaid: Number(paymentForm.amountPaid || 0),
        discount: Number(paymentForm.discount || 0),
        lateFee: Number(paymentForm.lateFee || 0)
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (!data.error) {
        setShowPaymentModal(false)
        setEditingPayment(null)
        setPaymentForm({
          studentId: '',
          feeStructureId: '',
          amountDue: '',
          discount: '0',
          lateFee: '0',
          amountPaid: '',
          paymentMethod: 'UPI',
          transactionId: '',
          receiptNumber: '',
          dueDate: new Date().toISOString().split('T')[0],
          paidDate: new Date().toISOString().split('T')[0],
          status: 'Paid',
          notes: ''
        })
        fetchData()
      } else {
        showAlert({
          title: editingPayment ? 'Update Payment Failed' : 'Payment Record Failed',
          message: data.error,
          type: 'card'
        })
      }
    } catch (err) {
      console.error(err)
      showAlert({ title: 'Network Error', message: 'Could not record payment.', type: 'card' })
    } finally {
      setActionLoading(false)
    }
  }

  // Handle Payment Record Delete
  async function handlePaymentDelete(id: string) {
    if (!confirm('Are you sure you want to delete this payment transaction?')) return
    try {
      const res = await fetch(`/api/fees/payments?id=${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!data.error) {
        fetchData()
      } else {
        showAlert({ title: 'Delete Failed', message: data.error, type: 'trash' })
      }
    } catch (err) {
      console.error(err)
      showAlert({ title: 'Error', message: 'Could not delete payment record.', type: 'trash' })
    }
  }

  // Open Edit Payment Modal
  function openEditPayment(payment: any) {
    setEditingPayment(payment)
    setPaymentForm({
      studentId: payment.studentId || '',
      feeStructureId: payment.feeStructureId || payment.feeTypeId || '',
      amountDue: String(payment.amountDue ?? payment.totalAmount ?? 0),
      discount: String(payment.discount ?? 0),
      lateFee: String(payment.lateFee ?? 0),
      amountPaid: String(payment.amountPaid ?? 0),
      paymentMethod: payment.paymentMethod || 'UPI',
      transactionId: payment.transactionId || '',
      receiptNumber: payment.receiptNumber || '',
      dueDate: payment.dueDate || '',
      paidDate: payment.paidDate || '',
      status: payment.status || 'Paid',
      notes: payment.notes || ''
    })
    setShowPaymentModal(true)
  }

  // Filters & Search calculations
  const filteredFeeTypes = useMemo(() => {
    return feeTypes.filter(fee => {
      const matchesSearch = 
        fee.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        fee.feeType?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        fee.programAssociation?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        fee.batchAssociation?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (fee.description && fee.description.toLowerCase().includes(searchQuery.toLowerCase()))
      const matchesType = feeTypeFilter === 'All' || fee.feeType === feeTypeFilter
      return matchesSearch && matchesType
    })
  }, [feeTypes, searchQuery, feeTypeFilter])

  const filteredPayments = useMemo(() => {
    return paymentRecords.filter(record => {
      const matchesSearch = 
        record.studentName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (record.rollNo && record.rollNo.toLowerCase().includes(searchQuery.toLowerCase())) ||
        record.feeName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        record.receiptNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (record.transactionId && record.transactionId.toLowerCase().includes(searchQuery.toLowerCase()))
      
      const matchesStatus = statusFilter === 'All' || record.status === statusFilter
      
      return matchesSearch && matchesStatus
    })
  }, [paymentRecords, searchQuery, statusFilter])

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
    <div className="flex-1 p-8 overflow-auto bg-slate-50/80 min-h-screen">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900">Fee Management</h1>
            <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 rounded-full text-[11px] font-bold uppercase tracking-wider flex items-center gap-1">
              <Database className="w-3 h-3" /> Neon Postgres
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manage Fee Types, Financial Details, Scope & Relations, Student Records, and Transaction Logistics
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto">
          {/* EXCEL UPLOAD OPTION BUTTON IN HEADER */}
          <button
            onClick={openExcelUploadModal}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Upload from Excel
          </button>

          {feeTypes.length === 0 && paymentRecords.length === 0 && !loading && (
            <button
              onClick={handleSeedData}
              disabled={seeding}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50"
            >
              <Database className={`w-3.5 h-3.5 ${seeding ? 'animate-bounce' : ''}`} />
              {seeding ? 'Seeding...' : 'Seed Sample Fee Data'}
            </button>
          )}

          <button 
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold shadow-sm transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Overview Grid (Computed Real-Time from Postgres) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        
        {/* KPI 1: Collected this month */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Collected This Month</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-2xl font-bold text-slate-900 mb-1">
              {formatCurrency(stats.totalCollectedThisMonth || 0)}
            </span>
            <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
              Total All-Time: {formatCurrency(stats.totalCollectedAllTime || 0)}
            </span>
          </div>
        </div>

        {/* KPI 2: Pending Dues */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Pending Dues</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-2xl font-bold text-slate-900 mb-1">
              {formatCurrency(stats.pendingDues || 0)}
            </span>
            <span className="text-[11px] font-semibold text-amber-700">
              Across {stats.activeStudentsWithDuesCount || 0} active students
            </span>
          </div>
        </div>

        {/* KPI 3: Overdue Accounts */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Overdue Accounts</span>
            <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="flex flex-col">
            <span className={`text-2xl font-bold mb-1 ${(stats.overdueAccounts || 0) > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
              {stats.overdueAccounts || 0}
            </span>
            <span className="text-[11px] font-semibold text-slate-500">
              {(stats.overdueAccounts || 0) > 0 ? 'Requires follow-up action' : 'No overdue accounts'}
            </span>
          </div>
        </div>

        {/* KPI 4: Collection Rate */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between hover:shadow-md transition-shadow">
          <div className="flex flex-col justify-between h-full">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Collection Rate</span>
            <div>
              <span className="text-2xl font-bold text-slate-900 mb-1 block">
                {collectionPercentage}%
              </span>
              <span className="text-[11px] font-semibold text-slate-500">
                {stats.totalPaymentRecordsCount || 0} total records
              </span>
            </div>
          </div>
          <div className="relative w-16 h-16 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
              <circle 
                cx="32" cy="32" r={circleRadius} 
                stroke="#f1f5f9" strokeWidth={strokeWidth} fill="transparent" 
              />
              <motion.circle 
                cx="32" cy="32" r={circleRadius} 
                stroke="#0f172a" strokeWidth={strokeWidth} fill="transparent" 
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
      <div className="flex items-center gap-8 border-b border-slate-200 mb-6">
        <button 
          onClick={() => { setActiveTab('structure'); setSearchQuery(''); }}
          className={`pb-3.5 text-sm font-bold transition-all relative flex items-center gap-2 ${
            activeTab === 'structure' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <Layers className="w-4 h-4" />
          Fee Structure & Scope ({feeTypes.length})
          {activeTab === 'structure' && (
            <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900" />
          )}
        </button>
        <button 
          onClick={() => { setActiveTab('payments'); setSearchQuery(''); }}
          className={`pb-3.5 text-sm font-bold transition-all relative flex items-center gap-2 ${
            activeTab === 'payments' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <FileText className="w-4 h-4" />
          Fee Payments & Transactions ({paymentRecords.length})
          {activeTab === 'payments' && (
            <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900" />
          )}
        </button>
      </div>

      {/* Controls: Search, filter, action buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        
        <div className="flex items-center gap-3 flex-1 max-w-lg">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setFeePage(1)
                setPaymentPage(1)
              }}
              placeholder={activeTab === 'structure' ? "Search fee name, type, batch, program..." : "Search student, receipt, roll no, transaction..."}
              className="w-full pl-10 pr-4 py-2 border border-slate-200/80 rounded-xl text-xs font-medium bg-white outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all shadow-xs"
            />
          </div>

          {activeTab === 'structure' && (
            <div className="flex items-center gap-1.5 bg-white border border-slate-200/80 rounded-xl px-3 py-2 shadow-xs">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select 
                value={feeTypeFilter}
                onChange={(e) => {
                  setFeeTypeFilter(e.target.value)
                  setFeePage(1)
                }}
                className="text-xs font-bold text-slate-700 bg-transparent outline-none cursor-pointer"
              >
                <option value="All">All Fee Types</option>
                <option value="Registration Fee">Registration Fee</option>
                <option value="Monthly Tuition">Monthly Tuition</option>
                <option value="Exam Fee">Exam Fee</option>
                <option value="Material Fee">Material Fee</option>
                <option value="Other">Other</option>
              </select>
            </div>
          )}

          {activeTab === 'payments' && (
            <div className="flex items-center gap-1.5 bg-white border border-slate-200/80 rounded-xl px-3 py-2 shadow-xs">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select 
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value)
                  setPaymentPage(1)
                }}
                className="text-xs font-bold text-slate-700 bg-transparent outline-none cursor-pointer"
              >
                <option value="All">All Statuses</option>
                <option value="Paid">Paid</option>
                <option value="Pending">Pending</option>
                <option value="Partial">Partial</option>
                <option value="Overdue">Overdue</option>
                <option value="Waived">Waived</option>
              </select>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Excel Upload Button right next to Create/Record */}
          <button
            onClick={openExcelUploadModal}
            title="View Excel Format & Upload Data"
            className="flex items-center gap-2 px-3.5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-all shadow-2xs"
          >
            <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
            <span className="hidden sm:inline">Upload Excel</span>
          </button>

          {activeTab === 'structure' ? (
            <button 
              onClick={() => {
                setEditingFee(null)
                setFeeForm({
                  name: '',
                  feeType: 'Monthly Tuition',
                  description: '',
                  amount: '',
                  frequency: 'Monthly',
                  dueDay: 5,
                  isMandatory: true,
                  programAssociation: 'All Programs',
                  batchAssociation: 'All Batches',
                  academicYear: '2024-25'
                })
                setShowFeeModal(true)
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
            >
              <Plus className="w-4 h-4" /> Create Fee Structure
            </button>
          ) : (
            <button 
              onClick={() => {
                setEditingPayment(null)
                const recNo = `REC-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`
                setPaymentForm({
                  studentId: '',
                  feeStructureId: '',
                  amountDue: '',
                  discount: '0',
                  lateFee: '0',
                  amountPaid: '',
                  paymentMethod: 'UPI',
                  transactionId: '',
                  receiptNumber: recNo,
                  dueDate: new Date().toISOString().split('T')[0],
                  paidDate: new Date().toISOString().split('T')[0],
                  status: 'Paid',
                  notes: ''
                })
                setShowPaymentModal(true)
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
            >
              <Plus className="w-4 h-4" /> Record Payment Transaction
            </button>
          )}
        </div>

      </div>

      {/* Main Tables */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-16 flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
          <span className="text-xs font-bold text-slate-600">Loading dynamic data from Neon Postgres database...</span>
        </div>
      ) : activeTab === 'structure' ? (
        
        // TAB 1: Fee Structure Table (Full Mind Map Fields)
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col justify-between min-h-[420px]">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-100">
                  <th className="px-5 py-3.5 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Fee Type & Name</th>
                  <th className="px-5 py-3.5 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Financial Details</th>
                  <th className="px-5 py-3.5 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Scope & Relations</th>
                  <th className="px-5 py-3.5 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest text-center">Mandatory</th>
                  <th className="px-5 py-3.5 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedFeeTypes.length > 0 ? (
                  paginatedFeeTypes.map((fee) => (
                    <tr key={fee._id || fee.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-1">
                          <span className="inline-flex items-center gap-1 w-fit px-2 py-0.5 bg-slate-100 text-slate-700 font-bold text-[10px] rounded-md uppercase tracking-wider">
                            <Tag className="w-2.5 h-2.5 text-slate-500" />
                            {fee.feeType || 'Monthly Tuition'}
                          </span>
                          <span className="text-xs font-bold text-slate-900 mt-0.5">{fee.name}</span>
                          {fee.description && (
                            <span className="text-[11px] text-slate-500 line-clamp-1">{fee.description}</span>
                          )}
                        </div>
                      </td>
                      
                      <td className="px-5 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-black text-slate-900">{formatCurrency(fee.amount)}</span>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 font-bold text-[10px] rounded border border-blue-100 uppercase tracking-wider">
                              {fee.frequency}
                            </span>
                            <span className="text-[11px] font-medium text-slate-500 flex items-center gap-0.5">
                              <Calendar className="w-3 h-3 text-slate-400" /> Due Day: {fee.dueDay || 5}th
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                            <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>Program: <strong className="text-slate-900">{fee.programAssociation || 'All Programs'}</strong></span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                            <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>Batch: <strong className="text-slate-900">{fee.batchAssociation || 'All Batches'}</strong></span>
                          </div>
                          <span className="text-[10px] font-medium text-slate-400">Academic Year: {fee.academicYear || '2024-25'}</span>
                        </div>
                      </td>

                      <td className="px-5 py-4 text-center">
                        {fee.isMandatory ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/60 rounded-full text-[10px] font-bold uppercase tracking-wider">
                            <CheckSquare className="w-3 h-3" /> Mandatory
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] font-bold uppercase tracking-wider">
                            <Square className="w-3 h-3 text-slate-400" /> Optional
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button 
                            onClick={() => openEditFee(fee)}
                            title="Edit Fee Structure"
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => handleFeeDelete(fee._id || fee.id)}
                            title="Delete Fee Structure"
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="text-center py-16">
                      <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                        <Layers className="w-10 h-10 text-slate-300 mb-2" />
                        <h4 className="text-sm font-bold text-slate-800">No Fee Structures Found</h4>
                        <p className="text-xs text-slate-500 mt-1">
                          Create your fee categories or click &quot;Upload from Excel&quot; to import bulk categories right away.
                        </p>
                      </div>
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
              {Math.min(feePage * itemsPerPage, filteredFeeTypes.length)} of {filteredFeeTypes.length} fee structures
            </span>
            <div className="flex items-center gap-1.5">
              <button 
                onClick={() => setFeePage(prev => Math.max(prev - 1, 1))}
                disabled={feePage === 1}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 transition-colors disabled:opacity-50 flex items-center gap-1 shadow-2xs"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Previous
              </button>
              {Array.from({ length: totalFeePages }, (_, i) => i + 1).map(pageNum => (
                <button
                  key={pageNum}
                  onClick={() => setFeePage(pageNum)}
                  className={`w-7 h-7 rounded-lg text-xs font-bold transition-all border ${
                    feePage === pageNum 
                      ? 'bg-slate-900 border-slate-900 text-white shadow-2xs' 
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {pageNum}
                </button>
              ))}
              <button 
                onClick={() => setFeePage(prev => Math.min(prev + 1, totalFeePages))}
                disabled={feePage === totalFeePages}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 transition-colors disabled:opacity-50 flex items-center gap-1 shadow-2xs"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

      ) : (

        // TAB 2: Payment Records Table (Full Mind Map Fields: Receipt, Breakdown, Logistics, Status)
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col justify-between min-h-[420px]">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-100">
                  <th className="px-5 py-3.5 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Receipt & Logistics</th>
                  <th className="px-5 py-3.5 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Student Records</th>
                  <th className="px-5 py-3.5 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Fee Structure Link</th>
                  <th className="px-5 py-3.5 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Financial Breakdown</th>
                  <th className="px-5 py-3.5 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Timeline & Status</th>
                  <th className="px-5 py-3.5 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedPayments.length > 0 ? (
                  paginatedPayments.map((record) => {
                    const due = record.amountDue || record.totalAmount || 0
                    const late = record.lateFee || 0
                    const disc = record.discount || 0
                    const netPayable = Math.max(0, due + late - disc)
                    const paid = record.amountPaid || 0

                    return (
                      <tr key={record._id || record.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex flex-col gap-0.5">
                            <button 
                              onClick={() => { setSelectedReceipt(record); setShowReceiptModal(true); }}
                              className="text-xs font-black text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 w-fit"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              {record.receiptNumber || 'N/A'}
                            </button>
                            <span className="text-[11px] font-semibold text-slate-600 flex items-center gap-1 mt-0.5">
                              Method: <strong className="text-slate-900">{record.paymentMethod || 'UPI'}</strong>
                            </span>
                            {record.transactionId && (
                              <span className="text-[10px] font-mono text-slate-400 truncate max-w-[140px]" title={record.transactionId}>
                                TXN: {record.transactionId}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-900">{record.studentName}</span>
                            <span className="text-[11px] font-medium text-slate-500">
                              Roll: {record.rollNo || 'N/A'} {record.class && `• ${record.class}`}
                            </span>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-800">{record.feeName}</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                              {record.feeType || 'Tuition Fee'}
                            </span>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex flex-col gap-0.5 text-[11px]">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-slate-500">Net Payable:</span>
                              <span className="font-bold text-slate-800">{formatCurrency(netPayable)}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-slate-500">Amount Paid:</span>
                              <span className="font-black text-emerald-700">{formatCurrency(paid)}</span>
                            </div>
                            {(disc > 0 || late > 0) && (
                              <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5 pt-0.5 border-t border-slate-100">
                                {disc > 0 && <span>Disc: -₹{disc}</span>}
                                {late > 0 && <span>Late: +₹{late}</span>}
                              </div>
                            )}
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex flex-col items-start gap-1">
                            <span className={`px-2.5 py-0.5 text-[10px] font-extrabold rounded-full uppercase tracking-wider border ${
                              record.status === 'Paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                              record.status === 'Pending' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                              record.status === 'Partial' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                              record.status === 'Waived' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                              'bg-rose-50 text-rose-700 border-rose-200'
                            }`}>
                              {record.status}
                            </span>
                            <span className="text-[10px] font-medium text-slate-500 flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              Due: {record.dueDate || 'N/A'}
                            </span>
                            {record.paidDate && (
                              <span className="text-[10px] font-medium text-emerald-600 flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" />
                                Paid: {record.paidDate}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button 
                              onClick={() => { setSelectedReceipt(record); setShowReceiptModal(true); }}
                              title="View Receipt"
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={() => openEditPayment(record)}
                              title="Edit Payment"
                              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={() => handlePaymentDelete(record._id || record.id)}
                              title="Delete Payment"
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="text-center py-16">
                      <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                        <FileText className="w-10 h-10 text-slate-300 mb-2" />
                        <h4 className="text-sm font-bold text-slate-800">No Payment Records Found</h4>
                        <p className="text-xs text-slate-500 mt-1">
                          Record student fee transactions or click &quot;Upload from Excel&quot; above to import bulk payments.
                        </p>
                      </div>
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
              {Math.min(paymentPage * itemsPerPage, filteredPayments.length)} of {filteredPayments.length} payment records
            </span>
            <div className="flex items-center gap-1.5">
              <button 
                onClick={() => setPaymentPage(prev => Math.max(prev - 1, 1))}
                disabled={paymentPage === 1}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 transition-colors disabled:opacity-50 flex items-center gap-1 shadow-2xs"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Previous
              </button>
              {Array.from({ length: totalPaymentPages }, (_, i) => i + 1).map(pageNum => (
                <button
                  key={pageNum}
                  onClick={() => setPaymentPage(pageNum)}
                  className={`w-7 h-7 rounded-lg text-xs font-bold transition-all border ${
                    paymentPage === pageNum 
                      ? 'bg-slate-900 border-slate-900 text-white shadow-2xs' 
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {pageNum}
                </button>
              ))}
              <button 
                onClick={() => setPaymentPage(prev => Math.min(prev + 1, totalPaymentPages))}
                disabled={paymentPage === totalPaymentPages}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 transition-colors disabled:opacity-50 flex items-center gap-1 shadow-2xs"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

      )}

      {/* MODAL 1: ADD / EDIT FEE STRUCTURE (Full Mind Map Fields) */}
      <AnimatePresence>
        {showFeeModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl p-6 shadow-2xl w-full max-w-xl border border-slate-100 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center pb-4 border-b border-slate-100 mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-slate-900 text-white rounded-xl">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      {editingFee ? 'Edit Fee Structure & Scope' : 'Create New Fee Structure'}
                    </h3>
                    <p className="text-[11px] text-slate-500">Configure financial details, recurring rules, and batch associations</p>
                  </div>
                </div>
                <button 
                  onClick={() => { setShowFeeModal(false); setEditingFee(null); }} 
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleFeeSubmit} className="space-y-4">
                
                {/* Fee Types & Name */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block mb-1">Fee Category Type *</label>
                    <select
                      value={feeForm.feeType}
                      onChange={(e) => setFeeForm({...feeForm, feeType: e.target.value})}
                      className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-semibold bg-slate-50 outline-none focus:border-slate-400 transition-colors cursor-pointer"
                    >
                      <option value="Registration Fee">Registration Fee</option>
                      <option value="Monthly Tuition">Monthly Tuition</option>
                      <option value="Exam Fee">Exam Fee</option>
                      <option value="Material Fee">Material Fee</option>
                      <option value="Other">Other Category</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block mb-1">Fee Structure Name *</label>
                    <input 
                      type="text"
                      required
                      value={feeForm.name}
                      onChange={(e) => setFeeForm({...feeForm, name: e.target.value})}
                      placeholder="e.g. Tuition Fee - Core JEE"
                      className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 outline-none focus:border-slate-400 font-semibold transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block mb-1">Description</label>
                  <input 
                    type="text"
                    value={feeForm.description}
                    onChange={(e) => setFeeForm({...feeForm, description: e.target.value})}
                    placeholder="e.g. Comprehensive curriculum and digital portal fees"
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 outline-none focus:border-slate-400 transition-colors"
                  />
                </div>

                {/* Financial Details */}
                <div className="p-3.5 bg-slate-50/80 border border-slate-200/80 rounded-xl space-y-3">
                  <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider block">Financial Details</span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Amount (₹) *</label>
                      <input 
                        type="number"
                        required
                        min="0"
                        value={feeForm.amount}
                        onChange={(e) => setFeeForm({...feeForm, amount: e.target.value})}
                        placeholder="12500"
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold bg-white outline-none focus:border-slate-400 transition-colors"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Frequency *</label>
                      <select
                        value={feeForm.frequency}
                        onChange={(e) => setFeeForm({...feeForm, frequency: e.target.value})}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold bg-white outline-none focus:border-slate-400 transition-colors cursor-pointer"
                      >
                        <option value="One-time">One-time</option>
                        <option value="Monthly">Monthly</option>
                        <option value="Quarterly">Quarterly</option>
                        <option value="Yearly">Yearly</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Due Day (1-31) *</label>
                      <input 
                        type="number"
                        min="1"
                        max="31"
                        required
                        value={feeForm.dueDay}
                        onChange={(e) => setFeeForm({...feeForm, dueDay: Number(e.target.value)})}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold bg-white outline-none focus:border-slate-400 transition-colors"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input 
                      type="checkbox"
                      id="isMandatory"
                      checked={feeForm.isMandatory}
                      onChange={(e) => setFeeForm({...feeForm, isMandatory: e.target.checked})}
                      className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer w-4 h-4"
                    />
                    <label htmlFor="isMandatory" className="text-xs font-bold text-slate-700 cursor-pointer">
                      Mandatory Fee (Applied automatically to associated students)
                    </label>
                  </div>
                </div>

                {/* Scope and Relations */}
                <div className="p-3.5 bg-slate-50/80 border border-slate-200/80 rounded-xl space-y-3">
                  <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider block">Scope & Association</span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Program Association</label>
                      <input 
                        type="text"
                        value={feeForm.programAssociation}
                        onChange={(e) => setFeeForm({...feeForm, programAssociation: e.target.value})}
                        placeholder="e.g. STEM / All Programs"
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium bg-white outline-none focus:border-slate-400 transition-colors"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Batch Association</label>
                      <input 
                        type="text"
                        value={feeForm.batchAssociation}
                        onChange={(e) => setFeeForm({...feeForm, batchAssociation: e.target.value})}
                        placeholder="e.g. JEE 2026-A / All Batches"
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium bg-white outline-none focus:border-slate-400 transition-colors"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Academic Year</label>
                      <input 
                        type="text"
                        required
                        value={feeForm.academicYear}
                        onChange={(e) => setFeeForm({...feeForm, academicYear: e.target.value})}
                        placeholder="2024-25"
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium bg-white outline-none focus:border-slate-400 transition-colors"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => { setShowFeeModal(false); setEditingFee(null); }}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={actionLoading}
                    className="px-6 py-2.5 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
                  >
                    {actionLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    {editingFee ? 'Save Changes' : 'Create Fee Structure'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: RECORD / EDIT PAYMENT TRANSACTION (Full Mind Map Fields) */}
      <AnimatePresence>
        {showPaymentModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl p-6 shadow-2xl w-full max-w-xl border border-slate-100 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center pb-4 border-b border-slate-100 mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-emerald-600 text-white rounded-xl">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      {editingPayment ? 'Edit Payment Record' : 'Record Student Fee Transaction'}
                    </h3>
                    <p className="text-[11px] text-slate-500">Record receipt number, financial breakdown, discount, and payment logistics</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowPaymentModal(false)} 
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handlePaymentSubmit} className="space-y-4">
                
                {/* Student Records & Fee Structure Link */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block mb-1">Select Student *</label>
                    <select
                      required
                      value={paymentForm.studentId}
                      onChange={(e) => setPaymentForm({...paymentForm, studentId: e.target.value})}
                      className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-semibold bg-slate-50 outline-none focus:border-slate-400 transition-colors cursor-pointer"
                    >
                      <option value="">-- Choose Student --</option>
                      {students.map((st) => (
                        <option key={st._id || st.id} value={st._id || st.id}>
                          {st.name} ({st.rollNo || 'No Roll'} • {st.class || 'Class 11'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block mb-1">Fee Structure Link *</label>
                    <select
                      required
                      value={paymentForm.feeStructureId}
                      onChange={(e) => handlePaymentFeeSelection(e.target.value)}
                      className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-semibold bg-slate-50 outline-none focus:border-slate-400 transition-colors cursor-pointer"
                    >
                      <option value="">-- Choose Fee Type --</option>
                      {feeTypes.map((type) => (
                        <option key={type._id || type.id} value={type._id || type.id}>
                          {type.name} ({formatCurrency(type.amount)} • {type.feeType})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Transaction Details & Calculation */}
                <div className="p-3.5 bg-slate-50/80 border border-slate-200/80 rounded-xl space-y-3">
                  <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider block">Transaction Financials & Breakdown</span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Amount Due (₹)</label>
                      <input 
                        type="number"
                        required
                        min="0"
                        value={paymentForm.amountDue}
                        onChange={(e) => setPaymentForm({...paymentForm, amountDue: e.target.value})}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold bg-white outline-none focus:border-slate-400 transition-colors"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Discount (₹)</label>
                      <input 
                        type="number"
                        min="0"
                        value={paymentForm.discount}
                        onChange={(e) => setPaymentForm({...paymentForm, discount: e.target.value})}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold bg-white outline-none focus:border-slate-400 transition-colors"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Late Fee (+₹)</label>
                      <input 
                        type="number"
                        min="0"
                        value={paymentForm.lateFee}
                        onChange={(e) => setPaymentForm({...paymentForm, lateFee: e.target.value})}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold bg-white outline-none focus:border-slate-400 transition-colors"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest block mb-1">Amount Paid (₹) *</label>
                      <input 
                        type="number"
                        required
                        min="0"
                        value={paymentForm.amountPaid}
                        onChange={(e) => setPaymentForm({...paymentForm, amountPaid: e.target.value})}
                        className="w-full px-3 py-1.5 border border-emerald-300 rounded-lg text-xs font-black bg-emerald-50 text-emerald-900 outline-none focus:border-emerald-500 transition-colors"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 pt-1 border-t border-slate-200/60">
                    <span>Computed Net Payable: {formatCurrency(Math.max(0, Number(paymentForm.amountDue || 0) + Number(paymentForm.lateFee || 0) - Number(paymentForm.discount || 0)))}</span>
                    <span className="text-slate-500 text-[11px]">Auto status will be set based on payment</span>
                  </div>
                </div>

                {/* Payment Logistics */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block mb-1">Payment Method *</label>
                    <select
                      value={paymentForm.paymentMethod}
                      onChange={(e) => setPaymentForm({...paymentForm, paymentMethod: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold bg-slate-50 outline-none focus:border-slate-400 transition-colors cursor-pointer"
                    >
                      <option value="UPI">UPI / QR</option>
                      <option value="Cash">Cash</option>
                      <option value="Card">Debit / Credit Card</option>
                      <option value="Net Banking">Net Banking</option>
                      <option value="Cheque">Cheque</option>
                      <option value="DD">Demand Draft (DD)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block mb-1">Receipt Number *</label>
                    <input 
                      type="text"
                      required
                      value={paymentForm.receiptNumber}
                      onChange={(e) => setPaymentForm({...paymentForm, receiptNumber: e.target.value})}
                      placeholder="REC-2026-XXXX"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono font-bold bg-slate-50 outline-none focus:border-slate-400 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block mb-1">Transaction / Ref ID</label>
                    <input 
                      type="text"
                      value={paymentForm.transactionId}
                      onChange={(e) => setPaymentForm({...paymentForm, transactionId: e.target.value})}
                      placeholder="e.g. TXN-849200"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono bg-slate-50 outline-none focus:border-slate-400 transition-colors"
                    />
                  </div>
                </div>

                {/* Timeline and Status */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block mb-1">Due Date</label>
                    <input 
                      type="date"
                      required
                      value={paymentForm.dueDate}
                      onChange={(e) => setPaymentForm({...paymentForm, dueDate: e.target.value})}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-medium bg-slate-50 outline-none focus:border-slate-400 transition-colors cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block mb-1">Paid Date</label>
                    <input 
                      type="date"
                      value={paymentForm.paidDate}
                      onChange={(e) => setPaymentForm({...paymentForm, paidDate: e.target.value})}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-medium bg-slate-50 outline-none focus:border-slate-400 transition-colors cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block mb-1">Status Override</label>
                    <select
                      value={paymentForm.status}
                      onChange={(e) => setPaymentForm({...paymentForm, status: e.target.value})}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50 outline-none focus:border-slate-400 transition-colors cursor-pointer"
                    >
                      <option value="Paid">Paid</option>
                      <option value="Pending">Pending</option>
                      <option value="Partial">Partial</option>
                      <option value="Overdue">Overdue</option>
                      <option value="Waived">Waived / Scholarship</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block mb-1">Notes / Remarks</label>
                  <input 
                    type="text"
                    value={paymentForm.notes}
                    onChange={(e) => setPaymentForm({...paymentForm, notes: e.target.value})}
                    placeholder="e.g. Merit scholarship concession applied / Cheque cleared"
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 outline-none focus:border-slate-400 transition-colors"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowPaymentModal(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={actionLoading}
                    className="px-6 py-2.5 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
                  >
                    {actionLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    {editingPayment ? 'Save Changes' : 'Submit Transaction'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 3: RECEIPT PREVIEW & PRINT MODAL */}
      <AnimatePresence>
        {showReceiptModal && selectedReceipt && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl p-8 shadow-2xl w-full max-w-lg border border-slate-100 relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500" />
              
              <div className="flex justify-between items-start mb-6 pt-2">
                <div>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">FEE PAYMENT RECEIPT</h3>
                  <span className="text-xs font-mono font-bold text-blue-600 block mt-0.5">
                    {selectedReceipt.receiptNumber || 'REC-XXXX'}
                  </span>
                </div>
                <button 
                  onClick={() => setShowReceiptModal(false)} 
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-5 text-xs text-slate-700">
                {/* Student Info */}
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/60 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Student Details</span>
                    <h4 className="text-sm font-bold text-slate-900 mt-0.5">{selectedReceipt.studentName}</h4>
                    <span className="text-[11px] text-slate-500 block">
                      Roll No: {selectedReceipt.rollNo || 'N/A'} {selectedReceipt.class && `• Class: ${selectedReceipt.class}`}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Status</span>
                    <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full font-bold text-[11px] uppercase tracking-wider ${
                      selectedReceipt.status === 'Paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {selectedReceipt.status}
                    </span>
                  </div>
                </div>

                {/* Fee Structure Link & Breakdown */}
                <div className="border border-slate-200/80 rounded-xl overflow-hidden">
                  <div className="bg-slate-100/80 px-4 py-2 text-[10px] font-extrabold text-slate-600 uppercase tracking-widest flex justify-between">
                    <span>Fee Description</span>
                    <span>Amount</span>
                  </div>
                  <div className="p-4 space-y-2.5 divide-y divide-slate-100">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-800">{selectedReceipt.feeName} ({selectedReceipt.feeType || 'Tuition'})</span>
                      <span className="font-semibold text-slate-900">{formatCurrency(selectedReceipt.amountDue || 0)}</span>
                    </div>
                    {selectedReceipt.lateFee > 0 && (
                      <div className="flex justify-between items-center pt-2 text-rose-600">
                        <span>Late Fee Assessment</span>
                        <span>+ {formatCurrency(selectedReceipt.lateFee)}</span>
                      </div>
                    )}
                    {selectedReceipt.discount > 0 && (
                      <div className="flex justify-between items-center pt-2 text-emerald-600">
                        <span>Scholarship / Concession Discount</span>
                        <span>- {formatCurrency(selectedReceipt.discount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-2.5 font-black text-sm text-slate-900 border-t border-slate-200">
                      <span>Total Amount Paid</span>
                      <span className="text-emerald-700">{formatCurrency(selectedReceipt.amountPaid || 0)}</span>
                    </div>
                  </div>
                </div>

                {/* Logistics & Timeline */}
                <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50/70 rounded-xl border border-slate-200/60 text-[11px]">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Payment Method</span>
                    <span className="font-bold text-slate-800">{selectedReceipt.paymentMethod || 'UPI'}</span>
                    {selectedReceipt.transactionId && (
                      <span className="font-mono text-slate-500 block text-[10px] mt-0.5">Ref: {selectedReceipt.transactionId}</span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Transaction Date</span>
                    <span className="font-bold text-slate-800">{selectedReceipt.paidDate || selectedReceipt.dueDate || 'N/A'}</span>
                    <span className="text-slate-400 block text-[10px] mt-0.5">By: {selectedReceipt.recordedByName || 'Management'}</span>
                  </div>
                </div>

                {selectedReceipt.notes && (
                  <div className="p-3 bg-blue-50/60 text-blue-800 rounded-xl text-[11px] border border-blue-100">
                    <strong>Note:</strong> {selectedReceipt.notes}
                  </div>
                )}
              </div>

              <div className="mt-7 pt-4 border-t border-slate-100 flex items-center justify-between">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" /> Print / Save PDF
                </button>
                <button
                  onClick={() => setShowReceiptModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
                >
                  Close Receipt
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 4: EXCEL UPLOAD & FORMATTING GUIDE MODAL */}
      <AnimatePresence>
        {showExcelModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-2xl p-6 shadow-2xl w-full max-w-4xl border border-slate-100 max-h-[90vh] overflow-y-auto flex flex-col"
            >
              <div className="flex justify-between items-center pb-4 border-b border-slate-100 mb-5">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-xs">
                    <FileSpreadsheet className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900">
                      Excel / CSV Bulk Data Upload & Formatting Guide
                    </h3>
                    <p className="text-xs text-slate-500">
                      Check exact column schemas below, download a pre-formatted template, and bulk import records directly into Neon Postgres
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowExcelModal(false)} 
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Target Selector Tabs inside Modal */}
              <div className="flex items-center justify-between gap-4 mb-5 p-1 bg-slate-100/80 rounded-xl border border-slate-200/60">
                <button
                  onClick={() => {
                    setExcelTab('structures')
                    setParsedExcelRows([])
                    setExcelFile(null)
                  }}
                  className={`flex-1 py-2.5 px-4 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-2 ${
                    excelTab === 'structures'
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Layers className="w-4 h-4" />
                  1. Fee Structures Schema ({excelTab === 'structures' ? 'Active' : 'Switch'})
                </button>
                <button
                  onClick={() => {
                    setExcelTab('payments')
                    setParsedExcelRows([])
                    setExcelFile(null)
                  }}
                  className={`flex-1 py-2.5 px-4 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-2 ${
                    excelTab === 'payments'
                      ? 'bg-white text-emerald-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  2. Fee Payments Schema ({excelTab === 'payments' ? 'Active' : 'Switch'})
                </button>
              </div>

              {/* Step 1: Formatting Guide Table */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2.5">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Table className="w-4 h-4 text-indigo-600" />
                    Required Excel Columns & Formatting Specification ({excelTab === 'structures' ? 'Fee Structures' : 'Fee Payments'})
                  </h4>
                  <button
                    onClick={() => downloadSampleTemplate(excelTab)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold transition-all shadow-2xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download Pre-Formatted .XLSX Template
                  </button>
                </div>

                <div className="border border-slate-200/80 rounded-xl overflow-hidden bg-slate-50/50 max-h-56 overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100/90 border-b border-slate-200 font-extrabold text-slate-700 text-[11px] uppercase tracking-wider">
                        <th className="px-3.5 py-2.5">Excel Column Header</th>
                        <th className="px-3.5 py-2.5">Data Type</th>
                        <th className="px-3.5 py-2.5">Required?</th>
                        <th className="px-3.5 py-2.5">Formatting Rules & Example</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/60 text-slate-700">
                      {excelTab === 'structures' ? (
                        <>
                          <tr className="bg-white/80">
                            <td className="px-3.5 py-2 font-mono font-bold text-indigo-700">Fee Name</td>
                            <td className="px-3.5 py-2 font-semibold">Text</td>
                            <td className="px-3.5 py-2"><span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded font-bold text-[10px]">Required</span></td>
                            <td className="px-3.5 py-2 text-slate-600">Full name of the fee category. Example: <code className="bg-slate-100 px-1 rounded">Tuition Fee - Core JEE</code></td>
                          </tr>
                          <tr className="bg-white/80">
                            <td className="px-3.5 py-2 font-mono font-bold text-indigo-700">Fee Category</td>
                            <td className="px-3.5 py-2 font-semibold">Text</td>
                            <td className="px-3.5 py-2"><span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded font-bold text-[10px]">Required</span></td>
                            <td className="px-3.5 py-2 text-slate-600">Must be one of: <code className="bg-slate-100 px-1 rounded">Registration Fee</code>, <code className="bg-slate-100 px-1 rounded">Monthly Tuition</code>, <code className="bg-slate-100 px-1 rounded">Exam Fee</code>, <code className="bg-slate-100 px-1 rounded">Material Fee</code>, or <code className="bg-slate-100 px-1 rounded">Other</code></td>
                          </tr>
                          <tr className="bg-white/80">
                            <td className="px-3.5 py-2 font-mono font-bold text-indigo-700">Amount (INR)</td>
                            <td className="px-3.5 py-2 font-semibold">Number</td>
                            <td className="px-3.5 py-2"><span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded font-bold text-[10px]">Required</span></td>
                            <td className="px-3.5 py-2 text-slate-600">Numeric amount in Rupees without commas/currency symbols. Example: <code className="bg-slate-100 px-1 rounded">12500</code></td>
                          </tr>
                          <tr className="bg-white/80">
                            <td className="px-3.5 py-2 font-mono font-bold text-indigo-700">Frequency</td>
                            <td className="px-3.5 py-2 font-semibold">Text</td>
                            <td className="px-3.5 py-2"><span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded font-bold text-[10px]">Required</span></td>
                            <td className="px-3.5 py-2 text-slate-600">Must be: <code className="bg-slate-100 px-1 rounded">One-time</code>, <code className="bg-slate-100 px-1 rounded">Monthly</code>, <code className="bg-slate-100 px-1 rounded">Quarterly</code>, or <code className="bg-slate-100 px-1 rounded">Yearly</code></td>
                          </tr>
                          <tr className="bg-white/80">
                            <td className="px-3.5 py-2 font-mono font-bold text-slate-600">Due Day</td>
                            <td className="px-3.5 py-2 font-semibold">Number</td>
                            <td className="px-3.5 py-2"><span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded font-bold text-[10px]">Optional</span></td>
                            <td className="px-3.5 py-2 text-slate-600">Day of the month (1-31). Defaults to <code className="bg-slate-100 px-1 rounded">5</code> if omitted.</td>
                          </tr>
                          <tr className="bg-white/80">
                            <td className="px-3.5 py-2 font-mono font-bold text-slate-600">Mandatory</td>
                            <td className="px-3.5 py-2 font-semibold">Text</td>
                            <td className="px-3.5 py-2"><span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded font-bold text-[10px]">Optional</span></td>
                            <td className="px-3.5 py-2 text-slate-600"><code className="bg-slate-100 px-1 rounded">Yes</code> or <code className="bg-slate-100 px-1 rounded">No</code>. Defaults to <code className="bg-slate-100 px-1 rounded">Yes</code>.</td>
                          </tr>
                          <tr className="bg-white/80">
                            <td className="px-3.5 py-2 font-mono font-bold text-slate-600">Program / Batch</td>
                            <td className="px-3.5 py-2 font-semibold">Text</td>
                            <td className="px-3.5 py-2"><span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded font-bold text-[10px]">Optional</span></td>
                            <td className="px-3.5 py-2 text-slate-600">Target program or batch association. Defaults to <code className="bg-slate-100 px-1 rounded">All Programs</code> / <code className="bg-slate-100 px-1 rounded">All Batches</code>.</td>
                          </tr>
                        </>
                      ) : (
                        <>
                          <tr className="bg-white/80">
                            <td className="px-3.5 py-2 font-mono font-bold text-emerald-700">Student Roll No</td>
                            <td className="px-3.5 py-2 font-semibold">Text</td>
                            <td className="px-3.5 py-2"><span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded font-bold text-[10px]">Required</span></td>
                            <td className="px-3.5 py-2 text-slate-600">Student&apos;s unique roll number or ID. Example: <code className="bg-slate-100 px-1 rounded">RN-101</code></td>
                          </tr>
                          <tr className="bg-white/80">
                            <td className="px-3.5 py-2 font-mono font-bold text-emerald-700">Student Name</td>
                            <td className="px-3.5 py-2 font-semibold">Text</td>
                            <td className="px-3.5 py-2"><span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded font-bold text-[10px]">Required</span></td>
                            <td className="px-3.5 py-2 text-slate-600">Full name of the student. Example: <code className="bg-slate-100 px-1 rounded">Aarav Sharma</code></td>
                          </tr>
                          <tr className="bg-white/80">
                            <td className="px-3.5 py-2 font-mono font-bold text-emerald-700">Fee Structure Name</td>
                            <td className="px-3.5 py-2 font-semibold">Text</td>
                            <td className="px-3.5 py-2"><span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded font-bold text-[10px]">Required</span></td>
                            <td className="px-3.5 py-2 text-slate-600">Exact name of the Fee Structure this payment corresponds to. Example: <code className="bg-slate-100 px-1 rounded">Tuition Fee - Core JEE</code></td>
                          </tr>
                          <tr className="bg-white/80">
                            <td className="px-3.5 py-2 font-mono font-bold text-emerald-700">Amount Due & Paid</td>
                            <td className="px-3.5 py-2 font-semibold">Number</td>
                            <td className="px-3.5 py-2"><span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded font-bold text-[10px]">Required</span></td>
                            <td className="px-3.5 py-2 text-slate-600">Numeric amounts. Columns: <code className="bg-slate-100 px-1 rounded">Amount Due</code> and <code className="bg-slate-100 px-1 rounded">Amount Paid</code>. Example: <code className="bg-slate-100 px-1 rounded">12500</code></td>
                          </tr>
                          <tr className="bg-white/80">
                            <td className="px-3.5 py-2 font-mono font-bold text-slate-600">Discount & Late Fee</td>
                            <td className="px-3.5 py-2 font-semibold">Number</td>
                            <td className="px-3.5 py-2"><span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded font-bold text-[10px]">Optional</span></td>
                            <td className="px-3.5 py-2 text-slate-600">Concession or late fee amounts in Rupees. Defaults to <code className="bg-slate-100 px-1 rounded">0</code>.</td>
                          </tr>
                          <tr className="bg-white/80">
                            <td className="px-3.5 py-2 font-mono font-bold text-slate-600">Payment Method</td>
                            <td className="px-3.5 py-2 font-semibold">Text</td>
                            <td className="px-3.5 py-2"><span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded font-bold text-[10px]">Optional</span></td>
                            <td className="px-3.5 py-2 text-slate-600"><code className="bg-slate-100 px-1 rounded">UPI</code>, <code className="bg-slate-100 px-1 rounded">Cash</code>, <code className="bg-slate-100 px-1 rounded">Card</code>, <code className="bg-slate-100 px-1 rounded">Net Banking</code>, <code className="bg-slate-100 px-1 rounded">Cheque</code>, or <code className="bg-slate-100 px-1 rounded">DD</code>.</td>
                          </tr>
                          <tr className="bg-white/80">
                            <td className="px-3.5 py-2 font-mono font-bold text-slate-600">Receipt / Ref / Date</td>
                            <td className="px-3.5 py-2 font-semibold">Text/Date</td>
                            <td className="px-3.5 py-2"><span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded font-bold text-[10px]">Optional</span></td>
                            <td className="px-3.5 py-2 text-slate-600">Columns: <code className="bg-slate-100 px-1 rounded">Receipt Number</code>, <code className="bg-slate-100 px-1 rounded">Transaction ID</code>, <code className="bg-slate-100 px-1 rounded">Due Date</code>, <code className="bg-slate-100 px-1 rounded">Paid Date</code> (YYYY-MM-DD). Auto-generated if left blank!</td>
                          </tr>
                        </>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Step 2: File Selector Zone */}
              <div className="mb-6">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleExcelFileChange}
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                />
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-indigo-300 hover:border-indigo-500 bg-indigo-50/40 hover:bg-indigo-50/70 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all text-center"
                >
                  <Upload className="w-8 h-8 text-indigo-600 mb-2 animate-bounce" />
                  <h4 className="text-sm font-bold text-slate-900">
                    {excelFile ? `Selected File: ${excelFile.name}` : "Click here or Drop your Excel / CSV file to parse"}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Supports <code className="bg-white px-1.5 py-0.5 rounded font-mono font-bold text-slate-700 border border-slate-200">.xlsx</code>, <code className="bg-white px-1.5 py-0.5 rounded font-mono font-bold text-slate-700 border border-slate-200">.xls</code>, and <code className="bg-white px-1.5 py-0.5 rounded font-mono font-bold text-slate-700 border border-slate-200">.csv</code> spreadsheets
                  </p>
                </div>
              </div>

              {/* Step 3: Live Preview & Validation Table */}
              {parsedExcelRows.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                      Parsed Rows Preview ({parsedExcelRows.length} rows ready to import)
                    </h4>
                    <span className="text-[11px] font-bold text-slate-500">Showing first 5 rows</span>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-x-auto bg-slate-50 max-h-48 overflow-y-auto">
                    <table className="w-full text-left border-collapse text-[11px]">
                      <thead>
                        <tr className="bg-slate-200/80 border-b border-slate-300 font-extrabold text-slate-700 uppercase tracking-wider">
                          <th className="px-3 py-2">#</th>
                          {Object.keys(parsedExcelRows[0] || {}).slice(0, 7).map((header) => (
                            <th key={header} className="px-3 py-2">{header}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {parsedExcelRows.slice(0, 5).map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="px-3 py-2 font-bold text-slate-400">{idx + 1}</td>
                            {Object.keys(parsedExcelRows[0] || {}).slice(0, 7).map((header) => (
                              <td key={header} className="px-3 py-2 font-medium text-slate-800 truncate max-w-[150px]">
                                {String(row[header] ?? '')}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Modal Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-auto">
                <span className="text-xs text-slate-500 flex items-center gap-1 font-medium">
                  <Info className="w-4 h-4 text-indigo-500" />
                  All data is validated and stored directly inside your Neon Postgres table.
                </span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowExcelModal(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmBulkImport}
                    disabled={parsedExcelRows.length === 0 || excelUploading}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
                  >
                    {excelUploading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    Confirm & Bulk Import ({parsedExcelRows.length} Rows)
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  )
}
