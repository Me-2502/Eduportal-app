import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      // Client errors (403, 404, 501...) won't fix themselves, so only retry network/5xx once.
      retry: (failureCount, error) => {
        const status = error?.response?.status
        if (status && status < 500) return false
        if (status === 501) return false
        return failureCount < 1
      },
    },
  },
})
