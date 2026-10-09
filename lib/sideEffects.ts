import { after } from 'next/server'

/**
 * Run a non-critical side effect (notifications, audit log, emails) after the
 * response has been sent, so it can neither slow down nor fail the save.
 * Failures are logged, never thrown.
 *
 * Outside a Next.js request scope (scripts, unit tests) `after()` throws, so
 * we fall back to fire-and-forget with the same error logging.
 */
export function runAfterResponse(label: string, task: () => Promise<unknown>): void {
  const safeTask = () =>
    Promise.resolve()
      .then(task)
      .catch((error) => {
        console.error(`[after:${label}] side effect failed`, error)
      })
  try {
    after(safeTask)
  } catch {
    void safeTask()
  }
}
