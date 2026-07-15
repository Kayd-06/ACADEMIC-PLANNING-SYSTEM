ALTER TABLE counseling_sessions ADD COLUMN IF NOT EXISTS counselor_id uuid REFERENCES users(id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE counseling_sessions ADD COLUMN IF NOT EXISTS counselor_role varchar(50);
