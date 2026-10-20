import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { Field, FormError } from '@/components/Field'
import { PasswordInput } from '@/components/PasswordInput'
import { Spinner } from '@/components/states'
import { Button } from '@/components/ui/button'
import { api, getErrorMessage } from '@/lib/api'

import { ME_KEY } from './auth-context'
import { validateNewPassword } from './password-rules'

export function ChangePasswordForm({ onDone, submitLabel = 'Update password' }) {
  const queryClient = useQueryClient()
  const [oldPassword, setOldPassword] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [localError, setLocalError] = useState('')

  const change = useMutation({
    mutationFn: (body) => api.post('/auth/change-password', body),
    onSuccess: () => {
      queryClient.setQueryData(ME_KEY, (user) => user && { ...user, must_change_password: false })
      setOldPassword('')
      setPassword('')
      setConfirm('')
      onDone?.()
    },
  })

  function handleSubmit(e) {
    e.preventDefault()
    const problem = validateNewPassword(password, confirm, oldPassword)
    setLocalError(problem)
    if (!problem) change.mutate({ old_password: oldPassword, new_password: password })
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <Field label="Current password" htmlFor="cp-old">
        <PasswordInput
          id="cp-old"
          autoComplete="current-password"
          value={oldPassword}
          onChange={(e) => setOldPassword(e.target.value)}
        />
      </Field>
      <Field label="New password" htmlFor="cp-new" hint="At least 8 characters.">
        <PasswordInput
          id="cp-new"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>
      <Field label="Repeat new password" htmlFor="cp-confirm">
        <PasswordInput
          id="cp-confirm"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </Field>
      <FormError>{localError || (change.error && getErrorMessage(change.error))}</FormError>
      <div>
        <Button type="submit" disabled={change.isPending || !oldPassword || !password}>
          {change.isPending && <Spinner />}
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
