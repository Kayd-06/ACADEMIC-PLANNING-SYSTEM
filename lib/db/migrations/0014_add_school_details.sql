ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "contact_person" varchar(255) DEFAULT '';--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "email" varchar(255) DEFAULT '';--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "address" text DEFAULT '';--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "gst_no" varchar(50) DEFAULT '';
