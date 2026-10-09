/**
 * Guards the invariant that db.batch() is atomic: drizzle's neon-http batch
 * builds every statement through rawSql.query and hands the *lazy* query
 * objects to rawSql.transaction(). If the DB-guard wrapper in lib/db/index.ts
 * ever resolves those objects itself (e.g. by becoming `async`), statements
 * would run one-by-one outside the transaction. No network is used here.
 */
const calls: { executed: string[]; transactions: unknown[][] } = { executed: [], transactions: [] }

jest.mock('@neondatabase/serverless', () => {
  class FakeNeonQuery {
    constructor(public sql: string, public params: unknown[]) {}
    then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) {
      calls.executed.push(this.sql)
      return Promise.resolve({ rows: [], fields: [], rowCount: 0 }).then(resolve, reject)
    }
  }
  const client: any = () => {
    throw new Error('tagged-template calls are not expected in this test')
  }
  client.query = (sql: string, params: unknown[]) => new FakeNeonQuery(sql, params)
  client.transaction = async (queries: unknown[]) => {
    calls.transactions.push(queries)
    return queries.map(() => ({ rows: [], fields: [], rowCount: 0 }))
  }
  const actual = jest.requireActual('@neondatabase/serverless')
  return { ...actual, neon: () => client, __FakeNeonQuery: FakeNeonQuery }
})

import { eq } from 'drizzle-orm'

describe('db.batch atomicity through the DB guard', () => {
  beforeEach(() => {
    calls.executed = []
    calls.transactions = []
  })

  it('passes un-executed query objects to a single transaction()', async () => {
    const { db } = await import('@/lib/db')
    const { students, attendanceEntries } = await import('@/lib/db/schema')
    const { __FakeNeonQuery } = jest.requireMock('@neondatabase/serverless')

    await db.batch([
      db.update(students).set({ name: 'x' }).where(eq(students.id, '00000000-0000-0000-0000-000000000001')),
      db.delete(attendanceEntries).where(eq(attendanceEntries.sessionId, '00000000-0000-0000-0000-000000000002')),
    ])

    expect(calls.executed).toEqual([])
    expect(calls.transactions).toHaveLength(1)
    expect(calls.transactions[0]).toHaveLength(2)
    for (const q of calls.transactions[0]) expect(q).toBeInstanceOf(__FakeNeonQuery)
  })

  it('still silently blocks an unscoped delete on a core table outside a batch', async () => {
    const { db } = await import('@/lib/db')
    const { students } = await import('@/lib/db/schema')
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    await db.delete(students)
    expect(calls.executed).toEqual([])
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})
