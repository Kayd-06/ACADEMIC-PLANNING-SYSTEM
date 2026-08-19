// Sidebar/TopHeader have no shared layout.tsx, so React fully unmounts and
// remounts them on every dashboard navigation — replaying every mount-time
// fetch from scratch. This in-memory, module-level (so it survives
// component remounts within the same browser session) stale-while-revalidate
// cache lets those components paint with the last-known data instantly while
// a background request refreshes it, instead of showing a spinner every time.
type CacheEntry<T> = { data: T; timestamp: number; promise?: Promise<T> }

const cache = new Map<string, CacheEntry<any>>()

export function swrFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  maxAgeMs: number = 60_000
): { data: T | undefined; promise: Promise<T> } {
  const entry = cache.get(key) as CacheEntry<T> | undefined
  const isFresh = !!entry && Date.now() - entry.timestamp < maxAgeMs

  if (isFresh) {
    return { data: entry!.data, promise: Promise.resolve(entry!.data) }
  }

  if (entry?.promise) {
    return { data: entry.data, promise: entry.promise }
  }

  const promise = fetcher()
    .then((data) => {
      cache.set(key, { data, timestamp: Date.now() })
      return data
    })
    .catch((err) => {
      cache.delete(key)
      throw err
    })

  cache.set(key, { data: entry?.data as T, timestamp: entry?.timestamp ?? 0, promise })

  return { data: entry?.data, promise }
}

// For events that signal the underlying data actually changed (e.g. a batch
// was just created elsewhere) — forces the next swrFetch for these key(s) to
// hit the network instead of serving a stale cached value.
export function invalidateSwrCache(keyPrefix: string) {
  for (const key of cache.keys()) {
    if (key.startsWith(keyPrefix)) cache.delete(key)
  }
}
