/**
 * =============================================================================
 * THE "AFTER" SCREEN AT SCALE — 500,000 rows, on-demand sync + OFFLINE (S3/S12)
 * =============================================================================
 *
 * Reads: Electric + `useLiveInfiniteQuery` ONLY, over a collection whose local
 *        replica is PERSISTED to browser SQLite (wa-sqlite + OPFS). No tRPC
 *        reads.
 * Writes: TanStack DB collection operations (optimistic) → tRPC → Postgres.
 *
 * What offline persistence adds on top of on-demand sync:
 *
 *  - First visit: the local SQLite DB is opened (a brief one-time init), then
 *    the grid fills from on-demand subset requests exactly as before.
 *  - Repeat visits / reload: the subsets you had already looked at are read
 *    straight from disk — instantly, and while OFFLINE. Only the rows you
 *    synced are there; on-demand never pulled the whole 500k, so neither does
 *    the local DB.
 *  - Go offline (Devtools → Network → Offline) and reload: previously-synced
 *    rows are still readable. Reconnecting resumes sync from the durable base.
 *
 * The collection is created asynchronously and client-only (OPFS lives in a Web
 * Worker), so this screen gates on `ensureDemoIssuesCollection()` before
 * rendering the grid — see `DemoLargePage` below. The route is `ssr: false`.
 *
 * Online optimistic writes still roll back if the server can't confirm them
 * (S15). Durable OFFLINE writes would additionally need
 * `@tanstack/offline-transactions`; this screen adds durable offline READS.
 */

import * as React from "react"
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"
import { createFileRoute } from "@tanstack/react-router"
import { and, eq, gt, ilike, useLiveInfiniteQuery } from "@tanstack/react-db"
import type { OfflineExecutor } from "@tanstack/offline-transactions"
import {
  DEMO_MUTATION_FN,
  ensureDemoIssuesCollection,
  type DemoIssuesCollection,
  type DemoIssuesHandle,
} from "@/lib/demo-collections"
import {
  getSubsetStats,
  resetSubsetStats,
  subscribeToSubsetStats,
} from "@/lib/demo-subset-monitor"
import ContentLayout from "@cloudscape-design/components/content-layout"
import Header from "@cloudscape-design/components/header"
import Container from "@cloudscape-design/components/container"
import Table from "@cloudscape-design/components/table"
import Input from "@cloudscape-design/components/input"
import Button from "@cloudscape-design/components/button"
import Checkbox from "@cloudscape-design/components/checkbox"
import Badge from "@cloudscape-design/components/badge"
import Box from "@cloudscape-design/components/box"
import SpaceBetween from "@cloudscape-design/components/space-between"
import ColumnLayout from "@cloudscape-design/components/column-layout"
import SegmentedControl from "@cloudscape-design/components/segmented-control"
import StatusIndicator from "@cloudscape-design/components/status-indicator"
import Alert from "@cloudscape-design/components/alert"
import Modal from "@cloudscape-design/components/modal"
import FormField from "@cloudscape-design/components/form-field"
import Pagination from "@cloudscape-design/components/pagination"

export const Route = createFileRoute(`/_authenticated/demo-large`)({
  component: DemoLargePage,
  // Client-only: the persisted collection opens an OPFS SQLite database in a
  // Web Worker, which does not exist during SSR.
  ssr: false,
})

const PAGE_SIZE = 50
// In Pages mode, keep this many pages synced ahead of the current one so paging
// forward is instant instead of showing a loading spinner.
const PREFETCH_PAGES = 5
type StatusFilter = `all` | `open` | `done`

/**
 * Reactive `navigator.onLine`. Drives the online/offline badge so the offline
 * beat is legible: flip Devtools to Offline and the header updates live.
 */
function subscribeOnline(callback: () => void) {
  window.addEventListener(`online`, callback)
  window.addEventListener(`offline`, callback)
  return () => {
    window.removeEventListener(`online`, callback)
    window.removeEventListener(`offline`, callback)
  }
}
function useOnlineStatus() {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true
  )
}

/**
 * Gate the grid on the async, client-only creation of the persisted collection.
 * The collection can't be a module-level singleton because opening the OPFS
 * database is asynchronous, so we resolve it here and hand the concrete instance
 * to `DemoLargeContent` (which then calls `useLiveInfiniteQuery` unconditionally,
 * keeping the Rules of Hooks intact).
 */
