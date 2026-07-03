--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "join_code" varchar(20) UNIQUE;
--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "admin_email" varchar(255) DEFAULT '';
--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "is_active" boolean NOT NULL DEFAULT true;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "school_id" uuid REFERENCES "schools"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "school_id" uuid REFERENCES "schools"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "faculty" ADD COLUMN IF NOT EXISTS "school_id" uuid REFERENCES "schools"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "assignments" ADD COLUMN IF NOT EXISTS "school_id" uuid REFERENCES "schools"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "feedback" ADD COLUMN IF NOT EXISTS "school_id" uuid REFERENCES "schools"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "daily_reports" ADD COLUMN IF NOT EXISTS "school_id" uuid REFERENCES "schools"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "study_materials" ADD COLUMN IF NOT EXISTS "school_id" uuid REFERENCES "schools"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "student_reports" ADD COLUMN IF NOT EXISTS "school_id" uuid REFERENCES "schools"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "counseling_sessions" ADD COLUMN IF NOT EXISTS "school_id" uuid REFERENCES "schools"("id") ON DELETE CASCADE;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "school_invites" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "email" varchar(255) NOT NULL,
  "role" varchar(20) NOT NULL DEFAULT 'teacher',
  "token" varchar(255) NOT NULL UNIQUE,
  "used" boolean NOT NULL DEFAULT false,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_users_school_id" ON "users"("school_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_students_school_id" ON "students"("school_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_faculty_school_id" ON "faculty"("school_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_assignments_school_id" ON "assignments"("school_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_feedback_school_id" ON "feedback"("school_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_daily_reports_school_id" ON "daily_reports"("school_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_study_materials_school_id" ON "study_materials"("school_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_student_reports_school_id" ON "student_reports"("school_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_counseling_sessions_school_id" ON "counseling_sessions"("school_id");
