-- 0051: unique keys that make the app's upserts race-free.
--
--   * attendance_sessions_slot_unique   one attendance sheet per
--     (school, date, batch, subject, class_time). Two teachers saving the same
--     sheet at the same moment used to create two sheets.
--   * students_school_roll_class_section_unique   replaces the two old partial
--     indexes, which skipped every student with an empty section (most bulk
--     imports had no section column) and so allowed duplicate roll numbers.
--   * batch_syllabus_batch_chapter_unique   one syllabus row per batch+chapter
--     (the old Syllabus Tracker GET auto-created these and could duplicate).
--
-- EXISTING DUPLICATES WOULD MAKE "CREATE UNIQUE INDEX" FAIL, so each section
-- first de-duplicates, copying every row it removes or changes into a
-- "_dedupe_0051_*" backup table (nothing is lost; review/drop those tables
-- later). Run lib/db/scripts/0051_preflight_duplicates.sql first to see what
-- will be touched.
--
-- The neon-http migrator runs statements one by one without a transaction,
-- so each section is a single DO block (atomic on its own) and every block
-- is safe to re-run.
--
-- Deploy order: apply this migration BEFORE deploying the code that uses
-- ON CONFLICT on these keys (attendance save, student bulk import, syllabus
-- tracker), or those requests fail with "no unique constraint matching".

DO $$
BEGIN
  CREATE TABLE IF NOT EXISTS "_dedupe_0051_attendance_sessions" AS
    SELECT s.*, now() AS backed_up_at FROM "attendance_sessions" s WHERE false;
  CREATE TABLE IF NOT EXISTS "_dedupe_0051_attendance_entries" AS
    SELECT e.*, now() AS backed_up_at FROM "attendance_entries" e WHERE false;

  -- Keep the most recently saved sheet of each duplicate group.
  WITH ranked AS (
    SELECT id, row_number() OVER (
      PARTITION BY school_id, date, batch, subject, class_time
      ORDER BY updated_at DESC, created_at DESC, id DESC
    ) AS rn
    FROM "attendance_sessions"
    WHERE school_id IS NOT NULL
  )
  INSERT INTO "_dedupe_0051_attendance_sessions"
  SELECT s.*, now() FROM "attendance_sessions" s
  JOIN ranked r ON r.id = s.id
  WHERE r.rn > 1
    AND NOT EXISTS (SELECT 1 FROM "_dedupe_0051_attendance_sessions" b WHERE b.id = s.id);

  INSERT INTO "_dedupe_0051_attendance_entries"
  SELECT e.*, now() FROM "attendance_entries" e
  WHERE e.session_id IN (SELECT id FROM "_dedupe_0051_attendance_sessions")
    AND NOT EXISTS (SELECT 1 FROM "_dedupe_0051_attendance_entries" b WHERE b.id = e.id);

  -- attendance_entries.session_id is ON DELETE CASCADE.
  DELETE FROM "attendance_sessions" WHERE id IN (SELECT id FROM "_dedupe_0051_attendance_sessions");

  -- NULLs stay distinct, so legacy rows without a school are not constrained
  -- (the app no longer writes those).
  CREATE UNIQUE INDEX IF NOT EXISTS "attendance_sessions_slot_unique"
    ON "attendance_sessions" USING btree ("school_id", "date", "batch", "subject", "class_time");
END $$;
--> statement-breakpoint

