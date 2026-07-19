ALTER TABLE batches ADD COLUMN IF NOT EXISTS program_id UUID REFERENCES programs(id) ON DELETE SET NULL;
--> statement-breakpoint
-- Carry forward each batch's earliest-linked program (a batch can now
-- belong to only one program, so any additional links are dropped)
UPDATE batches b
SET program_id = bp.program_id
FROM (
  SELECT DISTINCT ON (batch_id) batch_id, program_id
  FROM batch_programs
  ORDER BY batch_id, created_at ASC
) bp
WHERE b.id = bp.batch_id;
--> statement-breakpoint
DROP TABLE IF EXISTS batch_programs;
