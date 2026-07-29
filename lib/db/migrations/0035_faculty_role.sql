CREATE TYPE "faculty_role" AS ENUM ('TEACHER', 'COORDINATOR');--> statement-breakpoint
ALTER TABLE faculty ADD COLUMN IF NOT EXISTS role faculty_role NOT NULL DEFAULT 'TEACHER';
