ALTER TABLE schools DROP COLUMN IF EXISTS mou_status;
--> statement-breakpoint
ALTER TABLE schools ADD COLUMN IF NOT EXISTS mou_start_date VARCHAR(10);
--> statement-breakpoint
ALTER TABLE schools ADD COLUMN IF NOT EXISTS mou_end_date VARCHAR(10);
