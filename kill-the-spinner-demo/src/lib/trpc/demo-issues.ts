/**
 * Mutations for the large seeded demo dataset (the `/demo-large` view).
 *
 * Plain CRUD, one procedure per operation, each returning `{ txid }` so the
 * Electric collection can match the write against the sync stream — the same
 * contract as `src/lib/trpc/todos.ts`.
 *
 * It exists as a separate router only because the demo rows are authorized by
 * project membership rather than by `todos.user_ids` (see `demo-auth.ts` and the
 * header of `scripts/seed-large.ts`). Reads are NOT here and must never be added
 * here — the `/demo-large` view reads exclusively through Electric + useLiveQuery.
 */

import { z } from "zod"
import { and, eq } from "drizzle-orm"
import { TRPCError } from "@trpc/server"
import { router, authedProcedure, generateTxId } from "@/lib/trpc"
import { todosTable } from "@/db/schema"
import { requireDemoLargeProject } from "@/lib/trpc/demo-auth"

export const demoIssuesRouter = router({
  create: authedProcedure
    .input(
      z.object({
        text: z.string().min(1).max(500),
        completed: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const project = await requireDemoLargeProject(ctx)

      return ctx.db.transaction(async (tx) => {
        const txid = await generateTxId(tx)
        const [item] = await tx
          .insert(todosTable)
          .values({
            text: input.text,
            completed: input.completed,
            user_id: ctx.session.user.id,
            project_id: project.id,
          })
          .returning()

        return { item, txid }
      })
    }),

  update: authedProcedure
    .input(
      z.object({
        id: z.number(),
        data: z.object({
          text: z.string().min(1).max(500).optional(),
          completed: z.boolean().optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const project = await requireDemoLargeProject(ctx)

      return ctx.db.transaction(async (tx) => {
        const txid = await generateTxId(tx)
        const [item] = await tx
          .update(todosTable)
          .set(input.data)
          .where(
            and(
              eq(todosTable.id, input.id),
              eq(todosTable.project_id, project.id)
            )
          )
          .returning()

        if (!item) {
          throw new TRPCError({
            code: `NOT_FOUND`,
            message: `Issue not found in the demo dataset`,
          })
        }

        return { item, txid }
      })
    }),

  delete: authedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const project = await requireDemoLargeProject(ctx)

      return ctx.db.transaction(async (tx) => {
        const txid = await generateTxId(tx)
        const [item] = await tx
          .delete(todosTable)
          .where(
            and(
              eq(todosTable.id, input.id),
              eq(todosTable.project_id, project.id)
            )
          )
          .returning()

        if (!item) {
          throw new TRPCError({
            code: `NOT_FOUND`,
            message: `Issue not found in the demo dataset`,
          })
        }

        return { item, txid }
      })
    }),
})
