/**
 * Shared constants for the conference-talk demo ("Local-First: Kill the Spinner").
 *
 * These are used by:
 *  - `scripts/seed-large.ts`            (creates / clears the demo project + rows)
 *  - `src/routes/api/demo-issues.ts`    (server-side Electric shape boundary)
 *  - `src/lib/trpc/demo-issues.ts`      (writes for the large-dataset view)
 *  - `src/routes/_authenticated/demo-large.tsx` (the on-demand sync view)
 *
 * Nothing in the normal (non-demo) app reads this file.
 */

/**
 * Name of the project that holds the large seeded dataset.
 *
 * The demo rows are identified purely by `todos.project_id` pointing at the
 * project with this name, owned by the demo user. That is what makes the seed
 * script re-runnable and the clear operation safe: we never touch rows outside
 * this project.
 */
export const DEMO_LARGE_PROJECT_NAME = `Taskei: 500k Issues`

/** Default number of rows the seed script targets. */
export const DEMO_LARGE_DEFAULT_COUNT = 500_000

/** Rows inserted per SQL statement while seeding. */
export const DEMO_LARGE_DEFAULT_BATCH = 25_000

/**
 * Seeded rows deliberately have an EMPTY `user_ids` array.
 *
 * The existing production `todos` shape (`src/routes/api/todos.ts`) filters on
 * `$1 = ANY(user_ids)`, so the 500k seeded rows can never leak into the
 * existing eager `todoCollection`. That is what keeps the normal app fast and
 * unchanged while half a million rows sit in the same table.
 */
export const DEMO_LARGE_USER_IDS: Array<string> = []
