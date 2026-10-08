import { createFileRoute } from "@tanstack/react-router"
import { fetchRequestHandler } from "@trpc/server/adapters/fetch"
import { router } from "@/lib/trpc"
import { projectsRouter } from "@/lib/trpc/projects"
import { todosRouter } from "@/lib/trpc/todos"
import { usersRouter } from "@/lib/trpc/users"
// Conference-demo routers. `demoIssues` is ordinary CRUD for the large seeded
// dataset. `demoBefore` is a DELIBERATE, documented anti-pattern (tRPC reads)
// used only by the /demo-before screen — see the header of that file.
import { demoIssuesRouter } from "@/lib/trpc/demo-issues"
import { demoBeforeRouter } from "@/lib/trpc/demo-before"
import { db } from "@/db/connection"
import { auth } from "@/lib/auth"

export const appRouter = router({
  projects: projectsRouter,
  todos: todosRouter,
  users: usersRouter,
  demoIssues: demoIssuesRouter,
  demoBefore: demoBeforeRouter,
})

export type AppRouter = typeof appRouter

const serve = ({ request }: { request: Request }) => {
  return fetchRequestHandler({
    endpoint: `/api/trpc`,
    req: request,
    router: appRouter,
    createContext: async () => ({
      db,
      session: await auth.api.getSession({ headers: request.headers }),
    }),
  })
}

export const Route = createFileRoute(`/api/trpc/$`)({
  server: {
    handlers: {
      GET: serve,
      POST: serve,
    },
  },
})
