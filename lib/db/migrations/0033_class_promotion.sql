ALTER TABLE schools ADD COLUMN IF NOT EXISTS academic_year_start_month integer NOT NULL DEFAULT 4;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS class_promotion_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  academic_year varchar(255) NOT NULL,
  boundary_date varchar(10) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'pending',
  preview_counts jsonb NOT NULL DEFAULT '{}',
  excluded_new_admission_count integer NOT NULL DEFAULT 0,
  excluded_terminal_count integer NOT NULL DEFAULT 0,
  confirmed_at timestamptz,
  confirmed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS class_promotion_runs_school_year_unique ON class_promotion_runs(school_id, academic_year);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS class_promotion_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES class_promotion_runs(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  from_class varchar(255) NOT NULL,
  to_class varchar(255) NOT NULL,
  previous_batch varchar(255),
  created_at timestamptz NOT NULL DEFAULT now()
);
