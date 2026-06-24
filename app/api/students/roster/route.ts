import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Student from '@/models/Student'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    await connectDB()
    
    // Fetch all students
    const students = await Student.find().sort({ 'class': 1, section: 1, name: 1 }).lean()

    // Map to the required view format
    const roster = students.map((s: any) => {
      // Default color logic based on some hash or simple rotation
      const colors = ['bg-amber-100 text-amber-700', 'bg-rose-100 text-rose-700', 'bg-indigo-100 text-indigo-700', 'bg-emerald-100 text-emerald-700', 'bg-blue-100 text-blue-700', 'bg-purple-100 text-purple-700']
      const nameHash = s.name.length % colors.length
      
      const initials = s.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
      
      return {
        _id: s._id.toString(),
        roll: s.rollNo || 'N/A',
        name: s.name,
        class: `${s.class || 'N/A'} - ${s.section || 'N/A'}`,
        rawClass: s.class || '',
        rawSection: s.section || '',
        batch: s.batch || 'Unassigned',
        batchTheme: 'blue', // defaults
        initials,
        color: colors[nameHash],
        contact: s.parentContact || 'N/A',
        isActive: s.isActive
      }
    })

    return NextResponse.json(roster)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
