--> statement-breakpoint
DROP INDEX IF EXISTS students_roll_no_class_section_unique;
--> statement-breakpoint
CREATE UNIQUE INDEX students_roll_no_class_section_school_unique
ON students(roll_no, class, section, school_id)
WHERE roll_no <> '' AND class <> '' AND section <> '' AND school_id IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX students_roll_no_class_section_null_school_unique
ON students(roll_no, class, section)
WHERE roll_no <> '' AND class <> '' AND section <> '' AND school_id IS NULL;
