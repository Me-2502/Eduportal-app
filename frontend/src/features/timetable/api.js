import { useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api'

export function useMyTimetable({ enabled = true } = {}) {
  return useQuery({
    queryKey: ['timetable', 'me'],
    queryFn: () => api.get('/timetable/me').then((res) => res.data),
    staleTime: 10 * 60_000,
    enabled,
  })
}

export function useClassTimetable(classId) {
  return useQuery({
    queryKey: ['timetable', 'class', classId],
    queryFn: () => api.get(`/timetable/class/${classId}`).then((res) => res.data),
    staleTime: 10 * 60_000,
    enabled: Boolean(classId),
  })
}
