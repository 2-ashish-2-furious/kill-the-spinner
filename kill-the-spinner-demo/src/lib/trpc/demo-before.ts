/**
 * =============================================================================
 * ⚠️  DELIBERATE ANTI-PATTERN — DO NOT "FIX" THIS FILE, DO NOT COPY IT
 * =============================================================================
 *
 * `AGENTS.md` rule #1 says: NEVER use tRPC for data reads. This file breaks that
 * rule on purpose.
 *
 * It exists solely to power the "before" screen of the conference talk
 * ("Local-First: Kill the Spinner", slide S2) — the fetch-on-mount,
 * spinner-on-every-interaction, refetch-after-every-edit baseline that slide S3
 * is contrasted against. The demo only works if this baseline is real, so these
 * are genuine request/response reads with pagination and server-side filtering.
 *
 * Rules for this file:
 *  - It is consumed ONLY by `src/routes/_authenticated/demo-before/*`.
 *  - No production code path, and no Electric collection, may import it.
 *  - If you are looking for how reads are supposed to work in this app, look at
 *    `src/lib/collections.ts` + `useLiveQuery` instead.
 *
 * Authorization is NOT relaxed here: every procedure requires an authenticated
 * session and project membership (see `demo-auth.ts`).
 */

import { z } from "zod"
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  or,
  arrayContains,
} from "drizzle-orm"
import { router, authedProcedure, generateTxId } from "@/lib/trpc"
import { projectsTable, todosTable } from "@/db/schema"
import { requireProjectMembership } from "@/lib/trpc/demo-auth"

const statusFilter = z.enum([`all`, `open`, `done`])

export const demoBeforeRouter = router({
  /**
   * ANTI-PATTERN (read over tRPC): list the projects the caller can see, so the
   * "before" screen has a landing page. The sync-based app gets this from the
   * `projectCollection` with zero requests.
   */
  listProjects: authedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        id: projectsTable.id,
        name: projectsTable.name,
        description: projectsTable.description,
      })
      .from(projectsTable)
      .where(
        or(
          eq(projectsTable.owner_id, ctx.session.user.id),
          arrayContains(projectsTable.shared_user_ids, [ctx.session.user.id])
        )
      )
      .orderBy(asc(projectsTable.id))

    return rows
  }),

  /**
   * ANTI-PATTERN (read over tRPC): one page of issues for a project, filtered
   * and counted server-side. Every keystroke, every filter change, every page
   * turn and every edit costs one of these round trips — which is the entire
   * point of slide S2.
   */
  listIssues: authedProcedure
    .input(
      z.object({
        project_id: z.number(),
        search: z.string().default(``),
        status: statusFilter.default(`all`),
        limit: z.number().min(1).max(200).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const project = await requireProjectMembership(ctx, input.project_id)

      const filters = [eq(todosTable.project_id, input.project_id)]
      if (input.search.trim()) {
        filters.push(ilike(todosTable.text, `%${input.search.trim()}%`))
      }
      if (input.status !== `all`) {
        filters.push(eq(todosTable.completed, input.status === `done`))
      }
      const where = and(...filters)

      // Two queries per page view: the rows, and the total for the pager.
      const [items, [totals]] = await Promise.all([
        ctx.db
          .select()
          .from(todosTable)
          .where(where)
          .orderBy(desc(todosTable.id))
          .limit(input.limit)
          .offset(input.offset),
        ctx.db.select({ total: count() }).from(todosTable).where(where),
      ])

      return {
        project: { id: project.id, name: project.name },
        items,
        total: Number(totals?.total ?? 0),
        limit: input.limit,
        offset: input.offset,
      }
    }),

  /**
   * Write path for the "before" screen. Returns no txid and does no optimistic
   * update — the caller is expected to refetch, which is the behaviour being
   * demonstrated. (`generateTxId` is still called so the transaction shape
   * matches the real routers.)
   */
  setCompleted: authedProcedure
    .input(z.object({ id: z.number(), completed: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.transaction(async (tx) => {
        const [existing] = await tx
          .select({ project_id: todosTable.project_id })
          .from(todosTable)
          .where(eq(todosTable.id, input.id))
          .limit(1)

        if (!existing) {
          return { ok: false as const }
        }
        await requireProjectMembership(
          { db: ctx.db, session: ctx.session },
          existing.project_id
        )

        const txid = await generateTxId(tx)
        await tx
          .update(todosTable)
          .set({ completed: input.completed })
          .where(eq(todosTable.id, input.id))

        return { ok: true as const, txid }
      })
    }),

  /** Write path for the "before" screen — see `setCompleted`. */
  createIssue: authedProcedure
    .input(
      z.object({ project_id: z.number(), text: z.string().min(1).max(500) })
    )
    .mutation(async ({ ctx, input }) => {
      await requireProjectMembership(ctx, input.project_id)

      return ctx.db.transaction(async (tx) => {
        const txid = await generateTxId(tx)
        const [item] = await tx
          .insert(todosTable)
          .values({
            text: input.text,
            completed: false,
            user_id: ctx.session.user.id,
            project_id: input.project_id,
          })
          .returning()

        return { item, txid }
      })
    }),
})
