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
      pinned boolean NOT NULL DEFAULT false,
      urgent boolean NOT NULL DEFAULT false,
      author_name varchar(255) NOT NULL DEFAULT 'Admin',
      author_role varchar(255) NOT NULL DEFAULT 'Staff',
      expiry_date varchar(50),
      done boolean NOT NULL DEFAULT false,
      created_at timestamp with time zone NOT NULL DEFAULT now(),
      updated_at timestamp with time zone NOT NULL DEFAULT now()
    );
  `
  
  console.log('Table created successfully.')

  const countRes = await sql`SELECT count(*) as count FROM announcements;`
  const count = Number(countRes[0]?.count || 0)

  if (count === 0) {
    console.log('Table is empty. Seeding initial announcements...')
    await sql`
      INSERT INTO announcements (title, content, label, sub, type, scope, pinned, urgent, author_name, author_role, expiry_date, created_at, updated_at)
      VALUES 
      (
        'Emergency Campus Closure Tomorrow',
        'Due to severe weather warnings issued by the meteorological department, the campus will remain closed tomorrow, Tuesday. All offline classes are suspended. Online classes will proceed as per schedule. Stay safe.',
        'Emergency Campus Closure Tomorrow',
        'Due to severe weather warnings issued by the meteorological department, the campus will remain close',
        'Urgent',
        'All Staff & Students',
        true,
        true,
        'Sarah Jenkins',
        'Principal',
        NULL,
        now() - interval '2 days',
        now() - interval '2 days'
      ),
      (
        'Thanksgiving Break Schedule',
        'Please note that the school will be closed from Wednesday, Nov 22nd to Friday, Nov 24th for the Thanksgiving holiday. Hostels will remain open for international students. Have a wonderful break!',
        'Thanksgiving Break Schedule',
        'Please note that the school will be closed from Wednesday, Nov 22nd to Friday, Nov 24th for the Than',
        'Holiday',
        'All',
        false,
        false,
        'David Chen',
        'Admin',
        '2026-11-25',
        now() - interval '10 days',
        now() - interval '10 days'
      );
    `
    console.log('Seeded 2 announcements.')
  } else {
    console.log(`Table already has ${count} announcements. Skipping seed.`)
  }

  process.exit(0)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
