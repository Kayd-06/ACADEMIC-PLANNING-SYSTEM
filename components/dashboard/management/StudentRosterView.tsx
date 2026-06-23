'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, X, User, Phone, Briefcase, MapPin } from 'lucide-react'

// --- Mock Data ---
const STUDENTS = [
  { id: 1, roll: '24-11A-001', name: 'Karan Sharma', class: '11 - A', batch: 'JEE MAIN', batchTheme: 'blue', initials: 'KS', color: 'bg-amber-100 text-amber-700' },
  { id: 2, roll: '24-11A-002', name: 'Isha Patel', class: '11 - A', batch: 'NEET', batchTheme: 'green', initials: 'IP', color: 'bg-rose-100 text-rose-700' },
  { id: 3, roll: '24-11B-003', name: 'Rohan Gupta', class: '11 - B', batch: 'JEE ADV.', batchTheme: 'purple', initials: 'RG', color: 'bg-amber-100 text-amber-700' },
  { id: 4, roll: '24-11A-004', name: 'Meera Kumar', class: '11 - A', batch: 'NEET', batchTheme: 'green', initials: 'MK', color: 'bg-blue-100 text-blue-700' },
]

export default function StudentRosterView() {
  const [selectedStudent, setSelectedStudent] = useState<any>(null)

  return (
    <div className="flex-1 overflow-hidden bg-slate-50 relative flex h-screen">
      
      {/* Main Content Area */}
      <div className={`flex-1 p-8 overflow-auto transition-all duration-300 ${selectedStudent ? 'mr-[450px] blur-[2px] opacity-70 pointer-events-none' : ''}`}>
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Student Roster</h1>
          <p className="text-[13px] text-slate-500 mt-1">
            Manage student records, batches, and parent/guardian details
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mb-6">
          <div className="flex-1">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 pl-1">Class</label>
            <button className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-100 transition-colors">
              Class 11 <ChevronDown className="w-4 h-4 text-slate-400" />
            </button>
          </div>
          <div className="flex-1">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 pl-1">Section</label>
            <button className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-100 transition-colors">
              All Sections <ChevronDown className="w-4 h-4 text-slate-400" />
            </button>
          </div>
          <div className="flex-1">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 pl-1">Batch</label>
            <button className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-100 transition-colors">
              All Batches <ChevronDown className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Roll No</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Student Name</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Class & Sec</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Batch</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Contact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {STUDENTS.map((student) => (
                <tr 
                  key={student.id} 
                  onClick={() => setSelectedStudent(student)}
                  className="hover:bg-indigo-50/50 transition-colors cursor-pointer group"
                >
                  <td className="px-6 py-4 text-[13px] font-semibold text-slate-600">{student.roll}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold ${student.color}`}>
                        {student.initials}
                      </div>
                      <span className="text-[13px] font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{student.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-[13px] text-slate-700 font-medium">{student.class}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full uppercase tracking-wider ${
                      student.batchTheme === 'blue' ? 'bg-blue-50 text-blue-700' :
                      student.batchTheme === 'green' ? 'bg-emerald-50 text-emerald-700' :
                      'bg-purple-50 text-purple-700'
                    }`}>
                      {student.batch}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-[13px] text-slate-600">+91 98765...</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="p-4 border-t border-slate-100 bg-slate-50/50">
            <span className="text-[12px] text-slate-500 font-medium">Showing 1 to 4 of 124 entries</span>
          </div>
        </div>
      </div>

      {/* Side Drawer */}
      <AnimatePresence>
        {selectedStudent && (
          <>
            {/* Backdrop for mobile closing, though not strictly in mockup, good UX */}
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelectedStudent(null)}
              className="absolute inset-0 z-40 bg-slate-900/10 cursor-pointer"
            />
            
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute right-0 top-0 bottom-0 w-[450px] bg-white shadow-2xl border-l border-slate-200 z-50 flex flex-col"
            >
              
              {/* Drawer Header */}
              <div className="flex items-center justify-between p-6 border-b border-slate-100">
                <h2 className="text-lg font-bold text-slate-900">Student Profile</h2>
                <button 
                  onClick={() => setSelectedStudent(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                
                {/* Profile Identity */}
                <div className="flex flex-col items-center mb-8">
                  <div className={`w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold mb-4 shadow-sm border-4 border-white ring-2 ring-slate-100 ${selectedStudent.color}`}>
                    {selectedStudent.initials}
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-1">{selectedStudent.name}</h3>
                  <p className="text-[13px] text-slate-500 font-medium mb-4">Roll No: {selectedStudent.roll}</p>
                  
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full border ${
                      selectedStudent.batchTheme === 'blue' ? 'border-blue-200 text-blue-700 bg-blue-50/50' :
                      selectedStudent.batchTheme === 'green' ? 'border-emerald-200 text-emerald-700 bg-emerald-50/50' :
                      'border-purple-200 text-purple-700 bg-purple-50/50'
                    }`}>
                      {selectedStudent.batch} BATCH
                    </span>
                    <span className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full border border-indigo-200 text-indigo-700 bg-indigo-50/50">
                      CLASS {selectedStudent.class}
                    </span>
                  </div>
                </div>

                {/* Personal Information */}
                <div className="mb-8">
                  <h4 className="text-[13px] font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100">Personal Information</h4>
                  <div className="grid grid-cols-2 gap-y-4 gap-x-4">
                    <div>
                      <p className="text-[11px] font-semibold text-slate-500 mb-0.5">Date of Birth</p>
                      <p className="text-[13px] font-medium text-slate-900">15 Aug 2008</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-slate-500 mb-0.5">Gender</p>
                      <p className="text-[13px] font-medium text-slate-900">Female</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-slate-500 mb-0.5">Blood Group</p>
                      <p className="text-[13px] font-medium text-slate-900">O+</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-slate-500 mb-0.5">Admission Date</p>
                      <p className="text-[13px] font-medium text-slate-900">14 Apr 2024</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-[11px] font-semibold text-slate-500 mb-0.5">Address</p>
                      <p className="text-[13px] font-medium text-slate-900">402, Sunshine Heights, MG Road, Mumbai, Maharashtra 400001</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-[11px] font-semibold text-slate-500 mb-0.5">Previous School</p>
                      <p className="text-[13px] font-medium text-slate-900">Delhi Public School, Navi Mumbai</p>
                    </div>
                  </div>
                </div>

                {/* Parents/Guardians */}
                <div className="mb-8">
                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                    <h4 className="text-[13px] font-bold text-slate-900">Parents / Guardians</h4>
                    <button className="text-[11px] font-semibold text-indigo-600 hover:underline">Edit</button>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 flex-shrink-0">
                          <User className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <h5 className="text-[14px] font-bold text-slate-900">Rajesh Patel</h5>
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest bg-white px-2 py-0.5 rounded border border-slate-200">Father</span>
                          </div>
                          <div className="space-y-1 mt-2">
                            <p className="text-[12px] text-slate-600 flex items-center gap-2"><Phone className="w-3 h-3" /> +91 91234 56780</p>
                            <p className="text-[12px] text-slate-600 flex items-center gap-2"><Briefcase className="w-3 h-3" /> IT Consultant</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 flex-shrink-0">
                          <User className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <h5 className="text-[14px] font-bold text-slate-900">Anita Patel</h5>
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest bg-white px-2 py-0.5 rounded border border-slate-200">Mother</span>
                          </div>
                          <div className="space-y-1 mt-2">
                            <p className="text-[12px] text-slate-600 flex items-center gap-2"><Phone className="w-3 h-3" /> +91 98765 12345</p>
                            <p className="text-[12px] text-slate-600 flex items-center gap-2"><Briefcase className="w-3 h-3" /> Homemaker</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Fee Status */}
                <div>
                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                    <h4 className="text-[13px] font-bold text-slate-900">Fee Status</h4>
                    <button className="text-[11px] font-semibold text-indigo-600 hover:underline">View Ledger →</button>
                  </div>
                </div>

              </div>

              {/* Drawer Footer Actions */}
              <div className="p-6 border-t border-slate-100 bg-white grid grid-cols-2 gap-3">
                <button className="py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-bold rounded-lg hover:bg-slate-50 transition-colors shadow-sm">
                  Edit Profile
                </button>
                <button className="py-2.5 bg-[#0b1320] text-white text-sm font-bold rounded-lg hover:bg-slate-800 transition-colors shadow-sm">
                  Message Parent
                </button>
              </div>

            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  )
}
