import { config } from 'dotenv'
config({ path: '.env' })
config({ path: '.env.local' })
import { neon } from '@neondatabase/serverless'

async function runFeeMigrations() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not defined in .env.local')
    process.exit(1)
  }

  console.log('Connecting to Neon database over HTTP to ensure fee_structures and fee_payments tables exist...')
  const sql = neon(process.env.DATABASE_URL)

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS "fee_structures" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "fee_type" varchar(100) DEFAULT 'Monthly Tuition' NOT NULL,
        "name" varchar(255) NOT NULL,
        "description" text DEFAULT '',
        "amount" integer DEFAULT 0 NOT NULL,
        "frequency" varchar(50) DEFAULT 'Monthly' NOT NULL,
        "due_day" integer DEFAULT 5 NOT NULL,
        "is_mandatory" boolean DEFAULT true NOT NULL,
        "school_id" uuid,
        "program_association" varchar(255) DEFAULT 'All Programs' NOT NULL,
        "batch_association" varchar(255) DEFAULT 'All Batches' NOT NULL,
        "academic_year" varchar(50) DEFAULT '2024-25' NOT NULL,
        "is_active" boolean DEFAULT true NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      );
    `
    console.log('✔ fee_structures table created/verified successfully')

    await sql`
      CREATE TABLE IF NOT EXISTS "fee_payments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "student_id" uuid,
        "student_name" varchar(255) NOT NULL,
        "roll_no" varchar(100) DEFAULT '',
        "class" varchar(100) DEFAULT '',
        "section" varchar(100) DEFAULT '',
        "fee_structure_id" uuid,
        "fee_name" varchar(255) NOT NULL,
        "fee_type" varchar(100) DEFAULT 'Monthly Tuition' NOT NULL,
        "school_id" uuid,
        "amount_due" integer DEFAULT 0 NOT NULL,
        "amount_paid" integer DEFAULT 0 NOT NULL,
        "discount" integer DEFAULT 0 NOT NULL,
        "late_fee" integer DEFAULT 0 NOT NULL,
        "payment_method" varchar(50) DEFAULT 'UPI',
        "transaction_id" varchar(255) DEFAULT '',
        "receipt_number" varchar(100) NOT NULL UNIQUE,
        "recorded_by" uuid,
        "recorded_by_name" varchar(255) DEFAULT 'Management',
        "due_date" varchar(50) NOT NULL,
        "paid_date" varchar(50) DEFAULT '',
        "status" varchar(50) DEFAULT 'Pending' NOT NULL,
        "notes" text DEFAULT '',
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      );
    `
    console.log('✔ fee_payments table created/verified successfully')
    console.log('All fee migrations completed successfully!')
    process.exit(0)
  } catch (err) {
    console.error('Error running fee tables migration:', err)
    process.exit(1)
  }
}

runFeeMigrations()
