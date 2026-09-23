-- Scope Syllabus Tracker chapters to the batch they were created for.
--
-- Root cause being fixed: chapters were only ever scoped by (subject, school),
-- never by batch. The Syllabus Tracker's GET handler auto-seeds a
-- "Not Started" batch_syllabus row for any chapter under the viewed subject
-- that the viewed batch doesn't already have a row for -- regardless of which
-- batch that chapter was actually authored/imported for. That silently
-- leaked chapters (with a wrong forced status) into unrelated batches
-- whenever anyone opened the tracker for a different batch on the same
-- subject name (e.g. a NEET 1 Biology chapter showing up under JEE 1
-- Biology as "Not Started").
--
-- batch_id is nullable so chapters created via the separate Curriculum
-- Manager feature (master/shared content, no batch concept) are unaffected
-- and remain visible to every batch.

ALTER TABLE "chapters" ADD COLUMN "batch_id" uuid REFERENCES "batches"("id") ON DELETE CASCADE;
--> statement-breakpoint

-- Backfill: assign each existing chapter its true origin batch, using the
-- EARLIEST-created batch_syllabus row for that chapter. batch_syllabus rows
-- are only ever created at (a) chapter-creation time, for the batch being
-- imported into, or (b) auto-seed time on a later GET, which always happens
-- strictly after creation. So the earliest row reliably identifies the real
-- owning batch even in cases where the phantom row happens to share the same
-- "Not Started" status. Chapters with zero batch_syllabus rows (Curriculum
-- Manager chapters) are left with batch_id = NULL, i.e. shared.
UPDATE "chapters" c
SET "batch_id" = earliest.batch_id
FROM (
  SELECT DISTINCT ON (chapter_id) chapter_id, batch_id
  FROM "batch_syllabus"
  ORDER BY chapter_id, created_at ASC
) earliest
WHERE c.id = earliest.chapter_id;
--> statement-breakpoint

-- Cleanup: remove the phantom auto-seeded batch_syllabus rows left behind
-- for every batch other than the chapter's real owning batch.
DELETE FROM "batch_syllabus" bs
USING "chapters" c
WHERE bs.chapter_id = c.id
  AND c.batch_id IS NOT NULL
  AND bs.batch_id <> c.batch_id;
