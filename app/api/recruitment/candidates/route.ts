import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Candidate from '@/models/Candidate'

export async function GET() {
  try {
    await connectDB()
    const candidates = await Candidate.find().sort({ createdAt: -1 })
    
    // If no candidates exist, seed some dummy data for the user to see immediately
    if (candidates.length === 0) {
      const dummyCandidates = [
        { name: 'Dr. Sarah Jenkins', roleApplied: 'Associate Professor', department: 'Computer Science', status: 'Interview Scheduled', nextStep: 'Panel Review - Oct 10' },
        { name: 'Michael Chang', roleApplied: 'Assistant Lecturer', department: 'Mathematics', status: 'Shortlisted', nextStep: 'Schedule Initial Call' },
        { name: 'Dr. Emily Rostova', roleApplied: 'Head of Department', department: 'Physics', status: 'Offer Extended', nextStep: 'Awaiting Acceptance' },
        { name: 'James Wilson', roleApplied: 'Research Fellow', department: 'Biology', status: 'Under Review', nextStep: 'Committee Evaluation' }
      ]
      await Candidate.insertMany(dummyCandidates)
      return NextResponse.json(await Candidate.find().sort({ createdAt: -1 }))
    }

    return NextResponse.json(candidates)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    await connectDB()
    const body = await req.json()
    const candidate = await Candidate.create(body)
    return NextResponse.json(candidate)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
