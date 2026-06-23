import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Feedback from '@/models/Feedback'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// Helper to get formatted relative date
function getRelativeDateString(offsetDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().split('T')[0]
}

// Seeding function for exactly 124 feedback records
async function seedFeedback() {
  const count = await Feedback.countDocuments()
  if (count > 0) return

  // Targets:
  // Total: 124
  // Pending Review (Submitted / In Progress): 18
  // Actioned (Resolved / Dismissed): 106
  // Ratings: 5-star (70), 4-star (25), 3-star (18), 2-star (7), 1-star (4) => Average: 4.2
  // We will distribute statuses and ratings evenly across types:
  // Types: 'Student -> Teacher' (ST), 'Parent -> School' (PS), 'Teacher -> Management' (TM)

  const feedList: any[] = [
    // 1. First card from screenshot
    {
      senderName: 'Anonymous',
      isAnonymous: true,
      rating: 4,
      content: "The physics lectures are very detailed, but I'd like more practice problems for JEE. Sometimes the pace feels a bit rushed towards the end of the chapter.",
      type: 'Student -> Teacher',
      status: 'Submitted',
      subject: 'Physics',
      batch: 'JEE 2026-A',
      date: getRelativeDateString(0)
    },
    // 2. Second card from screenshot
    {
      senderName: 'Priya Rajan',
      isAnonymous: false,
      rating: 5,
      content: "The recent shift in the transport schedule has been very helpful. The bus now arrives right on time. Thank you to the admin team for resolving this quickly.",
      type: 'Parent -> School',
      status: 'In Progress',
      category: 'Transport',
      date: getRelativeDateString(-1)
    }
  ]

  // Status allocations:
  // Remaining to allocate:
  // Submitted: 9 (since 1 is already allocated)
  // In Progress: 7 (since 1 is already allocated)
  // Resolved: 70
  // Dismissed: 36
  const statuses = [
    ...Array(9).fill('Submitted'),
    ...Array(7).fill('In Progress'),
    ...Array(70).fill('Resolved'),
    ...Array(36).fill('Dismissed')
  ]

  // Rating allocations (excluding the 4-star and 5-star above):
  // 5-star: 69
  // 4-star: 24
  // 3-star: 18
  // 2-star: 7
  // 1-star: 4
  const ratings = [
    ...Array(69).fill(5),
    ...Array(24).fill(4),
    ...Array(18).fill(3),
    ...Array(7).fill(2),
    ...Array(4).fill(1)
  ]

  const contents = {
    'Student -> Teacher': [
      "The weekly tests are really helpful. The explanation of doubts after tests could be a bit more detailed.",
      "Organic Chemistry chapters are being covered very quickly. Please slow down the mechanism explanation.",
      "Really appreciate the extra handouts provided for JEE Physics. They have extremely good problem sets.",
      "The digital whiteboard notes are sometimes not uploaded on time. Please post them right after class.",
      "Mathematics lectures are outstanding. The interactive graphs make complex concepts easy to understand.",
      "Could we have more mock test discussions on Saturdays? It helps clear speed and accuracy bottlenecks."
    ],
    'Parent -> School': [
      "The new laboratory equipment is impressive. My child is excited about practical classes.",
      "The canteen food options should include more healthy fruits and less packaged snacks.",
      "The parent-teacher meeting was very well organized. Clear feedback on student strengths was given.",
      "School bus route #4 is frequently late by 10-15 minutes in the morning. Please look into it.",
      "The library lacks sufficient copies of standard JEE reference books. Please purchase more copies.",
      "Communication through the portal has improved a lot. We get alerts instantly now."
    ],
    'Teacher -> Management': [
      "The classroom projector in Block B, Room 204 is flickering. It makes teaching difficult.",
      "Requesting additional markers and whiteboards for the secondary school teacher room.",
      "The syllabus progress tracking tool is very smooth and makes academic planning clean.",
      "Suggesting a small workshop on digital tools usage for secondary faculty members.",
      "Could we optimize the duty schedules during examinations to allow teachers grading breaks?",
      "The support staff has been very helpful with setting up the chemistry lab apparatus."
    ]
  }

  const types = ['Student -> Teacher', 'Parent -> School', 'Teacher -> Management']
  const subjects = ['Physics', 'Chemistry', 'Mathematics', 'English', 'Biology']
  const batches = ['JEE 2026-A', 'NEET 2025-B', 'JEE 2024-C', 'Grade 10-A']
  const categories = ['Transport', 'Canteen', 'Library', 'Hostel', 'Academics', 'Infrastructure']
  const names = ['Amit Sharma', 'Neha Patel', 'Rohan Gupta', 'Karan Verma', 'Sanjay Shah', 'Deepa Nair', 'Rahul Das', 'Anjali Sen', 'Vijay Reddy']

  // Seed the remaining 122 feedback items
  for (let i = 0; i < 122; i++) {
    const type = types[i % types.length]
    const status = statuses[i]
    const rating = ratings[i]
    
    const textPool = contents[type as keyof typeof contents]
    const content = textPool[i % textPool.length]

    const isAnon = type === 'Student -> Teacher' && i % 2 === 0
    const senderName = isAnon ? 'Anonymous' : names[i % names.length]

    const item: Record<string, any> = {
      senderName,
      isAnonymous: isAnon,
      rating,
      content,
      type,
      status,
      date: getRelativeDateString(-1 - Math.floor(i / 4))
    }

    if (type === 'Student -> Teacher') {
      item.subject = subjects[i % subjects.length]
      item.batch = batches[i % batches.length]
    } else {
      item.category = categories[i % categories.length]
    }

    feedList.push(item)
  }

  // Shuffle slightly but keep the first two at index 0 and 1
  await Feedback.insertMany(feedList)
}

