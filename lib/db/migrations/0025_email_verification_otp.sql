ALTER TABLE email_verifications DROP CONSTRAINT IF EXISTS email_verifications_token_key;
--> statement-breakpoint
ALTER TABLE email_verifications DROP COLUMN IF EXISTS token;
--> statement-breakpoint
ALTER TABLE email_verifications ADD COLUMN IF NOT EXISTS otp varchar(6) NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE email_verifications ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE email_verifications ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
--> statement-breakpoint
ALTER TABLE email_verifications ALTER COLUMN otp DROP DEFAULT;
