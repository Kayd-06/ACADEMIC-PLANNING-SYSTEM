import { neon } from '@neondatabase/serverless'
import { config } from 'dotenv'

config({ path: '.env' })
config({ path: '.env.local' })

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not defined')
  process.exit(1)
}

const sql = neon(process.env.DATABASE_URL)

async function main() {
  console.log('Creating announcements table in Neon Postgres...')
  
  await sql`
    CREATE TABLE IF NOT EXISTS announcements (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      title varchar(255) NOT NULL,
      content text NOT NULL,
      label varchar(255) DEFAULT '',
      sub text DEFAULT '',
      type varchar(50) NOT NULL DEFAULT 'General',
      scope varchar(255) NOT NULL DEFAULT 'All',
      scope_value varchar(255) NOT NULL DEFAULT '',
      target_roles varchar(100) NOT NULL DEFAULT 'All',
      pinned boolean NOT NULL DEFAULT false,
      urgent boolean NOT NULL DEFAULT false,
      attachment_url varchar(1000) NOT NULL DEFAULT '',
      attachment_name varchar(255) NOT NULL DEFAULT '',
      author_name varchar(255) NOT NULL DEFAULT 'Admin',
      author_role varchar(255) NOT NULL DEFAULT 'Staff',
      expiry_date varchar(50),
      done boolean NOT NULL DEFAULT false,
      school_id uuid,
      created_at timestamp with time zone NOT NULL DEFAULT now(),
      updated_at timestamp with time zone NOT NULL DEFAULT now()
    );
  `
  
  console.log('Table created successfully.')

  const countRes = await sql`SELECT count(*) as count FROM announcements;`
  const count = Number(countRes[0]?.count || 0)

  if (count === 0) {
    console.log('Table is empty. Seeding initial announcements...')
    
    // Fetch all schools to create a personalized welcome message for each
    const schools = await sql`SELECT id, name FROM schools;`
    
    if (schools.length === 0) {
      console.log('No schools found. Skipping seed.')
    } else {
      for (const school of schools) {
        await sql`
          INSERT INTO announcements (title, content, label, sub, type, scope, scope_value, target_roles, pinned, urgent, attachment_url, attachment_name, author_name, author_role, expiry_date, done, school_id, created_at, updated_at)
          VALUES 
          (
            ${`Welcome to ${school.name}!`}::varchar,
            ${`We are thrilled to welcome all our dedicated Admin and Faculty members to a new academic year. Your hard work and commitment make ${school.name} a place of excellence. Let's make this year our best one yet!`}::text,
            ${`Welcome to ${school.name}!`}::varchar,
            ${`We are thrilled to welcome all our dedicated Admin and Faculty members to a new academic year. Your hard work and commitment make ${school.name} a place of excellence.`}::text,
            'General',
            'All',
            '',
            'All',
            true,
            false,
            '',
            '',
            'Admin',
            'Staff',
            NULL,
            false,
            ${school.id}::uuid,
            now(),
            now()
          );
        `
      }
      console.log(`Seeded ${schools.length} announcement(s).`)
    }
  } else {
    console.log(`Table already has ${count} announcements. Skipping seed.`)
  }

  process.exit(0)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
