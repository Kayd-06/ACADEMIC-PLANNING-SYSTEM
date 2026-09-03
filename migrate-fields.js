const { config } = require('dotenv');
config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function main() {
  const sql = neon(process.env.DATABASE_URL);
  await sql`ALTER TABLE "meeting_agenda_items" 
    ADD COLUMN IF NOT EXISTS "discussion" text DEFAULT '' NOT NULL,
    ADD COLUMN IF NOT EXISTS "action" text DEFAULT '' NOT NULL,
    ADD COLUMN IF NOT EXISTS "responsibility" varchar(255) DEFAULT '' NOT NULL,
    ADD COLUMN IF NOT EXISTS "target_date" varchar(20) DEFAULT '' NOT NULL`;
  console.log("Migration complete");
}
main().catch(console.error);
