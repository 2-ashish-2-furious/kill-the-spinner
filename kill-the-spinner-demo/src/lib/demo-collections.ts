/**
 * TanStack DB collection for the large seeded demo dataset (S3 / S12 / App. B2),
 * now with OFFLINE persistence (TanStack DB 0.6+ SQLite-backed local state).
 *
 * Two things stack here:
 *
 *   syncMode: `on-demand`     — only the subsets a live query asks for are pulled
 *                               from Electric (query-driven sync of S12).
 *   persistedCollectionOptions — wraps that synced collection with a durable
 *                               local base in browser SQLite (wa-sqlite + OPFS).
 *
 * The composition is the point: on-demand keeps the working set small, and
 * persistence makes that working set survive a reload and be readable OFFLINE.
 * Only the subsets you looked at are persisted, so an offline reload gives back
 * exactly the rows you had synced — nothing more. The Postgres/Electric side
 * remains the source of truth; the local SQLite copy is a durable cache that
 * reconciles on reconnect.
 *
 * WHY THIS FILE IS ASYNC / CLIENT-ONLY
 * ------------------------------------
 * `openBrowserWASQLiteOPFSDatabase` opens a SQLite database inside a dedicated
 * Web Worker over OPFS — it is asynchronous and exists only in the browser.
 * So the collection cannot be created at module load the way the eager
 * collections in `collections.ts` are. Instead we expose an async, memoised
 * `ensureDemoIssuesCollection()` that:
 *   - is a no-op / rejects on the server (guarded on `window`),
 *   - dynamically imports the browser persistence package so none of its
 *     worker/WASM code is pulled into the server bundle,
 *   - returns a single shared handle for the life of the tab.
 * The `/demo-large` route is `ssr: false`, and its component awaits this handle
 * before rendering the grid.
 *
 * Verified against the installed packages:
 *   - `@tanstack/electric-db-collection@0.4.10` → `syncMode?: 'eager' | 'on-demand'
 *     | 'progressive'` (electric.d.ts), returns a config carrying `sync`.
 *   - `@tanstack/db-sqlite-persistence-core@0.2.23`: the sync-wrapped overload of
 *     `persistedCollectionOptions` is `CollectionConfig & { sync, persistence,
 *     schemaVersion? }` — so spreading the electric options and adding
 *     `persistence` + `schemaVersion` selects it.
 *   - Browser adapter: `@tanstack/browser-db-sqlite-persistence@0.2.23`.
 *
 * Live queries against this collection MUST still carry an `orderBy` (Electric
 * rejects a subset request with a limit/offset but no order), and the ordered
 * `BTreeIndex` below is required for efficient lazy subset loading.
 */

import { BTreeIndex, createCollection } from "@tanstack/react-db"
import type { Collection, CollectionConfig } from "@tanstack/react-db"
import { electricCollectionOptions } from "@tanstack/electric-db-collection"
import type { OfflineExecutor } from "@tanstack/offline-transactions"
import { selectTodoSchema, type Todo } from "@/db/schema"
import { trpc } from "@/lib/trpc-client"
import { withDemoRollbackDelay } from "@/lib/demo-flags"
import { createSubsetCountingFetch } from "@/lib/demo-subset-monitor"

function shapeUrl(path: string) {
  return new URL(
    path,
    typeof window !== `undefined`
      ? window.location.origin
      : `http://localhost:5173`
  ).toString()
}

/**
 * Bump to invalidate the persisted local copy. For a SYNCED collection, changing
 * `schemaVersion` clears the on-disk rows and triggers a fresh re-sync from the
 * server (rather than silently reading a stale/incompatible local shape).
 */
const DEMO_ISSUES_SCHEMA_VERSION = 1

/** OPFS database file name. Namespaced/versioned so a reset is a clean swap. */
const OPFS_DATABASE_NAME = `demo-issues-v1.sqlite`

