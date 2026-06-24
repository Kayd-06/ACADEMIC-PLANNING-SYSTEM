CREATE TABLE "students" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"roll_no" varchar(255) DEFAULT '' NOT NULL,
	"class" varchar(255) DEFAULT '' NOT NULL,
	"section" varchar(255) DEFAULT '' NOT NULL,
	"parent_contact" varchar(255),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "students_roll_no_class_section_unique" ON "students" USING btree ("roll_no","class","section") WHERE "students"."roll_no" <> '' AND "students"."class" <> '' AND "students"."section" <> '';