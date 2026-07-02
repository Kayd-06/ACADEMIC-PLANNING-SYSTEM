import { pgTable, uuid, text, varchar, timestamp, pgEnum, boolean, uniqueIndex, integer } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const userRoleEnum = pgEnum('user_role', ['teacher', 'management'])
export const userStatusEnum = pgEnum('user_status', ['pending_verification', 'active'])

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: text('password').notNull(),
  role: userRoleEnum('role').notNull(),
  status: userStatusEnum('status').notNull().default('pending_verification'),
  department: varchar('department', { length: 255 }),
  employeeId: varchar('employee_id', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert

export const emailVerifications = pgTable('email_verifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  token: varchar('token', { length: 255 }).notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
})

export type EmailVerification = typeof emailVerifications.$inferSelect
export type NewEmailVerification = typeof emailVerifications.$inferInsert

export const schools = pgTable('schools', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull().default('Academic Planning System'),
  board: varchar('board', { length: 255 }).notNull().default('CBSE Affiliated'),
  classes: varchar('classes', { length: 255 }).notNull().default('Nursery – XII'),
  programs: varchar('programs', { length: 255 }).notNull().default('STEM, Humanities, Arts'),
  mouStatus: varchar('mou_status', { length: 255 }).notNull().default('Active (2025)'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type School = typeof schools.$inferSelect
export type NewSchool = typeof schools.$inferInsert

export const students = pgTable(
  'students',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    rollNo: varchar('roll_no', { length: 255 }).notNull().default(''),
    class: varchar('class', { length: 255 }).notNull().default(''),
    section: varchar('section', { length: 255 }).notNull().default(''),
    program: varchar('program', { length: 255 }).notNull().default(''),
    batch: varchar('batch', { length: 255 }).notNull().default(''),
    parentContact: varchar('parent_contact', { length: 255 }),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    rollClassSectionUnique: uniqueIndex('students_roll_no_class_section_unique')
      .on(table.rollNo, table.class, table.section)
      .where(sql`${table.rollNo} <> '' AND ${table.class} <> '' AND ${table.section} <> ''`),
  })
)

export type Student = typeof students.$inferSelect
export type NewStudent = typeof students.$inferInsert

export const counselingSessionTypeEnum = pgEnum('counseling_session_type', ['Academic', 'Career', 'Personal', 'Disciplinary'])
export const counselingSessionStatusEnum = pgEnum('counseling_session_status', ['Scheduled', 'Completed', 'No-Show', 'Cancelled'])

