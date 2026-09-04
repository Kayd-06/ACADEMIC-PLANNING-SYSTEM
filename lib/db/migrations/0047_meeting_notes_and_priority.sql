CREATE TYPE "public"."meeting_agenda_priority" AS ENUM('Low', 'Medium', 'High');
--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "minutes_prepared_by" varchar(255) DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "next_meeting_date" varchar(10) DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "meeting_agenda_items" ADD COLUMN "priority" "meeting_agenda_priority" DEFAULT 'Medium' NOT NULL;
