CREATE TYPE "public"."counseling_session_status" AS ENUM('Scheduled', 'Completed', 'No-Show', 'Cancelled');--> statement-breakpoint
CREATE TYPE "public"."counseling_session_type" AS ENUM('Academic', 'Career', 'Personal', 'Disciplinary');--> statement-breakpoint
CREATE TABLE "counseling_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_name" varchar(255) NOT NULL,
	"student_initials" varchar(10) NOT NULL,
	"counselor" varchar(255) NOT NULL,
	"type" "counseling_session_type" DEFAULT 'Academic' NOT NULL,
	"date" varchar(255) NOT NULL,
	"time" varchar(255) NOT NULL,
	"status" "counseling_session_status" DEFAULT 'Scheduled' NOT NULL,
	"notes" text DEFAULT '',
	"duration" varchar(255) DEFAULT '30 mins',
	"flagged" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
