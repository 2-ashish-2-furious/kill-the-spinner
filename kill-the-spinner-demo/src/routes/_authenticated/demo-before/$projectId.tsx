/**
 * =============================================================================
 * ⚠️  DELIBERATE ANTI-PATTERN — THIS FILE IS SUPPOSED TO BE LIKE THIS
 * =============================================================================
 *
 * DO NOT "FIX" THIS ROUTE. DO NOT MIGRATE IT TO ELECTRIC. DO NOT DELETE THE
 * SPINNER.
 *
 * `AGENTS.md` says: "NEVER use tRPC for data reads — only Electric SQL +
 * useLiveQuery", and "ALWAYS preload collections in route loaders". This route
 * breaks both rules on purpose. It is slide **S2** of the conference talk
 * "Local-First: Kill the Spinner" — the *before* screen that the sync-based
 * version (S3) is contrasted against. The contrast is the argument, so the
 * baseline has to be a real, honestly-built, fetch-and-spinner app:
 *
 *   - fetch on mount (`useEffect`), with a visible loading spinner
 *   - a loading branch in render (`isLoading ? spinner : rows`)
 *   - server-side filtering and pagination — every interaction is a round trip
 *   - refetch/invalidate after EVERY edit, so rows re-sort and jump
 *   - no optimistic updates anywhere
 *
 * It renders the same rows as the sync-based project view, from the same table,
 * through `trpc.demoBefore.*` (see `src/lib/trpc/demo-before.ts`).
 *
 * TWO READ SHAPES, BOTH THE OLD WAY: this route offers a "Pages" view (server
 * offset pagination) and a "Scroll" view (infinite scroll). BOTH are still
 * request/response reads over tRPC — the Scroll view fetches the next page from
 * the server as you reach the bottom and shows a spinner while it waits. That
 * is the point: infinite scroll does not make the network go away; it just
 * moves the spinner to the bottom of the list. S3 (`/demo-large`) is the
 * contrast, where the same scroll reads from the local replica with no round
 * trip.
 *
 * NOTE ON STYLING: the chrome here uses the same Cloudscape components as the
 * `/demo-large` "after" screen so the two are visually comparable. Only the
 * *behaviour* is the anti-pattern — the spinner on every interaction, the
 * server round trips, the pagination and the refetch-after-edit are all still
 * here on purpose. Do not remove them.
 *
 * Scope of the exception:
 *   - Confined to `src/routes/_authenticated/demo-before/*` + that one router.
 *   - The existing sync-based routes were NOT modified to accommodate it.
 *   - Nothing here is imported by production code.
 *
 * The "simulated latency" control is honest stagecraft: on a local Postgres a
 * small project answers in ~2ms, so the spinner would flash invisibly and the
 * audience would miss the point. It adds a fixed client-side delay to make the
 * wait perceptible — the presenter should say so, and can set it to 0 to show
 * the un-padded truth. On the 500k-row project no padding is needed: the
 * round trips are genuinely slow.
 */

import * as React from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { trpc } from "@/lib/trpc-client"
import { DEMO_BEFORE_LATENCY_MS, sleep } from "@/lib/demo-flags"
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
import Spinner from "@cloudscape-design/components/spinner"
import Alert from "@cloudscape-design/components/alert"
import Modal from "@cloudscape-design/components/modal"
import FormField from "@cloudscape-design/components/form-field"
import Select, {
  type SelectProps,
} from "@cloudscape-design/components/select"
import Pagination from "@cloudscape-design/components/pagination"

export const Route = createFileRoute(`/_authenticated/demo-before/$projectId`)({
  component: DemoBeforePage,
  ssr: false,
  // NOTE: deliberately NO loader / NO collection preload. The data is fetched by
  // the component after it mounts, which is what produces the first spinner.
})

const PAGE_SIZE = 50
type StatusFilter = `all` | `open` | `done`
type ViewMode = `pages` | `scroll`

const LATENCY_OPTIONS: Array<SelectProps.Option> = [
  { value: `0`, label: `0 ms — no delay (real local latency)` },
  { value: `400`, label: `400 ms — typical office Wi-Fi` },
  { value: `1000`, label: `1000 ms — slow / conference Wi-Fi` },
]

