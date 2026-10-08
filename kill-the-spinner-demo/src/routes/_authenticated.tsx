import * as React from "react"
import {
  createFileRoute,
  useNavigate,
  useLocation,
  Outlet,
} from "@tanstack/react-router"
import { useState } from "react"
import { authClient, authStateCollection } from "@/lib/auth-client"
import { useLiveQuery } from "@tanstack/react-db"
import { projectCollection } from "@/lib/collections"
import AppLayout from "@cloudscape-design/components/app-layout"
import TopNavigation from "@cloudscape-design/components/top-navigation"
import SideNavigation, {
  type SideNavigationProps,
} from "@cloudscape-design/components/side-navigation"
import Modal from "@cloudscape-design/components/modal"
import FormField from "@cloudscape-design/components/form-field"
import Input from "@cloudscape-design/components/input"
import Button from "@cloudscape-design/components/button"
import Box from "@cloudscape-design/components/box"
import SpaceBetween from "@cloudscape-design/components/space-between"

export const Route = createFileRoute(`/_authenticated`)({
  ssr: false, // Disable SSR - run beforeLoad only on client
  component: AuthenticatedLayout,
  beforeLoad: async () => {
    if (
      authStateCollection.get(`auth`) &&
      authStateCollection.get(`auth`)?.session.expiresAt > new Date()
    ) {
      return authStateCollection.get(`auth`)!
    } else {
      const result = await authClient.getSession()
      authStateCollection.insert({ id: `auth`, ...result.data })
      return result.data
    }
  },
  errorComponent: ({ error }) => {
    const ErrorComponent = () => {
      const { data: session } = authClient.useSession()

      // Only redirect to login if user is not authenticated
      if (!session && typeof window !== `undefined`) {
        window.location.href = `/login`
        return null
      }

      // For other errors, render an error message
      return (
        <Box padding="xxl" textAlign="center">
          <SpaceBetween size="m">
            <Box variant="h1" color="text-status-error">
              Error
            </Box>
            <Box variant="p" color="text-body-secondary">
              {error?.message || `An unexpected error occurred`}
            </Box>
            <Box>
              <Button onClick={() => window.location.reload()}>Retry</Button>
            </Box>
          </SpaceBetween>
        </Box>
      )
    }

    return <ErrorComponent />
  },
})

function AuthenticatedLayout() {
  const { data: session, isPending } = authClient.useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const [navigationOpen, setNavigationOpen] = useState(true)
  const [showNewProjectModal, setShowNewProjectModal] = useState(false)
  const [newProjectName, setNewProjectName] = useState(``)

  const { data: projects } = useLiveQuery((q) =>
    q.from({ projectCollection })
  )

  // Auto-creation of a "Default" project is intentionally disabled so the app
  // only shows explicitly-created projects (e.g. the seeded "Demo: 500k
  // Issues"). Use the "New project" button in the sidebar to create a project.

  const handleLogout = async () => {
    await authClient.signOut()
    navigate({ to: `/login` })
  }

  const handleCreateProject = () => {
    if (newProjectName.trim() && session) {
      projectCollection.insert({
        id: Math.floor(Math.random() * 100000),
        name: newProjectName.trim(),
        description: ``,
        owner_id: session.user.id,
        shared_user_ids: [],
        created_at: new Date(),
      })
      setNewProjectName(``)
      setShowNewProjectModal(false)
    }
  }

  // Type-safe navigation from Cloudscape's string hrefs back into TanStack's
  // typed router.
  const goTo = (href: string) => {
    if (href.startsWith(`/project/`)) {
      const projectId = href.slice(`/project/`.length)
      navigate({ to: `/project/$projectId`, params: { projectId } })
    } else if (href === `/demo-before`) {
      navigate({ to: `/demo-before` })
    } else if (href === `/demo-large`) {
      navigate({ to: `/demo-large` })
    } else {
      navigate({ to: `/` })
    }
  }

  if (isPending) {
    return null
  }

  if (!session) {
    return null
  }

  const navItems: Array<SideNavigationProps.Item> = [
    {
      type: `section`,
      text: `Projects`,
      items: projects.map((project) => ({
        type: `link`,
        text: project.name,
        href: `/project/${project.id}`,
      })),
    },
    { type: `divider` },
    {
      type: `section`,
      text: `Talk demos`,
      items: [
        { type: `link`, text: `Traditional UI`, href: `/demo-before` },
        {
          type: `link`,
          text: `Sync UI (on-demand)`,
          href: `/demo-large`,
        },
      ],
    },
  ]

  return (
    <>
      <div id="top-nav">
        <TopNavigation
          identity={{
            href: `/`,
            title: `TanStack DB / Electric Starter`,
            onFollow: (e) => {
              e.preventDefault()
              goTo(`/`)
            },
          }}
          utilities={[
            {
              type: `menu-dropdown`,
              text: session.user.email,
              iconName: `user-profile`,
              onItemClick: ({ detail }) => {
                if (detail.id === `signout`) void handleLogout()
              },
              items: [{ id: `signout`, text: `Sign out` }],
            },
          ]}
        />
      </div>
      <AppLayout
        headerSelector="#top-nav"
        toolsHide
        navigationOpen={navigationOpen}
        onNavigationChange={({ detail }) => setNavigationOpen(detail.open)}
        navigation={
          <SpaceBetween size="m">
            <SideNavigation
              header={{ href: `/`, text: `Workspace` }}
              activeHref={location.pathname}
              items={navItems}
              onFollow={(e) => {
                if (e.detail.external) return
                e.preventDefault()
                goTo(e.detail.href)
              }}
            />
            <Box padding={{ horizontal: `l` }}>
              <Button
                iconName="add-plus"
                onClick={() => setShowNewProjectModal(true)}
              >
                New project
              </Button>
            </Box>
          </SpaceBetween>
        }
        content={<Outlet />}
      />

      <Modal
        visible={showNewProjectModal}
        onDismiss={() => setShowNewProjectModal(false)}
        header="Create project"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                variant="link"
                onClick={() => setShowNewProjectModal(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                disabled={!newProjectName.trim()}
                onClick={handleCreateProject}
              >
                Create
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <FormField label="Project name">
          <Input
            value={newProjectName}
            autoFocus
            placeholder="e.g. Marketing site"
            onChange={({ detail }) => setNewProjectName(detail.value)}
            onKeyDown={({ detail }) => {
              if (detail.key === `Enter`) handleCreateProject()
            }}
          />
        </FormField>
      </Modal>
    </>
  )
}
