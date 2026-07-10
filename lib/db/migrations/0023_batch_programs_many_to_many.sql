CREATE TABLE IF NOT EXISTS batch_programs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT batch_programs_unique UNIQUE (batch_id, program_id)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_batch_programs_batch ON batch_programs(batch_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_batch_programs_program ON batch_programs(program_id);
--> statement-breakpoint
-- Carry forward each batch's existing single program assignment
INSERT INTO batch_programs (batch_id, program_id)
SELECT id, program_id FROM batches WHERE program_id IS NOT NULL
ON CONFLICT (batch_id, program_id) DO NOTHING;
--> statement-breakpoint
ALTER TABLE batches DROP COLUMN IF EXISTS program_id;
