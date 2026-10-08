/**
 * Shared authorization helpers for the conference-demo routers.
 *
 * Both demo routers (`demo-before` and `demo-issues`) operate on rows in the
 * seeded demo dataset, which deliberately has an empty `todos.user_ids` array
 * (see `scripts/seed-large.ts`). The normal `todos` router authorizes on
 * `user_ids`, which by design cannot match those rows — so these routers
 * authorize on **project membership** instead: you may read/write a row if you
 * own, or are shared on, the project it belongs to.
 *
 * That predicate is enforced server-side on every call. The client never gets to
 * choose the boundary.
 */

import { TRPCError } from "@trpc/server"
import { and, arrayContains, eq, or } from "drizzle-orm"
import { projectsTable } from "@/db/schema"
import { DEMO_LARGE_PROJECT_NAME } from "@/lib/demo-constants"
import type { db as Database } from "@/db/connection"

type DemoContext = {
  db: typeof Database
  session: { user: { id: string } }
}

/**
 * Throws unless the caller owns or is shared on `projectId`.
 * Returns the project row on success.
 */
export async function requireProjectMembership(
  ctx: DemoContext,
  projectId: number
) {
  const [project] = await ctx.db
    .select()
    .from(projectsTable)
    .where(
      and(
        eq(projectsTable.id, projectId),
        or(
          eq(projectsTable.owner_id, ctx.session.user.id),
          arrayContains(projectsTable.shared_user_ids, [ctx.session.user.id])
        )
      )
    )
    .limit(1)

  if (!project) {
    throw new TRPCError({
      code: `NOT_FOUND`,
      message: `Project not found, or you do not have access to it`,
    })
  }

  return project
}

/**
 * Resolves the seeded large-dataset project for the caller.
 * Mirrors the resolution done by the `/api/demo-issues` shape endpoint, so the
 * read boundary and the write boundary cannot drift apart.
 */
export async function requireDemoLargeProject(ctx: DemoContext) {
  const [project] = await ctx.db
    .select()
    .from(projectsTable)
    .where(
      and(
        eq(projectsTable.name, DEMO_LARGE_PROJECT_NAME),
        or(
          eq(projectsTable.owner_id, ctx.session.user.id),
          arrayContains(projectsTable.shared_user_ids, [ctx.session.user.id])
        )
      )
    )
    .limit(1)

  if (!project) {
    throw new TRPCError({
      code: `NOT_FOUND`,
      message: `The demo dataset project ("${DEMO_LARGE_PROJECT_NAME}") does not exist for this user. Run: pnpm seed:large`,
    })
  }

  return project
}
