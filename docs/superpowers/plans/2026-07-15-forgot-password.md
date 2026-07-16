# Forgot Password Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the non-functional "Forgot Password?" link work end-to-end: request a reset code by email, verify it, set a new password, stored in Neon.

**Architecture:** A new `password_resets` table mirrors `email_verifications` exactly. Two new public API routes (`forgot-password`, `reset-password`) mirror `resend-otp`/`verify-email`. A new state machine inside `LoginForm` (`components/auth/AuthPage.tsx`) mirrors the existing "Verify email" resume-flow.

**Tech Stack:** Next.js 16 App Router, Drizzle ORM, Neon Postgres, `bcryptjs`, `nodemailer` (Gmail SMTP, already configured), Jest with a real Postgres connection.

## Global Constraints

- OTP-based, not link-based (`NEXT_PUBLIC_APP_URL` broke magic links in production previously).
- `forgot-password` always returns the same generic success message regardless of whether the account exists — never leak account existence, unlike `verify-email`/`resend-otp` which do return a distinct 404.
- New password minimum length: 8 characters (matches signup).
- Password hashing: `bcrypt.hash(newPassword, 12)` (matches registration).
- `reset-password` attempt limit: `MAX_ATTEMPTS = 5` (matches `verify-email`).
- Code expiry: 10 minutes via `getExpiry(10)` (matches the existing pattern).
- Resend cooldown: 30 seconds (matches `resend-otp`).
- `password_resets` is not in the DB Guard's protected table list — every test in this plan must clean up by deleting specific row IDs only, never an unscoped `db.delete(table)`.
- Run `npx tsc --noEmit` after every task; must stay clean. Commit after every task.

---

### Task 1: Schema — `password_resets` table + `updateUserPassword` query

**Files:**
- Modify: `lib/db/schema.ts`
- Modify: `lib/db/schema.test.ts`
- Modify: `lib/db/queries/users.ts`
- Modify: `lib/db/queries/users.test.ts`
- Create: `lib/db/migrations/0028_password_resets.sql`
- Modify: `scripts/apply-migration.mjs`

**Interfaces:**
- Produces: `passwordResets` Drizzle table + `PasswordReset`/`NewPasswordReset` types (imported by Task 2). `updateUserPassword(id: string, hashedPassword: string): Promise<User | null>` in `lib/db/queries/users.ts` (imported by Task 4).

- [ ] **Step 1: Add the table to the schema**

In `lib/db/schema.ts`, find the `emailVerifications` block:

```ts
export const emailVerifications = pgTable('email_verifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  otp: varchar('otp', { length: 6 }).notNull(),
  attempts: integer('attempts').notNull().default(0),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export type EmailVerification = typeof emailVerifications.$inferSelect
export type NewEmailVerification = typeof emailVerifications.$inferInsert
```

Immediately after it (before the `schools` table), add:

```ts

export const passwordResets = pgTable('password_resets', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  otp: varchar('otp', { length: 6 }).notNull(),
  attempts: integer('attempts').notNull().default(0),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export type PasswordReset = typeof passwordResets.$inferSelect
export type NewPasswordReset = typeof passwordResets.$inferInsert
```

- [ ] **Step 2: Write the migration**

Create `lib/db/migrations/0028_password_resets.sql`:

```sql
CREATE TABLE IF NOT EXISTS password_resets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  otp varchar(6) NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS password_resets_user_id_idx ON password_resets(user_id);
```

- [ ] **Step 3: Point the apply script at this migration and run it**

In `scripts/apply-migration.mjs`, change the `readFileSync` line to:

```js
const migration = readFileSync('./lib/db/migrations/0028_password_resets.sql', 'utf8') // latest migration
```

Run: `node scripts/apply-migration.mjs`
Expected: `Applying 2 statements...` then `Done.`, exit code 0.

- [ ] **Step 4: Verify against Neon directly (read-only)**

Run:

