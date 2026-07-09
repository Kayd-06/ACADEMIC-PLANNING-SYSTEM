CREATE TABLE "fee_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid,
	"student_name" varchar(255) NOT NULL,
	"roll_no" varchar(100) DEFAULT '',
	"class" varchar(100) DEFAULT '',
	"section" varchar(100) DEFAULT '',
	"fee_structure_id" uuid,
	"fee_name" varchar(255) NOT NULL,
	"fee_type" varchar(100) DEFAULT 'Monthly Tuition' NOT NULL,
	"school_id" uuid,
	"amount_due" integer DEFAULT 0 NOT NULL,
	"amount_paid" integer DEFAULT 0 NOT NULL,
	"discount" integer DEFAULT 0 NOT NULL,
	"late_fee" integer DEFAULT 0 NOT NULL,
	"payment_method" varchar(50) DEFAULT 'UPI',
	"transaction_id" varchar(255) DEFAULT '',
	"receipt_number" varchar(100) NOT NULL,
	"recorded_by" uuid,
	"recorded_by_name" varchar(255) DEFAULT 'Management',
	"due_date" varchar(50) NOT NULL,
	"paid_date" varchar(50) DEFAULT '',
	"status" varchar(50) DEFAULT 'Pending' NOT NULL,
	"notes" text DEFAULT '',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fee_payments_receipt_number_unique" UNIQUE("receipt_number")
);
--> statement-breakpoint
CREATE TABLE "fee_structures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fee_type" varchar(100) DEFAULT 'Monthly Tuition' NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text DEFAULT '',
	"amount" integer DEFAULT 0 NOT NULL,
	"frequency" varchar(50) DEFAULT 'Monthly' NOT NULL,
	"due_day" integer DEFAULT 5 NOT NULL,
	"is_mandatory" boolean DEFAULT true NOT NULL,
	"school_id" uuid,
	"program_association" varchar(255) DEFAULT 'All Programs' NOT NULL,
	"batch_association" varchar(255) DEFAULT 'All Batches' NOT NULL,
	"academic_year" varchar(50) DEFAULT '2024-25' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teacher_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"batch_name" varchar(255) NOT NULL,
	"subject_name" varchar(255) DEFAULT '' NOT NULL,
	"role" varchar(20) DEFAULT 'primary' NOT NULL,
	"assigned_at" varchar(10),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teacher_subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"subject_name" varchar(255) NOT NULL,
	"program_name" varchar(255) DEFAULT '' NOT NULL,
	"is_primary" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "faculty" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "faculty" ADD COLUMN "employee_id" varchar(100);--> statement-breakpoint
ALTER TABLE "faculty" ADD COLUMN "dob" varchar(10);--> statement-breakpoint
ALTER TABLE "faculty" ADD COLUMN "gender" varchar(20);--> statement-breakpoint
ALTER TABLE "faculty" ADD COLUMN "bio" text;--> statement-breakpoint
ALTER TABLE "faculty" ADD COLUMN "profile_img_url" text;--> statement-breakpoint
ALTER TABLE "faculty" ADD COLUMN "alt_phone" varchar(50);--> statement-breakpoint
ALTER TABLE "faculty" ADD COLUMN "address_line1" varchar(500);--> statement-breakpoint
ALTER TABLE "faculty" ADD COLUMN "city" varchar(100);--> statement-breakpoint
ALTER TABLE "faculty" ADD COLUMN "state" varchar(100);--> statement-breakpoint
ALTER TABLE "faculty" ADD COLUMN "pincode" varchar(20);--> statement-breakpoint
ALTER TABLE "faculty" ADD COLUMN "qualification" varchar(255);--> statement-breakpoint
ALTER TABLE "faculty" ADD COLUMN "experience_years" integer;--> statement-breakpoint
ALTER TABLE "faculty" ADD COLUMN "primary_stream" varchar(100);--> statement-breakpoint
ALTER TABLE "faculty" ADD COLUMN "joining_date" varchar(10);--> statement-breakpoint
ALTER TABLE "faculty" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "faculty" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "fee_payments" ADD CONSTRAINT "fee_payments_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_payments" ADD CONSTRAINT "fee_payments_fee_structure_id_fee_structures_id_fk" FOREIGN KEY ("fee_structure_id") REFERENCES "public"."fee_structures"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_payments" ADD CONSTRAINT "fee_payments_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_payments" ADD CONSTRAINT "fee_payments_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_structures" ADD CONSTRAINT "fee_structures_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_batches" ADD CONSTRAINT "teacher_batches_teacher_id_faculty_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."faculty"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_subjects" ADD CONSTRAINT "teacher_subjects_teacher_id_faculty_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."faculty"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faculty" ADD CONSTRAINT "faculty_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "faculty_employee_id_school_unique" ON "faculty" USING btree ("employee_id","school_id") WHERE "faculty"."employee_id" IS NOT NULL AND "faculty"."employee_id" <> '';