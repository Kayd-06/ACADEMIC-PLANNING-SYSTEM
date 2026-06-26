'use client'
import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'

interface StudentFormValues {
  name: string
  rollNo: string
  class: string
  section: string
  program: string
  batch: string
  parentContact: string
}

const EMPTY_FORM: StudentFormValues = { name: '', rollNo: '', class: '', section: '', program: '', batch: '', parentContact: '' }

interface StudentFormModalProps {
  mode: 'add' | 'edit'
  student?: any
  onClose: () => void
  onSaved: () => void
}

function valuesFromStudent(student: any): StudentFormValues {
  return {
    name: student.name || '',
    rollNo: student.roll && student.roll !== 'N/A' ? student.roll : '',
    class: student.rawClass || '',
    section: student.rawSection || '',
    program: student.program && student.program !== 'Unassigned' ? student.program : '',
    batch: student.batch && student.batch !== 'Unassigned' ? student.batch : '',
    parentContact: student.contact && student.contact !== 'N/A' ? student.contact : '',
  }
}

export default function StudentFormModal({ mode, student, onClose, onSaved }: StudentFormModalProps) {
  const [form, setForm] = useState<StudentFormValues>(
    mode === 'edit' && student ? valuesFromStudent(student) : EMPTY_FORM
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) {
      setError('Student name is required.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const url = mode === 'add' ? '/api/students' : `/api/students?id=${student._id}`
      const method = mode === 'add' ? 'POST' : 'PATCH'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Something went wrong. Please try again.')
        return
      }
      onSaved()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const inputClass = 'w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400'
  const labelClass = 'block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5'

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/30 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">{mode === 'add' ? 'Add Student' : 'Edit Student'}</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <p className="text-sm text-rose-600 font-medium">{error}</p>}
          <div>
            <label className={labelClass}>Name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Roll No</label>
              <input value={form.rollNo} onChange={(e) => setForm({ ...form, rollNo: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Class</label>
              <input value={form.class} onChange={(e) => setForm({ ...form, class: e.target.value })} className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Section</label>
              <input value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Parent Contact</label>
              <input value={form.parentContact} onChange={(e) => setForm({ ...form, parentContact: e.target.value })} className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Program</label>
              <input value={form.program} onChange={(e) => setForm({ ...form, program: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Batch</label>
              <input value={form.batch} onChange={(e) => setForm({ ...form, batch: e.target.value })} className={inputClass} />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-bold rounded-lg hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-[#0b1320] text-white text-sm font-bold rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === 'add' ? 'Add Student' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
