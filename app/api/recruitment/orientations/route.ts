import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Orientation from '@/models/Orientation'

export async function GET() {
  try {
    await connectDB()
    const orientations = await Orientation.find().sort({ createdAt: 1 })
    
    if (orientations.length === 0) {
      const dummyOrientations = [
        { date: 'OCT 12', title: 'New Faculty Induction', location: 'Main Auditorium', time: '09:00 AM' },
        { date: 'OCT 15', title: 'LMS Training Workshop', location: 'Lab 3B', time: '02:00 PM' }
      ]
      await Orientation.insertMany(dummyOrientations)
      return NextResponse.json(await Orientation.find().sort({ createdAt: 1 }))
    }

    return NextResponse.json(orientations)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
