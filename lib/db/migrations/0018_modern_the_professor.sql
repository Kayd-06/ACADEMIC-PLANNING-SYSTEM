CREATE TABLE "assignment_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignment_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"submitted_at" timestamp with time zone,
	"graded_at" timestamp with time zone,
	"graded_by" varchar(255),
	"file_url" text,
	"marks_obtained" integer,
	"feedback" text,
	"status" varchar(50) DEFAULT 'Pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assignments" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "assignments" ADD COLUMN "total_marks" integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE "study_materials" ADD COLUMN "uploaded_by" varchar(255);--> statement-breakpoint
ALTER TABLE "study_materials" ADD COLUMN "subject_id" varchar(255);--> statement-breakpoint
ALTER TABLE "study_materials" ADD COLUMN "chapter_id" varchar(255);--> statement-breakpoint
ALTER TABLE "study_materials" ADD COLUMN "program_id" varchar(255);--> statement-breakpoint
ALTER TABLE "study_materials" ADD COLUMN "batch_id" varchar(255);--> statement-breakpoint
ALTER TABLE "study_materials" ADD COLUMN "title" varchar(255);--> statement-breakpoint
ALTER TABLE "study_materials" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "study_materials" ADD COLUMN "file_size" integer;--> statement-breakpoint
ALTER TABLE "study_materials" ADD COLUMN "is_public" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;