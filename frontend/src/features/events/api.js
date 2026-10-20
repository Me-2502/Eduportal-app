import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'

/** Events overlapping [from, to). Both are Dates; the API wants timezone-aware ISO strings. */
export function useEvents(from, to) {
  return useQuery({
    queryKey: ['events', from.toISOString(), to.toISOString()],
    queryFn: () =>
      api
        .get('/events', { params: { from: from.toISOString(), to: to.toISOString() } })
        .then((res) => res.data),
    // keep the previous month on screen while the next one loads
    placeholderData: keepPreviousData,
  })
}

function useEventMutation(mutationFn) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events'] }),
  })
}

export function useCreateEvent() {
  return useEventMutation((body) => api.post('/events', body).then((res) => res.data))
}

export function useUpdateEvent() {
  return useEventMutation(({ id, ...body }) =>
    api.patch(`/events/${id}`, body).then((res) => res.data),
  )
}

export function useDeleteEvent() {
  return useEventMutation((id) => api.delete(`/events/${id}`))
}
