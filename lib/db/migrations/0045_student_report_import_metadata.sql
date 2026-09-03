ALTER TABLE "student_reports"
  ADD COLUMN IF NOT EXISTS "imported_by_role" varchar(20) DEFAULT 'teacher' NOT NULL;
--> statement-breakpoint
ALTER TABLE "student_reports"
  ADD COLUMN IF NOT EXISTS "source_file_name" varchar(255);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "student_reports_school_idx"
  ON "student_reports" ("school_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "student_reports_teacher_idx"
  ON "student_reports" ("teacher_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "student_reports_filters_idx"
  ON "student_reports" ("school_id", "class_name", "subject", "term");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "student_report_entries_report_idx"
  ON "student_report_entries" ("report_id");
