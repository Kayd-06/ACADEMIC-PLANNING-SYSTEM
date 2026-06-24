import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Candidate from '@/models/Candidate'
import Appraisal from '@/models/Appraisal'
import RecruitmentKPI from '@/models/RecruitmentKPI'

const DEFAULT_KPIS = [
  { label: 'Open Positions', value: '12', subtext: '+2 this month', iconName: 'Briefcase', subcolor: 'text-green-600', subbg: 'bg-green-50', order: 1 },
  { label: 'Active Candidates', value: '34', subtext: '+8 this week', iconName: 'Users', subcolor: 'text-green-600', subbg: 'bg-green-50', order: 2 },
  { label: 'Interviews This Week', value: '8', subtext: '3 today', iconName: 'Calendar', subcolor: 'text-blue-600', subbg: 'bg-blue-50', order: 3 },
  { label: 'Offers Extended', value: '3', subtext: 'All accepted', iconName: 'CheckCircle2', subcolor: 'text-emerald-600', subbg: 'bg-emerald-50', order: 4 }
]

const DEFAULT_CANDIDATES = [
  { avatarInitials: 'AS', name: 'Alice Smith', roleApplied: 'Mathematics HOD', department: 'SCIENCE', theme: 'blue', status: 'Requirement' },
  { avatarInitials: 'BJ', name: 'Bob Jones', roleApplied: 'Physics Teacher', department: 'SCIENCE', theme: 'blue', status: 'Requirement' },
  { avatarInitials: 'CW', name: 'Claire Williams', roleApplied: 'Librarian', department: 'ADMIN', theme: 'blue', status: 'Shortlisted' },
  { avatarInitials: 'DP', name: 'David Patel', roleApplied: 'Sports Coach', department: 'ATHLETICS', theme: 'indigo', status: 'Shortlisted' },
  { avatarInitials: 'EM', name: 'Emma Martinez', roleApplied: 'English Lit', department: 'ARTS', theme: 'blue', status: 'Interview Scheduled', schedule: 'Tomorrow, 10:00 AM' }
]

const DEFAULT_APPRAISALS = [
  { avatarInitials: 'TH', facultyName: 'Tom Harris', department: 'Mathematics', reviewType: 'Annual', rating: 'Outstanding', scheduledDate: 'Oct 12, 2023', isCompleted: true },
  { avatarInitials: 'SJ', facultyName: 'Sarah Jenkins', department: 'Science', reviewType: 'Probation', rating: 'Excellent', scheduledDate: 'Oct 15, 2023', isCompleted: true },
  { avatarInitials: 'MB', facultyName: 'Michael Brown', department: 'History', reviewType: 'Annual', rating: 'Satisfactory', scheduledDate: 'Oct 18, 2023', isCompleted: false },
  { avatarInitials: 'LK', facultyName: 'Laura King', department: 'Physical Ed.', reviewType: 'Mid-Year', rating: 'Needs Improvement', scheduledDate: 'Oct 20, 2023', isCompleted: false }
]

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await connectDB()

    let kpis = await RecruitmentKPI.find().sort({ order: 1 })
    if (kpis.length === 0) {
      await RecruitmentKPI.insertMany(DEFAULT_KPIS)
      kpis = await RecruitmentKPI.find().sort({ order: 1 })
    }

    let candidates = await Candidate.find()
    if (candidates.length === 0) {
      await Candidate.insertMany(DEFAULT_CANDIDATES)
      candidates = await Candidate.find()
    }

    let appraisals = await Appraisal.find()
    // Using a manual check because there might be other appraisals seeded by another api, we specifically want to ensure these exact ones exist if empty
    // Actually, to make sure the view matches the screenshot, if we have 0 we seed, but if we have the old seed we might want to override.
    // Let's just seed if 0.
    if (appraisals.length === 0) {
      await Appraisal.insertMany(DEFAULT_APPRAISALS)
      appraisals = await Appraisal.find()
    }

    return NextResponse.json({
      kpis,
      candidates,
      appraisals
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0, must-revalidate'
      }
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
