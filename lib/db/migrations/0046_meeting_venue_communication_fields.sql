ALTER TABLE "meetings" ADD COLUMN "venue" varchar(255) DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "meeting_agenda_items" ADD COLUMN "communicated_to" varchar(255) DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "meeting_agenda_items" ADD COLUMN "communicated_by" varchar(255) DEFAULT '' NOT NULL;
