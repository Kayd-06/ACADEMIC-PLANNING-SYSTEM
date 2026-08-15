ALTER TABLE questions ADD COLUMN IF NOT EXISTS unattempted_marks integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE questions ADD COLUMN IF NOT EXISTS chapter_id uuid REFERENCES chapters(id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE questions ADD COLUMN IF NOT EXISTS concept_id uuid REFERENCES concepts(id) ON DELETE SET NULL;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE response_status AS ENUM ('Correct', 'Incorrect', 'Unattempted');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS test_questions (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	test_id uuid NOT NULL REFERENCES tests(id) ON DELETE cascade,
	question_id uuid NOT NULL REFERENCES questions(id) ON DELETE cascade,
	order_index integer NOT NULL DEFAULT 0,
	CONSTRAINT test_questions_test_question_unique UNIQUE(test_id, question_id)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS test_question_responses (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	test_id uuid NOT NULL REFERENCES tests(id) ON DELETE cascade,
	question_id uuid NOT NULL REFERENCES questions(id) ON DELETE cascade,
	student_id uuid NOT NULL REFERENCES students(id) ON DELETE cascade,
	status response_status NOT NULL,
	marks_awarded integer NOT NULL DEFAULT 0,
	graded_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
	school_id uuid REFERENCES schools(id) ON DELETE cascade,
	created_at timestamp with time zone DEFAULT now() NOT NULL,
	updated_at timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT test_question_responses_unique UNIQUE(test_id, question_id, student_id)
);
