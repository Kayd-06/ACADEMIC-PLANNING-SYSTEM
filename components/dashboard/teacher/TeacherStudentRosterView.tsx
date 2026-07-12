'use client'
import { useState, useEffect } from 'react'
import { ChevronDown, Filter, Mail, Phone, MessageSquare, User, Loader2, Search, Briefcase, MapPin } from 'lucide-react'
import { getBlobUrl } from '@/lib/blob'

function InfoField({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-slate-500 mb-0.5">{label}</p>
      <p className="text-[13px] font-medium text-slate-900 break-words">{value || <span className="text-slate-300">—</span>}</p>
    </div>
  )
}

const enrollmentStatusStyle: Record<string, string> = {
  active: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  dropped: 'text-rose-700 bg-rose-50 border-rose-200',
  transferred: 'text-amber-700 bg-amber-50 border-amber-200',
  completed: 'text-indigo-700 bg-indigo-50 border-indigo-200',
}

export default function TeacherStudentRosterView() {
  const [students, setStudents] = useState<any[]>([])
  const [activeStudent, setActiveStudent] = useState<any>(null)
  const [studentDetails, setStudentDetails] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isDetailsLoading, setIsDetailsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Filters
  const [classFilter, setClassFilter] = useState('All Classes')
  const [batchFilter, setBatchFilter] = useState('All Batches')
  const [programFilter, setProgramFilter] = useState('All Programs')

  useEffect(() => {
    fetchStudents()
  }, [])

  // Follow the sidebar's teacher-scoped Program/Batch switchers
  useEffect(() => {
    const applyProgram = () => setProgramFilter(localStorage.getItem('teacherSelectedProgram') || 'All Programs')
    const applyBatch = () => setBatchFilter(localStorage.getItem('teacherSelectedBatch') || 'All Batches')
    applyProgram()
    applyBatch()
    window.addEventListener('teacherProgramChanged', applyProgram)
    window.addEventListener('teacherBatchChanged', applyBatch)
    return () => {
      window.removeEventListener('teacherProgramChanged', applyProgram)
      window.removeEventListener('teacherBatchChanged', applyBatch)
    }
  }, [])

  useEffect(() => {
    if (activeStudent) {
      fetchStudentDetails(activeStudent._id)
    }
  }, [activeStudent])

  const fetchStudents = async () => {
    try {
      const res = await fetch('/api/students/roster')
      if (res.ok) {
        const data = await res.json()
        // /api/students/roster intentionally returns inactive students too;
        // filter them out here so a soft-deleted student doesn't show up to teachers.
        const active = data.filter((s: any) => s.isActive !== false)
        active.sort((a: any, b: any) => a.name.localeCompare(b.name))
        setStudents(active)
        if (active.length > 0) {
          setActiveStudent(active[0])
        }
      }
    } catch (error) {
      console.error('Failed to fetch roster', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchStudentDetails = async (id: string) => {
    setIsDetailsLoading(true)
    try {
      const res = await fetch(`/api/teacher-portal/students/${id}`)
      if (res.ok) {
        const data = await res.json()
        setStudentDetails(data)
      }
    } catch (error) {
      console.error('Failed to fetch details', error)
    } finally {
      setIsDetailsLoading(false)
    }
  }

  // Get unique filter options
  const classes = ['All Classes', ...Array.from(new Set(students.map(s => s.rawClass).filter(Boolean)))]
  const batches = ['All Batches', ...Array.from(new Set(students.map(s => s.batch).filter(Boolean)))]

  // Filter students. Program filtering matches each student's own `program`
  // field, mirroring the sidebar's Program switcher (management side).
  const filteredStudents = students.filter(s => {
    if (classFilter !== 'All Classes' && s.rawClass !== classFilter) return false
    if (batchFilter !== 'All Batches' && s.batch !== batchFilter) return false
    if (programFilter !== 'All Programs' && s.program !== programFilter) return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      return s.name.toLowerCase().includes(q) || (s.roll && s.roll.toLowerCase().includes(q))
    }
    return true
  })

  return (
    <div className="flex-1 p-8 overflow-hidden bg-slate-50 flex flex-col h-screen">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-8 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Student Roster</h1>
          <p className="text-[13px] text-slate-500 mt-1">
            View and track students in your assigned programs &amp; batches
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select 
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold shadow-sm outline-none cursor-pointer appearance-none"
          >
            {classes.map(c => <option key={c as string} value={c as string}>{c as string}</option>)}
          </select>
          <div className="relative">
            <select
              value={batchFilter}
              onChange={(e) => {
                const value = e.target.value
                setBatchFilter(value)
                if (value === 'All Batches') localStorage.removeItem('teacherSelectedBatch')
                else localStorage.setItem('teacherSelectedBatch', value)
                window.dispatchEvent(new Event('teacherBatchChanged'))
              }}
              className="pl-4 pr-10 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold shadow-sm outline-none cursor-pointer appearance-none"
            >
              {batches.map(b => <option key={b as string} value={b as string}>{b as string}</option>)}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Main Split Content */}
      <div className="flex gap-6 flex-1 overflow-hidden">
        
        {/* Left List (Master) */}
        <div className="w-80 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex-shrink-0">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h2 className="text-sm font-bold text-slate-900">Students ({filteredStudents.length})</h2>
            <button className="p-1 text-slate-400 hover:text-slate-600 transition-colors">
              <Filter className="w-4 h-4" />
            </button>
          </div>
          
          <div className="p-3 border-b border-slate-100 bg-white">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search students..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 placeholder-slate-400 outline-none focus:bg-white focus:border-indigo-500 transition-all"
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-32 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin mb-2" />
                <span className="text-xs">Loading...</span>
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="p-4 text-center text-slate-400 text-sm">No students found.</div>
            ) : (
              filteredStudents.map((student) => (
                <div 
                  key={student._id}
                  onClick={() => setActiveStudent(student)}
                  className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all border ${
                    activeStudent?._id === student._id 
                      ? 'bg-slate-50 border-slate-200 shadow-sm' 
                      : 'bg-white border-transparent hover:bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {student.profileImgUrl ? (
                      <img src={getBlobUrl(student.profileImgUrl)} alt={student.name} className="w-10 h-10 rounded-full object-cover shadow-sm shrink-0" />
                    ) : (
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-sm ${student.color}`}>
                        {student.initials}
                      </div>
                    )}
                    <div>
                      <h4 className="text-[13px] font-bold text-slate-900 truncate w-32">{student.name}</h4>
                      <p className="text-[11px] text-slate-500">Roll: {student.roll}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${student.isActive ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : 'text-slate-600 bg-slate-50 border-slate-200'}`}>
                    {student.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Detail (Detail) */}
        <div className="flex-1 overflow-y-auto pr-2 pb-8 space-y-6">
          
          {!activeStudent ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 flex flex-col items-center justify-center text-slate-400 h-full">
              <User className="w-16 h-16 mb-4 text-slate-300" />
              <p className="text-lg font-bold text-slate-600">No Student Selected</p>
              <p className="text-sm">Select a student from the roster to view their details.</p>
            </div>
          ) : isDetailsLoading ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 flex flex-col items-center justify-center text-slate-400 h-full">
               <Loader2 className="w-8 h-8 animate-spin mb-4 text-indigo-500" />
               <p className="text-sm font-medium">Loading student details...</p>
            </div>
          ) : studentDetails && (() => {
            const s = studentDetails.student ?? {}
            const guardians = studentDetails.guardians ?? []
            const enrollments = studentDetails.enrollments ?? []
            const primary = guardians.find((g: any) => g.isPrimary) ?? guardians[0]
            return (
            <>
              {/* Top Profile Card */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col sm:flex-row items-start justify-between gap-4">
                <div className="flex items-center gap-6">
                  {s.profileImgUrl ? (
                    <img src={getBlobUrl(s.profileImgUrl)} alt={activeStudent.name} className="w-20 h-20 rounded-full object-cover shadow-sm border-[3px] border-white ring-1 ring-slate-100" />
                  ) : (
                    <div className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold shadow-sm border-[3px] border-white ring-1 ring-slate-100 ${activeStudent.color}`}>
                      {activeStudent.initials}
                    </div>
                  )}
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 mb-1">{activeStudent.name}</h2>
                    <p className="text-[13px] text-slate-600 font-medium mb-3">
                      Class {activeStudent.class} • {activeStudent.batch} Batch • Roll No. {activeStudent.roll}
                      {s.admissionNumber ? ` • Adm. No. ${s.admissionNumber}` : ''}
                    </p>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 text-[12px] text-slate-500 font-medium">
                      <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> {primary?.email || s.email || 'No email on file'}</span>
                      <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> {primary?.phone || s.phone || activeStudent.contact}</span>
                    </div>
                  </div>
                </div>
                <button className="flex items-center gap-2 px-5 py-2.5 bg-[#0b1320] text-white text-sm font-bold rounded-lg shadow-sm hover:bg-slate-800 transition-colors shrink-0">
                  <MessageSquare className="w-4 h-4" /> Message Parent
                </button>
              </div>

              {/* Student Information */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <h3 className="text-sm font-bold text-slate-900 mb-6">Student Information</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-y-5 gap-x-4">
                  <InfoField label="Date of Birth" value={s.dob} />
                  <InfoField label="Gender" value={s.gender} />
                  <InfoField label="Blood Group" value={s.bloodGroup} />
                  <InfoField label="Aadhar Number" value={s.aadharNumber} />
                  <InfoField label="Email" value={s.email} />
                  <InfoField label="Phone" value={s.phone} />
                  <InfoField label="Previous School" value={s.previousSchool} />
                  <InfoField label="Previous %" value={s.previousPercentage} />
                  <InfoField label="Admission Date" value={s.admissionDate} />
                  <InfoField label="Status" value={s.status} />
                  <div className="col-span-2">
                    <InfoField label="Address" value={[s.addressLine1, s.city, s.state, s.pincode].filter(Boolean).join(', ')} />
                  </div>
                  {s.notes && (
                    <div className="col-span-full">
                      <InfoField label="Notes" value={s.notes} />
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                
                {/* Left Column in Detail */}
                <div className="space-y-6">
                  {/* Current Performance */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                    <h3 className="text-sm font-bold text-slate-900 mb-6">Current Performance Average</h3>
                    
                    {studentDetails.currentPerformance.length === 0 ? (
                      <p className="text-sm text-slate-500 italic mb-8">No performance data uploaded yet.</p>
                    ) : (
                      <div className="space-y-5 mb-8">
                        {studentDetails.currentPerformance.map((perf: any, idx: number) => (
                          <div key={idx}>
                            <div className="flex justify-between text-[12px] font-bold text-slate-700 mb-1.5">
                              <span>{perf.subject}</span>
                              <span>{perf.average}%</span>
                            </div>
                            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-[#0b1320] rounded-full" style={{ width: `${perf.average}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Circular Gauge Card */}
                    <div className="p-4 border border-emerald-100 bg-emerald-50/30 rounded-xl flex items-center gap-6">
                      <div className="w-16 h-16 rounded-full border-[4px] border-emerald-100 flex items-center justify-center relative">
                        <div className="absolute inset-0 rounded-full border-[4px] border-emerald-500 border-r-transparent border-b-transparent transform rotate-45" />
                        <span className="text-sm font-bold text-slate-900">{studentDetails.attendance}%</span>
                      </div>
                      <div>
                        <h4 className="text-[14px] font-bold text-slate-900">Attendance</h4>
                        <p className="text-[12px] text-slate-500 font-medium">Present {studentDetails.attendanceDays} days</p>
                      </div>
                    </div>
                  </div>

                  {/* Parents / Guardians */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                    <h3 className="text-sm font-bold text-slate-900 mb-6">Parents / Guardians</h3>
                    {guardians.length === 0 ? (
                      <p className="text-sm text-slate-500 italic">No guardian details on file.</p>
                    ) : (
                      <div className="space-y-3">
                        {guardians.map((g: any) => (
                          <div key={g.id} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                            <div className="flex items-start gap-4">
                              <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 flex-shrink-0">
                                <User className="w-5 h-5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1 gap-2">
                                  <h5 className="text-[14px] font-bold text-slate-900 truncate">{g.name}</h5>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {g.isPrimary && (
                                      <span className="text-[9px] font-bold text-emerald-700 uppercase tracking-widest bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">Primary</span>
                                    )}
                                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest bg-white px-2 py-0.5 rounded border border-slate-200">{g.relationship}</span>
                                  </div>
                                </div>
                                <div className="space-y-1 mt-2">
                                  {g.phone && <p className="text-[12px] text-slate-600 flex items-center gap-2"><Phone className="w-3 h-3 shrink-0" /> {g.phone}{g.altPhone ? ` / ${g.altPhone}` : ''}</p>}
                                  {g.email && <p className="text-[12px] text-slate-600 flex items-center gap-2"><Mail className="w-3 h-3 shrink-0" /> <span className="truncate">{g.email}</span></p>}
                                  {g.occupation && <p className="text-[12px] text-slate-600 flex items-center gap-2"><Briefcase className="w-3 h-3 shrink-0" /> {g.occupation}</p>}
                                  {(g.addressLine1 || g.city) && (
                                    <p className="text-[12px] text-slate-600 flex items-center gap-2"><MapPin className="w-3 h-3 shrink-0" /> <span className="truncate">{[g.addressLine1, g.city, g.state, g.pincode].filter(Boolean).join(', ')}</span></p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column in Detail */}
                <div className="space-y-6">
                  
                  {/* Recent Tests */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-slate-100">
                      <h3 className="text-sm font-bold text-slate-900">Recent Tests</h3>
                    </div>
                    {studentDetails.recentTests.length === 0 ? (
                      <div className="p-5 text-center text-sm text-slate-500">No tests logged.</div>
                    ) : (
                      <table className="w-full">
                        <thead>
                          <tr className="bg-slate-50/50">
                            <th className="px-5 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Test</th>
                            <th className="px-5 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Date</th>
                            <th className="px-5 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Score</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {studentDetails.recentTests.map((t: any, idx: number) => (
                            <tr key={idx}>
                              <td className="px-5 py-3 text-[13px] font-semibold text-slate-700">{t.test}</td>
                              <td className="px-5 py-3 text-[12px] text-slate-500">{t.date}</td>
                              <td className="px-5 py-3 text-[13px] font-bold text-slate-900">{t.score}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {/* Batch Enrollments */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                    <h3 className="text-sm font-bold text-slate-900 mb-6">Batch Enrollments</h3>
                    {enrollments.length === 0 ? (
                      <p className="text-sm text-slate-500 italic">No batch enrollments recorded.</p>
                    ) : (
                      <div className="space-y-2">
                        {enrollments.map((e: any) => (
                          <div key={e.id} className="bg-slate-50 rounded-xl p-3.5 border border-slate-100 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-[13px] font-bold text-slate-900 truncate">{e.batchName}</p>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                {e.rollNumber ? `Roll ${e.rollNumber}` : 'No roll'}{e.enrollmentDate ? ` • Enrolled ${e.enrollmentDate}` : ''}
                              </p>
                            </div>
                            <span className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-full border shrink-0 ${enrollmentStatusStyle[e.status] ?? 'border-slate-200 text-slate-600 bg-white'}`}>
                              {e.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Counseling Notes */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                    <h3 className="text-sm font-bold text-slate-900 mb-6">Counseling Notes</h3>
                    
                    {studentDetails.counselingNotes.length === 0 ? (
                      <div className="text-center text-sm text-slate-500 italic">No counseling notes found.</div>
                    ) : (
                      <div className="space-y-6 relative before:absolute before:inset-0 before:ml-2 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                        
                        {studentDetails.counselingNotes.map((note: any, idx: number) => (
                          <div key={idx} className="relative flex flex-col md:flex-row items-start gap-4">
                            <div className={`w-4 h-4 rounded-full ${idx === 0 ? 'bg-[#0b1320]' : 'bg-slate-300'} border-4 border-white ring-1 ring-slate-200 z-10 flex-shrink-0 mt-0.5 hidden md:block`} />
                            <div>
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">{note.date}</p>
                              <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                                <p className="text-[12px] text-slate-600 leading-relaxed">{note.notes}</p>
                              </div>
                            </div>
                          </div>
                        ))}

                      </div>
                    )}
                  </div>

                </div>
              </div>
            </>
            )
          })()}

        </div>

      </div>

    </div>
  )
}
