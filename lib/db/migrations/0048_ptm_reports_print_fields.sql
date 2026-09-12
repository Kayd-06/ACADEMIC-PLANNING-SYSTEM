ALTER TABLE "ptm_reports" ADD COLUMN "printed_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "ptm_reports" ADD COLUMN "print_count" integer DEFAULT 0 NOT NULL;