function DemoLargePage() {
  const online = useOnlineStatus()
  const [handle, setHandle] = useState<DemoIssuesHandle | null>(null)
  const [initError, setInitError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    ensureDemoIssuesCollection()
      .then((resolved) => {
        if (active) setHandle(resolved)
      })
      .catch((error: unknown) => {
        if (active) {
          setInitError(
            error instanceof Error ? error.message : String(error)
          )
        }
      })
    // The handle is a tab-lived singleton shared across mounts, so we do NOT
    // close it on unmount — only stop applying the result to this component.
    return () => {
      active = false
    }
  }, [])

  const header = (
    <Header
      variant="h1"
      actions={
        <SpaceBetween direction="horizontal" size="xs">
          <Badge color={online ? `green` : `red`}>
            {online ? `online` : `offline`}
          </Badge>
          <Badge color="blue">syncMode: on-demand</Badge>
          <Badge color="green">persisted: SQLite/OPFS</Badge>
        </SpaceBetween>
      }
      description={
        <>
          Reads come from a local replica persisted to browser SQLite via{` `}
          <Box variant="code" display="inline">
            useLiveInfiniteQuery
          </Box>
          . Subsets you have looked at survive reload and are readable offline.
        </>
      }
    >
      Demo · 500k issues, on-demand sync + offline
    </Header>
  )

  if (initError) {
    return (
      <ContentLayout header={header}>
        <Alert
          type="error"
          header="Could not open the local database"
          action={
            <Button onClick={() => window.location.reload()}>Reload</Button>
          }
        >
          The browser SQLite/OPFS persistence layer failed to initialise:{` `}
          {initError}. OPFS requires a modern browser; private-window and some
          embedded webviews block it.
        </Alert>
      </ContentLayout>
    )
  }

  if (!handle) {
    return (
      <ContentLayout header={header}>
        <Container>
          <Box padding="l" textAlign="center">
            <StatusIndicator type="loading">
              Opening the local SQLite database…
            </StatusIndicator>
          </Box>
        </Container>
      </ContentLayout>
    )
  }

  return (
    <DemoLargeContent
      collection={handle.collection}
      getOffline={handle.getOffline}
      online={online}
      header={header}
    />
  )
}

