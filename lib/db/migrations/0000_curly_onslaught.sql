CREATE TYPE "public"."user_role" AS ENUM('teacher', 'management');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('pending_verification', 'active');--> statement-breakpoint
CREATE TABLE "email_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "email_verifications_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "schools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) DEFAULT 'Academic Planning System' NOT NULL,
	"board" varchar(255) DEFAULT 'CBSE Affiliated' NOT NULL,
	"classes" varchar(255) DEFAULT 'Nursery – XII' NOT NULL,
	"programs" varchar(255) DEFAULT 'STEM, Humanities, Arts' NOT NULL,
	"mou_status" varchar(255) DEFAULT 'Active (2025)' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password" text NOT NULL,
	"role" "user_role" NOT NULL,
	"status" "user_status" DEFAULT 'pending_verification' NOT NULL,
	"department" varchar(255),
	"employee_id" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "email_verifications" ADD CONSTRAINT "email_verifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;