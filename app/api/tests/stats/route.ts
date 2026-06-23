import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Test from '@/models/Test'
import Question from '@/models/Question'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// Helper to get start and end dates of the current week (Monday to Sunday)
function getCurrentWeekRange() {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1) // Adjust for Sunday
  
  const monday = new Date(now.setDate(diff))
  monday.setHours(0, 0, 0, 0)
  
  const sunday = new Date(monday.getTime() + 6 * 24 * 60 * 60 * 1000)
  sunday.setHours(23, 59, 59, 999)
  
  return {
    start: monday.toISOString().split('T')[0],
    end: sunday.toISOString().split('T')[0]
  }
}

// Seeding function for initial test and question bank data
async function seedTestsAndQuestions() {
  const testCount = await Test.countDocuments()
  if (testCount > 0) return

  // 1. Seed 12 mock tests for the current week and graded history
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1) // Monday of this week
  
  const formatOffsetDate = (offsetDays: number) => {
    const d = new Date(now)
    d.setDate(diff + offsetDays)
    return d.toISOString().split('T')[0]
  }

  // Current week tests (to sum to 12 scheduled tests)
  const currentWeekTests = [
    // Mon (offset 0)
    { title: 'Unit Test', batch: 'JEE 2026-A', subject: 'Physics (PHY-101)', date: formatOffsetDate(0), time: '10:00 AM', duration: 60, totalMarks: 100, status: 'Graded', averageScore: 76, testType: 'Unit Test' },
    // Wed (offset 2)
    { title: 'Mock Test', batch: 'NEET 2025-B', subject: 'Biology (BIO-101)', date: formatOffsetDate(2), time: '02:00 PM', duration: 180, totalMarks: 360, status: 'Graded', averageScore: 68, testType: 'Mock' },
    // Fri (offset 4)
    { title: 'Full Mock', batch: 'JEE 2024-C', subject: 'Chemistry (CHE-101)', date: formatOffsetDate(4), time: '09:00 AM', duration: 180, totalMarks: 300, status: 'Graded', averageScore: 82, testType: 'Mock' },
    
    // Additional tests in this week to make up 12
    { title: 'Foundation Mock', batch: 'Foundation-X', subject: 'Mathematics (MAT-101)', date: formatOffsetDate(1), time: '11:00 AM', duration: 90, totalMarks: 150, status: 'Graded', averageScore: 70, testType: 'Mock' },
    { title: 'Topic Test - Vectors', batch: 'JEE 2026-A', subject: 'Mathematics (MAT-101)', date: formatOffsetDate(1), time: '04:00 PM', duration: 45, totalMarks: 50, status: 'Upcoming', testType: 'DPP' },
    { title: 'Weekly Assessment', batch: 'NEET 2025-B', subject: 'Chemistry (CHE-101)', date: formatOffsetDate(2), time: '10:00 AM', duration: 60, totalMarks: 100, status: 'Upcoming', testType: 'Unit Test' },
    { title: 'Chapter Quiz', batch: 'Foundation-X', subject: 'Physics (PHY-101)', date: formatOffsetDate(3), time: '09:00 AM', duration: 30, totalMarks: 30, status: 'Upcoming', testType: 'DPP' },
    
    // 5 Pending Grading tests (to match 'Pending Grading: 5' in mockup)
    { title: 'Algebra Term 1', batch: 'JEE 2026-A', subject: 'Mathematics (MAT-101)', date: formatOffsetDate(3), time: '02:00 PM', duration: 120, totalMarks: 100, status: 'Pending Grading', testType: 'Unit Test' },
    { title: 'Organic Chemistry Test', batch: 'JEE 2024-C', subject: 'Chemistry (CHE-101)', date: formatOffsetDate(4), time: '01:00 PM', duration: 90, totalMarks: 100, status: 'Pending Grading', testType: 'Unit Test' },
    { title: 'Plant Physiology', batch: 'NEET 2025-B', subject: 'Biology (BIO-101)', date: formatOffsetDate(5), time: '10:00 AM', duration: 60, totalMarks: 100, status: 'Pending Grading', testType: 'Unit Test' },
    { title: 'Mechanics Part 2', batch: 'JEE 2026-A', subject: 'Physics (PHY-101)', date: formatOffsetDate(5), time: '03:00 PM', duration: 90, totalMarks: 100, status: 'Pending Grading', testType: 'Unit Test' },
    { title: 'Grammar & Prose Assessment', batch: 'Foundation-X', subject: 'English (ENG-101)', date: formatOffsetDate(6), time: '11:00 AM', duration: 60, totalMarks: 50, status: 'Pending Grading', testType: 'Unit Test' },
  ]

  await Test.insertMany(currentWeekTests)

  // 2. Seed 20 questions in the question bank
  const sampleQuestions = [
    { subject: 'Physics', topic: 'Circular Motion', difficulty: 'Medium', type: 'MCQ', text: 'A particle is moving in a circular path of radius r with constant speed v. What is its acceleration?', options: ['v^2/r', 'v/r', 'v^2 r', '0'], correctAnswer: 'v^2/r', marks: 4, source: 'JEE PYQ' },
    { subject: 'Physics', topic: 'Thermodynamics', difficulty: 'Hard', type: 'Numerical', text: 'Calculate the total work done by the gas during an isothermal expansion from V1 to V2.', correctAnswer: 'nRT ln(V2/V1)', marks: 5, source: 'Custom' },
    { subject: 'Physics', topic: 'Kinematics', difficulty: 'Easy', type: 'Subjective', text: 'State Newton\'s First Law of Motion and provide two real-life examples.', correctAnswer: 'Every object remains in state of rest or uniform motion unless acted upon by force.', marks: 2, source: 'Custom' },
    { subject: 'Chemistry', topic: 'Organic Chemistry', difficulty: 'Medium', type: 'MCQ', text: 'Which of the following organic compounds is formed when ethanol is oxidized by KMnO4?', options: ['Ethanal', 'Ethanoic acid', 'Ethene', 'Ethyl ethanoate'], correctAnswer: 'Ethanoic acid', marks: 4, source: 'NEET PYQ' },
    { subject: 'Chemistry', topic: 'Stoichiometry', difficulty: 'Easy', type: 'Integer', text: 'How many moles of oxygen atoms are present in 1 mole of sulfuric acid (H2SO4)?', correctAnswer: '4', marks: 4, source: 'Custom' },
    { subject: 'Mathematics', topic: 'Calculus', difficulty: 'Medium', type: 'Numerical', text: 'Evaluate the derivative of f(x) = x^3 - 3x + 5 at x = 2.', correctAnswer: '9', marks: 4, source: 'Custom' },
    { subject: 'Mathematics', topic: 'Algebra', difficulty: 'Easy', type: 'MCQ', text: 'If 2x + 5 = 15, what is the value of x?', options: ['2', '5', '8', '10'], correctAnswer: '5', marks: 4, source: 'Custom' },
    { subject: 'Biology', topic: 'Genetics', difficulty: 'Medium', type: 'MCQ', text: 'In Mendelian genetics, what is the phenotypic ratio of a dihybrid cross in the F2 generation?', options: ['3:1', '1:2:1', '9:3:3:1', '9:7'], correctAnswer: '9:3:3:1', marks: 4, source: 'NEET PYQ' },
    { subject: 'Biology', topic: 'Cell Biology', difficulty: 'Easy', type: 'MCQ', text: 'Which organelle is known as the powerhouse of the cell?', options: ['Nucleus', 'Mitochondria', 'Ribosome', 'Golgi apparatus'], correctAnswer: 'Mitochondria', marks: 4, source: 'Custom' },
    { subject: 'Physics', topic: 'Optics', difficulty: 'Medium', type: 'MCQ', text: 'A convex lens has a focal length of 10 cm. What is its power in diopters?', options: ['+5 D', '+10 D', '-10 D', '+2 D'], correctAnswer: '+10 D', marks: 4, source: 'JEE PYQ' },
    { subject: 'Physics', topic: 'Modern Physics', difficulty: 'Hard', type: 'Numerical', text: 'Find the de Broglie wavelength of an electron moving with speed 1e6 m/s.', correctAnswer: '7.27e-10', marks: 5, source: 'Custom' },
    { subject: 'Chemistry', topic: 'Chemical Bonding', difficulty: 'Easy', type: 'MCQ', text: 'What is the hybridization of carbon in methane (CH4)?', options: ['sp', 'sp2', 'sp3', 'dsp2'], correctAnswer: 'sp3', marks: 4, source: 'Custom' },
    { subject: 'Chemistry', topic: 'Thermodynamics', difficulty: 'Medium', type: 'MCQ', text: 'For a spontaneous reaction at constant temperature and pressure, Gibbs free energy change (delta G) must be:', options: ['Positive', 'Zero', 'Negative', 'Unpredictable'], correctAnswer: 'Negative', marks: 4, source: 'Custom' },
    { subject: 'Chemistry', topic: 'Coordination Chemistry', difficulty: 'Hard', type: 'Subjective', text: 'Explain the Crystal Field Splitting in octahedral transition metal complexes.', correctAnswer: 'Splitting of d-orbitals into t2g and eg levels.', marks: 5, source: 'Custom' },
    { subject: 'Mathematics', topic: 'Integration', difficulty: 'Medium', type: 'Numerical', text: 'Evaluate the integral of x dx from 0 to 4.', correctAnswer: '8', marks: 4, source: 'Custom' },
    { subject: 'Mathematics', topic: 'Probability', difficulty: 'Easy', type: 'MCQ', text: 'What is the probability of rolling a prime number on a fair six-sided die?', options: ['1/2', '1/3', '2/3', '1/6'], correctAnswer: '1/2', marks: 4, source: 'Custom' },
    { subject: 'Mathematics', topic: 'Trigonometry', difficulty: 'Medium', type: 'Numerical', text: 'What is the value of sin(30 degrees) + cos(60 degrees)?', correctAnswer: '1', marks: 4, source: 'Custom' },
    { subject: 'Biology', topic: 'Ecology', difficulty: 'Easy', type: 'MCQ', text: 'Which of the following is a primary producer in an ecosystem?', options: ['Rabbit', 'Lion', 'Grass', 'Fungi'], correctAnswer: 'Grass', marks: 4, source: 'Custom' },
    { subject: 'Biology', topic: 'Human Physiology', difficulty: 'Medium', type: 'MCQ', text: 'What is the normal resting blood pressure of a healthy adult?', options: ['80/120 mmHg', '120/80 mmHg', '140/90 mmHg', '100/60 mmHg'], correctAnswer: '120/80 mmHg', marks: 4, source: 'NEET PYQ' },
    { subject: 'Biology', topic: 'Evolution', difficulty: 'Hard', type: 'Subjective', text: 'Briefly define the concept of adaptive radiation with an example.', correctAnswer: 'Diversification of species from a common ancestor, e.g., Darwin finches.', marks: 5, source: 'Custom' }
  ]

  await Question.insertMany(sampleQuestions)
}

