import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  testEnvironment: 'node',
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  // Nested git worktrees under .claude/worktrees/ (used by other in-progress
  // branches) carry their own copies of test files against a schema that
  // may be out of sync with this branch's — without this, a bare `npm test`
  // here picks them up too and fails on unrelated, already-merged work.
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/.claude/worktrees/'],
  // All tests hit one shared live Postgres database with no per-file
  // isolation (no transactional rollback, no separate schema per worker).
  // Running test files in parallel lets them race on shared singleton
  // tables (e.g. `schools`). Serialize execution to keep the suite reliable.
  maxWorkers: 1,
}

export default createJestConfig(config)
