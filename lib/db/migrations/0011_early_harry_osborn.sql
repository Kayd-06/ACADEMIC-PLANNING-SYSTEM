CREATE TABLE "attendance_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"student_id" uuid,
	"student_name" varchar(255) NOT NULL,
	"roll_no" varchar(100) DEFAULT '' NOT NULL,
	"status" varchar(10) DEFAULT 'Present' NOT NULL,
	"notes" varchar(500) DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" varchar(10) NOT NULL,
	"batch" varchar(255) NOT NULL,
	"subject" varchar(255) NOT NULL,
	"class_time" varchar(50) DEFAULT '' NOT NULL,
	"schedule_id" uuid,
	"special_class_id" uuid,
	"marked_by_name" varchar(255) DEFAULT '' NOT NULL,
	"marked_by_email" varchar(255) DEFAULT '' NOT NULL,
	"school_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"type" varchar(30) DEFAULT 'Event' NOT NULL,
	"scope" varchar(255) DEFAULT 'School-wide' NOT NULL,
	"scope_value" varchar(255) DEFAULT '' NOT NULL,
	"date" varchar(10) NOT NULL,
	"end_date" varchar(10),
	"school_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "class_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_name" varchar(255) DEFAULT '' NOT NULL,
	"teacher_email" varchar(255) NOT NULL,
	"subject" varchar(255) NOT NULL,
	"batch" varchar(255) NOT NULL,
	"day_of_week" integer NOT NULL,
	"start_time" varchar(20) NOT NULL,
	"end_time" varchar(20) NOT NULL,
	"room" varchar(100) DEFAULT '' NOT NULL,
	"effective_from" varchar(10),
	"effective_to" varchar(10),
	"is_active" boolean DEFAULT true NOT NULL,
	"school_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "special_classes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"type" varchar(20) DEFAULT 'Extra' NOT NULL,
	"teacher_name" varchar(255) DEFAULT '' NOT NULL,
	"teacher_email" varchar(255) NOT NULL,
	"subject" varchar(255) DEFAULT '' NOT NULL,
	"batch" varchar(255) DEFAULT '' NOT NULL,
	"date" varchar(10) NOT NULL,
	"start_time" varchar(20) NOT NULL,
	"end_time" varchar(20) NOT NULL,
	"room" varchar(100) DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"school_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "negative_marks" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "attendance_entries" ADD CONSTRAINT "attendance_entries_session_id_attendance_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."attendance_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_entries" ADD CONSTRAINT "attendance_entries_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_schedule_id_class_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."class_schedules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_special_class_id_special_classes_id_fk" FOREIGN KEY ("special_class_id") REFERENCES "public"."special_classes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_schedules" ADD CONSTRAINT "class_schedules_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "special_classes" ADD CONSTRAINT "special_classes_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;