```bash
node -e "
require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);
(async () => {
  const cols = await sql.query(\"SELECT column_name FROM information_schema.columns WHERE table_name = 'password_resets'\", [], { fullResults: true });
  console.log('password_resets columns:', cols.rows.map(c => c.column_name));
})();
"
```

Expected: lists `id, user_id, otp, attempts, expires_at, created_at`.

- [ ] **Step 5: Update the schema smoke test**

In `lib/db/schema.test.ts`, add `passwordResets` to the import list and to the `Promise.all`/assertions block alongside the other tables already there (follow the exact pattern already in the file for `testGrades` etc. — add one more `import` name and one more `expect(db.select().from(passwordResets)).resolves.toEqual(expect.any(Array))` line).

- [ ] **Step 6: Add `updateUserPassword` to the query layer**

In `lib/db/queries/users.ts`, after `updateUserStatus`, add:

```ts
export async function updateUserPassword(id: string, hashedPassword: string): Promise<User | null> {
  const rows = await db
    .update(users)
    .set({ password: hashedPassword, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning()
  return rows[0] ?? null
}
```

- [ ] **Step 7: Write a failing test for it**

In `lib/db/queries/users.test.ts`, add (using the file's existing `createdId`/`afterAll` pattern already there):

```ts
  it('updateUserPassword sets a new password hash', async () => {
    const updated = await updateUserPassword(createdId!, 'new-hashed-value')
    expect(updated?.password).toBe('new-hashed-value')
  })
```

Find:

```ts
import { createUser, findUserByEmail, findUserById, updateUserStatus } from './users'
```

Replace with:

```ts
import { createUser, findUserByEmail, findUserById, updateUserStatus, updateUserPassword } from './users'
```

- [ ] **Step 8: Run the tests**

Run: `npx jest --testPathPatterns='lib/db/queries/users\.test\.ts'`
Expected: PASS, all tests including the new one.

Run: `npx jest --testPathPatterns='lib/db/schema\.test\.ts'`
Expected: PASS.

- [ ] **Step 9: Typecheck and commit**

Run: `npx tsc --noEmit` — expect clean.

```bash
git add lib/db/schema.ts lib/db/schema.test.ts lib/db/queries/users.ts lib/db/queries/users.test.ts lib/db/migrations/0028_password_resets.sql scripts/apply-migration.mjs
git commit -m "feat: add password_resets table and updateUserPassword query"
```

---

### Task 2: `password_resets` query layer

**Files:**
- Create: `lib/db/queries/password-resets.ts`
- Create: `lib/db/queries/password-resets.test.ts`

**Interfaces:**
- Consumes: `passwordResets` table (Task 1).
- Produces: `createPasswordReset(data: NewPasswordReset): Promise<PasswordReset>`, `findLatestPasswordResetForUser(userId: string): Promise<PasswordReset | null>`, `incrementPasswordResetAttempts(id: string): Promise<void>`, `deletePasswordResetsForUser(userId: string): Promise<void>`. Tasks 3 and 4 import all four.

- [ ] **Step 1: Write the failing tests**

Create `lib/db/queries/password-resets.test.ts`:

```ts
import { db } from '../index'
import { users, passwordResets } from '../schema'
import { eq } from 'drizzle-orm'
import { createUser } from './users'
import {
  createPasswordReset,
  findLatestPasswordResetForUser,
  incrementPasswordResetAttempts,
  deletePasswordResetsForUser,
} from './password-resets'

describe('password reset queries', () => {
  const testEmail = `test-reset-queries-${Date.now()}@example.com`
  const testOtp = '654321'
  let userId: string | undefined

  beforeAll(async () => {
    const user = await createUser({
      name: 'Test Teacher', email: testEmail, password: 'hashed-password', role: 'teacher', status: 'active',
    })
    userId = user.id
  })

  afterAll(async () => {
    if (userId) {
      await db.delete(passwordResets).where(eq(passwordResets.userId, userId))
      await db.delete(users).where(eq(users.id, userId))
      userId = undefined
    }
  })

  it('createPasswordReset inserts a row', async () => {
    const reset = await createPasswordReset({
      userId: userId!, otp: testOtp, expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    })
    expect(reset.otp).toBe(testOtp)
    expect(reset.userId).toBe(userId)
    expect(reset.attempts).toBe(0)
  })

  it('findLatestPasswordResetForUser returns the most recently created row', async () => {
    const reset = await findLatestPasswordResetForUser(userId!)
    expect(reset?.userId).toBe(userId)
    expect(reset?.otp).toBe(testOtp)
  })

  it('findLatestPasswordResetForUser returns null for a user with no reset', async () => {
    const reset = await findLatestPasswordResetForUser('00000000-0000-0000-0000-000000000000')
    expect(reset).toBeNull()
  })

  it('incrementPasswordResetAttempts bumps the attempt count', async () => {
    const before = await findLatestPasswordResetForUser(userId!)
    await incrementPasswordResetAttempts(before!.id)
    const after = await findLatestPasswordResetForUser(userId!)
    expect(after?.attempts).toBe((before?.attempts ?? 0) + 1)
  })

  it('deletePasswordResetsForUser removes all rows for the user', async () => {
    await deletePasswordResetsForUser(userId!)
    const reset = await findLatestPasswordResetForUser(userId!)
    expect(reset).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --testPathPatterns='lib/db/queries/password-resets\.test\.ts'`
Expected: FAIL (module `./password-resets` does not exist).

- [ ] **Step 3: Implement**

Create `lib/db/queries/password-resets.ts`:

```ts
import { eq, desc } from 'drizzle-orm'
import { db } from '../index'
import { passwordResets, type PasswordReset, type NewPasswordReset } from '../schema'

export async function createPasswordReset(data: NewPasswordReset): Promise<PasswordReset> {
  const rows = await db.insert(passwordResets).values(data).returning()
  return rows[0]
}

// A user may have requested more than one code — only the most recent one is ever valid.
export async function findLatestPasswordResetForUser(userId: string): Promise<PasswordReset | null> {
  const rows = await db
    .select()
    .from(passwordResets)
    .where(eq(passwordResets.userId, userId))
    .orderBy(desc(passwordResets.createdAt))
    .limit(1)
  return rows[0] ?? null
}

export async function incrementPasswordResetAttempts(id: string): Promise<void> {
  const [row] = await db.select({ attempts: passwordResets.attempts }).from(passwordResets).where(eq(passwordResets.id, id))
  if (!row) return
  await db.update(passwordResets).set({ attempts: row.attempts + 1 }).where(eq(passwordResets.id, id))
}

export async function deletePasswordResetsForUser(userId: string): Promise<void> {
  await db.delete(passwordResets).where(eq(passwordResets.userId, userId))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --testPathPatterns='lib/db/queries/password-resets\.test\.ts'`
Expected: PASS (5 tests).

- [ ] **Step 5: Typecheck and commit**

Run: `npx tsc --noEmit` — expect clean.

```bash
git add lib/db/queries/password-resets.ts lib/db/queries/password-resets.test.ts
git commit -m "feat: add password_resets query layer"
```

---

### Task 3: `POST /api/auth/forgot-password`

**Files:**
- Modify: `lib/mail.ts`
- Create: `app/api/auth/forgot-password/route.ts`
- Create: `app/api/auth/forgot-password/route.test.ts`

**Interfaces:**
- Consumes: `createPasswordReset`/`findLatestPasswordResetForUser`/`deletePasswordResetsForUser` (Task 2), `findUserByEmail` (existing), `generateOtp`/`getExpiry` (existing `lib/tokens.ts`).
- Produces: `sendPasswordResetEmail(to: string, name: string, otp: string): Promise<void>` in `lib/mail.ts` (also used nowhere else, but keep it exported for consistency with `sendVerificationEmail`). `POST /api/auth/forgot-password` body `{ email }` → `200 { message }` always (never leaks whether the account exists).

- [ ] **Step 1: Add the email function**

In `lib/mail.ts`, after `sendVerificationEmail`, add:

```ts
export async function sendPasswordResetEmail(to: string, name: string, otp: string) {
  await transporter.sendMail({
    from: `"Academic Planning System" <${process.env.GMAIL_USER}>`,
    to,
    subject: `${otp} is your password reset code`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0f172a;color:#e2e8f0;padding:40px;border-radius:16px;">
        <h2 style="color:#818cf8;margin-bottom:8px;">Hi ${name},</h2>
        <p style="color:#94a3b8;margin-bottom:24px;">
          Use this code to reset your password. It expires in <strong style="color:#e2e8f0;">10 minutes</strong>.
        </p>
        <div style="display:inline-block;padding:16px 32px;background:#1e1b4b;border:1px solid #4f46e5;border-radius:12px;">
          <span style="font-size:32px;font-weight:700;letter-spacing:8px;color:#e2e8f0;">${otp}</span>
        </div>
        <hr style="border:none;border-top:1px solid #1e293b;margin-top:32px;"/>
        <p style="color:#334155;font-size:12px;margin-top:16px;">
          If you didn't request a password reset, you can safely ignore this email — your password will not change.
        </p>
      </div>
    `,
  })
}
```

- [ ] **Step 2: Write the failing test**

Create `app/api/auth/forgot-password/route.test.ts`:

```ts
import { db } from '@/lib/db'
import { users, passwordResets } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { createUser } from '@/lib/db/queries/users'

