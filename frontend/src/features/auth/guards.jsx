import { WifiOff } from 'lucide-react'
import { Navigate, Outlet, useLocation } from 'react-router'

import { EmptyState, FullPageSpinner } from '@/components/states'
import { Button } from '@/components/ui/button'
import { getErrorMessage } from '@/lib/api'

import { useAuth } from './auth-context'

export function RequireAuth() {
  const { user, isRestoring, sessionError, retrySession } = useAuth()
  const location = useLocation()

  if (isRestoring) return <FullPageSpinner />

  // Token exists but /auth/me failed for a reason other than 401 (e.g. server is down).
  // Don't throw the user back to the login page for that.
  if (!user && sessionError) {
    return (
      <div className="flex min-h-svh items-center justify-center p-6">
        <EmptyState
          icon={WifiOff}
          title="Can't load your account"
          action={<Button onClick={() => retrySession()}>Try again</Button>}
        >
          {getErrorMessage(sessionError)}
        </EmptyState>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />

  if (user.must_change_password && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />
  }

  return <Outlet />
}

/** Login, forgot password: only for signed-out visitors. */
export function PublicOnly() {
  const { user, isRestoring } = useAuth()
  const location = useLocation()
  if (isRestoring) return <FullPageSpinner />
  // RequireAuth takes it from here, including the forced password change
  if (user) return <Navigate to={location.state?.from ?? '/'} replace />
  return <Outlet />
}

/**
 * Hides a route from roles that can't use it. The API enforces the same rules;
 * this only avoids showing a page that would fail on every request.
 */
export function RequireRole({ roles, hod = false }) {
  const { user } = useAuth()
  const allowed = roles.includes(user.role) || (hod && user.is_hod)
  if (!allowed) return <Navigate to="/" replace />
  return <Outlet />
}
