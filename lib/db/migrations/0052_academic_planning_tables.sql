-- 0052: Postgres home for the Academic Planning board (milestones, planning
-- logs, header/quality metrics), which until now lived only in MongoDB
-- (models/AcademicPlanning.ts). Every row belongs to one school and to the
-- role board it is shown on ('management' | 'teacher').
--
-- Only creates new, empty tables (no data is moved or seeded). Safe to re-run.
-- Any milestones/logs/metrics worth keeping must be copied from MongoDB by
-- hand — see the PR description.

CREATE TABLE IF NOT EXISTS "academic_milestones" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "role" varchar(20) NOT NULL,
  "name" varchar(255) NOT NULL,
  "type" varchar(100) NOT NULL,
  "date" varchar(10) NOT NULL,
  "subject" varchar(255) NOT NULL,
  "status" varchar(50) NOT NULL DEFAULT 'Scheduled',
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "academic_milestones_role_check" CHECK ("role" IN ('management', 'teacher'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "academic_milestones_school_role_date_idx" ON "academic_milestones" ("school_id", "role", "date");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "academic_planning_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "role" varchar(20) NOT NULL,
  "title" varchar(255) NOT NULL,
  "focus" text NOT NULL,
  "type" varchar(50) NOT NULL,
  "measure" text NOT NULL,
  "measure_label" varchar(255) NOT NULL,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "academic_planning_logs_role_check" CHECK ("role" IN ('management', 'teacher'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "academic_planning_logs_school_role_created_idx" ON "academic_planning_logs" ("school_id", "role", "created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "academic_metrics" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "role" varchar(20) NOT NULL,
  "label" varchar(255) NOT NULL,
  "value" varchar(50) NOT NULL,
  "trend" varchar(50) NOT NULL,
  "category" varchar(50) NOT NULL,
  "chart_data" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "academic_metrics_role_check" CHECK ("role" IN ('management', 'teacher'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "academic_metrics_school_role_idx" ON "academic_metrics" ("school_id", "role");