/**
 * Note the `created_at: string`. Over JSON the timestamp arrives as text and the
 * component has to re-hydrate it — a small tax the sync path does not pay,
 * because the Electric collection has a `parser` that produces real `Date`s
 * before the data ever reaches a component.
 */
type BeforeIssue = {
  id: number
  text: string
  completed: boolean
  created_at: string
  user_id: string
  project_id: number
  user_ids: Array<string>
}

function DemoBeforePage() {
  const { projectId } = Route.useParams()
  const navigate = useNavigate()
  const numericProjectId = parseInt(projectId, 10)

  const [items, setItems] = useState<Array<BeforeIssue>>([])
  const [projectName, setProjectName] = useState(``)
  const [total, setTotal] = useState(0)

  // `isLoading` gates a full (replacing) load — the classic before spinner.
  // `isLoadingMore` gates a scroll append — a spinner at the bottom of the list.
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [searchInput, setSearchInput] = useState(``)
  const [search, setSearch] = useState(``)
  const [status, setStatus] = useState<StatusFilter>(`all`)
  const [page, setPage] = useState(0)
  const [viewMode, setViewMode] = useState<ViewMode>(`pages`)

  const [latency, setLatency] = useState(DEMO_BEFORE_LATENCY_MS)
  const [requestCount, setRequestCount] = useState(0)
  const [lastDurationMs, setLastDurationMs] = useState<number | null>(null)
  const [newText, setNewText] = useState(``)
  const [showAddModal, setShowAddModal] = useState(false)

  // A ref mirror of `items` so the scroll handler can read the current length
  // without being recreated (and re-firing the mount effect) on every append.
  const itemsRef = useRef<Array<BeforeIssue>>([])
  itemsRef.current = items

  /**
   * THE ANTI-PATTERN, in one function: a request/response read the UI waits for,
   * re-run from scratch on every filter change, page turn, mode switch and edit.
   * In Pages mode it fetches the current page; in Scroll mode it (re)starts the
   * list from the top.
   */
  const loadInitial = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    const startedAt = performance.now()
    try {
      if (latency > 0) await sleep(latency)
      const offset = viewMode === `scroll` ? 0 : page * PAGE_SIZE
      const result = await trpc.demoBefore.listIssues.query({
        project_id: numericProjectId,
        search,
        status,
        limit: PAGE_SIZE,
        offset,
      })
      setItems(result.items as Array<BeforeIssue>)
      setTotal(result.total)
      setProjectName(result.project.name)
      setLastDurationMs(Math.round(performance.now() - startedAt))
      setRequestCount((count) => count + 1)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setIsLoading(false)
    }
  }, [numericProjectId, search, status, page, latency, viewMode])

  // Fetch on mount, and again whenever any input to the query changes.
  useEffect(() => {
    void loadInitial()
  }, [loadInitial])

  /**
   * Scroll mode's "fetch the next page" — another server round trip, appended to
   * the list, with a spinner at the bottom while it is in flight.
   */
  const loadMore = useCallback(async () => {
    const offset = itemsRef.current.length
    if (total > 0 && offset >= total) return
    setIsLoadingMore(true)
    setError(null)
    const startedAt = performance.now()
    try {
      if (latency > 0) await sleep(latency)
      const result = await trpc.demoBefore.listIssues.query({
        project_id: numericProjectId,
        search,
        status,
        limit: PAGE_SIZE,
        offset,
      })
      setItems((prev) => [...prev, ...(result.items as Array<BeforeIssue>)])
      setTotal(result.total)
      setLastDurationMs(Math.round(performance.now() - startedAt))
      setRequestCount((count) => count + 1)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setIsLoadingMore(false)
    }
  }, [numericProjectId, search, status, latency, total])

  const onScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      if (viewMode !== `scroll`) return
      const el = event.currentTarget
      const distanceFromBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight
      const hasMore = total === 0 || itemsRef.current.length < total
      if (distanceFromBottom < 200 && !isLoading && !isLoadingMore && hasMore) {
        void loadMore()
      }
    },
    [viewMode, isLoading, isLoadingMore, total, loadMore]
  )

  const applySearch = () => {
    setPage(0)
    setSearch(searchInput.trim())
  }

  const toggle = async (item: BeforeIssue) => {
    await trpc.demoBefore.setCompleted.mutate({
      id: item.id,
      completed: !item.completed,
    })
    // Invalidate + refetch. No optimistic update: the checkbox does not move
    // until the server has answered twice, and the list resets to the top.
    await loadInitial()
  }

  const create = async () => {
    const text = newText.trim()
    if (!text) return
    await trpc.demoBefore.createIssue.mutate({
      project_id: numericProjectId,
      text,
    })
    setNewText(``)
    await loadInitial()
  }

  const maxPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1)
  const allLoaded = total > 0 && items.length >= total

  return (
    <ContentLayout
      header={
        <Header
          variant="h1"
          actions={
            <SpaceBetween direction="horizontal" size="s">
              <Button
                variant="inline-link"
                iconAlign="right"
                iconName="arrow-right"
                onClick={() => navigate({ to: `/demo-large` })}
              >
                Now show the same data the other way
              </Button>
              <Badge color="red">
                fetch on mount · refetch after every edit
              </Badge>
            </SpaceBetween>
          }
          description="Same table, same rows, built the way we all build them. Count the waits."
        >
          {projectName || `Project ${projectId}`} · the old way
        </Header>
      }
    >
      <SpaceBetween size="l">
        {/* ---- round-trip instrumentation ------------------------------- */}
        <Container
          header={
            <Header
              variant="h2"
              actions={
                <Button
                  variant="primary"
                  iconName="add-plus"
                  onClick={() => setShowAddModal(true)}
                >
                  Add item
                </Button>
              }
            >
              Round trips
            </Header>
          }
        >
          <ColumnLayout columns={4} variant="text-grid">
            <div>
              <Box variant="awsui-key-label">Rows loaded</Box>
              <Box variant="h2">{items.length.toLocaleString()}</Box>
            </div>
            <div>
              <Box variant="awsui-key-label">Total (server count)</Box>
              <Box variant="h2">{total.toLocaleString()}</Box>
            </div>
            <div>
              <Box variant="awsui-key-label">Round trips so far</Box>
              <Box variant="h2">{requestCount.toString()}</Box>
            </div>
            <div>
              <Box variant="awsui-key-label">Last request</Box>
              <Box variant="h2">
                {lastDurationMs === null ? `—` : `${lastDurationMs} ms`}
              </Box>
            </div>
          </ColumnLayout>
        </Container>

        {/* ---- controls + write path ------------------------------------ */}
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
              <Box variant="awsui-key-label">Simulated network latency</Box>
              <Select
                selectedOption={
                  LATENCY_OPTIONS.find(
                    (option) => option.value === String(latency)
                  ) ?? LATENCY_OPTIONS[0]
                }
                options={LATENCY_OPTIONS}
                onChange={({ detail }) =>
                  setLatency(Number(detail.selectedOption.value))
                }
              />
              <Box variant="small" color="text-body-secondary">
                Adds an artificial delay to every server round trip so the
                loading spinner is easy to see during the demo. Choose 0 ms to
                reveal the real local latency.
              </Box>
            </div>

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
                  placeholder="Filter issues, then press Enter (server round trip)"
                  onChange={({ detail }) => setSearchInput(detail.value)}
                  onKeyDown={({ detail }) => {
                    if (detail.key === `Enter`) applySearch()
                  }}
                />
              </div>
              <Button onClick={applySearch}>Apply filter</Button>
              <SegmentedControl
                selectedId={status}
                onChange={({ detail }) => {
                  setPage(0)
                  setStatus(detail.selectedId as StatusFilter)
                }}
                options={[
                  { id: `all`, text: `All` },
                  { id: `open`, text: `Open` },
                  { id: `done`, text: `Done` },
                ]}
              />
            </div>

            {error && (
              <Alert type="error" header="Request failed">
                {error}
              </Alert>
            )}
          </SpaceBetween>
        </Container>

        {/* ---- the grid (with the spinner S3 deletes) ------------------- */}
        <Container
          header={
            <Header
              variant="h2"
              counter={`(${total.toLocaleString()})`}
              actions={
                <SegmentedControl
                  selectedId={viewMode}
                  onChange={({ detail }) => {
                    setPage(0)
                    setViewMode(detail.selectedId as ViewMode)
                  }}
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
                pagesCount={maxPage + 1}
                disabled={isLoading}
                onChange={({ detail }) => setPage(detail.currentPageIndex - 1)}
              />
            ) : (
              <Box variant="small" color="text-body-secondary">
                {allLoaded
                  ? `All ${total.toLocaleString()} rows loaded.`
                  : `Showing ${items.length.toLocaleString()} of ${total.toLocaleString()} — scroll down to fetch the next page from the server.`}
              </Box>
            )
          }
        >
          <div
            onScroll={onScroll}
            style={{ height: `28rem`, overflowY: `auto` }}
          >
            <Table
              variant="embedded"
              stickyHeader
              wrapLines
              items={items}
              trackBy="id"
              loading={isLoading}
              loadingText="Loading issues…"
              empty={
                <Box textAlign="center" color="text-body-secondary" padding="l">
                  No issues found.
                </Box>
              }
              columnDefinitions={[
                {
                  id: `done`,
                  header: `Done`,
                  width: 70,
                  minWidth: 70,
                  cell: (item) => (
                    <Checkbox
                      checked={item.completed}
                      ariaLabel={`Toggle issue ${item.id}`}
                      onChange={() => void toggle(item)}
                    />
                  ),
                },
                {
                  id: `id`,
                  header: `ID`,
                  width: 100,
                  cell: (item) => (
                    <Box variant="code" color="text-body-secondary">
                      {item.id}
                    </Box>
                  ),
                },
                {
                  id: `issue`,
                  header: `Issue`,
                  minWidth: 320,
                  isRowHeader: true,
                  cell: (item) => (
                    <span
                      style={
                        item.completed
                          ? {
                              textDecoration: `line-through`,
                              color: `var(--color-text-body-secondary, #5f6b7a)`,
                            }
                          : undefined
                      }
                    >
                      {item.text}
                    </span>
                  ),
                },
                {
                  id: `status`,
                  header: `Status`,
                  width: 110,
                  cell: (item) => (
                    <StatusIndicator
                      type={item.completed ? `success` : `pending`}
                    >
                      {item.completed ? `Done` : `Open`}
                    </StatusIndicator>
                  ),
                },
                {
                  id: `created`,
                  header: `Created`,
                  width: 160,
                  cell: (item) => (
                    <Box variant="samp" color="text-body-secondary">
                      {new Date(item.created_at)
                        .toISOString()
                        .slice(0, 16)
                        .replace(`T`, ` `)}
                    </Box>
                  ),
                },
              ]}
            />

            {/* Scroll mode: the "fetch the next page" spinner, at the bottom of
                the list. This is the wait S3 removes. */}
            {viewMode === `scroll` && isLoadingMore && (
              <Box textAlign="center" padding="m" color="text-body-secondary">
                <Spinner /> Loading more from the server…
              </Box>
            )}
            {viewMode === `scroll` && !isLoadingMore && allLoaded && (
              <Box textAlign="center" padding="m" color="text-body-secondary">
                End of list.
              </Box>
            )}
          </div>
        </Container>

        <Modal
          visible={showAddModal}
          onDismiss={() => setShowAddModal(false)}
          header="Add item"
          footer={
            <Box float="right">
              <SpaceBetween direction="horizontal" size="xs">
                <Button
                  variant="link"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  disabled={!newText.trim()}
                  onClick={() => {
                    void create()
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
              value={newText}
              autoFocus
              placeholder="New issue (waits for the server, then refetches the list)"
              onChange={({ detail }) => setNewText(detail.value)}
              onKeyDown={({ detail }) => {
                if (detail.key === `Enter` && newText.trim()) {
                  void create()
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
