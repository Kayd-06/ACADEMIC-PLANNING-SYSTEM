CREATE TABLE "assignments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "title" varchar(255) NOT NULL,
  "chapter" varchar(255) NOT NULL,
  "batch" varchar(255) NOT NULL,
  "subject" varchar(255) NOT NULL,
  "type" varchar(20) NOT NULL DEFAULT 'Homework',
  "due_date" varchar(10) NOT NULL,
  "due_time" varchar(20) NOT NULL DEFAULT '11:59 PM',
  "submitted_count" integer NOT NULL DEFAULT 0,
  "total_students" integer NOT NULL DEFAULT 40,
  "status" varchar(30) NOT NULL DEFAULT 'Active',
  "teacher_email" varchar(255) NOT NULL,
  "file_url" varchar(1000) DEFAULT '',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
