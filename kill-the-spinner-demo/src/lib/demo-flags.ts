/**
 * =============================================================================
 * DEMO-ONLY FEATURE FLAGS — for the conference talk, not for production use
 * =============================================================================
 *
 * Everything in this file is inert unless a demo flag is explicitly switched on.
 * With no flags set, `withDemoRollbackDelay()` returns the handler you passed it
 * **by identity** — there is no wrapper, no try/catch, no extra await. Normal
 * app behaviour is therefore provably unchanged.
 *
 * ---------------------------------------------------------------------------
 * Flag: DEMO_SLOW_ROLLBACK  (default: OFF)
 * ---------------------------------------------------------------------------
 * Slide S15 has the presenter go offline, write a record, and let the audience
 * watch the optimistic row appear and then vanish when the write fails. In real
 * time the rollback happens as soon as the fetch rejects — often too fast for a
 * room to register. This flag holds the failure for ~2s so the optimistic row
 * stays on screen long enough to be seen, and only *then* rolls back.
 *
 * It does not fake success and it does not change which writes fail. It delays
 * the rejection of an already-failed write, nothing else.
 *
 * How to switch it on, in order of precedence:
 *
 *   1. Per-session, no restart needed — in the browser console:
 *        localStorage.setItem('demo:slowRollback', 'true'); location.reload()
 *        localStorage.removeItem('demo:slowRollback'); location.reload()
 *   2. Per-page — append `?slowRollback=1` to the URL (`?slowRollback=0` off).
 *   3. For the whole dev server — in `.env`:
 *        DEMO_SLOW_ROLLBACK=true
 *        DEMO_ROLLBACK_DELAY_MS=2000    # optional, defaults to 2000
 *      (`DEMO_` is exposed to the client bundle via `envPrefix` in
 *      vite.config.ts. Requires a dev-server restart.)
 *
 * The flag is read once at module load, which is what allows the no-flag path to
 * be a true no-op. That is why options 1 and 2 ask for a reload.
 */

const DEFAULT_ROLLBACK_DELAY_MS = 2000
const DEFAULT_BEFORE_LATENCY_MS = 1000

const LOCAL_STORAGE_KEY = `demo:slowRollback`
const QUERY_PARAM = `slowRollback`

function isTruthy(value: unknown): boolean {
  if (value === true) return true
  if (typeof value !== `string`) return false
  const normalized = value.trim().toLowerCase()
  return normalized === `true` || normalized === `1` || normalized === `yes`
}

function readNumericEnv(key: string, fallback: number): number {
  const raw = import.meta.env[key]
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

/** Build-time / dev-server env flag. */
function readEnvFlag(): boolean {
  return (
    isTruthy(import.meta.env.DEMO_SLOW_ROLLBACK) ||
    isTruthy(import.meta.env.VITE_DEMO_SLOW_ROLLBACK)
  )
}

/** Per-session browser override. Returns undefined when not specified. */
function readRuntimeOverride(): boolean | undefined {
  if (typeof window === `undefined`) return undefined

  try {
    const fromQuery = new URL(window.location.href).searchParams.get(
      QUERY_PARAM
    )
    if (fromQuery !== null) return isTruthy(fromQuery) || fromQuery === ``

    const stored = window.localStorage.getItem(LOCAL_STORAGE_KEY)
    if (stored !== null) return isTruthy(stored)
  } catch {
    // Private-mode localStorage, exotic URL — fall through to the env flag.
  }
  return undefined
}

/**
 * Resolved once, at module load. See the note above about why.
 */
export const DEMO_SLOW_ROLLBACK: boolean =
  readRuntimeOverride() ?? readEnvFlag()

/** How long a failed write is held on screen before it rolls back. */
export const DEMO_ROLLBACK_DELAY_MS: number = readNumericEnv(
  `DEMO_ROLLBACK_DELAY_MS`,
  DEFAULT_ROLLBACK_DELAY_MS
)

/**
 * Simulated network latency for the deliberately-slow "before" screen (S2).
 * Only ever read by `src/routes/_authenticated/demo-before/*`.
 */
export const DEMO_BEFORE_LATENCY_MS: number = readNumericEnv(
  `DEMO_BEFORE_LATENCY_MS`,
  DEFAULT_BEFORE_LATENCY_MS
)

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Wraps a TanStack DB mutation handler (`onInsert` / `onUpdate` / `onDelete`) so
 * that a REJECTED write is held for `DEMO_ROLLBACK_DELAY_MS` before the error
 * propagates. TanStack DB rolls the optimistic state back when the handler
 * rejects, so delaying the rejection delays the rollback — the row stays
 * visible, then disappears.
 *
 * Successful writes are never delayed.
 *
 * When the flag is off this returns `handler` itself, so wrapping a handler
 * costs literally nothing in normal operation.
 */
export function withDemoRollbackDelay<TParams, TResult>(
  handler: (params: TParams) => Promise<TResult>
): (params: TParams) => Promise<TResult> {
  if (!DEMO_SLOW_ROLLBACK) return handler

  return async (params: TParams) => {
    try {
      return await handler(params)
    } catch (error) {
      console.warn(
        `[demo] write failed — holding the optimistic row for ${DEMO_ROLLBACK_DELAY_MS}ms before rolling back (DEMO_SLOW_ROLLBACK is on)`,
        error
      )
      await sleep(DEMO_ROLLBACK_DELAY_MS)
      throw error
    }
  }
}
