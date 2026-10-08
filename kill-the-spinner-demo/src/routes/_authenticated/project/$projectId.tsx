import * as React from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useLiveQuery, eq } from "@tanstack/react-db"
import { useState } from "react"
import { authClient } from "@/lib/auth-client"
import {
  todoCollection,
  projectCollection,
  usersCollection,
} from "@/lib/collections"
import { type Todo } from "@/db/schema"
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

export const Route = createFileRoute(`/_authenticated/project/$projectId`)({
  component: ProjectPage,
  ssr: false,
  loader: async () => {
    await Promise.all([
      projectCollection.preload(),
      todoCollection.preload(),
      usersCollection.preload(),
    ])
    return null
  },
})

function ProjectPage() {
  const { projectId } = Route.useParams()
  const { data: session } = authClient.useSession()
  const [newTodoText, setNewTodoText] = useState(``)

  const { data: todos } = useLiveQuery(
    (q) =>
      q
        .from({ todoCollection })
        .where(({ todoCollection }) =>
          eq(todoCollection.project_id, parseInt(projectId, 10))
        )
        .orderBy(({ todoCollection }) => todoCollection.created_at),
    [projectId]
  )

  const { data: users } = useLiveQuery((q) =>
    q.from({ users: usersCollection })
  )

  const { data: usersInProjects } = useLiveQuery(
    (q) =>
      q
        .from({ projects: projectCollection })
        .where(({ projects }) => eq(projects.id, parseInt(projectId, 10)))
        .fn.select(({ projects }) => ({
          users: projects.shared_user_ids.concat(projects.owner_id),
          owner: projects.owner_id,
        })),
    [projectId]
  )
  const usersInProject = usersInProjects?.[0]

  const { data: projects } = useLiveQuery(
    (q) =>
      q
        .from({ projectCollection })
        .where(({ projectCollection }) =>
          eq(projectCollection.id, parseInt(projectId, 10))
        ),
    [projectId]
  )
  const project = projects[0]

  const addTodo = () => {
    if (newTodoText.trim() && session) {
      todoCollection.insert({
        user_id: session.user.id,
        id: Math.floor(Math.random() * 100000),
        text: newTodoText.trim(),
        completed: false,
        project_id: parseInt(projectId),
        user_ids: [],
        created_at: new Date(),
      })
      setNewTodoText(``)
    }
  }

  const toggleTodo = (todo: Todo) => {
    todoCollection.update(todo.id, (draft) => {
      draft.completed = !draft.completed
    })
  }

  const deleteTodo = (id: number) => {
    todoCollection.delete(id)
  }

  const editName = () => {
    if (!project) return
    const newName = prompt(`Edit project name:`, project.name)
    if (newName && newName !== project.name) {
      projectCollection.update(project.id, (draft) => {
        draft.name = newName
      })
    }
  }

  const editDescription = () => {
    if (!project) return
    const newDescription = prompt(
      `Edit project description:`,
      project.description || ``
    )
    if (newDescription !== null) {
      projectCollection.update(project.id, (draft) => {
        draft.description = newDescription
      })
    }
  }

  if (!project) {
    return (
      <ContentLayout header={<Header variant="h1">Project not found</Header>}>
        <Container>
          <Box color="text-body-secondary">
            This project does not exist or is no longer shared with you.
          </Box>
        </Container>
      </ContentLayout>
    )
  }

  type Member = {
    id: string
    name: string
    isInProject: boolean
    isOwner: boolean
  }

  const members: Array<Member> = (
    session?.user.id === project.owner_id
      ? users
      : users?.filter((user) => usersInProject?.users.includes(user.id))
  )?.map((user) => ({
    id: user.id,
    name: user.name,
    isInProject: usersInProject?.users.includes(user.id) ?? false,
    isOwner: user.id === usersInProject?.owner,
  })) ?? []

  const canEditMembership = session?.user.id === project.owner_id

  return (
    <ContentLayout
      header={
        <Header
          variant="h1"
          description={project.description || `No description yet.`}
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button iconName="edit" onClick={editName}>
                Rename
              </Button>
              <Button iconName="edit" onClick={editDescription}>
                Edit description
              </Button>
            </SpaceBetween>
          }
        >
          {project.name}
        </Header>
      }
    >
      <SpaceBetween size="l">
        <Container
          header={
            <Header variant="h2" counter={`(${todos?.length ?? 0})`}>
              Todos
            </Header>
          }
        >
          <SpaceBetween size="m">
            <div style={{ display: `flex`, gap: `8px` }}>
              <div style={{ flex: 1 }}>
                <Input
                  value={newTodoText}
                  placeholder="Add a new todo…"
                  onChange={({ detail }) => setNewTodoText(detail.value)}
                  onKeyDown={({ detail }) => {
                    if (detail.key === `Enter`) addTodo()
                  }}
                />
              </div>
              <Button
                variant="primary"
                onClick={addTodo}
                disabled={!newTodoText.trim()}
              >
                Add
              </Button>
            </div>

            <Table<Todo>
              variant="embedded"
              items={todos ?? []}
              trackBy="id"
              empty={
                <Box textAlign="center" color="text-body-secondary" padding="s">
                  No todos yet. Add one above!
                </Box>
              }
              columnDefinitions={[
                {
                  id: `done`,
                  header: `Done`,
                  width: 80,
                  cell: (todo) => (
                    <Checkbox
                      checked={todo.completed}
                      onChange={() => toggleTodo(todo)}
                    />
                  ),
                },
                {
                  id: `text`,
                  header: `Task`,
                  cell: (todo) => (
                    <span
                      style={
                        todo.completed
                          ? {
                              textDecoration: `line-through`,
                              color: `var(--color-text-body-secondary, #5f6b7a)`,
                            }
                          : undefined
                      }
                    >
                      {todo.text}
                    </span>
                  ),
                },
                {
                  id: `actions`,
                  header: ``,
                  width: 100,
                  cell: (todo) => (
                    <Button
                      variant="inline-link"
                      iconName="remove"
                      onClick={() => deleteTodo(todo.id)}
                    >
                      Delete
                    </Button>
                  ),
                },
              ]}
            />
          </SpaceBetween>
        </Container>

        <Container header={<Header variant="h2">Project members</Header>}>
          <Table<Member>
            variant="embedded"
            items={members}
            trackBy="id"
            empty={
              <Box textAlign="center" color="text-body-secondary" padding="s">
                No members.
              </Box>
            }
            columnDefinitions={[
              ...(canEditMembership
                ? [
                    {
                      id: `member`,
                      header: `Member`,
                      width: 90,
                      cell: (user: Member) => (
                        <Checkbox
                          checked={user.isInProject}
                          disabled={user.isOwner}
                          onChange={() => {
                            if (user.isInProject && !user.isOwner) {
                              projectCollection.update(project.id, (draft) => {
                                draft.shared_user_ids =
                                  draft.shared_user_ids.filter(
                                    (id) => id !== user.id
                                  )
                              })
                            } else if (!user.isInProject) {
                              projectCollection.update(project.id, (draft) => {
                                draft.shared_user_ids.push(user.id)
                              })
                            }
                          }}
                        />
                      ),
                    },
                  ]
                : []),
              {
                id: `name`,
                header: `Name`,
                cell: (user: Member) => user.name,
              },
              {
                id: `role`,
                header: `Role`,
                width: 120,
                cell: (user: Member) =>
                  user.isOwner ? <Badge color="blue">Owner</Badge> : ``,
              },
            ]}
          />
        </Container>
      </SpaceBetween>
    </ContentLayout>
  )
}