// GET — query list and metrics
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.user.role !== 'management') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    await connectDB()
    await seedFeedback()

    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') || 'All'

    // Overall metrics query (always matches all types to give correct header counts)
    const allItems = await Feedback.find({}).lean()
    
    // 1. Total Feedback
    const totalCount = allItems.length

    // 2. Average Rating
    const avgRating = totalCount > 0
      ? Number((allItems.reduce((sum, item) => sum + item.rating, 0) / totalCount).toFixed(1))
      : 4.2

    // 3. Pending Review (Submitted / In Progress)
    const pendingCount = allItems.filter(item => item.status === 'Submitted' || item.status === 'In Progress').length

    // 4. Actioned (Resolved / Dismissed)
    const actionedCount = allItems.filter(item => item.status === 'Resolved' || item.status === 'Dismissed').length

    // 5. Rating Distribution
    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
    allItems.forEach(item => {
      const r = Math.round(item.rating) as 5 | 4 | 3 | 2 | 1
      if (distribution[r] !== undefined) {
        distribution[r]++
      }
    })

    const ratingDistribution = Object.keys(distribution).reduce((acc: any, key) => {
      const count = distribution[Number(key) as 5 | 4 | 3 | 2 | 1]
      acc[key] = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0
      return acc
    }, {})

    // Query for the specific feedback list (filtered by tab)
    const query: Record<string, any> = {}
    if (type !== 'All') {
      query.type = type
    }

    const feedbackList = await Feedback.find(query).lean()
    
    // Sort feedbackList so Pending Review (Submitted, In Progress) are shown on top, sorted descending by date
    const statusPriority = { 'Submitted': 1, 'In Progress': 2, 'Resolved': 3, 'Dismissed': 4 }
    feedbackList.sort((a: any, b: any) => {
      const ap = statusPriority[a.status as keyof typeof statusPriority] || 4
      const bp = statusPriority[b.status as keyof typeof statusPriority] || 4
      if (ap !== bp) return ap - bp
      return new Date(b.date).getTime() - new Date(a.date).getTime()
    })

    return NextResponse.json({
      totalCount,
      avgRating,
      pendingCount,
      actionedCount,
      ratingDistribution,
      feedbackList
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT — update feedback review status
export async function PUT(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.user.role !== 'management') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    await connectDB()
    const body = await req.json()
    const { id, status } = body

    if (!id || !status) {
      return NextResponse.json({ error: 'Missing required fields: id, status' }, { status: 400 })
    }

    const updated = await Feedback.findByIdAndUpdate(id, { status }, { new: true })
    if (!updated) return NextResponse.json({ error: 'Feedback record not found' }, { status: 404 })

    return NextResponse.json(updated)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
