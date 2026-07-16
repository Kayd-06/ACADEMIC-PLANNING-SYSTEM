# Forgot Password — Design

## Overview

The "Forgot Password?" link on the login page (`components/auth/AuthPage.tsx`) is currently a `<button>` with no `onClick` — clicking it does nothing. This adds a real password-reset flow, following the exact OTP pattern already established for signup email verification (`emailVerifications` table, `lib/tokens.ts`, `lib/mail.ts`, the `resend-otp`/`verify-email` routes, and the "Verify email" resume-flow already in `LoginForm`) — not a reset-link email, since magic links previously broke in production when `NEXT_PUBLIC_APP_URL` pointed to `localhost`.

## Data Model

New table, mirroring `email_verifications` exactly (same shape, separate table so "unverified account" and "verified account resetting password" stay semantically distinct without an extra purpose column):

```ts
export const passwordResets = pgTable('password_resets', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  otp: varchar('otp', { length: 6 }).notNull(),
  attempts: integer('attempts').notNull().default(0),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
```

## API

### `POST /api/auth/forgot-password`
Body: `{ email }`. Looks up the user by email (any role, any status — including `pending_verification`; resetting the password doesn't verify the email, the user still hits the existing verification gate on login afterward). Always responds with the same generic success message regardless of whether the account exists, to avoid leaking which emails are registered; only sends an email when the account is real. 30-second resend cooldown, identical to `resend-otp`. On each call, deletes any prior unexpired reset for that user before creating a new one (same "one live code" pattern as `resend-otp`).

### `POST /api/auth/reset-password`
Body: `{ email, otp, newPassword }`. Validates `newPassword.length >= 8` (matching the signup rule). Looks up the latest `password_resets` row for the user; `MAX_ATTEMPTS = 5` (matching `verify-email`) — exceeding it deletes the row and requires requesting a new code. Expired codes are rejected and deleted (`410`, matching `verify-email`'s expiry handling). On a correct code: `bcrypt.hash(newPassword, 12)` (matching registration's hash), update `users.password`, delete the reset row, respond `{ message: 'Password reset successfully.' }`.

## Email

`lib/mail.ts` gains `sendPasswordResetEmail(to: string, name: string, otp: string)`, same transporter as `sendVerificationEmail`, reset-specific subject/copy (the code, not a link).

## Query Layer

`lib/db/queries/password-resets.ts`, mirroring `email-verifications.ts`: `createPasswordReset`, `findLatestPasswordResetForUser`, `incrementPasswordResetAttempts`, `deletePasswordResetsForUser`.

## UI (`components/auth/AuthPage.tsx`, `LoginForm`)

New state machine parallel to the existing `showResume`/`resumeStage` one: `showForgot`, `forgotStage: 'email' | 'otp' | 'done'`, `forgotEmail`, `forgotOtp`, `newPassword`, `confirmPassword`, `forgotError`, `forgotLoading`, its own `resendCooldown`.

- **Email stage**: one field, "Send Reset Code" button → `POST /api/auth/forgot-password`.
- **OTP stage**: one form with the 6-digit code, new password, and confirm-password fields together (not a separate step) — client-side checks the two passwords match before submitting; submits all three to `POST /api/auth/reset-password` in one call. Includes the same resend-code button/cooldown as the "Verify email" flow.
- **Done stage**: confirmation message, "Back to sign in" link.

The "Forgot Password?" button gets `onClick={() => { setForgotEmail(email); setShowForgot(true) }}` (pre-filling from whatever the user already typed in the login email field, matching how "Verify email" pre-fills `resumeEmail`).

## Testing

Route tests for `forgot-password` and `reset-password`, mirroring `resend-otp`'s and `verify-email`'s existing test files: no-session-needed (public routes, no `auth()` gate — matches the existing verify-email/resend-otp routes, which are also pre-login), unknown email still returns the generic success message, correct OTP resets the password and a subsequent login with the new password succeeds, wrong OTP increments attempts, attempts exhausted after 5 tries, expired code rejected, resend respects the 30s cooldown. All cleanup in these new tests deletes by specific row ID only, never an unscoped `db.delete(table)` — `password_resets` is not in the DB Guard's protected table list, and `users` rows created for these tests must be deleted by ID individually regardless.
