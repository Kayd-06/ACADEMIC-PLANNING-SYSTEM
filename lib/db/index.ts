import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'
export * from './schema'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not defined')
}

const rawSql = neon(process.env.DATABASE_URL)

// DB Guard: Intercept queries to prevent unscoped table-wide wipes on core production tables
// when tests run locally or on Vercel preview environments targeting DATABASE_URL.
const guardedSql: any = async (query: any, params?: any[], ...args: any[]) => {
  if (process.env.ALLOW_UNSCOPED_DELETES !== 'true') {
    const queryStr = typeof query === 'string' ? query : query?.sql || String(query || '')
    if (
      typeof queryStr === 'string' &&
      /^delete from "(users|schools|students|tests|questions|student_reports|student_report_entries|test_grades)"/i.test(queryStr.trim())
    ) {
      const hasWhere = /where/i.test(queryStr)
      const hasValidParam = params && params.length > 0 && params[0] !== undefined && params[0] !== null
      if (!hasWhere || (hasWhere && params && params.length > 0 && params[0] === undefined)) {
        console.warn(`[DB Guard] Blocked unscoped delete on core table: ${queryStr} (params: ${JSON.stringify(params)})`)
        return []
      }
    }
  }
  return rawSql(query, params, ...args)
}
Object.assign(guardedSql, rawSql)

export const db = drizzle(guardedSql, { schema })
