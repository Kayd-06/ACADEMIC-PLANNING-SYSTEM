// One-time cleanup: remove seeded/demo rows from Neon + legacy MongoDB collections.
// Real user-entered data is untouched — deletes match only the exact strings the
// old seeding functions inserted.
import { neon } from '@neondatabase/serverless'
import { config } from 'dotenv'

config({ path: '.env.local' })

const sql = neon(process.env.DATABASE_URL)

async function run(label, query, params = []) {
  const rows = await sql.query(query, params)
  console.log(`${label}: ${rows.length} deleted`)
}

// ── Feedback: all seeded rows drew their content from these exact pools ──
const FEEDBACK_CONTENTS = [
  "The weekly tests are really helpful. The explanation of doubts after tests could be a bit more detailed.",
  "Organic Chemistry chapters are being covered very quickly. Please slow down the mechanism explanation.",
  "Really appreciate the extra handouts provided for JEE Physics. They have extremely good problem sets.",
  "The digital whiteboard notes are sometimes not uploaded on time. Please post them right after class.",
  "Mathematics lectures are outstanding. The interactive graphs make complex concepts easy to understand.",
  "Can we have more assignments on integration? The textbook questions are not enough for practice.",
  "The new laboratory equipment is impressive. My child is excited about practical classes.",
  "The canteen food options should include more healthy fruits and less packaged snacks.",
  "The parent-teacher meeting was very well organized. Clear feedback on student strengths was given.",
  "School bus route #4 is frequently late by 10-15 minutes in the morning. Please look into it.",
  "The library lacks sufficient copies of standard JEE reference books. Please purchase more copies.",
  "Communication through the portal has improved a lot. We get alerts instantly now.",
  "The classroom projector in Block B, Room 204 is flickering. It makes teaching difficult.",
  "Requesting additional markers and whiteboards for the secondary school teacher room.",
  "The syllabus progress tracking tool is very smooth and makes academic planning clean.",
  "Suggesting a small workshop on digital tools usage for secondary faculty members.",
  "Could we optimize the duty schedules during examinations to allow teachers grading breaks?",
  "Excellent explanation of molecular structures. The 3D models were beautiful.",
]

// ── Assignments: seeded base titles + generated "X Assessment #N" pattern ──
const ASSIGNMENT_TITLES = [
  'Calculus Integration DPP 04', 'Physics Kinematics Homework', 'Organic Chemistry Nomenclature',
  'Trigonometric Functions DPP 01', 'Rotational Mechanics Homework', 'Chemical Equilibrium DPP 06',
  'Limits & Derivatives Homework', 'Thermodynamics DPP 03', 'Atomic Structure DPP 02',
  'Probability Theory Homework',
]

// ── Counseling: seeded session notes (exact strings) ──
const COUNSELING_NOTES = [
  'Struggling with mathematics; follow-up after mid-term.',
  'Discussed engineering college options and entrance exams.',
  'Student did not attend scheduled session. Follow up required.',
  'Session cancelled due to school event.',
  'Reviewing improvement plan for science subjects.',
  'Aptitude test review and career mapping session.',
  'Peer pressure issues discussed. Flagged for follow-up.',
  'Attendance discussion resolved.',
  'Grade improvement strategy for upcoming finals.',
  'Second consecutive no-show. Escalation needed.',
  'Stress management techniques shared.',
  'Scholarship application guidance session.',
  'Arts college portfolio reviewed.',
  'Bullying complaint investigated and resolved.',
  'Anxiety management referral follow-up.',
]

// ── Calendar: mock event descriptions ──
const CALENDAR_DESCRIPTIONS = [
  'Summer break. School reopens on June 11th.',
  'First semester mid-term examinations.',
  'Annual track & field sports meet.',
  'PTM to discuss academic planning and midterm performance.',
  'Holiday observed for Dussehra festival celebrations.',
  'Unit test runs through Oct 17th.',
  'Parent Teacher Meeting to discuss academic planning.',
  'Diwali festival holidays.',
  'Christmas celebration and food stalls.',
  'Winter break vacation.',
]

// ── Students: old attendance seeding used these literal class values ──
const SEEDED_CLASSES = ['11 - A', '11 - B', '10 - A', '10 - B', 'Grade 11-A', 'Grade 11-B', 'Grade 10-A', 'Grade 10-B']

console.log('── Clearing seeded data from Neon ──')

await run('feedback (seeded)', `DELETE FROM feedback WHERE content = ANY($1) RETURNING id`, [FEEDBACK_CONTENTS])
await run('assignments (seeded)', `DELETE FROM assignments WHERE title = ANY($1) OR title ~ '^(DPP|Homework) Assessment #[0-9]+$' RETURNING id`, [ASSIGNMENT_TITLES])
await run('counseling_sessions (seeded)', `DELETE FROM counseling_sessions WHERE notes = ANY($1) RETURNING id`, [COUNSELING_NOTES])
await run('calendar_events (seeded)', `DELETE FROM calendar_events WHERE description = ANY($1) RETURNING id`, [CALENDAR_DESCRIPTIONS])
await run('students (seeded demo roster)', `DELETE FROM students WHERE class = ANY($1) OR name = 'Kunal Singhi' RETURNING id`, [SEEDED_CLASSES])

// ── Legacy MongoDB collections (migrated features / seeded demo data) ──
// Full-collection wipe — only runs when explicitly requested with --mongo
if (process.argv.includes('--mongo') && process.env.MONGODB_URI) {
  try {
    const { default: mongoose } = await import('mongoose')
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 })
    const dropIf = async (name) => {
      const collections = await mongoose.connection.db.listCollections({ name }).toArray()
      if (collections.length) {
        const { deletedCount } = await mongoose.connection.db.collection(name).deleteMany({})
        console.log(`mongo ${name}: ${deletedCount} deleted`)
      } else {
        console.log(`mongo ${name}: not present`)
      }
    }
    console.log('── Clearing legacy MongoDB collections ──')
    await dropIf('feedbacks')
    await dropIf('attendances')
    await dropIf('teacherschedules')
    await dropIf('calendarevents')
    await mongoose.disconnect()
  } catch (e) {
    console.log('MongoDB cleanup skipped:', e.message)
  }
} else {
  console.log('Mongo cleanup skipped (pass --mongo to wipe legacy feedbacks/attendances/teacherschedules/calendarevents collections)')
}

console.log('Done.')
