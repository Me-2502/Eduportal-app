import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { api, setUnauthorizedHandler, tokenStore } from '@/lib/api'

import { AuthContext, ME_KEY } from './auth-context'

export function AuthProvider({ children }) {
  const queryClient = useQueryClient()
  const [token, setToken] = useState(() => tokenStore.get())

  // Restores the session after a page reload. Login seeds this cache directly.
  const meQuery = useQuery({
    queryKey: ME_KEY,
    queryFn: () => api.get('/auth/me').then((res) => res.data),
    enabled: Boolean(token),
    staleTime: Infinity,
    retry: false,
  })

  const logout = useCallback(() => {
    tokenStore.clear()
    setToken(null)
    queryClient.clear()
  }, [queryClient])

  useEffect(() => {
    setUnauthorizedHandler(logout)
  }, [logout])

  const login = useCallback(
    async (username, password) => {
      const { data } = await api.post('/auth/login', { username, password })
      tokenStore.set(data.access_token)
      queryClient.setQueryData(ME_KEY, data.user)
      setToken(data.access_token)
      return data.user
    },
    [queryClient],
  )

  const value = useMemo(() => {
    const user = token ? (meQuery.data ?? null) : null
    return {
      user,
      // true only while we have a token but don't know who it belongs to yet
      isRestoring: Boolean(token) && meQuery.isPending,
      sessionError: token ? meQuery.error : null,
      retrySession: meQuery.refetch,
      login,
      logout,
      isStudent: user?.role === 'student',
      isFaculty: user?.role === 'faculty',
      isAdmin: user?.role === 'admin',
      isStaff: user?.role === 'faculty' || user?.role === 'admin',
      // HOD and admin may edit things other people created (deps.can_manage)
      canManage: Boolean(user?.is_hod) || user?.role === 'admin',
    }
  }, [token, meQuery.data, meQuery.isPending, meQuery.error, meQuery.refetch, login, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
