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
  schoolId: uuid('school_id').references(() => schools.id, { onDelete: 'set null' }),
  activeSchoolId: uuid('active_school_id').references(() => schools.id, { onDelete: 'set null' }),
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

export const counselingSessionTypeEnum = pgEnum('counseling_session_type', ['Academic', 'Career', 'Personal', 'Disciplinary'])
export const counselingSessionStatusEnum = pgEnum('counseling_session_status', ['Scheduled', 'Completed', 'No-Show', 'Cancelled'])

export const counselingSessions = pgTable('counseling_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  studentName: varchar('student_name', { length: 255 }).notNull(),
  studentInitials: varchar('student_initials', { length: 10 }).notNull(),
  counselor: varchar('counselor', { length: 255 }).notNull(),
  type: counselingSessionTypeEnum('type').notNull().default('Academic'),
  date: varchar('date', { length: 255 }).notNull(),
  time: varchar('time', { length: 255 }).notNull(),
  status: counselingSessionStatusEnum('status').notNull().default('Scheduled'),
  notes: text('notes').default(''),
  duration: varchar('duration', { length: 255 }).default('30 mins'),
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
  schoolId: uuid('school_id').references(() => schools.id, { onDelete: 'cascade' }),
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
  schoolId: uuid('school_id').references(() => schools.id, { onDelete: 'cascade' }),
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
  schoolId: uuid('school_id').references(() => schools.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type Assignment = typeof assignments.$inferSelect
export type NewAssignment = typeof assignments.$inferInsert

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
