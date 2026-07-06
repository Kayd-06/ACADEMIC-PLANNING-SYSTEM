CREATE TABLE IF NOT EXISTS "recruitment_requirements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "job_title" varchar(255) NOT NULL,
  "subject_program" varchar(255) NOT NULL,
  "department" varchar(255) DEFAULT 'SCIENCE' NOT NULL,
  "experience_required" varchar(255) DEFAULT '3+ Years' NOT NULL,
  "qualification_required" varchar(255) DEFAULT 'Master''s Degree' NOT NULL,
  "vacancies" integer DEFAULT 1 NOT NULL,
  "status" varchar(50) DEFAULT 'Open' NOT NULL,
  "posting_date" varchar(50) DEFAULT '' NOT NULL,
  "closing_date" varchar(50) DEFAULT '' NOT NULL,
  "school_id" uuid REFERENCES "schools"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "recruitment_candidates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(255) NOT NULL,
  "contact_email" varchar(255) DEFAULT '' NOT NULL,
  "contact_phone" varchar(50) DEFAULT '' NOT NULL,
  "qualification" varchar(255) DEFAULT '' NOT NULL,
  "resume_link" varchar(1000) DEFAULT '' NOT NULL,
  "years_of_experience" varchar(50) DEFAULT '0' NOT NULL,
  "current_organization" varchar(255) DEFAULT '' NOT NULL,
  "specialization" varchar(255) DEFAULT '' NOT NULL,
  "expected_salary" varchar(100) DEFAULT '' NOT NULL,
  "applied_date" varchar(50) DEFAULT '' NOT NULL,
  "workflow_status" varchar(50) DEFAULT 'Requirement' NOT NULL,
  "role_applied" varchar(255) DEFAULT '' NOT NULL,
  "department" varchar(255) DEFAULT 'SCIENCE' NOT NULL,
  "requirement_id" uuid REFERENCES "recruitment_requirements"("id") ON DELETE SET NULL,
  "avatar_initials" varchar(10) DEFAULT 'XX' NOT NULL,
  "theme" varchar(50) DEFAULT 'blue' NOT NULL,
  "schedule" varchar(255) DEFAULT '',
  "school_id" uuid REFERENCES "schools"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "recruitment_interviews" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "candidate_id" uuid REFERENCES "recruitment_candidates"("id") ON DELETE CASCADE,
  "candidate_name" varchar(255) DEFAULT '' NOT NULL,
  "date_time" varchar(100) DEFAULT '' NOT NULL,
  "mode" varchar(50) DEFAULT 'In-person' NOT NULL,
  "location_or_link" varchar(500) DEFAULT '' NOT NULL,
  "feedback_text" text DEFAULT '' NOT NULL,
  "rating" integer DEFAULT 3 NOT NULL,
  "final_result" varchar(50) DEFAULT 'Pending' NOT NULL,
  "interviewer_name" varchar(255) DEFAULT 'Panel' NOT NULL,
  "school_id" uuid REFERENCES "schools"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "teacher_appraisals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "teacher_name" varchar(255) NOT NULL,
  "teacher_email" varchar(255) DEFAULT '',
  "department" varchar(255) DEFAULT 'Science' NOT NULL,
  "appraiser_name" varchar(255) DEFAULT 'Head of Department' NOT NULL,
  "period" varchar(100) DEFAULT 'Annual' NOT NULL,
  "academic_year" varchar(50) DEFAULT '2025-2026' NOT NULL,
  "teaching_rating" varchar(50) DEFAULT '5' NOT NULL,
  "punctuality_rating" varchar(50) DEFAULT '5' NOT NULL,
  "student_feedback_average" varchar(50) DEFAULT '4.8' NOT NULL,
  "overall_rating" varchar(50) DEFAULT 'Excellent' NOT NULL,
  "remarks_goals" text DEFAULT '' NOT NULL,
  "improvement_areas" text DEFAULT '' NOT NULL,
  "review_status" varchar(50) DEFAULT 'Pending' NOT NULL,
  "scheduled_date" varchar(100) DEFAULT '',
  "is_completed" boolean DEFAULT false NOT NULL,
  "avatar_initials" varchar(10) DEFAULT 'XX' NOT NULL,
  "school_id" uuid REFERENCES "schools"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_action_type" varchar(255) NOT NULL,
  "table_name" varchar(255) NOT NULL,
  "record_id" varchar(255) DEFAULT '' NOT NULL,
  "old_values" text DEFAULT '' NOT NULL,
  "new_values" text DEFAULT '' NOT NULL,
  "ip_address" varchar(100) DEFAULT '127.0.0.1' NOT NULL,
  "user_agent" text DEFAULT '' NOT NULL,
  "author_name" varchar(255) DEFAULT 'Admin' NOT NULL,
  "author_role" varchar(255) DEFAULT 'Management' NOT NULL,
  "school_id" uuid REFERENCES "schools"("id") ON DELETE CASCADE,
  "timestamp" timestamp with time zone DEFAULT now() NOT NULL
);
