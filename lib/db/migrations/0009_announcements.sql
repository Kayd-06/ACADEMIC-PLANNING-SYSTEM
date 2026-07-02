CREATE TABLE IF NOT EXISTS "announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"label" varchar(255) DEFAULT '',
	"sub" text DEFAULT '',
	"type" varchar(50) DEFAULT 'General' NOT NULL,
	"scope" varchar(255) DEFAULT 'All' NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"urgent" boolean DEFAULT false NOT NULL,
	"author_name" varchar(255) DEFAULT 'Admin' NOT NULL,
	"author_role" varchar(255) DEFAULT 'Staff' NOT NULL,
	"expiry_date" varchar(50),
	"done" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
