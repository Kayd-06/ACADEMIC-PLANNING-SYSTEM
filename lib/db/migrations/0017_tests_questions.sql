CREATE TABLE IF NOT EXISTS tests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  batch VARCHAR(255) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  date VARCHAR(10) NOT NULL,
  time VARCHAR(20) NOT NULL DEFAULT '10:00 AM',
  duration INTEGER NOT NULL DEFAULT 60,
  total_marks INTEGER NOT NULL DEFAULT 100,
  status VARCHAR(30) NOT NULL DEFAULT 'Upcoming',
  test_type VARCHAR(30) NOT NULL DEFAULT 'Unit Test',
  average_score INTEGER,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_tests_school_date ON tests(school_id, date);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  subject VARCHAR(255) NOT NULL,
  topic VARCHAR(255) NOT NULL,
  difficulty VARCHAR(20) NOT NULL DEFAULT 'Medium',
  type VARCHAR(30) NOT NULL DEFAULT 'MCQ',
  text TEXT NOT NULL,
  options TEXT NOT NULL DEFAULT '[]',
  correct_answer TEXT NOT NULL DEFAULT '',
  marks INTEGER NOT NULL DEFAULT 4,
  source VARCHAR(100) NOT NULL DEFAULT 'Custom',
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_questions_school_subject ON questions(school_id, subject);
