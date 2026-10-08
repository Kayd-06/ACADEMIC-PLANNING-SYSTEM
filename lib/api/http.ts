import { NextResponse } from 'next/server'

/**
 * An error that is safe to show to the client. Anything thrown inside a route
 * handler that is NOT an HttpError is treated as an internal error: it is
 * logged server-side and the client only gets a generic message, so raw
 * database / driver messages (table names, constraint names, SQL) never leak.
 */
export class HttpError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}

export function isUniqueViolation(error: unknown): boolean {
  const e = error as { code?: string; cause?: { code?: string } } | null | undefined
  return e?.code === '23505' || e?.cause?.code === '23505'
}

interface ErrorResponseOptions {
  /** Message returned for unique-constraint violations (HTTP 409). */
  conflictMessage?: string
  /** Generic message returned for unexpected errors (HTTP 500). */
  fallbackMessage?: string
}

/**
 * Convert any thrown value into a JSON response without leaking internals.
 * `context` is only used for the server log (e.g. "POST /api/students").
 */
export function errorResponse(error: unknown, context: string, options: ErrorResponseOptions = {}) {
  if (error instanceof HttpError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  if (isUniqueViolation(error)) {
    return NextResponse.json(
      { error: options.conflictMessage ?? 'A record with these details already exists.' },
      { status: 409 },
    )
  }
  console.error(`[${context}]`, error)
  return NextResponse.json(
    { error: options.fallbackMessage ?? 'Something went wrong. Please try again.' },
    { status: 500 },
  )
}

/** Fields a client must never be able to set through a PATCH/PUT body. */
const PROTECTED_FIELDS = new Set(['id', '_id', 'schoolId', 'school_id', 'createdAt', 'updatedAt'])

/** Return a shallow copy of `body` with only the allowed keys (and never protected ones). */
export function pickAllowed<T extends string>(body: unknown, allowed: readonly T[]): Partial<Record<T, unknown>> {
  const out: Partial<Record<T, unknown>> = {}
  if (!body || typeof body !== 'object') return out
  const src = body as Record<string, unknown>
  for (const key of allowed) {
    if (PROTECTED_FIELDS.has(key)) continue
    if (src[key] !== undefined) out[key] = src[key]
  }
  return out
}
