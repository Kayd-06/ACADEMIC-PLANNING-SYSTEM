CREATE TABLE "student_report_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"roll_no" varchar(255) DEFAULT '' NOT NULL,
	"marks" integer NOT NULL,
	"max_marks" integer DEFAULT 100 NOT NULL,
	"grade" varchar(10) NOT NULL,
	"attendance" integer,
	"remarks" varchar(1000)
);
--> statement-breakpoint
CREATE TABLE "student_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"teacher_name" varchar(255) NOT NULL,
	"class_name" varchar(255) NOT NULL,
	"subject" varchar(255) NOT NULL,
	"term" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "student_report_entries" ADD CONSTRAINT "student_report_entries_report_id_student_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."student_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_reports" ADD CONSTRAINT "student_reports_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;