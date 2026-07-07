ALTER TABLE announcements ADD COLUMN IF NOT EXISTS scope_value VARCHAR(255) NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS target_roles VARCHAR(100) NOT NULL DEFAULT 'All';
--> statement-breakpoint
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS attachment_url VARCHAR(1000) NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS attachment_name VARCHAR(255) NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category VARCHAR(30) NOT NULL DEFAULT 'General',
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  link VARCHAR(500) NOT NULL DEFAULT '',
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);
--> statement-breakpoint
UPDATE feedback SET status = 'Reviewed' WHERE status = 'In Progress';
--> statement-breakpoint
UPDATE feedback SET status = 'Actioned' WHERE status = 'Resolved';
--> statement-breakpoint
ALTER TYPE counseling_session_type ADD VALUE IF NOT EXISTS 'Parent Meeting';
--> statement-breakpoint
ALTER TABLE counseling_sessions ADD COLUMN IF NOT EXISTS duration_minutes INTEGER NOT NULL DEFAULT 30;
--> statement-breakpoint
ALTER TABLE counseling_sessions ADD COLUMN IF NOT EXISTS action_items TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE counseling_sessions ADD COLUMN IF NOT EXISTS next_session_date VARCHAR(10);
--> statement-breakpoint
UPDATE counseling_sessions SET duration_minutes = COALESCE(NULLIF(regexp_replace(duration, '[^0-9]', '', 'g'), '')::int, 30);
