import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'

export function useMyMarks() {
  return useQuery({
    queryKey: ['marks', 'me'],
    queryFn: () => api.get('/marks/me').then((res) => res.data),
  })
}

export function useStudentMarks(studentId) {
  return useQuery({
    queryKey: ['marks', 'student', studentId],
    queryFn: () => api.get(`/marks/student/${studentId}`).then((res) => res.data),
    enabled: Boolean(studentId),
  })
}

function useMarksMutation(mutationFn) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: (_, { studentId }) =>
      queryClient.invalidateQueries({ queryKey: ['marks', 'student', studentId] }),
  })
}

export function useSaveMarks() {
  return useMarksMutation(({ studentId, standard, exam, marks }) =>
    api.put(`/marks/${studentId}/${standard}`, { exam, marks }),
  )
}

export function useDeleteMarks() {
  return useMarksMutation(({ studentId, standard, exam }) =>
    api.delete(`/marks/${studentId}/${standard}`, { params: { exam } }),
  )
}
