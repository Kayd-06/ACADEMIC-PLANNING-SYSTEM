import type { BatchItem } from 'drizzle-orm/batch'
import { db } from '@/lib/db'

export type BatchStatement = BatchItem<'pg'>

/**
 * Run statements atomically in one round trip (neon-http transaction).
 * An empty list is a no-op.
 */
export async function runBatch(statements: BatchStatement[]): Promise<unknown[]> {
  if (statements.length === 0) return []
  return db.batch(statements as [BatchStatement, ...BatchStatement[]])
}
