import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import { useAuth } from './auth-context'
import { AuthLayout } from './AuthLayout'
import { ChangePasswordForm } from './ChangePasswordForm'

/** Shown after login while the account still has its starting password. */
export function ChangePasswordPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <AuthLayout
      title={`Welcome, ${user.first_name}`}
      description="Before you continue, replace the password you were given with one of your own."
      footer={
        <button type="button" onClick={logout} className="hover:text-foreground">
          Not you? Sign out
        </button>
      }
    >
      <ChangePasswordForm
        submitLabel="Save and continue"
        onDone={() => {
          toast.success('Password changed.')
          navigate('/', { replace: true })
        }}
      />
    </AuthLayout>
  )
}
