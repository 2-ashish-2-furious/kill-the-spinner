/**
 * =============================================================================
 * DEMO SEED SCRIPT — large dataset for the conference talk (S3 / S12 / App. B2)
 * =============================================================================
 *
 * Seeds a large volume of realistic issue rows into the existing `todos` table
 * so the "after" demo can show query-driven sync over ~500,000 rows, the way
 * Electric's own "LinearLarge" demo does.
 *
 * Usage (from the project root):
 *
 *   pnpm seed:large                      # top up to 500,000 rows (default)
 *   pnpm seed:large -- --count=50000     # smaller set, e.g. for a rehearsal
 *   pnpm seed:large -- --reset           # delete demo rows, then re-seed
 *   pnpm seed:large -- --user=me@x.com   # pick the owning user explicitly
 *   pnpm seed:large:clear                # remove ALL seeded rows + the project
 *
 * Properties:
 *
 *  - **Re-runnable / idempotent.** Rows live in a dedicated project (see
 *    `DEMO_LARGE_PROJECT_NAME`). The script counts what is already there and
 *    only inserts the difference, so running it twice is a no-op. `--reset`
 *    forces a clean rebuild.
 *  - **Efficient.** Rows are generated *inside Postgres* with
 *    `INSERT ... SELECT ... FROM generate_series(...)`, in batches of 25,000.
 *    500,000 rows is ~20 statements, not 500,000 round trips.
 *  - **Isolated.** Seeded rows have an EMPTY `user_ids` array, so they do not
 *    match the existing `/api/todos` shape filter (`$1 = ANY(user_ids)`) and
 *    therefore never enter the existing eager `todoCollection`. The normal app
 *    stays exactly as fast as it was, even with 500k rows in the same table.
 *
 *    Achieving that needs one trick worth explaining. This schema has a
 *    `populate_todo_user_ids_trigger` BEFORE INSERT trigger that overwrites
 *    `user_ids` with the owning project's members. We therefore seed inside a
 *    session with `session_replication_role = replica`, which disables user
 *    triggers **for this session only** (nothing persistent is altered — unlike
 *    `ALTER TABLE ... DISABLE TRIGGER`, a crash cannot leave the trigger off).
 *    Verified locally: rows inserted this way are still logically decoded and
 *    streamed by Electric, so sync works normally.
 *
 *    Consequence to be aware of: the sibling `sync_todo_user_ids_trigger` fires
 *    on `UPDATE OF shared_user_ids, owner_id ON projects`. Do NOT edit the demo
 *    project's members/owner in the UI — that would rewrite `user_ids` on all
 *    500k rows and dump them into the normal app's eager collection.
 *  - **Non-destructive.** Deletion is scoped to `project_id = <demo project>`.
 *    This script NEVER drops the database, the schema, or the docker volume.
 *    Do not use `docker compose down -v` / `pnpm backend:clear` for cleanup —
 *    use `pnpm seed:large:clear`.
 */

import "@dotenvx/dotenvx/config"
import { Pool, type PoolClient } from "pg"
import {
  DEMO_LARGE_DEFAULT_BATCH,
  DEMO_LARGE_DEFAULT_COUNT,
  DEMO_LARGE_PROJECT_NAME,
} from "../src/lib/demo-constants.ts"

// -----------------------------------------------------------------------------
// Arg parsing
// -----------------------------------------------------------------------------

type Args = {
  count: number
  batch: number
  user?: string
  project: string
  reset: boolean
  clear: boolean
}

function parseArgs(argv: Array<string>): Args {
  const get = (name: string): string | undefined => {
    const withEquals = argv.find((a) => a.startsWith(`--${name}=`))
    if (withEquals) return withEquals.slice(`--${name}=`.length)
    const idx = argv.indexOf(`--${name}`)
    if (idx !== -1 && argv[idx + 1] && !argv[idx + 1].startsWith(`--`)) {
      return argv[idx + 1]
    }
    return undefined
  }
  const has = (name: string) => argv.includes(`--${name}`)

  const count = Number(get(`count`) ?? DEMO_LARGE_DEFAULT_COUNT)
  const batch = Number(get(`batch`) ?? DEMO_LARGE_DEFAULT_BATCH)

  if (!Number.isFinite(count) || count < 0) {
    throw new Error(
      `--count must be a non-negative number, got: ${get(`count`)}`
    )
  }
  if (!Number.isFinite(batch) || batch < 1) {
    throw new Error(`--batch must be a positive number, got: ${get(`batch`)}`)
  }

  return {
    count: Math.floor(count),
    batch: Math.floor(batch),
    user: get(`user`),
    project: get(`project`) ?? DEMO_LARGE_PROJECT_NAME,
    reset: has(`reset`),
    clear: has(`clear`),
  }
}

