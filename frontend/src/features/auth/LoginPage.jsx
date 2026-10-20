import { useState } from 'react'
import { Link } from 'react-router'

import { Field, FormError } from '@/components/Field'
import { PasswordInput } from '@/components/PasswordInput'
import { Spinner } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getErrorMessage } from '@/lib/api'

import { useAuth } from './auth-context'
import { AuthLayout } from './AuthLayout'

export function LoginPage() {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      // PublicOnly redirects as soon as the user is known
      await login(username.trim(), password)
    } catch (err) {
      setError(getErrorMessage(err))
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Sign in"
      description="Use the username and password given to you by the school."
      footer="Trouble signing in? Ask the school office to reset your account."
    >
      <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
        <Field label="Username" htmlFor="username">
          <Input
            id="username"
            autoComplete="username"
            autoFocus
            placeholder="e.g. 2023A05"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </Field>
        <div className="grid gap-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <Link
              to="/forgot-password"
              className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <FormError>{error}</FormError>
        <Button type="submit" disabled={submitting || !username.trim() || !password} className="mt-1">
          {submitting && <Spinner />}
          Sign in
        </Button>
      </form>
    </AuthLayout>
  )
}