function DemoLargeContent({
  collection,
  getOffline,
  online,
  header,
}: {
  collection: DemoIssuesCollection
  getOffline: () => Promise<OfflineExecutor>
  online: boolean
  header: React.ReactNode
}) {
  const [searchInput, setSearchInput] = useState(``)
  const [search, setSearch] = useState(``)
  const [status, setStatus] = useState<StatusFilter>(`all`)
  const [newIssueText, setNewIssueText] = useState(``)
  const [writeError, setWriteError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<`scroll` | `pages`>(`pages`)
  const [page, setPage] = useState(0)
  const [showAddModal, setShowAddModal] = useState(false)

  // Debounce only so a filter is one subset request per phrase, not per keypress.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  // A filter change resets the query to its first subset, so return to page 1.
  useEffect(() => {
    setPage(0)
  }, [search, status])

  const stats = useSyncExternalStore(
    subscribeToSubsetStats,
    getSubsetStats,
    getSubsetStats
  )

  /**
   * The live query. `where` + `orderBy` + the paging window are pushed down to
   * Electric as subset params — this is the query-driven sync of S12. Rows land
   * in the persisted local replica, so a reload/offline read serves them from
   * SQLite instead of the network.
   *
   * An `orderBy` is REQUIRED: Electric rejects a subset request that carries a
   * limit/offset without an order.
   */
  const {
    data: issues,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useLiveInfiniteQuery(
    (q) =>
      q
        .from({ issues: collection })
        .where(({ issues: row }) => {
          // `gt(id, 0)` is an always-true base predicate so the optional
          // filters can be ANDed onto something without special-casing.
          const predicates = [gt(row.id, 0)]
          if (search) predicates.push(ilike(row.text, `%${search}%`))
          if (status !== `all`) {
            predicates.push(eq(row.completed, status === `done`))
          }
          return predicates.reduce((left, right) => and(left, right))
        })
        .orderBy(({ issues: row }) => row.id, `desc`),
    { pageSize: PAGE_SIZE },
    [search, status]
  )

  /**
   * Bounded gate for every auto `fetchNextPage`. WITHOUT this, going offline (or
   * any subset that returns no rows) turns the prefetch/scroll loop into a
   * runaway retry storm — hundreds of requests, hundreds of MB, and an
   * eventual out-of-memory crash — because `hasNextPage` stays true while
   * `issues.length` never advances. Guards:
   *   - offline: never auto-fetch (you can only read what is already local);
   *   - in-flight / no more pages: skip;
   *   - no progress: if the previous auto-fetch added zero rows, stop until the
   *     query identity or connectivity changes (the `stalled` breaker).
   */
  const lastTriggerLenRef = useRef(-1)
  const stalledRef = useRef(false)
  useEffect(() => {
    // Reset the breaker when the query changes or we come back online.
    stalledRef.current = false
    lastTriggerLenRef.current = -1
  }, [search, status, online])

  const maybeFetchNext = useCallback(() => {
    if (!online || !hasNextPage || isFetchingNextPage || stalledRef.current) {
      return
    }
    if (issues.length === lastTriggerLenRef.current) {
      // The previous trigger produced no new rows — stop hammering.
      stalledRef.current = true
      return
    }
    lastTriggerLenRef.current = issues.length
    fetchNextPage()
  }, [online, hasNextPage, isFetchingNextPage, issues.length, fetchNextPage])

  // Manual "Load more" / retry: clears the breaker and fetches once (still
  // requires connectivity). Lets the user re-arm auto-fetch after a stall.
  const retryFetch = useCallback(() => {
    stalledRef.current = false
    lastTriggerLenRef.current = issues.length
    if (online && hasNextPage && !isFetchingNextPage) fetchNextPage()
  }, [online, hasNextPage, isFetchingNextPage, issues.length, fetchNextPage])

  const onScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      const el = event.currentTarget
      const distanceFromBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight
      if (distanceFromBottom < 400) maybeFetchNext()
    },
    [maybeFetchNext]
  )

  /**
   * Pagination over the same on-demand query. Because the total is never
   * fetched in on-demand mode, pages are discovered as you go: paging past what
   * has been synced locally triggers the next subset request (openEnd), and
   * "Previous" is instant because those rows are already local.
   */
  const pagesLoaded = Math.max(1, Math.ceil(issues.length / PAGE_SIZE))
  const displayItems =
    viewMode === `pages`
      ? issues.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)
      : issues

  const goToPage = (nextPage: number) => {
    if ((nextPage + 1) * PAGE_SIZE > issues.length) maybeFetchNext()
    setPage(nextPage)
  }

  // Prefetch a buffer of pages ahead of the current one so paging forward
  // doesn't wait on a subset request. Bounded by `maybeFetchNext`, so it can
  // never loop when offline or when a subset stops returning rows.
  useEffect(() => {
    if (viewMode !== `pages`) return
    const rowsNeeded = (page + 1 + PREFETCH_PAGES) * PAGE_SIZE
    if (issues.length < rowsNeeded) maybeFetchNext()
  }, [viewMode, page, issues.length, maybeFetchNext])

  // The write executor is created lazily and OFF the read critical path (so the
  // grid paints on refresh without waiting for it). Warm it in the background
  // once mounted; writes await it, by which point it is ready.
  const [offline, setOffline] = useState<OfflineExecutor | null>(null)
  useEffect(() => {
    let active = true
    void getOffline().then((executor) => {
      if (active) setOffline(executor)
    })
    return () => {
      active = false
    }
  }, [getOffline])

  // Number of writes sitting in the durable outbox (persisted, not yet
  // confirmed by the server). Polled cheaply once the executor is ready; climbs
  // while offline, drains to 0 after reconnect as the executor replays them.
  const [pendingWrites, setPendingWrites] = useState(0)
  useEffect(() => {
    if (!offline) return
    let active = true
    const refresh = async () => {
      try {
        const pending = await offline.peekOutbox()
        if (active) setPendingWrites(pending.length)
      } catch {
        // ignore transient outbox read errors
      }
    }
    void refresh()
    const timer = setInterval(refresh, 1500)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [offline])

  /**
   * Every write goes through an offline transaction. While OFFLINE the mutation
   * is persisted to a durable outbox and left optimistically applied (the row
   * stays on screen); on reconnect the executor dispatches it to the server with
   * retry + backoff and Electric syncs the confirmed row back. `commit()` only
   * *rejects* on a permanent (`NonRetriableError`) failure — a genuine rollback
   * worth surfacing — so transient/offline failures no longer show an error.
   */
  const runWrite = useCallback(
    (mutate: () => void, what: string) => {
      setWriteError(null)
      void getOffline()
        .then((executor) => {
          const tx = executor.createOfflineTransaction({
            mutationFnName: DEMO_MUTATION_FN,
            autoCommit: false,
          })
          tx.mutate(mutate)
          return tx.commit()
        })
        .catch((error: unknown) => {
          setWriteError(
            `${what} was permanently rejected by the server and rolled back. (${
              error instanceof Error ? error.message : String(error)
            })`
          )
        })
    },
    [getOffline]
  )

  const addIssue = () => {
    const text = newIssueText.trim()
    if (!text) return
    // Optimistic insert. The temporary id is deliberately far above the
    // identity sequence so it cannot collide with a real row.
    runWrite(() => {
      collection.insert({
        id: 1_000_000_000 + Math.floor(Math.random() * 100_000_000),
        text,
        completed: false,
        created_at: new Date(),
        user_id: ``,
        project_id: 0,
        user_ids: [],
      })
    }, `Adding "${text}"`)
    setNewIssueText(``)
  }

  const toggle = (id: number, completed: boolean) => {
    runWrite(() => {
      collection.update(id, (draft) => {
        draft.completed = !completed
      })
    }, `Toggling issue ${id}`)
  }

  const remove = (id: number) => {
    runWrite(() => {
      collection.delete(id)
    }, `Deleting issue ${id}`)
  }

  const filterDescription = useMemo(() => {
    const parts: Array<string> = []
    if (search) parts.push(`text ILIKE '%${search}%'`)
    if (status !== `all`) parts.push(`completed = ${status === `done`}`)
    return parts.length ? parts.join(` AND `) : `(no filter — whole shape)`
  }, [search, status])

  return (
    <ContentLayout header={header}>
      <SpaceBetween size="l">
        {/* ---- live instrumentation ------------------------------------- */}
        <Container header={<Header variant="h2">Sync instrumentation</Header>}>
          <SpaceBetween size="m">
            <ColumnLayout columns={4} variant="text-grid">
              <div>
                <Box variant="awsui-key-label">Rows in local replica</Box>
                <Box variant="h2">{issues.length.toLocaleString()}</Box>
              </div>
              <div>
                <Box variant="awsui-key-label">Subset requests</Box>
                <Box variant="h2">{stats.subsetRequests.toString()}</Box>
              </div>
              <div>
                <Box variant="awsui-key-label">Stream requests</Box>
                <Box variant="h2">{stats.streamRequests.toString()}</Box>
              </div>
              <div
                style={{
                  display: `flex`,
                  alignItems: `flex-end`,
                }}
              >
                <div style={{ width: `180px` }}>
                  <SpaceBetween size="s">
                    <Button fullWidth onClick={resetSubsetStats}>
                      Reset counters
                    </Button>
                    <Button
                      fullWidth
                      variant="primary"
                      iconName="add-plus"
                      onClick={() => setShowAddModal(true)}
                    >
                      Add item
                    </Button>
                  </SpaceBetween>
                </div>
              </div>
            </ColumnLayout>

            <Box variant="code">
              <div>predicate pushed down: {filterDescription}</div>
              <div>last subset request: {stats.lastSubset ?? `—`}</div>
              <div>persisted to: browser SQLite (wa-sqlite / OPFS)</div>
              <div>outbox (pending writes): {pendingWrites}</div>
            </Box>

            {pendingWrites > 0 && (
              <StatusIndicator type={online ? `in-progress` : `pending`}>
                {pendingWrites} write{pendingWrites === 1 ? `` : `s`} queued in
                the durable outbox
                {online
                  ? ` — replaying to the server…`
                  : ` — will sync when you are back online`}
              </StatusIndicator>
            )}
          </SpaceBetween>
        </Container>

        {/* ---- filters + write path ------------------------------------- */}
        <Container>
          <SpaceBetween size="m">
            <div
              style={{
                display: `flex`,
                gap: `8px`,
                alignItems: `center`,
                flexWrap: `wrap`,
              }}
            >
              <div style={{ flex: 1, minWidth: `16rem` }}>
                <Input
                  type="search"
                  value={searchInput}
                  placeholder="Filter issues (try: critical)"
                  onChange={({ detail }) => setSearchInput(detail.value)}
                />
              </div>
              <SegmentedControl
                selectedId={status}
                onChange={({ detail }) =>
                  setStatus(detail.selectedId as StatusFilter)
                }
                options={[
                  { id: `all`, text: `All` },
                  { id: `open`, text: `Open` },
                  { id: `done`, text: `Done` },
                ]}
              />
            </div>

            {writeError && (
              <Alert
                type="error"
                dismissible
                onDismiss={() => setWriteError(null)}
                header="Write rolled back"
              >
                {writeError}
              </Alert>
            )}
          </SpaceBetween>
        </Container>

        {/* ---- the grid -------------------------------------------------- */}
        <Container
          header={
            <Header
              variant="h2"
              counter={
                hasNextPage
                  ? `(${issues.length.toLocaleString()}+)`
                  : `(${issues.length.toLocaleString()})`
              }
              description="Only the subsets you have scrolled or filtered into are held locally (and persisted)."
              actions={
                <SegmentedControl
                  selectedId={viewMode}
                  onChange={({ detail }) =>
                    setViewMode(detail.selectedId as `scroll` | `pages`)
                  }
                  options={[
                    { id: `pages`, text: `Pages` },
                    { id: `scroll`, text: `Scroll` },
                  ]}
                />
              }
            >
              Issues
            </Header>
          }
          footer={
            viewMode === `pages` ? (
              <Pagination
                currentPageIndex={page + 1}
                // Show at most 5 page numbers (a window ahead of the current
                // page); `openEnd` signals there are more beyond the window.
                pagesCount={Math.min(pagesLoaded, page + 5)}
                openEnd={hasNextPage || pagesLoaded > page + 5}
                onChange={({ detail }) => goToPage(detail.currentPageIndex - 1)}
              />
            ) : (
              <div
                style={{
                  display: `flex`,
                  gap: `12px`,
                  alignItems: `center`,
                }}
              >
                <Button
                  onClick={retryFetch}
                  disabled={!hasNextPage || isFetchingNextPage || !online}
                  loading={isFetchingNextPage}
                >
                  {isFetchingNextPage ? `Loading next subset…` : `Load more`}
                </Button>
                <Box variant="small" color="text-body-secondary">
                  {online
                    ? `Scrolling loads more automatically; this button is a stage fallback.`
                    : `Offline — only rows already in the local replica are available.`}
                </Box>
              </div>
            )
          }
        >
          <div
            onScroll={viewMode === `scroll` ? onScroll : undefined}
            style={{ height: `28rem`, overflowY: `auto` }}
          >
            <Table
              variant="embedded"
              stickyHeader
              wrapLines
              items={displayItems}
              trackBy="id"
              loading={
                viewMode === `pages` &&
                isFetchingNextPage &&
                displayItems.length === 0
              }
              loadingText="Loading page…"
              empty={
                <Box
                  textAlign="center"
                  color="text-body-secondary"
                  padding="l"
                >
                  Nothing matches this filter in the synced subset yet. If the
                  grid is empty on load, run{` `}
                  <Box variant="code" display="inline">
                    pnpm seed:large
                  </Box>
                  .
                </Box>
              }
              columnDefinitions={[
                {
                  id: `done`,
                  header: `Done`,
                  width: 70,
                  minWidth: 70,
                  cell: (issue) => (
                    <Checkbox
                      checked={issue.completed}
                      ariaLabel={`Toggle issue ${issue.id}`}
                      onChange={() => toggle(issue.id, issue.completed)}
                    />
                  ),
                },
                {
                  id: `id`,
                  header: `ID`,
                  width: 100,
                  cell: (issue) => (
                    <Box variant="code" color="text-body-secondary">
                      {issue.id}
                    </Box>
                  ),
                },
                {
                  id: `issue`,
                  header: `Issue`,
                  minWidth: 320,
                  isRowHeader: true,
                  cell: (issue) => (
                    <span
                      style={
                        issue.completed
                          ? {
                              textDecoration: `line-through`,
                              color: `var(--color-text-body-secondary, #5f6b7a)`,
                            }
                          : undefined
                      }
                    >
                      {issue.text}
                    </span>
                  ),
                },
                {
                  id: `status`,
                  header: `Status`,
                  width: 110,
                  cell: (issue) => (
                    <StatusIndicator
                      type={issue.completed ? `success` : `pending`}
                    >
                      {issue.completed ? `Done` : `Open`}
                    </StatusIndicator>
                  ),
                },
                {
                  id: `created`,
                  header: `Created`,
                  width: 160,
                  cell: (issue) => (
                    <Box variant="samp" color="text-body-secondary">
                      {issue.created_at instanceof Date
                        ? issue.created_at
                            .toISOString()
                            .slice(0, 16)
                            .replace(`T`, ` `)
                        : String(issue.created_at)}
                    </Box>
                  ),
                },
                {
                  id: `actions`,
                  header: ``,
                  width: 60,
                  cell: (issue) => (
                    <Button
                      variant="icon"
                      iconName="remove"
                      ariaLabel={`Delete issue ${issue.id}`}
                      onClick={() => remove(issue.id)}
                    />
                  ),
                },
              ]}
            />
          </div>
        </Container>

        {/* ---- offline read helper --------------------------------------- */}
        <Alert type="info" header="Try offline reads">
          <ol style={{ margin: 0, paddingLeft: `1.25rem` }}>
            <li>Scroll / filter to sync some subsets into the local replica.</li>
            <li>Devtools → Network → Offline.</li>
            <li>
              Reload the page. The subsets you had are read back from SQLite and
              the grid still works — no network. The header badge flips to{` `}
              <strong>offline</strong>.
            </li>
          </ol>
        </Alert>

        {/* ---- S15 helper: durable offline writes ------------------------ */}
        <Alert type="warning" header="S15 · offline writes queue and replay">
          <SpaceBetween size="xs">
            <ol style={{ margin: 0, paddingLeft: `1.25rem` }}>
              <li>Devtools → Network → Offline (the header badge flips to{` `}
                <strong>offline</strong>).
              </li>
              <li>
                Add / toggle / delete. The change stays applied — it is written
                to a durable outbox (IndexedDB), not rolled back. The{` `}
                <Box variant="code" display="inline">
                  outbox (pending writes)
                </Box>
                {` `}counter above goes up.
              </li>
              <li>
                Reload while still offline — the queued writes persist (they are
                in the outbox, not just React state).
              </li>
              <li>
                Devtools → Network → No throttling. The executor replays the
                outbox to the server with retry + backoff and the counter drains
                back to 0.
              </li>
            </ol>
            <Box>
              Powered by{` `}
              <Box variant="code" display="inline">
                @tanstack/offline-transactions
              </Box>
              . A permanently-rejected write (a{` `}
              <Box variant="code" display="inline">
                NonRetriableError
              </Box>
              {` `}from the server) is the only case that still rolls back and
              shows an error.
            </Box>
          </SpaceBetween>
        </Alert>

        <Modal
          visible={showAddModal}
          onDismiss={() => setShowAddModal(false)}
          header="Add item"
          footer={
            <Box float="right">
              <SpaceBetween direction="horizontal" size="xs">
                <Button variant="link" onClick={() => setShowAddModal(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  disabled={!newIssueText.trim()}
                  onClick={() => {
                    addIssue()
                    setShowAddModal(false)
                  }}
                >
                  Add
                </Button>
              </SpaceBetween>
            </Box>
          }
        >
          <FormField label="Issue text">
            <Input
              value={newIssueText}
              autoFocus
              placeholder="New issue (optimistic — appears before the server replies)"
              onChange={({ detail }) => setNewIssueText(detail.value)}
              onKeyDown={({ detail }) => {
                if (detail.key === `Enter` && newIssueText.trim()) {
                  addIssue()
                  setShowAddModal(false)
                }
              }}
            />
          </FormField>
        </Modal>
      </SpaceBetween>
    </ContentLayout>
  )
}
