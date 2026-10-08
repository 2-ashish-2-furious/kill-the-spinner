/**
 * Electric shape endpoint for the large seeded demo dataset (S3 / S12 / App. B2).
 *
 * This is an ordinary, correctly-authorized Electric shape — the same pattern as
 * `/api/todos` — but scoped by PROJECT MEMBERSHIP instead of by `todos.user_ids`,
 * because the 500k seeded rows deliberately carry an empty `user_ids` array so
 * they can never leak into the app's existing eager `todoCollection`.
 * See `scripts/seed-large.ts` for why.
 *
 * The `where` clause set here is the **outer boundary** of the shape: it is what
 * *could* ever sync to this client. The on-demand collection then ANDs its own
 * subset predicates inside that boundary at runtime (`subset__*` query params),
 * which is exactly the S12 point — the server owns the boundary, the client owns
 * the paging. Both halves are visible in the browser network panel.
 *
 * Notes for S11 (authorization as a sync boundary):
 *  - The project id is resolved SERVER-SIDE from the session. The client cannot
 *    ask for a different project by tampering with query params.
 *  - If the demo project does not exist for this user, we return a shape that
 *    matches nothing rather than an unfiltered table.
 */

import { createFileRoute } from "@tanstack/react-router"
import { and, eq, or, arrayContains } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { db } from "@/db/connection"
import { projectsTable } from "@/db/schema"
import { prepareElectricUrl, proxyElectricRequest } from "@/lib/electric-proxy"
import { DEMO_LARGE_PROJECT_NAME } from "@/lib/demo-constants"

const serve = async ({ request }: { request: Request }) => {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return new Response(JSON.stringify({ error: `Unauthorized` }), {
      status: 401,
      headers: { "content-type": `application/json` },
    })
  }

  // Resolve the demo project the caller is actually allowed to see.
  const [project] = await db
    .select({ id: projectsTable.id })
    .from(projectsTable)
    .where(
      and(
        eq(projectsTable.name, DEMO_LARGE_PROJECT_NAME),
        or(
          eq(projectsTable.owner_id, session.user.id),
          arrayContains(projectsTable.shared_user_ids, [session.user.id])
        )
      )
    )
    .limit(1)

  const originUrl = prepareElectricUrl(request.url)
  originUrl.searchParams.set(`table`, `todos`)

  if (!project) {
    // Deliberately empty shape: better an empty grid than an unfiltered table.
    originUrl.searchParams.set(`where`, `false`)
  } else {
    originUrl.searchParams.set(`where`, `project_id = $1`)
    originUrl.searchParams.set(`params[1]`, String(project.id))
  }

  return proxyElectricRequest(originUrl)
}

export const Route = createFileRoute(`/api/demo-issues`)({
  server: {
    handlers: {
      GET: serve,
    },
  },
})