/**
 * Name of the offline mutation function registered with the offline executor.
 * Writes are dispatched through this (batched) rather than through the
 * collection's own onInsert/onUpdate/onDelete, so they can be queued in a
 * durable outbox while offline and replayed on reconnect. See DEMO_MUTATION_FN
 * usage in `createDemoIssuesCollection`.
 */
export const DEMO_MUTATION_FN = `syncDemoIssues`

/**
 * The Electric side of the collection: on-demand, instrumented, with the same
 * optimistic tRPC write handlers as before. Returned as a plain options object
 * so it can be spread into `persistedCollectionOptions`.
 */
function demoIssuesElectricOptions() {
  return electricCollectionOptions({
    id: `demo-issues`,

    // ---- the one line the on-demand demo is about --------------------------
    syncMode: `on-demand`,
    // -----------------------------------------------------------------------

    shapeOptions: {
      url: shapeUrl(`/api/demo-issues`),
      parser: {
        timestamptz: (date: string) => new Date(date),
      },
      // Demo instrumentation only: counts subset requests for the on-screen
      // badge. Does not modify requests or responses.
      fetchClient: createSubsetCountingFetch(),
    },
    schema: selectTodoSchema,
    getKey: (item) => item.id,

    // Mutation handlers are wrapped with `withDemoRollbackDelay`, which is the
    // IDENTITY function unless DEMO_SLOW_ROLLBACK is on. See demo-flags.ts.
    // NOTE: these are online optimistic writes — a write attempted while offline
    // still rolls back (S15). Durable offline WRITES would additionally need
    // `@tanstack/offline-transactions`; this change adds durable offline READS.
    onInsert: withDemoRollbackDelay(async ({ transaction }) => {
      const { modified } = transaction.mutations[0]
      const result = await trpc.demoIssues.create.mutate({
        text: modified.text,
        completed: modified.completed,
      })
      return { txid: result.txid }
    }),

    onUpdate: withDemoRollbackDelay(async ({ transaction }) => {
      const { modified } = transaction.mutations[0]
      const result = await trpc.demoIssues.update.mutate({
        id: modified.id,
        data: {
          text: modified.text,
          completed: modified.completed,
        },
      })
      return { txid: result.txid }
    }),

    onDelete: withDemoRollbackDelay(async ({ transaction }) => {
      const { original } = transaction.mutations[0]
      const result = await trpc.demoIssues.delete.mutate({ id: original.id })
      return { txid: result.txid }
    }),
  })
}

export type DemoIssuesCollection = Collection<Todo, number>

export type DemoIssuesHandle = {
  collection: DemoIssuesCollection
  /**
   * Offline transaction executor. Create writes with
   * `offline.createOfflineTransaction({ mutationFnName: DEMO_MUTATION_FN })`,
   * `tx.mutate(() => collection.insert(...))`, then `tx.commit()`. While
   * offline the transaction is persisted to a durable outbox and stays
   * optimistically applied; on reconnect the executor dispatches it to the
   * server (with retry/backoff) and reconciles via Electric sync.
   */
  getOffline: () => Promise<OfflineExecutor>
  /** Tears down the OPFS worker + coordinator + offline executor. Not called on
   *  unmount — the handle is a tab-lived singleton — but exported for tests. */
  close: () => Promise<void>
}

let handlePromise: Promise<DemoIssuesHandle> | null = null

/**
 * Create (once per tab) the persisted + synced on-demand collection.
 *
 * Browser-only: rejects on the server. The browser persistence package is
 * imported dynamically so its Web Worker / WASM code never enters the server
 * bundle. Multi-tab safe via `BrowserCollectionCoordinator` (Web Locks leader
 * election + BroadcastChannel), which also prevents OPFS access-handle
 * contention when the demo opens a second window side by side (S12/S15).
 */
export function ensureDemoIssuesCollection(): Promise<DemoIssuesHandle> {
  if (typeof window === `undefined`) {
    return Promise.reject(
      new Error(`ensureDemoIssuesCollection is browser-only (needs OPFS)`)
    )
  }
  if (!handlePromise) {
    handlePromise = createDemoIssuesCollection().catch((error) => {
      // Reset so a later mount can retry (e.g. after a transient OPFS failure).
      handlePromise = null
      throw error
    })
  }
  return handlePromise
}

