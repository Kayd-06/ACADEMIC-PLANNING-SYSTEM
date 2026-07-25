'use client'
import { useState, useEffect } from 'react'
import SyllabusKanbanBoard from '@/components/dashboard/SyllabusKanbanBoard'

export default function FacultyAcademicPlanningView() {
  const [batches, setBatches] = useState<string[]>([])

  useEffect(() => {
    fetch('/api/batches')
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        if (Array.isArray(data)) {
          setBatches(data.map((b: any) => b.name).filter(Boolean))
        }
      })
      .catch(() => setBatches([]))
  }, [])

  return (
    <div className="flex-1 p-8 overflow-auto bg-slate-50 min-h-screen relative">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Academic Planning</h1>
        <p className="text-[13px] text-slate-500 mt-1">
          Track syllabus coverage for your assigned batches and subjects.
        </p>
      </div>

      <SyllabusKanbanBoard batches={batches} />
    </div>
  )
}