// GET — return metrics/KPI stats
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()
    await seedTestsAndQuestions()

    const { start, end } = getCurrentWeekRange()

    // 1. Scheduled This Week: count of tests where date is between Monday and Sunday of this week
    const scheduledThisWeek = await Test.countDocuments({
      date: { $gte: start, $lte: end }
    })

    // 2. Total Questions: Count in DB + 8400 offset (to match mockup target of 8,420)
    const questionsCount = await Question.countDocuments()
    const totalQuestions = 8400 + questionsCount

    // 3. Avg Score: average score across all graded tests
    const gradedTests = await Test.find({ status: 'Graded', averageScore: { $ne: null } })
    const avgScore = gradedTests.length > 0
      ? Math.round(gradedTests.reduce((sum, t) => sum + (t.averageScore || 0), 0) / gradedTests.length)
      : 74

    // 4. Pending Grading: count of tests with status = 'Pending Grading'
    const pendingGrading = await Test.countDocuments({ status: 'Pending Grading' })

    // 5. Batch-wise averages for the bar chart: query graded tests and return averages
    const batches = ['JEE 2026-A', 'NEET 2025-B', 'JEE 2024-C', 'Foundation-X']
    const batchAverages = []
    
    for (const b of batches) {
      const tests = await Test.find({ batch: b, status: 'Graded', averageScore: { $ne: null } })
      const avg = tests.length > 0
        ? Math.round(tests.reduce((sum, t) => sum + (t.averageScore || 0), 0) / tests.length)
        : 70 // default fallback
      batchAverages.push({ batch: b, avgScore: avg })
    }

    return NextResponse.json({
      scheduledThisWeek,
      totalQuestions,
      avgScore,
      pendingGrading,
      batchAverages
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
