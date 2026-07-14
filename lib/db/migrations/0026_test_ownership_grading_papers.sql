ALTER TABLE tests ADD COLUMN IF NOT EXISTS program varchar(255) NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE tests ADD COLUMN IF NOT EXISTS created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE tests ADD COLUMN IF NOT EXISTS paper_url text;
--> statement-breakpoint
ALTER TABLE tests ADD COLUMN IF NOT EXISTS paper_file_name varchar(255);
--> statement-breakpoint
ALTER TABLE questions ADD COLUMN IF NOT EXISTS created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS test_grades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  roll_no varchar(255) NOT NULL DEFAULT '',
  marks_obtained integer,
  correct integer,
  incorrect integer,
  unattempted integer,
  absent boolean NOT NULL DEFAULT false,
  graded_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS test_grades_test_id_student_id_unique ON test_grades(test_id, student_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS test_grades_test_id_idx ON test_grades(test_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS test_grades_student_id_idx ON test_grades(student_id);
