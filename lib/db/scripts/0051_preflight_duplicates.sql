-- READ-ONLY preflight for migration 0051_data_integrity_unique_keys.
-- Paste into the Neon SQL editor (on a branch/backup first if you like) to see
-- what the migration will de-duplicate. Nothing here modifies data.

-- 1) Duplicate attendance sheets (all but the newest per group will be removed,
--    after being copied to _dedupe_0051_attendance_sessions / _entries).
SELECT school_id, date, batch, subject, class_time, count(*) AS sheets
FROM attendance_sessions
WHERE school_id IS NOT NULL
GROUP BY 1, 2, 3, 4, 5
HAVING count(*) > 1
ORDER BY sheets DESC;

-- 1b) Students listed more than once on the same sheet (all but the newest
--     entry are copied to _dedupe_0051_attendance_entries, then removed).
SELECT session_id, student_id, count(*) AS entries
FROM attendance_entries
WHERE student_id IS NOT NULL
GROUP BY 1, 2
HAVING count(*) > 1
ORDER BY entries DESC;

-- 2) Students sharing (school, roll_no, class, section). All but the most
--    recently updated get roll_no suffixed with "-DUP-xxxxxxxx" (logged in
--    _dedupe_0051_students_renamed); none are deleted.
SELECT school_id, roll_no, class, section, count(*) AS students, array_agg(name) AS names
FROM students
WHERE roll_no <> '' AND class <> '' AND school_id IS NOT NULL
GROUP BY 1, 2, 3, 4
HAVING count(*) > 1
ORDER BY students DESC;

-- 3) Duplicate syllabus rows per batch+chapter (the most progressed is kept,
--    the rest copied to _dedupe_0051_batch_syllabus then removed).
SELECT batch_id, chapter_id, count(*) AS rows, array_agg(status) AS statuses
FROM batch_syllabus
GROUP BY 1, 2
HAVING count(*) > 1
ORDER BY rows DESC;

-- 4) Rows with no school at all. The app now refuses to treat "no school" as
--    "every school", so these become invisible until a school is assigned.
SELECT 'students' AS t, count(*) FROM students WHERE school_id IS NULL
UNION ALL SELECT 'attendance_sessions', count(*) FROM attendance_sessions WHERE school_id IS NULL
UNION ALL SELECT 'batches', count(*) FROM batches WHERE school_id IS NULL
UNION ALL SELECT 'class_schedules', count(*) FROM class_schedules WHERE school_id IS NULL
UNION ALL SELECT 'special_classes', count(*) FROM special_classes WHERE school_id IS NULL
UNION ALL SELECT 'fee_payments', count(*) FROM fee_payments WHERE school_id IS NULL
UNION ALL SELECT 'fee_structures', count(*) FROM fee_structures WHERE school_id IS NULL
UNION ALL SELECT 'meetings', count(*) FROM meetings WHERE school_id IS NULL
UNION ALL SELECT 'recruitment_requirements', count(*) FROM recruitment_requirements WHERE school_id IS NULL
UNION ALL SELECT 'recruitment_candidates', count(*) FROM recruitment_candidates WHERE school_id IS NULL
UNION ALL SELECT 'recruitment_interviews', count(*) FROM recruitment_interviews WHERE school_id IS NULL
UNION ALL SELECT 'teacher_appraisals', count(*) FROM teacher_appraisals WHERE school_id IS NULL
UNION ALL SELECT 'audit_logs', count(*) FROM audit_logs WHERE school_id IS NULL
UNION ALL SELECT 'users (no school)', count(*) FROM users WHERE school_id IS NULL AND active_school_id IS NULL;
