import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'

const get = (url, params) => api.get(url, { params }).then((res) => res.data)

export function useMyAbsences({ from, to } = {}) {
  return useQuery({
    queryKey: ['attendance', 'me', from, to],
    queryFn: () => get('/attendance/me', { from, to }),
  })
}

export function useMyAttendanceSummary(year) {
  return useQuery({
    queryKey: ['attendance', 'me', 'summary', year],
    queryFn: () => get('/attendance/me/summary', { year }),
  })
}

/** Absences of a class on one day ("yyyy-MM-dd"). */
export function useClassAbsences(classId, day) {
  return useQuery({
    queryKey: ['attendance', 'class', classId, day],
    queryFn: () => get(`/attendance/class/${classId}`, { from: day, to: day }),
    enabled: Boolean(classId && day),
  })
}

export function useFacultyAbsences(day, { enabled = true } = {}) {
  return useQuery({
    queryKey: ['attendance', 'faculty', day],
    queryFn: () => get('/attendance/faculty', { from: day, to: day }),
    enabled: Boolean(day) && enabled,
  })
}

export function useSetClassAttendance() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ classId, day, absentees }) =>
      api.put(`/attendance/class/${classId}/${day}`, { absentees }),
    onSuccess: (_, { classId }) =>
      queryClient.invalidateQueries({ queryKey: ['attendance', 'class', classId] }),
  })
}

export function useSetFacultyAttendance() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ day, absentees }) => api.put(`/attendance/faculty/${day}`, { absentees }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['attendance', 'faculty'] }),
  })
}
