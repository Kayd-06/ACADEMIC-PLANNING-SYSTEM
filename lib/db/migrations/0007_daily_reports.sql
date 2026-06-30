CREATE TABLE "daily_reports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "teacher_name" varchar(255) NOT NULL,
  "teacher_email" varchar(255) NOT NULL,
  "date" varchar(10) NOT NULL,
  "batch" varchar(255) NOT NULL,
  "subject" varchar(255) NOT NULL,
  "chapter" varchar(255) DEFAULT '' NOT NULL,
  "topics_covered" text DEFAULT '' NOT NULL,
  "present_count" integer DEFAULT 0 NOT NULL,
  "absent_count" integer DEFAULT 0 NOT NULL,
  "homework_given" text DEFAULT '',
  "observations" text DEFAULT '',
  "is_late" boolean DEFAULT false NOT NULL,
  "submitted_at" timestamp with time zone DEFAULT now() NOT NULL
);
