DO $$ BEGIN
 CREATE TYPE "public"."student_rating" AS ENUM('Unsatisfactory', 'Satisfactory', 'Good', 'Very Good', 'Excellent');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "daily_student_ratings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"faculty_id" uuid,
	"batch_id" uuid,
	"batch" varchar(100) NOT NULL,
	"student_id" uuid NOT NULL,
	"date" varchar(10) NOT NULL,
	"attitude" "student_rating" NOT NULL,
	"behaviour" "student_rating" NOT NULL,
	"focus" "student_rating" NOT NULL,
	"interaction" "student_rating" NOT NULL,
	"notes" text,
	"school_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ptm_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"faculty_id" uuid,
	"student_id" uuid NOT NULL,
	"batch_id" uuid,
	"batch" varchar(100),
	"date" varchar(10) NOT NULL,
	"parent_name" varchar(255),
	"parent_attended" boolean DEFAULT true NOT NULL,
	"discussion_notes" text DEFAULT '' NOT NULL,
	"action_items" text DEFAULT '' NOT NULL,
	"follow_up_date" varchar(10),
	"school_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "daily_student_ratings" ADD CONSTRAINT "daily_student_ratings_faculty_id_users_id_fk" FOREIGN KEY ("faculty_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "daily_student_ratings" ADD CONSTRAINT "daily_student_ratings_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "daily_student_ratings" ADD CONSTRAINT "daily_student_ratings_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "daily_student_ratings" ADD CONSTRAINT "daily_student_ratings_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ptm_reports" ADD CONSTRAINT "ptm_reports_faculty_id_users_id_fk" FOREIGN KEY ("faculty_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ptm_reports" ADD CONSTRAINT "ptm_reports_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ptm_reports" ADD CONSTRAINT "ptm_reports_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ptm_reports" ADD CONSTRAINT "ptm_reports_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "daily_student_ratings_student_date_unique" ON "daily_student_ratings" USING btree ("student_id","date");
