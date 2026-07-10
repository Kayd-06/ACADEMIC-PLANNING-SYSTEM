CREATE TABLE IF NOT EXISTS teacher_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
  program_name varchar(255) NOT NULL,
  is_primary boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS teacher_programs_teacher_id_idx ON teacher_programs(teacher_id);
