// Read-only preview of what clear-seed-data.mjs would delete. No writes.
import { neon } from '@neondatabase/serverless'
import { config } from 'dotenv'

config({ path: '.env.local' })
const sql = neon(process.env.DATABASE_URL)

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
const ASSIGNMENT_TITLES = [
  'Calculus Integration DPP 04', 'Physics Kinematics Homework', 'Organic Chemistry Nomenclature',
  'Trigonometric Functions DPP 01', 'Rotational Mechanics Homework', 'Chemical Equilibrium DPP 06',
  'Limits & Derivatives Homework', 'Thermodynamics DPP 03', 'Atomic Structure DPP 02',
  'Probability Theory Homework',
]
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
const SEEDED_CLASSES = ['11 - A', '11 - B', '10 - A', '10 - B', 'Grade 11-A', 'Grade 11-B', 'Grade 10-A', 'Grade 10-B']

async function count(label, query, params = []) {
  const [row] = await sql.query(query, params)
  console.log(`${label}: ${row.n} rows would be deleted (of ${row.total} total)`)
}

await count('feedback', `SELECT count(*) FILTER (WHERE content = ANY($1)) AS n, count(*) AS total FROM feedback`, [FEEDBACK_CONTENTS])
await count('assignments', `SELECT count(*) FILTER (WHERE title = ANY($1) OR title ~ '^(DPP|Homework) Assessment #[0-9]+$') AS n, count(*) AS total FROM assignments`, [ASSIGNMENT_TITLES])
await count('counseling_sessions', `SELECT count(*) FILTER (WHERE notes = ANY($1)) AS n, count(*) AS total FROM counseling_sessions`, [COUNSELING_NOTES])
await count('calendar_events', `SELECT count(*) FILTER (WHERE description = ANY($1)) AS n, count(*) AS total FROM calendar_events`, [CALENDAR_DESCRIPTIONS])
await count('students', `SELECT count(*) FILTER (WHERE class = ANY($1) OR name = 'Kunal Singhi') AS n, count(*) AS total FROM students`, [SEEDED_CLASSES])

// Show a sample of the students that would go, so it's verifiable
const sample = await sql.query(`SELECT name, class, section, roll_no FROM students WHERE class = ANY($1) OR name = 'Kunal Singhi' ORDER BY name LIMIT 8`, [SEEDED_CLASSES])
console.log('\nSample of students matched for deletion:')
for (const s of sample) console.log(`  - ${s.name} (class "${s.class}", section "${s.section}", roll "${s.roll_no}")`)

const kept = await sql.query(`SELECT DISTINCT class FROM students WHERE NOT (class = ANY($1)) LIMIT 10`, [SEEDED_CLASSES])
console.log('\nClasses that would be KEPT:', kept.map(r => `"${r.class}"`).join(', '))
