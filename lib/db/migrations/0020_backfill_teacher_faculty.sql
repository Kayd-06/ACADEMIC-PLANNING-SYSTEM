-- Backfill faculty directory rows for teachers who registered (or joined a
-- school) before ensureFacultyRecord() existed, so they show up in
-- management's Faculty Directory without re-entry.
INSERT INTO faculty (user_id, school_id, name, email, subject, specialization, batches, experience, status, is_active)
SELECT u.id, u.school_id, u.name, u.email, COALESCE(NULLIF(u.department, ''), 'General'), '', 0, '', 'ACTIVE', true
FROM users u
WHERE u.role = 'teacher'
  AND u.school_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM faculty f
    WHERE f.school_id = u.school_id
      AND (f.user_id = u.id OR f.email = u.email)
  );
--> statement-breakpoint
-- Link any admin-created faculty rows that matched by email but never got user_id set
UPDATE faculty f
SET user_id = u.id, updated_at = now()
FROM users u
WHERE f.user_id IS NULL
  AND u.role = 'teacher'
  AND f.school_id = u.school_id
  AND f.email = u.email;
--> statement-breakpoint
-- Seed a primary teacher_subjects row for every faculty record still missing one
INSERT INTO teacher_subjects (teacher_id, subject_name, is_primary)
SELECT f.id, f.subject, true
FROM faculty f
WHERE f.subject <> ''
  AND NOT EXISTS (SELECT 1 FROM teacher_subjects ts WHERE ts.teacher_id = f.id);
