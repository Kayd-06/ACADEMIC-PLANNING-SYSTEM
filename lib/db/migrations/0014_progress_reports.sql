CREATE TABLE IF NOT EXISTS "progress_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid REFERENCES "students"("id") ON DELETE set null,
	"student_name" varchar(255) NOT NULL,
	"roll_no" varchar(100) DEFAULT '' NOT NULL,
	"batch" varchar(255) NOT NULL,
	"term_type" varchar(100) DEFAULT 'Mid-Term' NOT NULL,
	"academic_year" varchar(50) DEFAULT '2025-2026' NOT NULL,
	"percentage" varchar(50) DEFAULT '0%' NOT NULL,
	"rank" varchar(50) DEFAULT '-' NOT NULL,
	"teacher_remarks" text DEFAULT '' NOT NULL,
	"principal_remarks" text DEFAULT '' NOT NULL,
	"teacher_name" varchar(255) DEFAULT 'Faculty' NOT NULL,
	"teacher_email" varchar(255) DEFAULT '' NOT NULL,
	"school_id" uuid REFERENCES "schools"("id") ON DELETE cascade,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "progress_report_subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"progress_report_id" uuid NOT NULL REFERENCES "progress_reports"("id") ON DELETE cascade,
	"subject_name" varchar(255) NOT NULL,
	"marks_obtained" integer DEFAULT 0 NOT NULL,
	"total_marks" integer DEFAULT 100 NOT NULL,
	"grade" varchar(20) DEFAULT 'A' NOT NULL,
	"rank_in_batch" varchar(50) DEFAULT '-' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