async function createDemoIssuesCollection(): Promise<DemoIssuesHandle> {
  const {
    BrowserCollectionCoordinator,
    createBrowserWASQLitePersistence,
    openBrowserWASQLiteOPFSDatabase,
    persistedCollectionOptions,
  } = await import(`@tanstack/browser-db-sqlite-persistence`)

  const database = await openBrowserWASQLiteOPFSDatabase({
    databaseName: OPFS_DATABASE_NAME,
  })
  const coordinator = new BrowserCollectionCoordinator({
    dbName: `demo-issues`,
  })
  const persistence = createBrowserWASQLitePersistence({
    database,
    coordinator,
  })

  // `persistedCollectionOptions` (sync-wrapped) and `createCollection` come from
  // separately-versioned packages whose generics don't line up on the drizzle-zod
  // `schema` type, even though the runtime composition is the documented path
  // (persisted options are made to feed createCollection). We assert the options
  // to a plain `CollectionConfig` at this single boundary; the runtime object is
  // unchanged (it still carries `persistence`), and the row type stays enforced
  // via the `DemoIssuesCollection` annotation, so all downstream usage is typed.
  const collection: DemoIssuesCollection = createCollection(
    persistedCollectionOptions({
      ...demoIssuesElectricOptions(),
      persistence,
      schemaVersion: DEMO_ISSUES_SCHEMA_VERSION,
    }) as unknown as CollectionConfig<Todo, number>
  )

  // Ordered index for lazy subset loading (see file header) + the grid's
  // `completed` filter. Without the ordered index TanStack DB warns and falls
  // back to loading all rows — which on 500k rows is the failure this avoids.
  collection.createIndex((row) => row.id, {
    name: `demo-issues-id`,
    indexType: BTreeIndex,
  })
  collection.createIndex((row) => row.completed, {
    name: `demo-issues-completed`,
    indexType: BTreeIndex,
  })

  // ---- durable offline WRITES (OFF the read critical path) --------------
  // The offline executor owns an IndexedDB (localStorage fallback) outbox and
  // its own leader election. Writes go through `DEMO_MUTATION_FN` (batched per
  // transaction). Offline → persisted to the outbox and left optimistically
  // applied; online/reconnect → dispatched to the server with retry+backoff.
  //
  // Crucially this is created LAZILY: `ensureDemoIssuesCollection` resolves as
  // soon as the SQLite DB + collection are ready, so reads paint immediately on
  // refresh. The executor (its own dynamic import + IndexedDB open) is only
  // spun up on first `getOffline()` — the component warms it in the background
  // and every write awaits it, by which point it is ready.
  let offlinePromise: Promise<OfflineExecutor> | null = null
  const getOffline = () => {
    if (!offlinePromise) {
      offlinePromise = import(`@tanstack/offline-transactions`).then(
        ({ startOfflineExecutor }) =>
          startOfflineExecutor({
            collections: { demoIssues: collection },
            mutationFns: {
              [DEMO_MUTATION_FN]: async ({ transaction }) => {
                for (const mutation of transaction.mutations) {
                  if (mutation.type === `insert`) {
                    const row = mutation.modified as Todo
                    await trpc.demoIssues.create.mutate({
                      text: row.text,
                      completed: row.completed,
                    })
                  } else if (mutation.type === `update`) {
                    const row = mutation.modified as Todo
                    await trpc.demoIssues.update.mutate({
                      id: row.id,
                      data: { text: row.text, completed: row.completed },
                    })
                  } else if (mutation.type === `delete`) {
                    const row = mutation.original as Todo
                    await trpc.demoIssues.delete.mutate({ id: row.id })
                  }
                }
              },
            },
          })
      )
    }
    return offlinePromise
  }

  return {
    collection,
    getOffline,
    close: async () => {
      if (offlinePromise) (await offlinePromise).dispose()
      coordinator.dispose()
      await database.close?.()
    },
  }
}
