ALTER TABLE students ADD COLUMN IF NOT EXISTS admission_number VARCHAR(100);
--> statement-breakpoint
ALTER TABLE students ADD COLUMN IF NOT EXISTS aadhar_number VARCHAR(20);
--> statement-breakpoint
ALTER TABLE students ADD COLUMN IF NOT EXISTS email VARCHAR(255);
--> statement-breakpoint
ALTER TABLE students ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
--> statement-breakpoint
ALTER TABLE students ADD COLUMN IF NOT EXISTS address_line1 VARCHAR(500);
--> statement-breakpoint
ALTER TABLE students ADD COLUMN IF NOT EXISTS city VARCHAR(100);
--> statement-breakpoint
ALTER TABLE students ADD COLUMN IF NOT EXISTS state VARCHAR(100);
--> statement-breakpoint
ALTER TABLE students ADD COLUMN IF NOT EXISTS pincode VARCHAR(20);
--> statement-breakpoint
ALTER TABLE students ADD COLUMN IF NOT EXISTS dob VARCHAR(10);
--> statement-breakpoint
ALTER TABLE students ADD COLUMN IF NOT EXISTS gender VARCHAR(20);
--> statement-breakpoint
ALTER TABLE students ADD COLUMN IF NOT EXISTS blood_group VARCHAR(10);
--> statement-breakpoint
ALTER TABLE students ADD COLUMN IF NOT EXISTS profile_img_url TEXT;
--> statement-breakpoint
ALTER TABLE students ADD COLUMN IF NOT EXISTS previous_school VARCHAR(255);
--> statement-breakpoint
ALTER TABLE students ADD COLUMN IF NOT EXISTS previous_percentage VARCHAR(20);
--> statement-breakpoint
ALTER TABLE students ADD COLUMN IF NOT EXISTS admission_date VARCHAR(10);
--> statement-breakpoint
ALTER TABLE students ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active';
--> statement-breakpoint
ALTER TABLE students ADD COLUMN IF NOT EXISTS notes TEXT;
--> statement-breakpoint
ALTER TABLE students ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;
--> statement-breakpoint
UPDATE students SET status = 'inactive' WHERE is_active = false AND status = 'active';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS parents_guardians (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  relationship VARCHAR(50) NOT NULL DEFAULT 'Parent',
  is_primary BOOLEAN NOT NULL DEFAULT false,
  email VARCHAR(255),
  phone VARCHAR(50),
  alt_phone VARCHAR(50),
  occupation VARCHAR(255),
  annual_income VARCHAR(100),
  address_line1 VARCHAR(500),
  city VARCHAR(100),
  state VARCHAR(100),
  pincode VARCHAR(20),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_parents_guardians_student ON parents_guardians(student_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS student_batch_enrollments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  batch_name VARCHAR(255) NOT NULL,
  roll_number VARCHAR(100) NOT NULL DEFAULT '',
  enrollment_date VARCHAR(10),
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_student_batch_enrollments_student ON student_batch_enrollments(student_id);
--> statement-breakpoint
INSERT INTO parents_guardians (student_id, name, relationship, is_primary, phone)
SELECT s.id, 'Primary Contact', 'Parent', true, s.parent_contact
FROM students s
WHERE s.parent_contact IS NOT NULL AND s.parent_contact <> ''
  AND NOT EXISTS (SELECT 1 FROM parents_guardians pg WHERE pg.student_id = s.id);
--> statement-breakpoint
INSERT INTO student_batch_enrollments (student_id, batch_name, roll_number, status)
SELECT s.id, s.batch, s.roll_no, CASE WHEN s.is_active THEN 'active' ELSE 'dropped' END
FROM students s
WHERE s.batch <> ''
  AND NOT EXISTS (SELECT 1 FROM student_batch_enrollments e WHERE e.student_id = s.id);
