ALTER TABLE faculty ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE faculty ADD COLUMN IF NOT EXISTS employee_id VARCHAR(100);
--> statement-breakpoint
ALTER TABLE faculty ADD COLUMN IF NOT EXISTS dob VARCHAR(10);
--> statement-breakpoint
ALTER TABLE faculty ADD COLUMN IF NOT EXISTS gender VARCHAR(20);
--> statement-breakpoint
ALTER TABLE faculty ADD COLUMN IF NOT EXISTS bio TEXT;
--> statement-breakpoint
ALTER TABLE faculty ADD COLUMN IF NOT EXISTS profile_img_url TEXT;
--> statement-breakpoint
ALTER TABLE faculty ADD COLUMN IF NOT EXISTS alt_phone VARCHAR(50);
--> statement-breakpoint
ALTER TABLE faculty ADD COLUMN IF NOT EXISTS address_line1 VARCHAR(500);
--> statement-breakpoint
ALTER TABLE faculty ADD COLUMN IF NOT EXISTS city VARCHAR(100);
--> statement-breakpoint
ALTER TABLE faculty ADD COLUMN IF NOT EXISTS state VARCHAR(100);
--> statement-breakpoint
ALTER TABLE faculty ADD COLUMN IF NOT EXISTS pincode VARCHAR(20);
--> statement-breakpoint
ALTER TABLE faculty ADD COLUMN IF NOT EXISTS qualification VARCHAR(255);
--> statement-breakpoint
ALTER TABLE faculty ADD COLUMN IF NOT EXISTS experience_years INTEGER;
--> statement-breakpoint
ALTER TABLE faculty ADD COLUMN IF NOT EXISTS primary_stream VARCHAR(100);
--> statement-breakpoint
ALTER TABLE faculty ADD COLUMN IF NOT EXISTS joining_date VARCHAR(10);
--> statement-breakpoint
ALTER TABLE faculty ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
--> statement-breakpoint
ALTER TABLE faculty ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
--> statement-breakpoint
UPDATE faculty SET is_active = (status = 'ACTIVE');
--> statement-breakpoint
UPDATE faculty SET experience_years = COALESCE(NULLIF(regexp_replace(experience, '[^0-9]', '', 'g'), '')::int, NULL) WHERE experience_years IS NULL;
--> statement-breakpoint
UPDATE faculty SET user_id = u.id FROM users u WHERE faculty.user_id IS NULL AND faculty.email IS NOT NULL AND lower(u.email) = lower(faculty.email);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS faculty_employee_id_school_unique ON faculty(employee_id, school_id) WHERE employee_id IS NOT NULL AND employee_id <> '';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS teacher_subjects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
  subject_name VARCHAR(255) NOT NULL,
  program_name VARCHAR(255) NOT NULL DEFAULT '',
  is_primary BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_teacher_subjects_teacher ON teacher_subjects(teacher_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS teacher_batches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
  batch_name VARCHAR(255) NOT NULL,
  subject_name VARCHAR(255) NOT NULL DEFAULT '',
  role VARCHAR(20) NOT NULL DEFAULT 'primary',
  assigned_at VARCHAR(10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_teacher_batches_teacher ON teacher_batches(teacher_id);
--> statement-breakpoint
INSERT INTO teacher_subjects (teacher_id, subject_name, is_primary)
SELECT f.id, f.subject, true FROM faculty f
WHERE f.subject <> '' AND NOT EXISTS (SELECT 1 FROM teacher_subjects ts WHERE ts.teacher_id = f.id);
