ALTER TABLE chapters ADD COLUMN IF NOT EXISTS code varchar(50) NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS board varchar(50);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS concepts (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	chapter_id uuid NOT NULL REFERENCES chapters(id) ON DELETE cascade,
	name varchar(255) NOT NULL,
	code varchar(50) NOT NULL DEFAULT '',
	order_index integer NOT NULL DEFAULT 0,
	school_id uuid REFERENCES schools(id) ON DELETE cascade,
	created_at timestamp with time zone DEFAULT now() NOT NULL
);
