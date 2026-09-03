import { db } from './lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  try {
    await db.execute(sql`
      ALTER TABLE "meeting_agenda_items" 
      ADD COLUMN "discussion" text DEFAULT '' NOT NULL,
      ADD COLUMN "action" text DEFAULT '' NOT NULL,
      ADD COLUMN "responsibility" varchar(255) DEFAULT '' NOT NULL,
      ADD COLUMN "target_date" varchar(20) DEFAULT '' NOT NULL;
    `);
    console.log("Migration complete.");
  } catch (e) {
    console.error(e);
  }
}
main();