// -----------------------------------------------------------------------------
// Pretty logging
// -----------------------------------------------------------------------------

const started = Date.now()

function log(message: string) {
  const elapsed = ((Date.now() - started) / 1000).toFixed(1)
  process.stdout.write(`[seed-large ${elapsed}s] ${message}\n`)
}

function formatInt(n: number) {
  return n.toLocaleString(`en-US`)
}

// -----------------------------------------------------------------------------
// Realistic issue text, generated server-side.
//
// The three word lists are combined with integer division so that consecutive
// rows walk the full cross-product rather than repeating in a short cycle.
// Row `i` becomes something like:
//   "ENG-004312 Investigate billing webhook retries under load [critical]"
// -----------------------------------------------------------------------------

const VERBS = [
  `Fix`,
  `Investigate`,
  `Refactor`,
  `Document`,
  `Add tracing to`,
  `Roll back`,
  `Rate limit`,
  `Cache`,
  `Deflake`,
  `Migrate`,
  `Instrument`,
  `Harden`,
  `Audit`,
  `Reduce latency in`,
]

const AREAS = [
  `the login flow`,
  `billing webhook retries`,
  `the search index`,
  `session expiry`,
  `the CSV export`,
  `avatar uploads`,
  `the audit log`,
  `push notifications`,
  `the invite email`,
  `SSO metadata refresh`,
  `the pricing page`,
  `report scheduling`,
  `the sync worker`,
  `permission checks`,
  `the onboarding wizard`,
  `webhook signatures`,
  `the admin console`,
  `usage metering`,
]

const TAILS = [
  `on Safari`,
  `under load`,
  `for enterprise tenants`,
  `after the 2.4 upgrade`,
  `on slow connections`,
  `in the EU region`,
  `when offline`,
  `for trial accounts`,
  `during peak hours`,
  `behind the proxy`,
  `on first paint`,
  `with 10k+ rows`,
  `on mobile web`,
  `after a token refresh`,
  `in the nightly job`,
  `when the cache is cold`,
]

/**
 * Renders a JS string array as a parenthesised Postgres text[] literal, so the
 * result can be subscripted directly: `(ARRAY['a','b']::text[])[1]`.
 */
function pgTextArray(values: Array<string>) {
  const escaped = values.map((v) => `'${v.replace(/'/g, `''`)}'`).join(`,`)
  return `(ARRAY[${escaped}]::text[])`
}

// Multipliers are coprime with each list length so that consecutive rows differ
// in all three positions while still covering the whole cross-product.
const INSERT_BATCH_SQL = `
  INSERT INTO todos (text, completed, created_at, user_id, project_id, user_ids)
  SELECT
    'ENG-' || lpad(g.i::text, 6, '0') || ' '
      || ${pgTextArray(VERBS)}[1 + (g.i % ${VERBS.length})] || ' '
      || ${pgTextArray(AREAS)}[1 + ((g.i * 5) % ${AREAS.length})] || ' '
      || ${pgTextArray(TAILS)}[1 + ((g.i * 3) % ${TAILS.length})]
      || CASE
           WHEN g.i % 17 = 0 THEN ' [critical]'
           WHEN g.i % 17 = 1 THEN ' [regression]'
           WHEN g.i % 17 = 2 THEN ' [flaky]'
           ELSE ''
         END,
    (g.i % 3) = 0,
    now()
      - ((g.i % 720)::double precision * interval '1 day')
      - ((g.i % 1440)::double precision * interval '1 minute'),
    $1,
    $2,
    '{}'::text[]
  FROM generate_series($3::bigint, $4::bigint) AS g(i)
`

// -----------------------------------------------------------------------------
// Database helpers
// -----------------------------------------------------------------------------