export const counselingSessions = pgTable('counseling_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  studentName: varchar('student_name', { length: 255 }).notNull(),
  studentInitials: varchar('student_initials', { length: 10 }).notNull(),
  counselor: varchar('counselor', { length: 255 }).notNull(),
  type: counselingSessionTypeEnum('type').notNull().default('Academic'),
  date: varchar('date', { length: 255 }).notNull(), // YYYY-MM-DD format
  time: varchar('time', { length: 255 }).notNull(), // e.g. "10:30 AM"
  status: counselingSessionStatusEnum('status').notNull().default('Scheduled'),
  notes: text('notes').default(''),
  duration: varchar('duration', { length: 255 }).default('30 mins'),
  flagged: boolean('flagged').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type CounselingSession = typeof counselingSessions.$inferSelect
export type NewCounselingSession = typeof counselingSessions.$inferInsert

export const studentReports = pgTable('student_reports', {
  id: uuid('id').defaultRandom().primaryKey(),
  teacherId: uuid('teacher_id').notNull(),
  teacherName: varchar('teacher_name', { length: 255 }).notNull(),
  className: varchar('class_name', { length: 255 }).notNull(),
  subject: varchar('subject', { length: 255 }).notNull(),
  term: varchar('term', { length: 255 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export type StudentReport = typeof studentReports.$inferSelect
export type NewStudentReport = typeof studentReports.$inferInsert

export const studentReportEntries = pgTable('student_report_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  reportId: uuid('report_id')
    .notNull()
    .references(() => studentReports.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  rollNo: varchar('roll_no', { length: 255 }).notNull().default(''),
  marks: integer('marks').notNull(),
  maxMarks: integer('max_marks').notNull().default(100),
  grade: varchar('grade', { length: 10 }).notNull(),
  attendance: integer('attendance'),
  remarks: varchar('remarks', { length: 1000 }),
})

export type StudentReportEntry = typeof studentReportEntries.$inferSelect
export type NewStudentReportEntry = typeof studentReportEntries.$inferInsert

export const facultyStatusEnum = pgEnum('faculty_status', ['ACTIVE', 'ON_LEAVE', 'INACTIVE'])

export const faculty = pgTable('faculty', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  subject: varchar('subject', { length: 255 }).notNull(),
  specialization: varchar('specialization', { length: 255 }).notNull(),
  batches: integer('batches').notNull().default(0),
  experience: varchar('experience', { length: 255 }).notNull().default(''),
  status: facultyStatusEnum('status').notNull().default('ACTIVE'),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export type Faculty = typeof faculty.$inferSelect
export type NewFaculty = typeof faculty.$inferInsert

export const studyMaterials = pgTable('study_materials', {
  id: uuid('id').defaultRandom().primaryKey(),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  type: varchar('type', { length: 50 }).notNull().default('PDF'),
  fileUrl: text('file_url'),
  subject: varchar('subject', { length: 255 }).notNull(),
  provider: varchar('provider', { length: 255 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export type StudyMaterial = typeof studyMaterials.$inferSelect
export type NewStudyMaterial = typeof studyMaterials.$inferInsert

export const dailyReports = pgTable('daily_reports', {
  id: uuid('id').defaultRandom().primaryKey(),
  teacherName: varchar('teacher_name', { length: 255 }).notNull(),
  teacherEmail: varchar('teacher_email', { length: 255 }).notNull(),
  date: varchar('date', { length: 10 }).notNull(), // YYYY-MM-DD
  batch: varchar('batch', { length: 255 }).notNull(),
  subject: varchar('subject', { length: 255 }).notNull(),
  chapter: varchar('chapter', { length: 255 }).notNull().default(''),
  topicsCovered: text('topics_covered').notNull().default(''),
  presentCount: integer('present_count').notNull().default(0),
  absentCount: integer('absent_count').notNull().default(0),
  homeworkGiven: text('homework_given').default(''),
  observations: text('observations').default(''),
  isLate: boolean('is_late').notNull().default(false),
  submittedAt: timestamp('submitted_at', { withTimezone: true }).defaultNow().notNull(),
})

export type DailyReport = typeof dailyReports.$inferSelect
export type NewDailyReport = typeof dailyReports.$inferInsert

export const assignments = pgTable('assignments', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  chapter: varchar('chapter', { length: 255 }).notNull(),
  batch: varchar('batch', { length: 255 }).notNull(),
  subject: varchar('subject', { length: 255 }).notNull(),
  type: varchar('type', { length: 20 }).notNull().default('Homework'),
  dueDate: varchar('due_date', { length: 10 }).notNull(),
  dueTime: varchar('due_time', { length: 20 }).notNull().default('11:59 PM'),
  submittedCount: integer('submitted_count').notNull().default(0),
  totalStudents: integer('total_students').notNull().default(40),
  status: varchar('status', { length: 30 }).notNull().default('Active'),
  teacherEmail: varchar('teacher_email', { length: 255 }).notNull(),
  fileUrl: varchar('file_url', { length: 1000 }).default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type Assignment = typeof assignments.$inferSelect
export type NewAssignment = typeof assignments.$inferInsert

export const announcements = pgTable('announcements', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content').notNull(),
  label: varchar('label', { length: 255 }).default(''),
  sub: text('sub').default(''),
  type: varchar('type', { length: 50 }).notNull().default('General'),
  scope: varchar('scope', { length: 255 }).notNull().default('All'),
  pinned: boolean('pinned').notNull().default(false),
  urgent: boolean('urgent').notNull().default(false),
  authorName: varchar('author_name', { length: 255 }).notNull().default('Admin'),
  authorRole: varchar('author_role', { length: 255 }).notNull().default('Staff'),
  expiryDate: varchar('expiry_date', { length: 50 }),
  done: boolean('done').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type Announcement = typeof announcements.$inferSelect
export type NewAnnouncement = typeof announcements.$inferInsert

