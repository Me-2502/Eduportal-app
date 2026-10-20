import { createContext, useContext } from 'react'

export const AuthContext = createContext(null)

export const ME_KEY = ['auth', 'me']

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>')
  return context
}

/** The logged-in user. Only use below <RequireAuth>, where it is never null. */
export function useCurrentUser() {
  return useAuth().user
}
