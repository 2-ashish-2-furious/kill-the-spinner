import * as React from "react"
import { createFileRoute } from "@tanstack/react-router"
import { authClient } from "@/lib/auth-client"
import { useState } from "react"
import Container from "@cloudscape-design/components/container"
import Header from "@cloudscape-design/components/header"
import Form from "@cloudscape-design/components/form"
import FormField from "@cloudscape-design/components/form-field"
import Input from "@cloudscape-design/components/input"
import Button from "@cloudscape-design/components/button"
import Alert from "@cloudscape-design/components/alert"
import SpaceBetween from "@cloudscape-design/components/space-between"
import Box from "@cloudscape-design/components/box"

export const Route = createFileRoute(`/login`)({
  component: Layout,
  ssr: false,
})

function Layout() {
  const [email, setEmail] = useState(``)
  const [password, setPassword] = useState(``)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(``)

  const handleSubmit = async () => {
    setIsLoading(true)
    setError(``)

    try {
      let { data: _data, error } = await authClient.signUp.email(
        {
          email,
          password,
          name: email,
        },
        {
          onSuccess: () => {
            window.location.href = `/`
          },
        }
      )

      if (error?.code === `USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL`) {
        const result = await authClient.signIn.email(
          {
            email,
            password,
          },
          {
            onSuccess: async () => {
              await authClient.getSession()
              window.location.href = `/`
            },
          }
        )

        _data = result.data
        error = result.error
      }

      if (error) {
        console.error(`Authentication error:`, error)
        setError(error.message || `Authentication failed`)
      }
    } catch (err) {
      console.error(`Unexpected error:`, err)
      setError(`An unexpected error occurred`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: `100vh`,
        display: `flex`,
        alignItems: `center`,
        justifyContent: `center`,
        padding: `48px 16px`,
      }}
    >
      <div style={{ width: `100%`, maxWidth: `420px` }}>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void handleSubmit()
          }}
        >
          <Container
            header={<Header variant="h1">Sign in to your account</Header>}
          >
            <Form
              actions={
                <Button
                  variant="primary"
                  formAction="submit"
                  loading={isLoading}
                  disabled={!email || !password}
                >
                  {isLoading ? `Signing in…` : `Sign in`}
                </Button>
              }
            >
              <SpaceBetween size="l">
                <Alert type="info" header="Development mode">
                  Any email/password combination will work for testing. New
                  accounts are created automatically when you sign in with a new
                  combo.
                </Alert>

                <FormField label="Email address">
                  <Input
                    type="email"
                    value={email}
                    autoFocus
                    placeholder="you@example.com"
                    onChange={({ detail }) => setEmail(detail.value)}
                  />
                </FormField>

                <FormField label="Password">
                  <Input
                    type="password"
                    value={password}
                    placeholder="Password"
                    onChange={({ detail }) => setPassword(detail.value)}
                  />
                </FormField>

                {error && (
                  <Alert type="error" header="Authentication failed">
                    {error}
                  </Alert>
                )}
              </SpaceBetween>
            </Form>
          </Container>
        </form>
        <Box textAlign="center" padding={{ top: `s` }}>
          <Box variant="small" color="text-body-secondary">
            TanStack DB / Electric Starter
          </Box>
        </Box>
      </div>
    </div>
  )
}
