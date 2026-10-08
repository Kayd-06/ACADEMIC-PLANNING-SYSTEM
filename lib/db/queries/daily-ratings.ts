import { eq, and, desc, sql } from 'drizzle-orm'
import { db } from '../index'
import { dailyStudentRatings, students, type DailyStudentRating } from '../schema'

export interface SaveRatingInput {
  studentId: string
  attitude: 'Unsatisfactory' | 'Satisfactory' | 'Good' | 'Very Good' | 'Excellent'
  behaviour: 'Unsatisfactory' | 'Satisfactory' | 'Good' | 'Very Good' | 'Excellent'
  focus: 'Unsatisfactory' | 'Satisfactory' | 'Good' | 'Very Good' | 'Excellent'
  interaction: 'Unsatisfactory' | 'Satisfactory' | 'Good' | 'Very Good' | 'Excellent'
  notes?: string
}

export async function saveDailyStudentRatings(
  batch: string,
  date: string,
  ratings: SaveRatingInput[],
  facultyId?: string | null,
  schoolId?: string | null,
  batchId?: string | null
) {
  if (ratings.length === 0) return []
  // One multi-row upsert on (student_id, date) instead of 2 queries per
  // student. The same student twice: last one wins (as before).
  const byStudent = new Map<string, typeof dailyStudentRatings.$inferInsert>()
  for (const r of ratings) {
    byStudent.set(r.studentId, {
      studentId: r.studentId,
      date,
      batch,
      attitude: r.attitude,
      behaviour: r.behaviour,
      focus: r.focus,
      interaction: r.interaction,
      notes: r.notes ?? null,
      facultyId: facultyId ?? null,
      schoolId: schoolId ?? null,
      batchId: batchId ?? null,
    })
  }
  return db
    .insert(dailyStudentRatings)
    .values([...byStudent.values()])
    .onConflictDoUpdate({
      target: [dailyStudentRatings.studentId, dailyStudentRatings.date],
      set: {
        attitude: sql.raw('excluded.attitude'),
        behaviour: sql.raw('excluded.behaviour'),
        focus: sql.raw('excluded.focus'),
        interaction: sql.raw('excluded.interaction'),
        notes: sql.raw('excluded.notes'),
        batch: sql.raw('excluded.batch'),
        facultyId: sql.raw('coalesce(excluded.faculty_id, "daily_student_ratings".faculty_id)'),
        schoolId: sql.raw('coalesce(excluded.school_id, "daily_student_ratings".school_id)'),
        batchId: sql.raw('coalesce(excluded.batch_id, "daily_student_ratings".batch_id)'),
        updatedAt: sql`now()`,
      },
    })
    .returning()
}

export async function getDailyRatingsForBatchAndDate(batch: string, date: string, schoolId?: string | null) {
  const conditions = [eq(dailyStudentRatings.batch, batch), eq(dailyStudentRatings.date, date)]
  if (schoolId) conditions.push(eq(dailyStudentRatings.schoolId, schoolId))

  return db
    .select({
      id: dailyStudentRatings.id,
      studentId: dailyStudentRatings.studentId,
      batch: dailyStudentRatings.batch,
      date: dailyStudentRatings.date,
      attitude: dailyStudentRatings.attitude,
      behaviour: dailyStudentRatings.behaviour,
      focus: dailyStudentRatings.focus,
      interaction: dailyStudentRatings.interaction,
      notes: dailyStudentRatings.notes,
      studentName: students.name,
      rollNo: students.rollNo,
    })
    .from(dailyStudentRatings)
    .innerJoin(students, eq(dailyStudentRatings.studentId, students.id))
    .where(and(...conditions))
}

export async function getStudentDailyRatingsSummary(studentId: string, schoolId?: string | null) {
  const conditions = [eq(dailyStudentRatings.studentId, studentId)]
  if (schoolId) conditions.push(eq(dailyStudentRatings.schoolId, schoolId))

  const ratings = await db
    .select()
    .from(dailyStudentRatings)
    .where(and(...conditions))
    .orderBy(desc(dailyStudentRatings.date))

  const RATING_SCORE_MAP: Record<string, number> = {
    Unsatisfactory: 1,
    Satisfactory: 2,
    Good: 3,
    'Very Good': 4,
    Excellent: 5,
  }

  if (ratings.length === 0) {
    return {
      totalEntries: 0,
      avgAttitude: 0,
      avgBehaviour: 0,
      avgFocus: 0,
      avgInteraction: 0,
      overallRatingScore: 0,
      ratingsList: [],
    }
  }

  let attitudeSum = 0
  let behaviourSum = 0
  let focusSum = 0
  let interactionSum = 0

  for (const r of ratings) {
    attitudeSum += RATING_SCORE_MAP[r.attitude] || 3
    behaviourSum += RATING_SCORE_MAP[r.behaviour] || 3
    focusSum += RATING_SCORE_MAP[r.focus] || 3
    interactionSum += RATING_SCORE_MAP[r.interaction] || 3
  }

  const count = ratings.length
  const avgAttitude = Number((attitudeSum / count).toFixed(2))
  const avgBehaviour = Number((behaviourSum / count).toFixed(2))
  const avgFocus = Number((focusSum / count).toFixed(2))
  const avgInteraction = Number((interactionSum / count).toFixed(2))
  const overallRatingScore = Number(((avgAttitude + avgBehaviour + avgFocus + avgInteraction) / 4).toFixed(2))

  return {
    totalEntries: count,
    avgAttitude,
    avgBehaviour,
    avgFocus,
    avgInteraction,
    overallRatingScore,
    ratingsList: ratings,
  }
}
