CREATE TABLE IF NOT EXISTS programs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code VARCHAR(50) NOT NULL DEFAULT '',
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'Foundational',
  target_exam VARCHAR(100) NOT NULL DEFAULT '',
  duration VARCHAR(50) NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  color_theme VARCHAR(20) NOT NULL DEFAULT 'blue',
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS batches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  class_level VARCHAR(20) NOT NULL DEFAULT '',
  capacity INTEGER NOT NULL DEFAULT 60,
  enrolled_count INTEGER NOT NULL DEFAULT 0,
  start_date VARCHAR(10),
  end_date VARCHAR(10),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  program_id UUID REFERENCES programs(id) ON DELETE SET NULL,
  teacher_id UUID REFERENCES faculty(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_batches_school ON batches(school_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS subjects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS program_subjects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  is_core BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS chapters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  program_id UUID REFERENCES programs(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  order_index INTEGER NOT NULL DEFAULT 0,
  expected_hours INTEGER,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS batch_syllabus (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  target_start_date VARCHAR(10),
  target_end_date VARCHAR(10),
  actual_end_date VARCHAR(10),
  status VARCHAR(20) NOT NULL DEFAULT 'Not Started',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
-- Backfill: one batch row per distinct batch name already present on students,
-- so existing rosters immediately appear under real batch records
INSERT INTO batches (name, school_id, enrolled_count)
SELECT s.batch, s.school_id, COUNT(*)
FROM students s
WHERE s.batch <> '' AND s.is_active = true
GROUP BY s.batch, s.school_id
HAVING NOT EXISTS (
  SELECT 1 FROM batches b WHERE b.name = s.batch AND b.school_id IS NOT DISTINCT FROM s.school_id
);
--> statement-breakpoint
-- Schools that have students but ended up with no batch at all get "Batch 1"
INSERT INTO batches (name, school_id)
SELECT DISTINCT 'Batch 1', s.school_id
FROM students s
WHERE s.school_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM batches b WHERE b.school_id = s.school_id);
--> statement-breakpoint
-- Seed core subjects per school (chart: Physics, Chemistry, Math, Biology, English)
INSERT INTO subjects (name, code, school_id)
SELECT sub.name, sub.code, sc.id
FROM schools sc
CROSS JOIN (VALUES
  ('Physics', 'PHY'), ('Chemistry', 'CHE'), ('Mathematics', 'MAT'), ('Biology', 'BIO'), ('English', 'ENG')
) AS sub(name, code)
WHERE NOT EXISTS (SELECT 1 FROM subjects x WHERE x.school_id = sc.id AND x.name = sub.name);
