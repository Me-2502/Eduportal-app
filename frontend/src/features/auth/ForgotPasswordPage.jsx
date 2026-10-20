import { useMutation } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'

import { Field, FormError } from '@/components/Field'
import { PasswordInput } from '@/components/PasswordInput'
import { Spinner } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api, getErrorMessage } from '@/lib/api'

import { AuthLayout } from './AuthLayout'
import { validateNewPassword } from './password-rules'

function RequestStep({ onSent }) {
  const [username, setUsername] = useState('')
  const request = useMutation({
    mutationFn: (name) => api.post('/auth/forgot-password', { username: name }),
    onSuccess: (_, name) => onSent(name),
  })

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        request.mutate(username.trim())
      }}
    >
      <Field label="Username" htmlFor="fp-username">
        <Input
          id="fp-username"
          autoComplete="username"
          autoFocus
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </Field>
      <FormError>{request.error && getErrorMessage(request.error)}</FormError>
      <Button type="submit" disabled={request.isPending || username.trim().length < 3}>
        {request.isPending && <Spinner />}
        Send code
      </Button>
    </form>
  )
}

function ResetStep({ username, onBack }) {
  const navigate = useNavigate()
  const [otp, setOtp] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [localError, setLocalError] = useState('')

  const reset = useMutation({
    mutationFn: (body) => api.post('/auth/reset-password', body),
    onSuccess: () => {
      toast.success('Password updated. Sign in with your new password.')
      navigate('/login', { replace: true })
    },
  })

  function handleSubmit(e) {
    e.preventDefault()
    const problem = validateNewPassword(password, confirm)
    setLocalError(problem)
    if (!problem) reset.mutate({ username, otp, new_password: password })
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
        If <span className="font-medium text-foreground">{username}</span> has an email on file,
        a 6-digit code is on its way. It expires in 10 minutes.
      </p>
      <Field label="Code" htmlFor="otp">
        <Input
          id="otp"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          maxLength={6}
          placeholder="000000"
          className="tabular font-mono tracking-[0.3em]"
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
        />
      </Field>
      <Field label="New password" htmlFor="np" hint="At least 8 characters.">
        <PasswordInput
          id="np"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>
      <Field label="Repeat new password" htmlFor="np2">
        <PasswordInput
          id="np2"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </Field>
      <FormError>{localError || (reset.error && getErrorMessage(reset.error))}</FormError>
      <Button type="submit" disabled={reset.isPending || otp.length !== 6}>
        {reset.isPending && <Spinner />}
        Set new password
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={onBack}>
        Use a different username
      </Button>
    </form>
  )
}

export function ForgotPasswordPage() {
  const [username, setUsername] = useState(null)

  return (
    <AuthLayout
      title="Reset your password"
      description={
        username
          ? 'Enter the code from the email and choose a new password.'
          : "Enter your username and we'll email you a reset code."
      }
      footer={
        <Link to="/login" className="inline-flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="size-3.5" /> Back to sign in
        </Link>
      }
    >
      {username ? (
        <ResetStep username={username} onBack={() => setUsername(null)} />
      ) : (
        <RequestStep onSent={setUsername} />
      )}
    </AuthLayout>
  )
}