DO $$
BEGIN
  CREATE TABLE IF NOT EXISTS "_dedupe_0051_students_renamed" (
    student_id uuid PRIMARY KEY,
    school_id uuid,
    name varchar(255),
    class varchar(255),
    section varchar(255),
    old_roll_no varchar(255),
    new_roll_no varchar(255),
    renamed_at timestamptz NOT NULL DEFAULT now()
  );

  -- Duplicates are NOT deleted (they may carry attendance, fees, marks...).
  -- All but the most recently updated row of each group get their roll
  -- number suffixed with "-DUP-<first 8 chars of id>" so management can
  -- review and merge them by hand.
  WITH ranked AS (
    SELECT id, row_number() OVER (
      PARTITION BY school_id, roll_no, class, section
      ORDER BY updated_at DESC, created_at DESC, id DESC
    ) AS rn
    FROM "students"
    WHERE roll_no <> '' AND class <> '' AND school_id IS NOT NULL
  )
  INSERT INTO "_dedupe_0051_students_renamed" (student_id, school_id, name, class, section, old_roll_no, new_roll_no)
  SELECT s.id, s.school_id, s.name, s.class, s.section, s.roll_no,
         left(s.roll_no, 240) || '-DUP-' || left(s.id::text, 8)
  FROM "students" s JOIN ranked r ON r.id = s.id
  WHERE r.rn > 1
  ON CONFLICT (student_id) DO NOTHING;

  UPDATE "students" s
  SET roll_no = d.new_roll_no, updated_at = now()
  FROM "_dedupe_0051_students_renamed" d
  WHERE d.student_id = s.id AND s.roll_no = d.old_roll_no;

  DROP INDEX IF EXISTS "students_roll_no_class_section_school_unique";
  DROP INDEX IF EXISTS "students_roll_no_class_section_null_school_unique";

  -- section is part of the key even when empty ('' is a value, not "unknown").
  CREATE UNIQUE INDEX IF NOT EXISTS "students_school_roll_class_section_unique"
    ON "students" USING btree ("school_id", "roll_no", "class", "section")
    WHERE "roll_no" <> '' AND "class" <> '' AND "school_id" IS NOT NULL;
END $$;
--> statement-breakpoint

DO $$
BEGIN
  CREATE TABLE IF NOT EXISTS "_dedupe_0051_batch_syllabus" AS
    SELECT b.*, now() AS backed_up_at FROM "batch_syllabus" b WHERE false;

  -- Keep the most progressed row (Completed > In Progress > others), then the newest.
  WITH ranked AS (
    SELECT id, row_number() OVER (
      PARTITION BY batch_id, chapter_id
      ORDER BY CASE status WHEN 'Completed' THEN 0 WHEN 'In Progress' THEN 1 ELSE 2 END,
               updated_at DESC, created_at DESC, id DESC
    ) AS rn
    FROM "batch_syllabus"
  )
  INSERT INTO "_dedupe_0051_batch_syllabus"
  SELECT b.*, now() FROM "batch_syllabus" b
  JOIN ranked r ON r.id = b.id
  WHERE r.rn > 1
    AND NOT EXISTS (SELECT 1 FROM "_dedupe_0051_batch_syllabus" x WHERE x.id = b.id);

  DELETE FROM "batch_syllabus" WHERE id IN (SELECT id FROM "_dedupe_0051_batch_syllabus");

  CREATE UNIQUE INDEX IF NOT EXISTS "batch_syllabus_batch_chapter_unique"
    ON "batch_syllabus" USING btree ("batch_id", "chapter_id");
END $$;
--> statement-breakpoint

-- One-time replacement for the GET /api/batches "sync" that used to run on
-- every page view: make sure every batch name used by a student or a teacher
-- assignment has a batches row in its school. Idempotent.
INSERT INTO "batches" ("name", "school_id")
SELECT DISTINCT s.batch, s.school_id
FROM "students" s
WHERE s.batch <> '' AND s.school_id IS NOT NULL
ON CONFLICT ("school_id", "name") DO NOTHING;
--> statement-breakpoint

INSERT INTO "batches" ("name", "school_id")
SELECT DISTINCT tb.batch_name, f.school_id
FROM "teacher_batches" tb
JOIN "faculty" f ON f.id = tb.teacher_id
WHERE tb.batch_name <> '' AND f.school_id IS NOT NULL
ON CONFLICT ("school_id", "name") DO NOTHING;