async function resolveUser(client: PoolClient, email?: string) {
  if (email) {
    const { rows } = await client.query<{ id: string; email: string }>(
      `SELECT id, email FROM users WHERE email = $1 LIMIT 1`,
      [email]
    )
    if (!rows[0]) {
      throw new Error(
        `No user found with email "${email}". Sign up in the app first, or omit --user to use the first user.`
      )
    }
    return rows[0]
  }

  const { rows } = await client.query<{ id: string; email: string }>(
    `SELECT id, email FROM users ORDER BY created_at ASC LIMIT 1`
  )
  if (!rows[0]) {
    throw new Error(
      `No users in the database. Start the app (pnpm dev), sign up, then re-run this script.`
    )
  }
  return rows[0]
}

async function findDemoProject(
  client: PoolClient,
  ownerId: string,
  projectName: string
) {
  const { rows } = await client.query<{ id: number }>(
    `SELECT id FROM projects WHERE name = $1 AND owner_id = $2 LIMIT 1`,
    [projectName, ownerId]
  )
  return rows[0]?.id
}

async function ensureDemoProject(
  client: PoolClient,
  ownerId: string,
  projectName: string
) {
  const existing = await findDemoProject(client, ownerId, projectName)
  if (existing !== undefined) return existing

  const { rows } = await client.query<{ id: number }>(
    `INSERT INTO projects (name, description, owner_id, shared_user_ids)
     VALUES ($1, $2, $3, '{}'::text[])
     RETURNING id`,
    [
      projectName,
      `Seeded demo dataset for the "Kill the Spinner" talk. Managed by scripts/seed-large.ts — safe to delete with pnpm seed:large:clear.`,
      ownerId,
    ]
  )
  log(`Created demo project "${projectName}" (id=${rows[0]!.id})`)
  return rows[0]!.id
}

/**
 * Demo-support indexes.
 *
 * Electric answers each on-demand subset request with a real SQL query against
 * `todos`. Without these, every `ORDER BY id DESC LIMIT n` page and every
 * `text ILIKE '%…%'` filter is a 500k-row sequential scan (measured: ~56ms and
 * ~207ms respectively). With them, subset responses stay comfortably snappy on
 * stage.
 *
 * Created by this script rather than by a Drizzle migration so that they are
 * part of the demo dataset lifecycle and are removed again by `--clear`.
 * They are plain additive indexes on an existing table; nothing else changes.
 */
const DEMO_INDEXES: Array<{ name: string; sql: string }> = [
  {
    name: `todos_demo_project_id_id_idx`,
    sql: `CREATE INDEX IF NOT EXISTS todos_demo_project_id_id_idx ON todos (project_id, id DESC)`,
  },
  {
    name: `todos_demo_text_trgm_idx`,
    sql: `CREATE INDEX IF NOT EXISTS todos_demo_text_trgm_idx ON todos USING gin (text gin_trgm_ops)`,
  },
]

