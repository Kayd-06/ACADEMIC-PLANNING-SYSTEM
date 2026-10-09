import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'
import { shouldBlockDelete } from './dbGuard'
export * from './schema'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not defined')
}

const rawSql: any = neon(process.env.DATABASE_URL)

// DB Guard: block unscoped table-wide wipes on core tables (this project has
// no separate test database — Jest's DATABASE_URL is the same one the real
// app reads from — so an unscoped `db.delete(table)` in a test's cleanup
// hook deletes real rows).
//
// drizzle-orm's neon-http session calls `client.query ?? client` (see
// node_modules/drizzle-orm/neon-http/session.cjs) and neon()'s returned
// function carries its own `.query` method, so wrapping only the top-level
// callable (as an earlier version of this guard did) is silently bypassed —
// Drizzle always finds and calls the real `.query` directly. The guard has
// to replace that `.query` property itself to actually run.
const rawQuery = rawSql.query.bind(rawSql)

// IMPORTANT: this wrapper must stay synchronous and return neon's lazy
// NeonQueryPromise untouched. `db.batch([...])` (our only way to run several
// statements atomically on neon-http) builds every statement through this
// `.query` and then hands the un-awaited query objects to
// `rawSql.transaction()`. An `async` wrapper would resolve — i.e. EXECUTE —
// each statement on its own, outside the transaction, and hand transaction()
// plain Promises it rejects.
rawSql.query = (query: any, params?: any[], ...args: any[]) => {
  const queryStr = typeof query === 'string' ? query : query?.sql || String(query || '')
  if (shouldBlockDelete(queryStr, params)) {
    console.warn(`[DB Guard] Blocked unscoped delete on core table: ${queryStr} (params: ${JSON.stringify(params)})`)
    // A plain promise (not a NeonQueryPromise) also makes a db.batch() that
    // contains a blocked delete fail as a whole instead of half-applying.
    return Promise.resolve({ rows: [], rowCount: 0, fields: [] })
  }
  return rawQuery(query, params, ...args)
}

export const db = drizzle(rawSql, { schema })
