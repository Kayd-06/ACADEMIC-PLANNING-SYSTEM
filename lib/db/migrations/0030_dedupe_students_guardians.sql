-- Keep only the most-recently-updated primary guardian per student; drop the rest.
DELETE FROM parents_guardians pg
USING (
  SELECT id, student_id,
         ROW_NUMBER() OVER (PARTITION BY student_id, is_primary ORDER BY updated_at DESC, created_at DESC) AS rn
  FROM parents_guardians
  WHERE is_primary = true
) ranked
WHERE pg.id = ranked.id AND ranked.rn > 1;

-- Drop students that are exact duplicates on every identifying field, keeping the most recent.
DELETE FROM students s
USING (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY name, class, section, roll_no, COALESCE(admission_number, ''), COALESCE(school_id::text, '')
           ORDER BY created_at DESC
         ) AS rn
  FROM students
) ranked
WHERE s.id = ranked.id AND ranked.rn > 1;