async function createDemoIndexes(client: PoolClient) {
  for (const index of DEMO_INDEXES) {
    try {
      if (index.sql.includes(`gin_trgm_ops`)) {
        await client.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`)
      }
      log(`Ensuring index ${index.name}...`)
      await client.query(index.sql)
    } catch (error) {
      // Indexes are a performance nicety, not a correctness requirement.
      log(
        `  WARNING: could not create ${index.name}: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
    }
  }
}

async function dropDemoIndexes(client: PoolClient) {
  for (const index of DEMO_INDEXES) {
    await client.query(`DROP INDEX IF EXISTS ${index.name}`)
  }
  log(`Dropped demo-support indexes.`)
}

async function countRows(client: PoolClient, projectId: number) {
  const { rows } = await client.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM todos WHERE project_id = $1`,
    [projectId]
  )
  return Number(rows[0]!.n)
}

/**
 * Deletes the demo rows in batches so that progress is visible and so a single
 * enormous transaction does not stall Postgres/Electric replication.
 */
async function deleteRows(
  client: PoolClient,
  projectId: number,
  batch: number
) {
  const total = await countRows(client, projectId)
  if (total === 0) {
    log(`No demo rows to delete.`)
    return 0
  }

  log(
    `Deleting ${formatInt(total)} demo rows in batches of ${formatInt(batch)}...`
  )
  let deleted = 0
  for (;;) {
    const { rowCount } = await client.query(
      `DELETE FROM todos
       WHERE ctid IN (
         SELECT ctid FROM todos WHERE project_id = $1 LIMIT $2
       )`,
      [projectId, batch]
    )
    if (!rowCount) break
    deleted += rowCount
    log(`  deleted ${formatInt(deleted)} / ${formatInt(total)}`)
  }
  return deleted
}

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2))

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error(`DATABASE_URL is not set (expected in .env)`)
  }

  const pool = new Pool({ connectionString: databaseUrl })
  const client = await pool.connect()

  try {
    const user = await resolveUser(client, args.user)
    log(`Demo user: ${user.email} (${user.id})`)

    // ---- clear mode -------------------------------------------------------
    if (args.clear) {
      const projectId = await findDemoProject(client, user.id, args.project)
      if (projectId === undefined) {
        log(
          `Nothing to clear: no project named "${args.project}" for this user.`
        )
        return
      }
      const deleted = await deleteRows(client, projectId, args.batch)
      await client.query(`DELETE FROM projects WHERE id = $1`, [projectId])
      await dropDemoIndexes(client)
      log(
        `Cleared ${formatInt(deleted)} rows and removed project "${args.project}".`
      )
      log(`The database, schema and docker volume were NOT touched.`)
      return
    }

    // ---- seed mode --------------------------------------------------------
    const projectId = await ensureDemoProject(client, user.id, args.project)

    if (args.reset) {
      await deleteRows(client, projectId, args.batch)
    }

    const existing = await countRows(client, projectId)
    const remaining = args.count - existing

    if (remaining <= 0) {
      log(
        `Already seeded: ${formatInt(existing)} rows in project "${args.project}" (target ${formatInt(args.count)}). Nothing to do.`
      )
      log(`Use --reset to rebuild, or --count=<n> to raise the target.`)
      return
    }

    log(
      `Seeding ${formatInt(remaining)} rows (have ${formatInt(existing)}, target ${formatInt(args.count)}) into project id=${projectId}`
    )

    const seedStart = Date.now()
    let inserted = 0

    // Disable user triggers FOR THIS SESSION ONLY so `populate_todo_user_ids`
    // does not overwrite our empty `user_ids`. Session-scoped: if this process
    // dies, nothing is left disabled. Restored in the `finally` below.
    await client.query(`SET session_replication_role = replica`)
    try {
      while (inserted < remaining) {
        const size = Math.min(args.batch, remaining - inserted)
        const from = existing + inserted + 1
        const to = from + size - 1

        await client.query(INSERT_BATCH_SQL, [user.id, projectId, from, to])
        inserted += size

        // Safety net: after the very first batch, confirm the trigger really
        // was bypassed. If it was not, these rows would leak into the normal
        // app's eager collection, so undo them and stop.
        if (inserted === size) {
          const { rows } = await client.query<{ leaked: string }>(
            `SELECT count(*)::text AS leaked
             FROM todos
             WHERE project_id = $1 AND cardinality(user_ids) > 0`,
            [projectId]
          )
          if (Number(rows[0]!.leaked) > 0) {
            await deleteRows(client, projectId, args.batch)
            throw new Error(
              `Trigger bypass failed: seeded rows got a non-empty user_ids array, which would ` +
                `flood the normal app's eager todoCollection. The ${formatInt(size)} rows just ` +
                `inserted have been removed. This usually means the DATABASE_URL user is not ` +
                `superuser and cannot SET session_replication_role.`
            )
          }
        }

        const elapsedSec = (Date.now() - seedStart) / 1000
        const rate = inserted / Math.max(elapsedSec, 0.001)
        const etaSec = (remaining - inserted) / Math.max(rate, 1)
        const pct = ((inserted / remaining) * 100).toFixed(1)
        log(
          `  ${formatInt(inserted)} / ${formatInt(remaining)} (${pct}%)  ` +
            `${formatInt(Math.round(rate))} rows/s  eta ${etaSec.toFixed(0)}s`
        )
      }
    } finally {
      await client.query(`SET session_replication_role = DEFAULT`)
    }

    await createDemoIndexes(client)
    log(`Running ANALYZE todos (so the planner picks the new indexes)...`)
    await client.query(`ANALYZE todos`)

    const finalCount = await countRows(client, projectId)
    log(
      `Done. Project "${args.project}" now holds ${formatInt(finalCount)} rows.`
    )
    log(
      `Next: pnpm dev, then open /demo-large (on-demand sync over this data).`
    )
    log(
      `      The "before" screen for the same data is /demo-before/${projectId}`
    )
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((error: unknown) => {
  process.stderr.write(
    `[seed-large] FAILED: ${error instanceof Error ? error.message : String(error)}\n`
  )
  process.exitCode = 1
})
