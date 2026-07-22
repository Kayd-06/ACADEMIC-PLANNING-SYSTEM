'use client'
import { useState, useEffect } from 'react'
import { Upload, Loader2 } from 'lucide-react'
import FacultyCsvUploadModal from './FacultyCsvUploadModal'
import Avatar from '../Avatar'

export default function FacultyTab() {
  const [facultyList, setFacultyList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showImport, setShowImport] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  useEffect(() => { fetchFaculty() }, [])

  async function fetchFaculty() {
    setLoading(true)
    try {
      const res = await fetch('/api/teacher-portal/faculty')
      const data = await res.json()
      if (Array.isArray(data)) setFacultyList(data)
    } catch (err) {
      console.error('Failed to fetch faculty', err)
    } finally {
      setLoading(false)
    }
  }

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelectedIds((prev) =>
      prev.size === facultyList.length ? new Set() : new Set(facultyList.map((f) => f.id))
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <p className="text-[13px] text-slate-500">
          {facultyList.length} faculty member{facultyList.length === 1 ? '' : 's'} across all batches
        </p>
        <button
          onClick={() => setShowImport(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#0b1320] hover:bg-slate-800 text-white rounded-lg text-sm font-semibold transition-all shadow-sm active:scale-95"
        >
          <Upload className="w-4 h-4" /> Import CSV
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
        </div>
      ) : facultyList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500">
          <p className="text-sm">No faculty found. Import a CSV to get started.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left w-10">
                  <input
                    type="checkbox"
                    checked={facultyList.length > 0 && selectedIds.size === facultyList.length}
                    onChange={toggleAll}
                    aria-label="Select all faculty"
                  />
                </th>
                <th className="px-6 py-3 text-left font-bold text-slate-400 uppercase tracking-wider text-[10px] w-14">Avatar</th>
                {['Name', 'Employee ID', 'Subject / Specialization', 'Batches', 'Status'].map((h) => (
                  <th key={h} className="px-6 py-3 text-left font-bold text-slate-400 uppercase tracking-wider text-[10px]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {facultyList.map((f) => (
                <tr key={f.id} className="hover:bg-slate-50/70">
                  <td className="px-6 py-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(f.id)}
                      onChange={() => toggleRow(f.id)}
                      aria-label={`Select ${f.name}`}
                    />
                  </td>
                  <td className="px-6 py-4">
                    <Avatar src={f.profileImgUrl} name={f.name} size="w-8 h-8" />
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-900">{f.name}</td>
                  <td className="px-6 py-4 text-slate-500">{f.employeeId || '—'}</td>
                  <td className="px-6 py-4 text-slate-600">{f.subject}{f.specialization ? ` — ${f.specialization}` : ''}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1.5">
                      {(f.batchAssignments || []).length === 0 ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        f.batchAssignments.map((b: any) => (
                          <span key={b.id} className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 rounded-md">
                            {b.batchName}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full border uppercase tracking-wider ${
                      f.status === 'ACTIVE' ? 'border-emerald-200 text-emerald-700 bg-emerald-50' :
                      f.status === 'ON_LEAVE' ? 'border-amber-200 text-amber-700 bg-amber-50' :
                      'border-slate-200 text-slate-700 bg-slate-50'
                    }`}>{f.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showImport && (
        <FacultyCsvUploadModal
          onClose={() => setShowImport(false)}
          onImported={() => { setShowImport(false); fetchFaculty() }}
        />
      )}
    </div>
  )
}
