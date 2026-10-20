import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'

import { ThemeContext } from './theme-context'

const STORAGE_KEY = 'eduportal.theme'
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)')

function subscribeToSystemTheme(callback) {
  darkQuery.addEventListener('change', callback)
  return () => darkQuery.removeEventListener('change', callback)
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem(STORAGE_KEY) ?? 'system')
  const systemDark = useSyncExternalStore(subscribeToSystemTheme, () => darkQuery.matches)
  const resolvedTheme = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark')
  }, [resolvedTheme])

  const value = useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme: (next) => {
        localStorage.setItem(STORAGE_KEY, next)
        setTheme(next)
      },
    }),
    [theme, resolvedTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
