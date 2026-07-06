import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { recruitmentRequirements, recruitmentCandidates, recruitmentInterviews, teacherAppraisals } from '@/lib/db/schema'
import { desc } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const requirements = await db.select().from(recruitmentRequirements)
    const candidates = await db.select().from(recruitmentCandidates).orderBy(desc(recruitmentCandidates.createdAt))
    const interviews = await db.select().from(recruitmentInterviews)
    const appraisals = await db.select().from(teacherAppraisals).orderBy(desc(teacherAppraisals.createdAt))

    const openVacancies = requirements
      .filter(r => r.status?.toLowerCase() === 'open')
      .reduce((sum, r) => sum + (r.vacancies || 1), 0)

    const activeCandidates = candidates.filter(c => {
      const s = c.workflowStatus?.toLowerCase() || ''
      return s !== 'rejected' && s !== 'hired'
    }).length

    const interviewsScheduled = candidates.filter(c => c.workflowStatus?.toLowerCase() === 'interview scheduled').length || interviews.length

    const pendingAppraisals = appraisals.filter(a => {
      const s = a.reviewStatus?.toLowerCase() || ''
      return s === 'pending' || s === 'in progress'
    }).length

    const hiredCount = candidates.filter(c => c.workflowStatus?.toLowerCase() === 'hired').length

    const kpis = [
      {
        id: '1',
        label: 'Open Vacancies',
        value: String(openVacancies),
        change: 'Active roles',
        trend: 'neutral',
        icon: 'Briefcase'
      },
      {
        id: '2',
        label: 'Active Candidates',
        value: String(activeCandidates),
        change: 'In hiring pipeline',
        trend: activeCandidates > 0 ? 'up' : 'neutral',
        icon: 'Users'
      },
      {
        id: '3',
        label: 'Interviews Scheduled',
        value: String(interviewsScheduled),
        change: 'Upcoming sessions',
        trend: interviewsScheduled > 0 ? 'up' : 'neutral',
        icon: 'Calendar'
      },
      {
        id: '4',
        label: 'Pending Appraisals',
        value: String(pendingAppraisals),
        change: 'Requires review',
        trend: pendingAppraisals > 0 ? 'down' : 'neutral',
        icon: 'Award'
      },
      {
        id: '5',
        label: 'Hired This Year',
        value: String(hiredCount),
        change: 'Successfully onboarded',
        trend: hiredCount > 0 ? 'up' : 'neutral',
        icon: 'CheckCircle'
      }
    ]

    const stages = ['Requirement', 'Shortlisted', 'Interview Scheduled', 'Under Review', 'Offer Extended', 'Hired']
    const pipeline = stages.map(stage => ({
      stage,
      count: candidates.filter(c => (c.workflowStatus || 'Requirement').toLowerCase() === stage.toLowerCase()).length
    }))

    const formattedCandidates = candidates.map(c => ({
      ...c,
      _id: c.id,
      status: c.workflowStatus || 'Requirement'
    }))

    const formattedAppraisals = appraisals.map(a => ({
      ...a,
      _id: a.id,
      status: a.reviewStatus || 'Pending'
    }))

    return NextResponse.json({
      kpis,
      pipeline,
      recentCandidates: formattedCandidates.slice(0, 5),
      recentAppraisals: formattedAppraisals.slice(0, 5),
      requirementsCount: requirements.length,
      candidatesCount: candidates.length,
      appraisalsCount: appraisals.length
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch dashboard data' }, { status: 500 })
  }
}
