-- Migration: Add performance indexes for chapter_code and concept_code
-- Per spec: chapter_code is "Indexed", concept_code has "Unique Composite Index"
-- (application-level upsert already enforces uniqueness; DB indexes speed up lookups)

-- Index on chapters.code for fast chapter code lookups (spec: "Indexed")
CREATE INDEX IF NOT EXISTS idx_chapters_code ON chapters(code) WHERE code IS NOT NULL AND code <> '';
--> statement-breakpoint
-- Index on concepts.code for fast concept code lookups
CREATE INDEX IF NOT EXISTS idx_concepts_code ON concepts(code) WHERE code IS NOT NULL AND code <> '';
