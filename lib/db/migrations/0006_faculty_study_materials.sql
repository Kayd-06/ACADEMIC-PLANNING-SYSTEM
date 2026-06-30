CREATE TYPE "faculty_status" AS ENUM ('ACTIVE', 'ON_LEAVE', 'INACTIVE');
--> statement-breakpoint
CREATE TABLE "faculty" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(255) NOT NULL,
  "subject" varchar(255) NOT NULL,
  "specialization" varchar(255) NOT NULL,
  "batches" integer DEFAULT 0 NOT NULL,
  "experience" varchar(255) DEFAULT '' NOT NULL,
  "status" "faculty_status" DEFAULT 'ACTIVE' NOT NULL,
  "email" varchar(255),
  "phone" varchar(50),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "study_materials" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "file_name" varchar(255) NOT NULL,
  "type" varchar(50) DEFAULT 'PDF' NOT NULL,
  "file_url" text,
  "subject" varchar(255) NOT NULL,
  "provider" varchar(255) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
