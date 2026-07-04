ALTER TABLE users ADD COLUMN IF NOT EXISTS active_school_id UUID REFERENCES schools(id) ON DELETE SET NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS admin_schools (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, school_id)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_admin_schools_user ON admin_schools(user_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_admin_schools_school ON admin_schools(school_id);
--> statement-breakpoint
INSERT INTO admin_schools (user_id, school_id, role)
SELECT id, school_id, 'owner'
FROM users
WHERE school_id IS NOT NULL AND role = 'management'
ON CONFLICT DO NOTHING;
--> statement-breakpoint
UPDATE users SET active_school_id = school_id WHERE school_id IS NOT NULL AND role = 'management' AND active_school_id IS NULL;
