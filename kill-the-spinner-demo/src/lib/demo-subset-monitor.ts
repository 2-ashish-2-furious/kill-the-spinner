/**
 * Demo instrumentation: counts Electric **subset** requests.
 *
 * On slide S3 / S12 the presenter opens the browser network panel and points at
 * the requests that appear as the grid is scrolled and filtered. This module
 * mirrors that count into the page itself, so the audience can see it on the
 * projector without squinting at devtools — and so the presenter can prove that
 * scrolling triggers new subset requests while re-rendering does not.
 *
 * It wraps `fetch` for the demo collection only (via `shapeOptions.fetchClient`)
 * and counts requests carrying `subset__*` query params, which is exactly how the
 * Electric client itself identifies a snapshot/subset request.
 *
 * Read-only instrumentation: it never alters the request or the response.
 */

type Listener = () => void

export type SubsetStats = {
  /** Number of subset (snapshot) requests issued by the demo collection. */
  subsetRequests: number
  /** Number of ordinary shape-log requests (initial sync + long polls). */
  streamRequests: number
  /** Human-readable summary of the most recent subset request. */
  lastSubset: string | null
}

const listeners = new Set<Listener>()

let stats: SubsetStats = {
  subsetRequests: 0,
  streamRequests: 0,
  lastSubset: null,
}

function emit(next: SubsetStats) {
  stats = next
  listeners.forEach((listener) => listener())
}

export function subscribeToSubsetStats(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Stable snapshot for `useSyncExternalStore`. */
export function getSubsetStats(): SubsetStats {
  return stats
}

export function resetSubsetStats() {
  emit({ subsetRequests: 0, streamRequests: 0, lastSubset: null })
}

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === `string`) return input
  if (input instanceof URL) return input.toString()
  return input.url
}

function describeSubset(url: URL): string {
  const parts: Array<string> = []
  const where = url.searchParams.get(`subset__where`)
  const params = url.searchParams.get(`subset__params`)
  const orderBy = url.searchParams.get(`subset__order_by`)
  const limit = url.searchParams.get(`subset__limit`)
  const offset = url.searchParams.get(`subset__offset`)

  if (where) parts.push(`where ${where}`)
  if (params) parts.push(`params ${params}`)
  if (orderBy) parts.push(`order by ${orderBy}`)
  if (limit) parts.push(`limit ${limit}`)
  if (offset) parts.push(`offset ${offset}`)

  return parts.join(` · `) || `(no predicates)`
}

/**
 * Returns a `fetch` that counts subset requests before delegating.
 */
export function createSubsetCountingFetch(
  baseFetch: typeof fetch = globalThis.fetch.bind(globalThis)
): typeof fetch {
  return (input, init) => {
    try {
      const url = new URL(urlOf(input), globalThis.location?.origin)
      const isSubset = [...url.searchParams.keys()].some((key) =>
        key.startsWith(`subset__`)
      )

      if (isSubset) {
        emit({
          ...stats,
          subsetRequests: stats.subsetRequests + 1,
          lastSubset: describeSubset(url),
        })
      } else {
        emit({ ...stats, streamRequests: stats.streamRequests + 1 })
      }
    } catch {
      // Instrumentation must never break the request.
    }

    return baseFetch(input, init)
  }
}
