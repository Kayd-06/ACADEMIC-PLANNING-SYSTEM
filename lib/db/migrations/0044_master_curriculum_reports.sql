-- Migration: Add 5 new tables for master curriculum, batch/student concept progress, and report card engine
-- master_curriculum, batch_concept_progress, student_concept_progress,
-- generated_student_reports, report_subject_analytics

-- 1. master_curriculum — denormalized flat table matching Excel master sheet
CREATE TABLE IF NOT EXISTS "master_curriculum" (
  "id"                  uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "board"               varchar(50)  NOT NULL,
  "program"             varchar(100) NOT NULL,
  "class_level"         varchar(50)  NOT NULL,
  "subject"             varchar(100) NOT NULL,
  "chapter_name"        varchar(255) NOT NULL,
  "chapter_code"        varchar(50)  NOT NULL DEFAULT '',
  "chapter_order_index" integer      NOT NULL DEFAULT 0,
  "expected_hours"      integer               DEFAULT 0,
  "concept_name"        varchar(255) NOT NULL,
  "concept_code"        varchar(50)  NOT NULL DEFAULT '',
  "concept_order_index" integer      NOT NULL DEFAULT 0,
  "importance_weight"   varchar(20)           DEFAULT 'Medium',
  "school_id"           uuid REFERENCES "schools"("id") ON DELETE CASCADE,
  "is_active"           boolean      NOT NULL DEFAULT true,
  "created_at"          timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"          timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
-- Composite unique index (partial — excludes blank concept codes)
CREATE UNIQUE INDEX IF NOT EXISTS "curriculum_concept_unique"
  ON "master_curriculum" ("school_id","board","program","class_level","subject","concept_code")
  WHERE concept_code <> '';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mc_board_idx"       ON "master_curriculum" ("board");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mc_program_idx"     ON "master_curriculum" ("program");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mc_class_level_idx" ON "master_curriculum" ("class_level");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mc_subject_idx"     ON "master_curriculum" ("subject");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mc_school_idx"      ON "master_curriculum" ("school_id");
--> statement-breakpoint

-- 2. batch_concept_progress — concept-level batch tracking
CREATE TABLE IF NOT EXISTS "batch_concept_progress" (
  "id"                    uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "batch_id"              uuid NOT NULL REFERENCES "batches"("id") ON DELETE CASCADE,
  "curriculum_id"         uuid NOT NULL REFERENCES "master_curriculum"("id") ON DELETE CASCADE,
  "status"                varchar(20) NOT NULL DEFAULT 'NOT_STARTED',
  "planned_start_date"    varchar(10),
  "planned_end_date"      varchar(10),
  "actual_completion_date" varchar(10),
  "teacher_id"            uuid REFERENCES "faculty"("id") ON DELETE SET NULL,
  "updated_at"            timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "batch_concept_progress_unique"
  ON "batch_concept_progress" ("batch_id","curriculum_id");
--> statement-breakpoint

-- 3. student_concept_progress — per-student mastery tracking (per architecture diagram)
CREATE TABLE IF NOT EXISTS "student_concept_progress" (
  "id"                  uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "student_id"          uuid NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
  "curriculum_id"       uuid NOT NULL REFERENCES "master_curriculum"("id") ON DELETE CASCADE,
  "status"              varchar(20) NOT NULL DEFAULT 'NOT_STARTED',
  "mastery_score"       integer DEFAULT 0,
  "last_practice_date"  varchar(10),
  "updated_at"          timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "student_concept_progress_unique"
  ON "student_concept_progress" ("student_id","curriculum_id");
--> statement-breakpoint

-- 4. generated_student_reports — report card engine
CREATE TABLE IF NOT EXISTS "generated_student_reports" (
  "id"                           uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "school_id"                    uuid NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "student_id"                   uuid NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
  "batch_id"                     uuid REFERENCES "batches"("id") ON DELETE SET NULL,
  "report_title"                 varchar(255) NOT NULL,
  "report_type"                  varchar(50)  NOT NULL DEFAULT 'COMPREHENSIVE',
  "academic_year"                varchar(20)  NOT NULL,
  "term"                         varchar(50)  NOT NULL,
  "overall_percentage"           varchar(10)  NOT NULL DEFAULT '0%',
  "overall_grade"                varchar(10)  NOT NULL DEFAULT 'N/A',
  "class_rank"                   varchar(20)           DEFAULT '-',
  "batch_rank"                   varchar(20)           DEFAULT '-',
  "attendance_percentage"        integer               DEFAULT 0,
  "syllabus_coverage_percentage" integer               DEFAULT 0,
  "strength_areas"               text                  DEFAULT '',
  "improvement_areas"            text                  DEFAULT '',
  "teacher_remarks"              text                  DEFAULT '',
  "principal_remarks"            text                  DEFAULT '',
  "pdf_url"                      text,
  "status"                       varchar(20)  NOT NULL DEFAULT 'DRAFT',
  "generated_by"                 uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at"                   timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"                   timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gsr_school_idx"  ON "generated_student_reports" ("school_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gsr_student_idx" ON "generated_student_reports" ("student_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gsr_batch_idx"   ON "generated_student_reports" ("batch_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gsr_term_idx"    ON "generated_student_reports" ("academic_year","term");
--> statement-breakpoint

-- 5. report_subject_analytics — per-subject breakdown within a report
CREATE TABLE IF NOT EXISTS "report_subject_analytics" (
  "id"                      uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "report_id"               uuid NOT NULL REFERENCES "generated_student_reports"("id") ON DELETE CASCADE,
  "subject_name"            varchar(100) NOT NULL,
  "marks_obtained"          integer NOT NULL DEFAULT 0,
  "max_marks"               integer NOT NULL DEFAULT 100,
  "grade"                   varchar(10) NOT NULL DEFAULT 'A',
  "total_chapters_taught"   integer DEFAULT 0,
  "completed_chapters_count" integer DEFAULT 0,
  "concepts_mastered_count" integer DEFAULT 0,
  "concepts_total_count"    integer DEFAULT 0,
  "subject_teacher_remarks" text DEFAULT ''
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "rsa_report_subject_unique"
  ON "report_subject_analytics" ("report_id","subject_name");
