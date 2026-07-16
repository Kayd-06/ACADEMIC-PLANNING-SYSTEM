// Database schema definitions - updated with dailyReports and progressReports
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
  profileImgUrl: text('profile_img_url'),
  schoolId: uuid('school_id').references(() => schools.id, { onDelete: 'set null' }),
  activeSchoolId: uuid('active_school_id').references(() => schools.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert

// OTP-based email verification — a 6-digit code emailed to the user, rather
// than a magic link (which requires NEXT_PUBLIC_APP_URL to be correctly set
// per-environment; a code sidesteps that entirely and doesn't break when a
// deployment's URL changes).
export const emailVerifications = pgTable('email_verifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  otp: varchar('otp', { length: 6 }).notNull(),
  attempts: integer('attempts').notNull().default(0),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export type EmailVerification = typeof emailVerifications.$inferSelect
export type NewEmailVerification = typeof emailVerifications.$inferInsert

export const passwordResets = pgTable('password_resets', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  otp: varchar('otp', { length: 6 }).notNull(),
  attempts: integer('attempts').notNull().default(0),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export type PasswordReset = typeof passwordResets.$inferSelect
export type NewPasswordReset = typeof passwordResets.$inferInsert

export const schools = pgTable('schools', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull().default('Academic Planning System'),
  board: varchar('board', { length: 255 }).notNull().default('CBSE Affiliated'),
  classes: varchar('classes', { length: 255 }).notNull().default('Nursery – XII'),
  programs: varchar('programs', { length: 255 }).notNull().default('STEM, Humanities, Arts'),
  mouStatus: varchar('mou_status', { length: 255 }).notNull().default('Active (2025)'),
  joinCode: varchar('join_code', { length: 20 }).unique(),
  adminEmail: varchar('admin_email', { length: 255 }).default(''),
  isActive: boolean('is_active').notNull().default(true),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type School = typeof schools.$inferSelect
export type NewSchool = typeof schools.$inferInsert

export const schoolInvites = pgTable('school_invites', {
  id: uuid('id').defaultRandom().primaryKey(),
  schoolId: uuid('school_id').notNull().references(() => schools.id, { onDelete: 'cascade' }),
  email: varchar('email', { length: 255 }).notNull(),
  role: varchar('role', { length: 20 }).notNull().default('teacher'),
  token: varchar('token', { length: 255 }).notNull().unique(),
  used: boolean('used').notNull().default(false),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export type SchoolInvite = typeof schoolInvites.$inferSelect
export type NewSchoolInvite = typeof schoolInvites.$inferInsert

export const students = pgTable(
  'students',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    // Identification
    name: varchar('name', { length: 255 }).notNull(),
    admissionNumber: varchar('admission_number', { length: 100 }),
    aadharNumber: varchar('aadhar_number', { length: 20 }),
    rollNo: varchar('roll_no', { length: 255 }).notNull().default(''),
    // Contact & Address
    email: varchar('email', { length: 255 }),
    phone: varchar('phone', { length: 50 }),
    addressLine1: varchar('address_line1', { length: 500 }),
    city: varchar('city', { length: 100 }),
    state: varchar('state', { length: 100 }),
    pincode: varchar('pincode', { length: 20 }),
    // Personal Details
    dob: varchar('dob', { length: 10 }),
    gender: varchar('gender', { length: 20 }),
    bloodGroup: varchar('blood_group', { length: 10 }),
    profileImgUrl: text('profile_img_url'),
    // Academic History (class = current_class)
    previousSchool: varchar('previous_school', { length: 255 }),
    previousPercentage: varchar('previous_percentage', { length: 20 }),
    class: varchar('class', { length: 255 }).notNull().default(''),
    section: varchar('section', { length: 255 }).notNull().default(''),
    program: varchar('program', { length: 255 }).notNull().default(''),
    batch: varchar('batch', { length: 255 }).notNull().default(''),
    parentContact: varchar('parent_contact', { length: 255 }),
    // Status & Metadata
    admissionDate: varchar('admission_date', { length: 10 }),
    status: varchar('status', { length: 20 }).notNull().default('active'),
    notes: text('notes'),
    isActive: boolean('is_active').notNull().default(true),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    schoolId: uuid('school_id').references(() => schools.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    rollClassSectionSchoolUnique: uniqueIndex('students_roll_no_class_section_school_unique')
      .on(table.rollNo, table.class, table.section, table.schoolId)
      .where(sql`${table.rollNo} <> '' AND ${table.class} <> '' AND ${table.section} <> '' AND ${table.schoolId} IS NOT NULL`),
    rollClassSectionNullSchoolUnique: uniqueIndex('students_roll_no_class_section_null_school_unique')
      .on(table.rollNo, table.class, table.section)
      .where(sql`${table.rollNo} <> '' AND ${table.class} <> '' AND ${table.section} <> '' AND ${table.schoolId} IS NULL`),
  })
)

export type Student = typeof students.$inferSelect
export type NewStudent = typeof students.$inferInsert

export const parentsGuardians = pgTable('parents_guardians', {
  id: uuid('id').defaultRandom().primaryKey(),
  // Identity & Relationship
  studentId: uuid('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 255 }).notNull(),
  relationship: varchar('relationship', { length: 50 }).notNull().default('Parent'),
  isPrimary: boolean('is_primary').notNull().default(false),
  // Communication
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  altPhone: varchar('alt_phone', { length: 50 }),
  // Socio-Economic & Location
  occupation: varchar('occupation', { length: 255 }),
  annualIncome: varchar('annual_income', { length: 100 }),
  addressLine1: varchar('address_line1', { length: 500 }),
  city: varchar('city', { length: 100 }),
  state: varchar('state', { length: 100 }),
  pincode: varchar('pincode', { length: 20 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type ParentGuardian = typeof parentsGuardians.$inferSelect
export type NewParentGuardian = typeof parentsGuardians.$inferInsert

export const studentBatchEnrollments = pgTable('student_batch_enrollments', {
  id: uuid('id').defaultRandom().primaryKey(),
  studentId: uuid('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  batchName: varchar('batch_name', { length: 255 }).notNull(),
  rollNumber: varchar('roll_number', { length: 100 }).notNull().default(''),
  enrollmentDate: varchar('enrollment_date', { length: 10 }),
  status: varchar('status', { length: 20 }).notNull().default('active'), // active | dropped | transferred | completed
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type StudentBatchEnrollment = typeof studentBatchEnrollments.$inferSelect
export type NewStudentBatchEnrollment = typeof studentBatchEnrollments.$inferInsert

// ── Scheduling & Attendance ──────────────────────────────────────────────

// Weekly recurring timetable entries
export const classSchedules = pgTable('class_schedules', {
  id: uuid('id').defaultRandom().primaryKey(),
  // Teacher, Subject, and Batch links
  teacherName: varchar('teacher_name', { length: 255 }).notNull().default(''),
  teacherEmail: varchar('teacher_email', { length: 255 }).notNull(),
  subject: varchar('subject', { length: 255 }).notNull(),
  batch: varchar('batch', { length: 255 }).notNull(),
  // Timing and Room assignment (dayOfWeek: 0=Sunday … 6=Saturday)
  dayOfWeek: integer('day_of_week').notNull(),
  startTime: varchar('start_time', { length: 20 }).notNull(),
  endTime: varchar('end_time', { length: 20 }).notNull(),
  room: varchar('room', { length: 100 }).notNull().default(''),
  // Effective date range
  effectiveFrom: varchar('effective_from', { length: 10 }),
  effectiveTo: varchar('effective_to', { length: 10 }),
  // Active status toggle
  isActive: boolean('is_active').notNull().default(true),
  schoolId: uuid('school_id').references(() => schools.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type ClassSchedule = typeof classSchedules.$inferSelect
export type NewClassSchedule = typeof classSchedules.$inferInsert

// One-off sessions: Extra | Doubt | Revision | Makeup | Orientation
export const specialClasses = pgTable('special_classes', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  type: varchar('type', { length: 20 }).notNull().default('Extra'),
  teacherName: varchar('teacher_name', { length: 255 }).notNull().default(''),
  teacherEmail: varchar('teacher_email', { length: 255 }).notNull(),
  subject: varchar('subject', { length: 255 }).notNull().default(''),
  batch: varchar('batch', { length: 255 }).notNull().default(''),
  // Specific date and timing
  date: varchar('date', { length: 10 }).notNull(),
  startTime: varchar('start_time', { length: 20 }).notNull(),
  endTime: varchar('end_time', { length: 20 }).notNull(),
  room: varchar('room', { length: 100 }).notNull().default(''),
  notes: text('notes').notNull().default(''),
  schoolId: uuid('school_id').references(() => schools.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type SpecialClass = typeof specialClasses.$inferSelect
export type NewSpecialClass = typeof specialClasses.$inferInsert

// One marked class occurrence — linked to a recurring schedule or a special class
export const attendanceSessions = pgTable('attendance_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  date: varchar('date', { length: 10 }).notNull(),
  batch: varchar('batch', { length: 255 }).notNull(),
  subject: varchar('subject', { length: 255 }).notNull(),
  classTime: varchar('class_time', { length: 50 }).notNull().default(''),
  scheduleId: uuid('schedule_id').references(() => classSchedules.id, { onDelete: 'set null' }),
  specialClassId: uuid('special_class_id').references(() => specialClasses.id, { onDelete: 'set null' }),
  // Marked by Teacher metadata
  markedByName: varchar('marked_by_name', { length: 255 }).notNull().default(''),
  markedByEmail: varchar('marked_by_email', { length: 255 }).notNull().default(''),
  schoolId: uuid('school_id').references(() => schools.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type AttendanceSession = typeof attendanceSessions.$inferSelect
export type NewAttendanceSession = typeof attendanceSessions.$inferInsert

// Per-class student tracking: Present | Absent | Late | Excused
export const attendanceEntries = pgTable('attendance_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionId: uuid('session_id').notNull().references(() => attendanceSessions.id, { onDelete: 'cascade' }),
  studentId: uuid('student_id').references(() => students.id, { onDelete: 'set null' }),
  studentName: varchar('student_name', { length: 255 }).notNull(),
  rollNo: varchar('roll_no', { length: 100 }).notNull().default(''),
  status: varchar('status', { length: 10 }).notNull().default('Present'),
  notes: varchar('notes', { length: 500 }).notNull().default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type AttendanceEntry = typeof attendanceEntries.$inferSelect
export type NewAttendanceEntry = typeof attendanceEntries.$inferInsert

// Academic calendar: Holidays, Exams, and Events
export const calendarEvents = pgTable('calendar_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull().default(''),
  // Event types: Holiday | Exam/Test | Parent Meeting | Meeting | Event
  type: varchar('type', { length: 30 }).notNull().default('Event'),
  // Scope: School-wide | Program | Batch (scopeValue holds the program/batch name)
  scope: varchar('scope', { length: 255 }).notNull().default('School-wide'),
  scopeValue: varchar('scope_value', { length: 255 }).notNull().default(''),
  // Start and End dates
  date: varchar('date', { length: 10 }).notNull(),
  endDate: varchar('end_date', { length: 10 }),
  schoolId: uuid('school_id').references(() => schools.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type CalendarEvent = typeof calendarEvents.$inferSelect
export type NewCalendarEvent = typeof calendarEvents.$inferInsert

// Institutional compliance protocols (School Background > Protocols panel)
export const protocols = pgTable('protocols', {
  id: uuid('id').defaultRandom().primaryKey(),
  label: varchar('label', { length: 255 }).notNull(),
  sub: varchar('sub', { length: 500 }).notNull().default(''),
  // Status: completed | pending | overdue
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  reviewedAt: varchar('reviewed_at', { length: 50 }),
  overdueDays: integer('overdue_days'),
  schoolId: uuid('school_id').references(() => schools.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type Protocol = typeof protocols.$inferSelect
export type NewProtocol = typeof protocols.$inferInsert

// ── Programs, Batches & Academic Structure ─────────────────────────────────

// Types: JEE | NEET | Foundational; Target Exams: JEE Main, Advanced, NEET UG, Board
export const programs = pgTable('programs', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: varchar('code', { length: 50 }).notNull().default(''),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 50 }).notNull().default('Foundational'),
  targetExam: varchar('target_exam', { length: 100 }).notNull().default(''),
  duration: varchar('duration', { length: 50 }).notNull().default(''),
  isActive: boolean('is_active').notNull().default(true),
  colorTheme: varchar('color_theme', { length: 20 }).notNull().default('blue'),
  schoolId: uuid('school_id').references(() => schools.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type Program = typeof programs.$inferSelect
export type NewProgram = typeof programs.$inferInsert

// Specific student groups per year. Class levels: 9 | 10 | 11 | 12 | Dropper.
// Students link to a batch by name (students.batch), so `name` is the join key.
export const batches = pgTable('batches', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  classLevel: varchar('class_level', { length: 20 }).notNull().default(''),
  // Metrics
  capacity: integer('capacity').notNull().default(60),
  enrolledCount: integer('enrolled_count').notNull().default(0),
  // Schedule
  startDate: varchar('start_date', { length: 10 }),
  endDate: varchar('end_date', { length: 10 }),
  // Coordination — program links live in batch_programs (many-to-many)
  schoolId: uuid('school_id').references(() => schools.id, { onDelete: 'cascade' }),
  teacherId: uuid('teacher_id').references(() => faculty.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type Batch = typeof batches.$inferSelect
export type NewBatch = typeof batches.$inferInsert

// One batch can run under several programs at once (e.g. a batch that's
// both JEE and NEET track), and one program spans many batches.
export const batchPrograms = pgTable('batch_programs', {
  id: uuid('id').defaultRandom().primaryKey(),
  batchId: uuid('batch_id').notNull().references(() => batches.id, { onDelete: 'cascade' }),
  programId: uuid('program_id').notNull().references(() => programs.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  batchProgramUnique: uniqueIndex('batch_programs_unique').on(table.batchId, table.programId),
}))

export type BatchProgram = typeof batchPrograms.$inferSelect
export type NewBatchProgram = typeof batchPrograms.$inferInsert

export const subjects = pgTable('subjects', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  code: varchar('code', { length: 50 }).notNull().default(''),
  description: text('description').notNull().default(''),
  schoolId: uuid('school_id').references(() => schools.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export type Subject = typeof subjects.$inferSelect
export type NewSubject = typeof subjects.$inferInsert

// Program -> Subject mapping
export const programSubjects = pgTable('program_subjects', {
  id: uuid('id').defaultRandom().primaryKey(),
  programId: uuid('program_id').notNull().references(() => programs.id, { onDelete: 'cascade' }),
  subjectId: uuid('subject_id').notNull().references(() => subjects.id, { onDelete: 'cascade' }),
  isCore: boolean('is_core').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export type ProgramSubject = typeof programSubjects.$inferSelect
export type NewProgramSubject = typeof programSubjects.$inferInsert

// Syllabus breakdown per subject/program
export const chapters = pgTable('chapters', {
  id: uuid('id').defaultRandom().primaryKey(),
  subjectId: uuid('subject_id').notNull().references(() => subjects.id, { onDelete: 'cascade' }),
  programId: uuid('program_id').references(() => programs.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description').notNull().default(''),
  orderIndex: integer('order_index').notNull().default(0),
  expectedHours: integer('expected_hours'),
  schoolId: uuid('school_id').references(() => schools.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export type Chapter = typeof chapters.$inferSelect
export type NewChapter = typeof chapters.$inferInsert

// Batch chapter timeline: Not Started | In Progress | Completed
export const batchSyllabus = pgTable('batch_syllabus', {
  id: uuid('id').defaultRandom().primaryKey(),
  batchId: uuid('batch_id').notNull().references(() => batches.id, { onDelete: 'cascade' }),
  chapterId: uuid('chapter_id').notNull().references(() => chapters.id, { onDelete: 'cascade' }),
  targetStartDate: varchar('target_start_date', { length: 10 }),
  targetEndDate: varchar('target_end_date', { length: 10 }),
  actualEndDate: varchar('actual_end_date', { length: 10 }),
  status: varchar('status', { length: 20 }).notNull().default('Not Started'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type BatchSyllabus = typeof batchSyllabus.$inferSelect
export type NewBatchSyllabus = typeof batchSyllabus.$inferInsert

export const counselingSessionTypeEnum = pgEnum('counseling_session_type', ['Academic', 'Career', 'Personal', 'Disciplinary', 'Parent Meeting'])
export const counselingSessionStatusEnum = pgEnum('counseling_session_status', ['Scheduled', 'Completed', 'No-Show', 'Cancelled'])

export const counselingSessions = pgTable('counseling_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  studentName: varchar('student_name', { length: 255 }).notNull(),
  studentInitials: varchar('student_initials', { length: 10 }).notNull(),
  counselor: varchar('counselor', { length: 255 }).notNull(),
  counselorId: uuid('counselor_id').references(() => users.id, { onDelete: 'set null' }),
  counselorRole: varchar('counselor_role', { length: 50 }),
  type: counselingSessionTypeEnum('type').notNull().default('Academic'),
  date: varchar('date', { length: 255 }).notNull(),
  time: varchar('time', { length: 255 }).notNull(),
  status: counselingSessionStatusEnum('status').notNull().default('Scheduled'),
  // Session records
  notes: text('notes').default(''),
  actionItems: text('action_items').notNull().default(''),
  duration: varchar('duration', { length: 255 }).default('30 mins'),
  durationMinutes: integer('duration_minutes').notNull().default(30),
  nextSessionDate: varchar('next_session_date', { length: 10 }),
  flagged: boolean('flagged').default(false).notNull(),
  schoolId: uuid('school_id').references(() => schools.id, { onDelete: 'cascade' }),
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
  schoolId: uuid('school_id').references(() => schools.id, { onDelete: 'cascade' }),
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

// The chart's "teachers" table — extended in place
export const faculty = pgTable('faculty', {
  // Identities & Keys
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  schoolId: uuid('school_id').references(() => schools.id, { onDelete: 'cascade' }),
  employeeId: varchar('employee_id', { length: 100 }),
  // Personal Details
  name: varchar('name', { length: 255 }).notNull(),
  dob: varchar('dob', { length: 10 }),
  gender: varchar('gender', { length: 20 }),
  bio: text('bio'),
  profileImgUrl: text('profile_img_url'),
  // Contact Information
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  altPhone: varchar('alt_phone', { length: 50 }),
  addressLine1: varchar('address_line1', { length: 500 }),
  city: varchar('city', { length: 100 }),
  state: varchar('state', { length: 100 }),
  pincode: varchar('pincode', { length: 20 }),
  // Professional Profile
  qualification: varchar('qualification', { length: 255 }),
  experienceYears: integer('experience_years'),
  primaryStream: varchar('primary_stream', { length: 100 }),
  joiningDate: varchar('joining_date', { length: 10 }),
  isActive: boolean('is_active').notNull().default(true),
  // Legacy columns kept for existing UI
  subject: varchar('subject', { length: 255 }).notNull(),
  specialization: varchar('specialization', { length: 255 }).notNull(),
  batches: integer('batches').notNull().default(0),
  experience: varchar('experience', { length: 255 }).notNull().default(''),
  status: facultyStatusEnum('status').notNull().default('ACTIVE'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  employeeIdSchoolUnique: uniqueIndex('faculty_employee_id_school_unique')
    .on(table.employeeId, table.schoolId)
    .where(sql`${table.employeeId} IS NOT NULL AND ${table.employeeId} <> ''`),
}))

export type Faculty = typeof faculty.$inferSelect
export type NewFaculty = typeof faculty.$inferInsert

// Subjects a teacher can teach (subject/program stored by name — no subjects table exists)
export const teacherSubjects = pgTable('teacher_subjects', {
  id: uuid('id').defaultRandom().primaryKey(),
  teacherId: uuid('teacher_id').notNull().references(() => faculty.id, { onDelete: 'cascade' }),
  subjectName: varchar('subject_name', { length: 255 }).notNull(),
  programName: varchar('program_name', { length: 255 }).notNull().default(''),
  isPrimary: boolean('is_primary').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export type TeacherSubject = typeof teacherSubjects.$inferSelect
export type NewTeacherSubject = typeof teacherSubjects.$inferInsert

// Batch assignments: role = primary | substitute | assistant
export const teacherBatches = pgTable('teacher_batches', {
  id: uuid('id').defaultRandom().primaryKey(),
  teacherId: uuid('teacher_id').notNull().references(() => faculty.id, { onDelete: 'cascade' }),
  batchName: varchar('batch_name', { length: 255 }).notNull(),
  subjectName: varchar('subject_name', { length: 255 }).notNull().default(''),
  role: varchar('role', { length: 20 }).notNull().default('primary'),
  assignedAt: varchar('assigned_at', { length: 10 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export type TeacherBatch = typeof teacherBatches.$inferSelect
export type NewTeacherBatch = typeof teacherBatches.$inferInsert

// Programs a teacher is assigned to (name-based, like teacherSubjects/teacherBatches).
// Used to scope which students a teacher sees in their portal.
export const teacherPrograms = pgTable('teacher_programs', {
  id: uuid('id').defaultRandom().primaryKey(),
  teacherId: uuid('teacher_id').notNull().references(() => faculty.id, { onDelete: 'cascade' }),
  programName: varchar('program_name', { length: 255 }).notNull(),
  isPrimary: boolean('is_primary').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export type TeacherProgram = typeof teacherPrograms.$inferSelect
export type NewTeacherProgram = typeof teacherPrograms.$inferInsert

export const studyMaterials = pgTable('study_materials', {
  id: uuid('id').defaultRandom().primaryKey(),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  type: varchar('type', { length: 50 }).notNull().default('PDF'),
  fileUrl: text('file_url'),
  subject: varchar('subject', { length: 255 }).notNull(),
  provider: varchar('provider', { length: 255 }).notNull(),
  schoolId: uuid('school_id').references(() => schools.id, { onDelete: 'cascade' }),
  uploadedBy: varchar('uploaded_by', { length: 255 }),
  subjectId: varchar('subject_id', { length: 255 }),
  chapterId: varchar('chapter_id', { length: 255 }),
  programId: varchar('program_id', { length: 255 }),
  batchId: varchar('batch_id', { length: 255 }),
  title: varchar('title', { length: 255 }),
  description: text('description'),
  fileSize: integer('file_size'),
  isPublic: boolean('is_public').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export type StudyMaterial = typeof studyMaterials.$inferSelect
export type NewStudyMaterial = typeof studyMaterials.$inferInsert

export const dailyReports = pgTable('daily_reports', {
  id: uuid('id').defaultRandom().primaryKey(),
  teacherName: varchar('teacher_name', { length: 255 }).notNull(),
  teacherEmail: varchar('teacher_email', { length: 255 }).notNull(),
  date: varchar('date', { length: 10 }).notNull(),
  batch: varchar('batch', { length: 255 }).notNull(),
  subject: varchar('subject', { length: 255 }).notNull(),
  chapter: varchar('chapter', { length: 255 }).notNull().default(''),
  topicsCovered: text('topics_covered').notNull().default(''),
  presentCount: integer('present_count').notNull().default(0),
  absentCount: integer('absent_count').notNull().default(0),
  homeworkGiven: text('homework_given').default(''),
  observations: text('observations').default(''),
  isLate: boolean('is_late').notNull().default(false),
  schoolId: uuid('school_id').references(() => schools.id, { onDelete: 'cascade' }),
  submittedAt: timestamp('submitted_at', { withTimezone: true }).defaultNow().notNull(),
})

export type DailyReport = typeof dailyReports.$inferSelect
export type NewDailyReport = typeof dailyReports.$inferInsert

export const progressReports = pgTable('progress_reports', {
  id: uuid('id').defaultRandom().primaryKey(),
  studentId: uuid('student_id').references(() => students.id, { onDelete: 'set null' }),
  studentName: varchar('student_name', { length: 255 }).notNull(),
  rollNo: varchar('roll_no', { length: 100 }).notNull().default(''),
  batch: varchar('batch', { length: 255 }).notNull(),
  termType: varchar('term_type', { length: 100 }).notNull().default('Mid-Term'),
  academicYear: varchar('academic_year', { length: 50 }).notNull().default('2025-2026'),
  percentage: varchar('percentage', { length: 50 }).notNull().default('0%'),
  rank: varchar('rank', { length: 50 }).notNull().default('-'),
  teacherRemarks: text('teacher_remarks').notNull().default(''),
  principalRemarks: text('principal_remarks').notNull().default(''),
  teacherName: varchar('teacher_name', { length: 255 }).notNull().default('Faculty'),
  teacherEmail: varchar('teacher_email', { length: 255 }).notNull().default(''),
  schoolId: uuid('school_id').references(() => schools.id, { onDelete: 'cascade' }),
  generatedAt: timestamp('generated_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type ProgressReport = typeof progressReports.$inferSelect
export type NewProgressReport = typeof progressReports.$inferInsert

export const progressReportSubjects = pgTable('progress_report_subjects', {
  id: uuid('id').defaultRandom().primaryKey(),
  progressReportId: uuid('progress_report_id').notNull().references(() => progressReports.id, { onDelete: 'cascade' }),
  subjectName: varchar('subject_name', { length: 255 }).notNull(),
  marksObtained: integer('marks_obtained').notNull().default(0),
  totalMarks: integer('total_marks').notNull().default(100),
  grade: varchar('grade', { length: 20 }).notNull().default('A'),
  rankInBatch: varchar('rank_in_batch', { length: 50 }).notNull().default('-'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export type ProgressReportSubject = typeof progressReportSubjects.$inferSelect
export type NewProgressReportSubject = typeof progressReportSubjects.$inferInsert

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
  description: text('description'),
  totalMarks: integer('total_marks').default(100).notNull(),
  schoolId: uuid('school_id').references(() => schools.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type Assignment = typeof assignments.$inferSelect
export type NewAssignment = typeof assignments.$inferInsert

export const assignmentSubmissions = pgTable('assignment_submissions', {
  id: uuid('id').defaultRandom().primaryKey(),
  assignmentId: uuid('assignment_id').notNull().references(() => assignments.id, { onDelete: 'cascade' }),
  studentId: uuid('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  gradedAt: timestamp('graded_at', { withTimezone: true }),
  gradedBy: varchar('graded_by', { length: 255 }),
  fileUrl: text('file_url'),
  marksObtained: integer('marks_obtained'),
  feedback: text('feedback'),
  status: varchar('status', { length: 50 }).notNull().default('Pending'), // Pending, Submitted, Graded, Late, Not Submitted
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type AssignmentSubmission = typeof assignmentSubmissions.$inferSelect
export type NewAssignmentSubmission = typeof assignmentSubmissions.$inferInsert

export const feedback = pgTable('feedback', {
  id: uuid('id').defaultRandom().primaryKey(),
  senderName: varchar('sender_name', { length: 255 }).notNull().default(''),
  isAnonymous: boolean('is_anonymous').notNull().default(false),
  rating: integer('rating').notNull().default(5),
  content: text('content').notNull().default(''),
  type: varchar('type', { length: 50 }).notNull().default('Student -> Teacher'),
  status: varchar('status', { length: 30 }).notNull().default('Submitted'),
  subject: varchar('subject', { length: 255 }).default(''),
  batch: varchar('batch', { length: 255 }).default(''),
  category: varchar('category', { length: 255 }).default(''),
  date: varchar('date', { length: 10 }).notNull(),
  schoolId: uuid('school_id').references(() => schools.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type Feedback = typeof feedback.$inferSelect
export type NewFeedback = typeof feedback.$inferInsert

export const announcements = pgTable('announcements', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content').notNull(),
  label: varchar('label', { length: 255 }).default(''),
  sub: text('sub').default(''),
  // Types: General | Academic | Exam | Holiday | Urgent | Fee
  type: varchar('type', { length: 50 }).notNull().default('General'),
  // Scopes: All | Program | Batch | Role (scopeValue holds the program/batch name)
  scope: varchar('scope', { length: 255 }).notNull().default('All'),
  scopeValue: varchar('scope_value', { length: 255 }).notNull().default(''),
  // Target roles when scope = Role: All | Teacher | Parent
  targetRoles: varchar('target_roles', { length: 100 }).notNull().default('All'),
  pinned: boolean('pinned').notNull().default(false),
  urgent: boolean('urgent').notNull().default(false),
  // Attachments
  attachmentUrl: varchar('attachment_url', { length: 1000 }).notNull().default(''),
  attachmentName: varchar('attachment_name', { length: 255 }).notNull().default(''),
  authorName: varchar('author_name', { length: 255 }).notNull().default('Admin'),
  authorRole: varchar('author_role', { length: 255 }).notNull().default('Staff'),
  expiryDate: varchar('expiry_date', { length: 50 }),
  done: boolean('done').notNull().default(false),
  schoolId: uuid('school_id').references(() => schools.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type Announcement = typeof announcements.$inferSelect
export type NewAnnouncement = typeof announcements.$inferInsert

// Per-user notification inbox with categories and read-status tracking
export const notifications = pgTable('notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  // Categories: Announcement | Result | Assignment | Fee | Attendance | General
  category: varchar('category', { length: 30 }).notNull().default('General'),
  title: varchar('title', { length: 255 }).notNull(),
  message: text('message').notNull().default(''),
  link: varchar('link', { length: 500 }).notNull().default(''),
  isRead: boolean('is_read').notNull().default(false),
  readAt: timestamp('read_at', { withTimezone: true }),
  schoolId: uuid('school_id').references(() => schools.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export type Notification = typeof notifications.$inferSelect
export type NewNotification = typeof notifications.$inferInsert

export const adminSchools = pgTable('admin_schools', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  schoolId: uuid('school_id').notNull().references(() => schools.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 20 }).notNull().default('member'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userSchoolUnique: uniqueIndex('admin_schools_user_school_unique').on(table.userId, table.schoolId),
}))

export type AdminSchool = typeof adminSchools.$inferSelect
export type NewAdminSchool = typeof adminSchools.$inferInsert

export const recruitmentRequirements = pgTable('recruitment_requirements', {
  id: uuid('id').defaultRandom().primaryKey(),
  jobTitle: varchar('job_title', { length: 255 }).notNull(),
  subjectProgram: varchar('subject_program', { length: 255 }).notNull(),
  department: varchar('department', { length: 255 }).notNull().default('SCIENCE'),
  experienceRequired: varchar('experience_required', { length: 255 }).notNull().default('3+ Years'),
  qualificationRequired: varchar('qualification_required', { length: 255 }).notNull().default('Master\'s Degree'),
  vacancies: integer('vacancies').notNull().default(1),
  status: varchar('status', { length: 50 }).notNull().default('Open'), // Open, Closed, Draft
  postingDate: varchar('posting_date', { length: 50 }).notNull().default(''),
  closingDate: varchar('closing_date', { length: 50 }).notNull().default(''),
  schoolId: uuid('school_id').references(() => schools.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type RecruitmentRequirement = typeof recruitmentRequirements.$inferSelect
export type NewRecruitmentRequirement = typeof recruitmentRequirements.$inferInsert

export const recruitmentCandidates = pgTable('recruitment_candidates', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  contactEmail: varchar('contact_email', { length: 255 }).notNull().default(''),
  contactPhone: varchar('contact_phone', { length: 50 }).notNull().default(''),
  qualification: varchar('qualification', { length: 255 }).notNull().default(''),
  resumeLink: varchar('resume_link', { length: 1000 }).notNull().default(''),
  yearsOfExperience: varchar('years_of_experience', { length: 50 }).notNull().default('0'),
  currentOrganization: varchar('current_organization', { length: 255 }).notNull().default(''),
  specialization: varchar('specialization', { length: 255 }).notNull().default(''),
  expectedSalary: varchar('expected_salary', { length: 100 }).notNull().default(''),
  appliedDate: varchar('applied_date', { length: 50 }).notNull().default(''),
  workflowStatus: varchar('workflow_status', { length: 50 }).notNull().default('Requirement'), // Requirement, Shortlisted, Interview Scheduled, Under Review, Offer Extended, Rejected, Hired
  roleApplied: varchar('role_applied', { length: 255 }).notNull().default(''),
  department: varchar('department', { length: 255 }).notNull().default('SCIENCE'),
  requirementId: uuid('requirement_id').references(() => recruitmentRequirements.id, { onDelete: 'set null' }),
  avatarInitials: varchar('avatar_initials', { length: 10 }).notNull().default('XX'),
  theme: varchar('theme', { length: 50 }).notNull().default('blue'),
  schedule: varchar('schedule', { length: 255 }).default(''),
  schoolId: uuid('school_id').references(() => schools.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type RecruitmentCandidate = typeof recruitmentCandidates.$inferSelect
export type NewRecruitmentCandidate = typeof recruitmentCandidates.$inferInsert

export const recruitmentInterviews = pgTable('recruitment_interviews', {
  id: uuid('id').defaultRandom().primaryKey(),
  candidateId: uuid('candidate_id').references(() => recruitmentCandidates.id, { onDelete: 'cascade' }),
  candidateName: varchar('candidate_name', { length: 255 }).notNull().default(''),
  dateTime: varchar('date_time', { length: 100 }).notNull().default(''),
  mode: varchar('mode', { length: 50 }).notNull().default('In-person'), // In-person, Online
  locationOrLink: varchar('location_or_link', { length: 500 }).notNull().default(''),
  feedbackText: text('feedback_text').notNull().default(''),
  rating: integer('rating').notNull().default(3), // 1-5
  finalResult: varchar('final_result', { length: 50 }).notNull().default('Pending'), // Pending, Pass, Fail, Hold, Offer
  interviewerName: varchar('interviewer_name', { length: 255 }).notNull().default('Panel'),
  schoolId: uuid('school_id').references(() => schools.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type RecruitmentInterview = typeof recruitmentInterviews.$inferSelect
export type NewRecruitmentInterview = typeof recruitmentInterviews.$inferInsert

export const teacherAppraisals = pgTable('teacher_appraisals', {
  id: uuid('id').defaultRandom().primaryKey(),
  teacherName: varchar('teacher_name', { length: 255 }).notNull(),
  teacherEmail: varchar('teacher_email', { length: 255 }).default(''),
  department: varchar('department', { length: 255 }).notNull().default('Science'),
  appraiserName: varchar('appraiser_name', { length: 255 }).notNull().default('Head of Department'),
  period: varchar('period', { length: 100 }).notNull().default('Annual'),
  academicYear: varchar('academic_year', { length: 50 }).notNull().default('2025-2026'),
  teachingRating: varchar('teaching_rating', { length: 50 }).notNull().default('5'),
  punctualityRating: varchar('punctuality_rating', { length: 50 }).notNull().default('5'),
  studentFeedbackAverage: varchar('student_feedback_average', { length: 50 }).notNull().default('4.8'),
  overallRating: varchar('overall_rating', { length: 50 }).notNull().default('Excellent'),
  remarksGoals: text('remarks_goals').notNull().default(''),
  improvementAreas: text('improvement_areas').notNull().default(''),
  reviewStatus: varchar('review_status', { length: 50 }).notNull().default('Pending'), // Pending, In Progress, Completed
  scheduledDate: varchar('scheduled_date', { length: 100 }).default(''),
  isCompleted: boolean('is_completed').notNull().default(false),
  avatarInitials: varchar('avatar_initials', { length: 10 }).notNull().default('XX'),
  schoolId: uuid('school_id').references(() => schools.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type TeacherAppraisal = typeof teacherAppraisals.$inferSelect
export type NewTeacherAppraisal = typeof teacherAppraisals.$inferInsert

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userActionType: varchar('user_action_type', { length: 255 }).notNull(),
  tableName: varchar('table_name', { length: 255 }).notNull(),
  recordId: varchar('record_id', { length: 255 }).notNull().default(''),
  oldValues: text('old_values').notNull().default(''),
  newValues: text('new_values').notNull().default(''),
  ipAddress: varchar('ip_address', { length: 100 }).notNull().default('127.0.0.1'),
  userAgent: text('user_agent').notNull().default(''),
  authorName: varchar('author_name', { length: 255 }).notNull().default('Admin'),
  authorRole: varchar('author_role', { length: 255 }).notNull().default('Management'),
  schoolId: uuid('school_id').references(() => schools.id, { onDelete: 'cascade' }),
  timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
})

export type AuditLog = typeof auditLogs.$inferSelect
export type NewAuditLog = typeof auditLogs.$inferInsert

// ── Tests & Question Bank ────────────────────────────────────────────────────

export const tests = pgTable('tests', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  batch: varchar('batch', { length: 255 }).notNull(),
  program: varchar('program', { length: 255 }).notNull().default(''),
  subject: varchar('subject', { length: 255 }).notNull(),
  date: varchar('date', { length: 10 }).notNull(),
  time: varchar('time', { length: 20 }).notNull().default('10:00 AM'),
  duration: integer('duration').notNull().default(60),
  totalMarks: integer('total_marks').notNull().default(100),
  status: varchar('status', { length: 30 }).notNull().default('Upcoming'), // Upcoming | Pending Grading | Graded
  testType: varchar('test_type', { length: 30 }).notNull().default('Unit Test'), // Unit Test | Mock | DPP
  averageScore: integer('average_score'),
  // NULL means this row predates faculty ownership (or was created directly
  // by management) — visible to management only, never to any teacher.
  createdByUserId: uuid('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  paperUrl: text('paper_url'),
  paperFileName: varchar('paper_file_name', { length: 255 }),
  schoolId: uuid('school_id').references(() => schools.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type Test = typeof tests.$inferSelect
export type NewTest = typeof tests.$inferInsert

export const questions = pgTable('questions', {
  id: uuid('id').defaultRandom().primaryKey(),
  subject: varchar('subject', { length: 255 }).notNull(),
  topic: varchar('topic', { length: 255 }).notNull(),
  difficulty: varchar('difficulty', { length: 20 }).notNull().default('Medium'), // Easy | Medium | Hard
  type: varchar('type', { length: 30 }).notNull().default('MCQ'), // MCQ | Numerical | Integer | Subjective
  text: text('text').notNull(),
  // JSON array stored as text: ["Option A", "Option B", ...]
  options: text('options').notNull().default('[]'),
  correctAnswer: text('correct_answer').notNull().default(''),
  marks: integer('marks').notNull().default(4),
  negativeMarks: integer('negative_marks').notNull().default(0),
  source: varchar('source', { length: 100 }).notNull().default('Custom'),
  // NULL means this row predates faculty ownership — visible to management
  // only, never to any teacher. Same semantics as tests.createdByUserId.
  createdByUserId: uuid('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  schoolId: uuid('school_id').references(() => schools.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type Question = typeof questions.$inferSelect
export type NewQuestion = typeof questions.$inferInsert

export const testGrades = pgTable('test_grades', {
  id: uuid('id').defaultRandom().primaryKey(),
  testId: uuid('test_id').notNull().references(() => tests.id, { onDelete: 'cascade' }),
  studentId: uuid('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  rollNo: varchar('roll_no', { length: 255 }).notNull().default(''),
  // NULL = not graded yet, or graded but marked absent.
  marksObtained: integer('marks_obtained'),
  correct: integer('correct'),
  incorrect: integer('incorrect'),
  unattempted: integer('unattempted'),
  absent: boolean('absent').notNull().default(false),
  gradedByUserId: uuid('graded_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  schoolId: uuid('school_id').references(() => schools.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  testStudentUnique: uniqueIndex('test_grades_test_id_student_id_unique').on(table.testId, table.studentId),
}))

export type TestGrade = typeof testGrades.$inferSelect
export type NewTestGrade = typeof testGrades.$inferInsert

// ── Finance & Fee Management ──────────────────────────────────────────────────

export const feeStructures = pgTable('fee_structures', {
  id: uuid('id').defaultRandom().primaryKey(),
  // Fee Types: Registration Fee, Monthly Tuition, Exam Fee, Material Fee, Other
  feeType: varchar('fee_type', { length: 100 }).notNull().default('Monthly Tuition'),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description').default(''),
  
  // Financial Details
  amount: integer('amount').notNull().default(0),
  frequency: varchar('frequency', { length: 50 }).notNull().default('Monthly'), // One-time, Monthly, Quarterly, Yearly
  dueDay: integer('due_day').notNull().default(5), // 1-31
  isMandatory: boolean('is_mandatory').notNull().default(true),
  
  // Scope and Relations
  schoolId: uuid('school_id').references(() => schools.id, { onDelete: 'cascade' }),
  programAssociation: varchar('program_association', { length: 255 }).notNull().default('All Programs'),
  batchAssociation: varchar('batch_association', { length: 255 }).notNull().default('All Batches'),
  academicYear: varchar('academic_year', { length: 50 }).notNull().default('2024-25'),
  
  // Status
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type FeeStructure = typeof feeStructures.$inferSelect
export type NewFeeStructure = typeof feeStructures.$inferInsert

export const feePayments = pgTable('fee_payments', {
  id: uuid('id').defaultRandom().primaryKey(),
  
  // Student Records
  studentId: uuid('student_id').references(() => students.id, { onDelete: 'cascade' }),
  studentName: varchar('student_name', { length: 255 }).notNull(),
  rollNo: varchar('roll_no', { length: 100 }).default(''),
  class: varchar('class', { length: 100 }).default(''),
  section: varchar('section', { length: 100 }).default(''),
  
  // Fee Structure Link
  feeStructureId: uuid('fee_structure_id').references(() => feeStructures.id, { onDelete: 'set null' }),
  feeName: varchar('fee_name', { length: 255 }).notNull(),
  feeType: varchar('fee_type', { length: 100 }).notNull().default('Monthly Tuition'),
  schoolId: uuid('school_id').references(() => schools.id, { onDelete: 'cascade' }),
  
  // Transaction Details
  amountDue: integer('amount_due').notNull().default(0),
  amountPaid: integer('amount_paid').notNull().default(0),
  discount: integer('discount').notNull().default(0),
  lateFee: integer('late_fee').notNull().default(0),
  
  // Payment Logistics
  paymentMethod: varchar('payment_method', { length: 50 }).default('UPI'), // Cash, Online, Cheque, DD, UPI, Card, Net Banking
  transactionId: varchar('transaction_id', { length: 255 }).default(''),
  receiptNumber: varchar('receipt_number', { length: 100 }).notNull().unique(),
  recordedBy: uuid('recorded_by').references(() => users.id, { onDelete: 'set null' }),
  recordedByName: varchar('recorded_by_name', { length: 255 }).default('Management'),
  
  // Timeline and Status
  dueDate: varchar('due_date', { length: 50 }).notNull(), // YYYY-MM-DD
  paidDate: varchar('paid_date', { length: 50 }).default(''), // YYYY-MM-DD or empty
  status: varchar('status', { length: 50 }).notNull().default('Pending'), // Pending, Partial, Paid, Overdue, Waived
  notes: text('notes').default(''),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type FeePayment = typeof feePayments.$inferSelect
export type NewFeePayment = typeof feePayments.$inferInsert

