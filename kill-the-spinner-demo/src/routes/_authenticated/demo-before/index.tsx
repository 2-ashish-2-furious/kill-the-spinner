/**
 * =============================================================================
 * ⚠️  DELIBERATE ANTI-PATTERN — see `./$projectId.tsx` for the full explanation
 * =============================================================================
 *
 * Landing page for the S2 "before" demo: pick which project to open the old way.
 * It also reads over tRPC (fetch on mount + spinner) on purpose, so the very
 * first interaction of the demo already costs a wait.
 *
 * Do not migrate this to `projectCollection` + `useLiveQuery`.
 */

import * as React from "react"
import { useEffect, useState } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { trpc } from "@/lib/trpc-client"
import { DEMO_BEFORE_LATENCY_MS, sleep } from "@/lib/demo-flags"
import { DEMO_LARGE_PROJECT_NAME } from "@/lib/demo-constants"
import ContentLayout from "@cloudscape-design/components/content-layout"
import Header from "@cloudscape-design/components/header"
import Container from "@cloudscape-design/components/container"
import Box from "@cloudscape-design/components/box"
import SpaceBetween from "@cloudscape-design/components/space-between"
import Spinner from "@cloudscape-design/components/spinner"
import Badge from "@cloudscape-design/components/badge"
import Link from "@cloudscape-design/components/link"

export const Route = createFileRoute(`/_authenticated/demo-before/`)({
  component: DemoBeforeIndex,
  ssr: false,
})

type ProjectRow = {
  id: number
  name: string
  description: string | null
}

function DemoBeforeIndex() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Array<ProjectRow>>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setIsLoading(true)
      if (DEMO_BEFORE_LATENCY_MS > 0) await sleep(DEMO_BEFORE_LATENCY_MS)
      const rows = await trpc.demoBefore.listProjects.query()
      if (!cancelled) {
        setProjects(rows)
        setIsLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <ContentLayout
      header={
        <Header
          variant="h1"
          description="Pick a project to open the old way — fetch on mount, spinner on every interaction, refetch after every edit."
        >
          S2 · The “before” demo
        </Header>
      }
    >
      <SpaceBetween size="l">
        <Container header={<Header variant="h2">Projects</Header>}>
          {isLoading ? (
            <Box textAlign="center" padding="l" color="text-body-secondary">
              <Spinner size="large" /> Loading projects…
            </Box>
          ) : projects.length === 0 ? (
            <Box color="text-body-secondary">
              No projects yet. Sign in to the app and create one, then run{` `}
              <Box variant="code" display="inline">
                pnpm seed:large
              </Box>
              {` `}for the large dataset.
            </Box>
          ) : (
            <SpaceBetween size="s">
              {projects.map((project) => (
                <div
                  key={project.id}
                  style={{
                    display: `flex`,
                    alignItems: `center`,
                    gap: `8px`,
                    flexWrap: `wrap`,
                  }}
                >
                  <Link
                    fontSize="heading-s"
                    onFollow={() =>
                      navigate({
                        to: `/demo-before/$projectId`,
                        params: { projectId: String(project.id) },
                      })
                    }
                  >
                    {project.name}
                  </Link>
                  {project.name === DEMO_LARGE_PROJECT_NAME && (
                    <Badge color="red">500k rows — genuinely slow</Badge>
                  )}
                  {project.description && (
                    <Box variant="small" color="text-body-secondary">
                      {project.description}
                    </Box>
                  )}
                </div>
              ))}
            </SpaceBetween>
          )}
        </Container>

        <Box color="text-body-secondary">
          The sync-based version of the same data lives at{` `}
          <Link onFollow={() => navigate({ to: `/demo-large` })}>
            /demo-large
          </Link>
          .
        </Box>
      </SpaceBetween>
    </ContentLayout>
  )
}