jest.mock('@/lib/mail', () => ({ sendPasswordResetEmail: jest.fn() }))

import { sendPasswordResetEmail } from '@/lib/mail'
import { POST } from './route'

function req(body: any) {
  return new Request('http://localhost/api/auth/forgot-password', {
    method: 'POST', body: JSON.stringify(body),
  }) as any
}

describe('POST /api/auth/forgot-password', () => {
  let userId: string | undefined

  afterEach(async () => {
    if (userId) {
      await db.delete(passwordResets).where(eq(passwordResets.userId, userId))
      await db.delete(users).where(eq(users.id, userId))
      userId = undefined
    }
    jest.clearAllMocks()
  })

  it('returns the generic message and sends an email for a real account', async () => {
    const email = `forgot-${Date.now()}@example.com`
    const user = await createUser({ name: 'Test User', email, password: 'x', role: 'teacher', status: 'active' })
    userId = user.id

    const res = await POST(req({ email }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.message).toMatch(/if an account/i)
    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1)

    const [reset] = await db.select().from(passwordResets).where(eq(passwordResets.userId, user.id))
    expect(reset.otp).toHaveLength(6)
  })

  it('returns the same generic message for an unknown email, without sending anything', async () => {
    const res = await POST(req({ email: 'nobody-here@example.com' }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.message).toMatch(/if an account/i)
    expect(sendPasswordResetEmail).not.toHaveBeenCalled()
  })

  it('enforces the 30s resend cooldown for a real account', async () => {
    const email = `forgot-${Date.now()}@example.com`
    const user = await createUser({ name: 'Test User', email, password: 'x', role: 'teacher', status: 'active' })
    userId = user.id

    await POST(req({ email }))
    const res = await POST(req({ email }))
    expect(res.status).toBe(429)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest --testPathPatterns='app/api/auth/forgot-password/route\.test\.ts'`
Expected: FAIL (module `./route` does not exist).

- [ ] **Step 4: Implement the route**

Create `app/api/auth/forgot-password/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { findUserByEmail } from '@/lib/db/queries/users'
import {
  createPasswordReset,
  findLatestPasswordResetForUser,
  deletePasswordResetsForUser,
} from '@/lib/db/queries/password-resets'
import { generateOtp, getExpiry } from '@/lib/tokens'
import { sendPasswordResetEmail } from '@/lib/mail'

const RESEND_COOLDOWN_MS = 30 * 1000
const GENERIC_MESSAGE = 'If an account exists for that email, a reset code has been sent.'

export async function POST(req: Request) {
  try {
    const { email } = await req.json()
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const user = await findUserByEmail(email)
    if (!user) {
      // Never reveal whether the account exists.
      return NextResponse.json({ message: GENERIC_MESSAGE }, { status: 200 })
    }

    const previous = await findLatestPasswordResetForUser(user.id)
    if (previous && Date.now() - new Date(previous.createdAt).getTime() < RESEND_COOLDOWN_MS) {
      const waitSeconds = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - new Date(previous.createdAt).getTime())) / 1000)
      return NextResponse.json({ error: `Please wait ${waitSeconds}s before requesting another code.` }, { status: 429 })
    }

    await deletePasswordResetsForUser(user.id)
    const otp = generateOtp()
    await createPasswordReset({ userId: user.id, otp, expiresAt: getExpiry(10) })
    await sendPasswordResetEmail(email, user.name, otp)

    return NextResponse.json({ message: GENERIC_MESSAGE }, { status: 200 })
  } catch (error) {
    console.error('Forgot password error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest --testPathPatterns='app/api/auth/forgot-password/route\.test\.ts'`
Expected: PASS (3 tests).

- [ ] **Step 6: Typecheck and commit**

Run: `npx tsc --noEmit` — expect clean.

```bash
git add lib/mail.ts app/api/auth/forgot-password/route.ts app/api/auth/forgot-password/route.test.ts
git commit -m "feat: add POST /api/auth/forgot-password"
```

---

### Task 4: `POST /api/auth/reset-password`

**Files:**
- Create: `app/api/auth/reset-password/route.ts`
- Create: `app/api/auth/reset-password/route.test.ts`

**Interfaces:**
- Consumes: `findUserByEmail`/`updateUserPassword` (Task 1), `findLatestPasswordResetForUser`/`incrementPasswordResetAttempts`/`deletePasswordResetsForUser` (Task 2), `isExpired` (existing `lib/tokens.ts`).
- Produces: `POST /api/auth/reset-password` body `{ email, otp, newPassword }` → `200 { message }` on success, `400` (missing fields / bad code / password too short), `404` (unknown email), `410` (expired code, deletes it), `429` (attempts exhausted, deletes it).

- [ ] **Step 1: Write the failing tests**

Create `app/api/auth/reset-password/route.test.ts`:

```ts
import { db } from '@/lib/db'
import { users, passwordResets } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { createUser } from '@/lib/db/queries/users'
import { createPasswordReset } from '@/lib/db/queries/password-resets'
import bcrypt from 'bcryptjs'
import { POST } from './route'

function req(body: any) {
  return new Request('http://localhost/api/auth/reset-password', {
    method: 'POST', body: JSON.stringify(body),
  }) as any
}

describe('POST /api/auth/reset-password', () => {
  let userId: string | undefined

  afterEach(async () => {
    if (userId) {
      await db.delete(passwordResets).where(eq(passwordResets.userId, userId))
      await db.delete(users).where(eq(users.id, userId))
      userId = undefined
    }
  })

  async function makeUserWithReset(otp: string, expiresAt: Date, attempts = 0) {
    const email = `reset-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`
    const user = await createUser({ name: 'Reset User', email, password: 'old-hash', role: 'teacher', status: 'active' })
    userId = user.id
    await createPasswordReset({ userId: user.id, otp, expiresAt, attempts })
    return user
  }

  it('resets the password and deletes the code on a valid request', async () => {
    const user = await makeUserWithReset('123456', new Date(Date.now() + 10 * 60 * 1000))

    const res = await POST(req({ email: user.email, otp: '123456', newPassword: 'brand-new-password' }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.message).toMatch(/reset successfully/i)

    const [updated] = await db.select().from(users).where(eq(users.id, userId!))
    const matches = await bcrypt.compare('brand-new-password', updated.password)
    expect(matches).toBe(true)

    const remaining = await db.select().from(passwordResets).where(eq(passwordResets.userId, userId!))
    expect(remaining).toHaveLength(0)
  })

  it('rejects a password shorter than 8 characters', async () => {
    const user = await makeUserWithReset('123456', new Date(Date.now() + 10 * 60 * 1000))
    const res = await POST(req({ email: user.email, otp: '123456', newPassword: 'short' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for an incorrect code', async () => {
    const user = await makeUserWithReset('123456', new Date(Date.now() + 10 * 60 * 1000))
    const res = await POST(req({ email: user.email, otp: '000000', newPassword: 'brand-new-password' }))
    expect(res.status).toBe(400)

    const [updated] = await db.select().from(users).where(eq(users.id, userId!))
    expect(updated.password).toBe('old-hash')
  })

  it('returns 404 for an email with no account', async () => {
    userId = undefined
    const res = await POST(req({ email: 'does-not-exist@example.com', otp: '123456', newPassword: 'brand-new-password' }))
    expect(res.status).toBe(404)
  })

  it('returns 410 and deletes the code for an expired one', async () => {
    const user = await makeUserWithReset('123456', new Date(Date.now() - 60 * 1000))
    const res = await POST(req({ email: user.email, otp: '123456', newPassword: 'brand-new-password' }))
    expect(res.status).toBe(410)

    const remaining = await db.select().from(passwordResets).where(eq(passwordResets.userId, userId!))
    expect(remaining).toHaveLength(0)
  })

  it('returns 429 once attempts are exhausted', async () => {
    const user = await makeUserWithReset('123456', new Date(Date.now() + 10 * 60 * 1000), 5)
    const res = await POST(req({ email: user.email, otp: '123456', newPassword: 'brand-new-password' }))
    expect(res.status).toBe(429)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --testPathPatterns='app/api/auth/reset-password/route\.test\.ts'`
Expected: FAIL (module `./route` does not exist).

- [ ] **Step 3: Implement the route**

Create `app/api/auth/reset-password/route.ts`:

```ts
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { findUserByEmail, updateUserPassword } from '@/lib/db/queries/users'
import {
  findLatestPasswordResetForUser,
  incrementPasswordResetAttempts,
  deletePasswordResetsForUser,
} from '@/lib/db/queries/password-resets'
import { isExpired } from '@/lib/tokens'

const MAX_ATTEMPTS = 5

export async function POST(req: Request) {
  try {
    const { email, otp, newPassword } = await req.json()
    if (!email || !otp || !newPassword) {
      return NextResponse.json({ error: 'Email, code, and new password are required' }, { status: 400 })
    }
    if (String(newPassword).length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    const user = await findUserByEmail(email)
    if (!user) {
      return NextResponse.json({ error: 'No account found for this email' }, { status: 404 })
    }

    const reset = await findLatestPasswordResetForUser(user.id)
    if (!reset) {
      return NextResponse.json({ error: 'No pending reset code found. Please request a new one.' }, { status: 400 })
    }

    if (isExpired(reset.expiresAt)) {
      await deletePasswordResetsForUser(user.id)
      return NextResponse.json({ error: 'This code has expired. Please request a new one.' }, { status: 410 })
    }

    if (reset.attempts >= MAX_ATTEMPTS) {
      await deletePasswordResetsForUser(user.id)
      return NextResponse.json({ error: 'Too many incorrect attempts. Please request a new code.' }, { status: 429 })
    }

    if (reset.otp !== String(otp).trim()) {
      await incrementPasswordResetAttempts(reset.id)
      const remaining = MAX_ATTEMPTS - reset.attempts - 1
      return NextResponse.json({ error: `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.` }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12)
    await updateUserPassword(user.id, hashedPassword)
    await deletePasswordResetsForUser(user.id)

    return NextResponse.json({ message: 'Password reset successfully. You can now log in.' }, { status: 200 })
  } catch (error) {
    console.error('Reset password error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --testPathPatterns='app/api/auth/reset-password/route\.test\.ts'`
Expected: PASS (6 tests).

- [ ] **Step 5: Typecheck and commit**

Run: `npx tsc --noEmit` — expect clean.

```bash
git add app/api/auth/reset-password/route.ts app/api/auth/reset-password/route.test.ts
git commit -m "feat: add POST /api/auth/reset-password"
```

---

### Task 5: Wire the UI — `LoginForm`'s "Forgot Password?" flow

**Files:**
- Modify: `components/auth/AuthPage.tsx`

**Interfaces:**
- Consumes: `POST /api/auth/forgot-password`, `POST /api/auth/reset-password` (Tasks 3-4). Reuses `FieldInput`, `PasswordInput`, `PrimaryBtn`, `ErrorMsg` (already defined earlier in this same file) and the `Mail`/`Hash`/`Lock` icons already imported.

This codebase has no automated test convention for `.tsx` files — verification is `npx tsc --noEmit` plus a manual dev-server check.

- [ ] **Step 1: Add state, mirroring the existing `showResume` block**

In `components/auth/AuthPage.tsx`, inside `LoginForm`, find:

```tsx
  const [resendCooldown, setResendCooldown] = useState(0)

  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setInterval(() => setResendCooldown(s => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [resendCooldown])
```

Replace with:

```tsx
  const [resendCooldown, setResendCooldown] = useState(0)

  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setInterval(() => setResendCooldown(s => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [resendCooldown])

  // Forgot-password flow — same shape as the "Verify email" resume flow above.
  const [showForgot, setShowForgot] = useState(false)
  const [forgotStage, setForgotStage] = useState<'email' | 'otp' | 'done'>('email')
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotOtp, setForgotOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [forgotError, setForgotError] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotResendCooldown, setForgotResendCooldown] = useState(0)

  useEffect(() => {
    if (forgotResendCooldown <= 0) return
    const t = setInterval(() => setForgotResendCooldown(s => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [forgotResendCooldown])
```

- [ ] **Step 2: Add the handler functions**

Find:

```tsx
  function closeResume() {
    setShowResume(false)
    setResumeStage('email')
    setResumeOtp('')
    setResumeError('')
  }
```

Replace with:

```tsx
  function closeResume() {
    setShowResume(false)
    setResumeStage('email')
    setResumeOtp('')
    setResumeError('')
  }

  function closeForgot() {
    setShowForgot(false)
    setForgotStage('email')
    setForgotOtp('')
    setNewPassword('')
    setConfirmPassword('')
    setForgotError('')
  }

  async function sendForgotCode(e: React.FormEvent) {
    e.preventDefault(); setForgotError(''); setForgotLoading(true)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      })
      const data = await res.json()
      if (!res.ok) { setForgotError(data.error || 'Failed to send code.'); return }
      setForgotStage('otp')
      setForgotResendCooldown(30)
    } finally { setForgotLoading(false) }
  }

  async function resendForgotCode() {
    if (forgotResendCooldown > 0) return
    setForgotError(''); setForgotLoading(true)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      })
      const data = await res.json()
      if (!res.ok) { setForgotError(data.error || 'Failed to resend code.'); return }
      setForgotResendCooldown(30)
    } finally { setForgotLoading(false) }
  }

  async function submitNewPassword(e: React.FormEvent) {
    e.preventDefault(); setForgotError('')
    if (newPassword !== confirmPassword) { setForgotError('Passwords do not match.'); return }
    if (newPassword.length < 8) { setForgotError('Password must be at least 8 characters.'); return }
    setForgotLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail, otp: forgotOtp, newPassword }),
      })
      const data = await res.json()
      if (!res.ok) { setForgotError(data.error || 'Failed to reset password.'); return }
      setForgotStage('done')
    } finally { setForgotLoading(false) }
  }
```

- [ ] **Step 3: Render the flow, mirroring the `showResume` block**

Find:

```tsx
  if (showResume) {
```

Immediately before this line, add:

```tsx
  if (showForgot) {
    return (
      <div className="w-full">
        <button onClick={closeForgot} className="text-xs text-gray-400 hover:text-gray-600 mb-3 block transition-colors">← Back to login</button>
        <h2 className="text-2xl font-bold text-gray-800 text-center mb-6">Reset Password</h2>
        <ErrorMsg msg={forgotError} />
        {forgotStage === 'done' ? (
          <div className="text-center py-3">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            </div>
            <p className="text-sm font-medium text-gray-800">Password reset</p>
            <p className="text-xs text-gray-400 mt-1">You can sign in with your new password</p>
            <button onClick={closeForgot} className="mt-3 text-xs text-indigo-500 hover:text-indigo-600 transition-colors">Back to sign in</button>
          </div>
        ) : forgotStage === 'otp' ? (
          <form onSubmit={submitNewPassword} className="space-y-2.5">
            <p className="text-xs text-gray-500">
              Enter the 6-digit code sent to <span className="font-semibold text-gray-700">{forgotEmail}</span>, and choose a new password.
            </p>
            <FieldInput
              icon={<Hash className="w-4 h-4" />} type="text" inputMode="numeric" maxLength={6}
              value={forgotOtp} onChange={e => setForgotOtp(e.target.value.replace(/\D/g, ''))}
              required placeholder="6-digit code"
              className="text-center tracking-[0.5em] font-semibold"
            />
            <PasswordInput value={newPassword} onChange={e => setNewPassword(e.target.value)} required placeholder="New password" />
            <PasswordInput value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required placeholder="Confirm new password" />
            <div className="pt-1"><PrimaryBtn loading={forgotLoading}>Reset Password</PrimaryBtn></div>
            <button
              type="button" onClick={resendForgotCode} disabled={forgotLoading || forgotResendCooldown > 0}
              className="w-full text-center text-xs text-indigo-500 hover:text-indigo-600 disabled:text-gray-300 transition-colors pt-1"
            >
              {forgotResendCooldown > 0 ? `Resend code in ${forgotResendCooldown}s` : 'Resend code'}
            </button>
          </form>
        ) : (
          <form onSubmit={sendForgotCode} className="space-y-2.5">
            <FieldInput icon={<Mail className="w-4 h-4" />} type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} required placeholder="Your account email" />
            <div className="pt-1"><PrimaryBtn loading={forgotLoading}>Send Reset Code</PrimaryBtn></div>
          </form>
        )}
      </div>
    )
  }

```

- [ ] **Step 4: Wire the "Forgot Password?" button**

Find:

```tsx
          <button type="button" className="text-xs text-gray-400 hover:text-indigo-500 transition-colors">
            Forgot Password?
          </button>
```

Replace with:

```tsx
          <button type="button" onClick={() => { setForgotEmail(email); setShowForgot(true) }} className="text-xs text-gray-400 hover:text-indigo-500 transition-colors">
            Forgot Password?
          </button>
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Manual verification**

On the dev server: click "Forgot Password?" → enter a real account's email → confirm a code arrives by email → enter the code + a new password twice → confirm success message → log in with the new password. Also check: wrong code shows an error and doesn't reset anything; "Back to login" from any stage returns cleanly to the login form.

- [ ] **Step 7: Commit**

```bash
git add components/auth/AuthPage.tsx
git commit -m "feat: wire up the forgot password flow in LoginForm"
```

---

## Final Verification

- [ ] `npx tsc --noEmit` clean.
- [ ] `npm run build` succeeds.
- [ ] Each new test file passes individually (do not run the full `npm test` suite blindly — confirm no other test file was affected by checking `git status` shows only this plan's files changed).
- [ ] Manual: full forgot-password round trip on the dev server as described in Task 5 Step 6.
