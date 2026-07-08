CREATE TABLE IF NOT EXISTS class_schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_name VARCHAR(255) NOT NULL DEFAULT '',
  teacher_email VARCHAR(255) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  batch VARCHAR(255) NOT NULL,
  day_of_week INTEGER NOT NULL,
  start_time VARCHAR(20) NOT NULL,
  end_time VARCHAR(20) NOT NULL,
  room VARCHAR(100) NOT NULL DEFAULT '',
  effective_from VARCHAR(10),
  effective_to VARCHAR(10),
  is_active BOOLEAN NOT NULL DEFAULT true,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_class_schedules_teacher ON class_schedules(teacher_email);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS special_classes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  type VARCHAR(20) NOT NULL DEFAULT 'Extra',
  teacher_name VARCHAR(255) NOT NULL DEFAULT '',
  teacher_email VARCHAR(255) NOT NULL,
  subject VARCHAR(255) NOT NULL DEFAULT '',
  batch VARCHAR(255) NOT NULL DEFAULT '',
  date VARCHAR(10) NOT NULL,
  start_time VARCHAR(20) NOT NULL,
  end_time VARCHAR(20) NOT NULL,
  room VARCHAR(100) NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_special_classes_teacher ON special_classes(teacher_email, date);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS attendance_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date VARCHAR(10) NOT NULL,
  batch VARCHAR(255) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  class_time VARCHAR(50) NOT NULL DEFAULT '',
  schedule_id UUID REFERENCES class_schedules(id) ON DELETE SET NULL,
  special_class_id UUID REFERENCES special_classes(id) ON DELETE SET NULL,
  marked_by_name VARCHAR(255) NOT NULL DEFAULT '',
  marked_by_email VARCHAR(255) NOT NULL DEFAULT '',
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_lookup ON attendance_sessions(date, batch, subject);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS attendance_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  student_name VARCHAR(255) NOT NULL,
  roll_no VARCHAR(100) NOT NULL DEFAULT '',
  status VARCHAR(10) NOT NULL DEFAULT 'Present',
  notes VARCHAR(500) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_attendance_entries_session ON attendance_entries(session_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  type VARCHAR(30) NOT NULL DEFAULT 'Event',
  scope VARCHAR(255) NOT NULL DEFAULT 'School-wide',
  scope_value VARCHAR(255) NOT NULL DEFAULT '',
  date VARCHAR(10) NOT NULL,
  end_date VARCHAR(10),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON calendar_events(date);
