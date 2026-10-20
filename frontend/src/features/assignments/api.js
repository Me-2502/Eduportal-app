import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'

const get = (url, params) => api.get(url, { params }).then((res) => res.data)

/** Staff list. Without a class filter the API returns the user's own assignments. */
export function useAssignments({ classroomId } = {}) {
  return useQuery({
    queryKey: ['assignments', 'list', classroomId ?? 'mine'],
    queryFn: () => get('/assignments', { classroom_id: classroomId, limit: 100 }),
  })
}

/** Student list: every assignment of their class, each with their own submission or null. */
export function useMyAssignments({ pending = false, enabled = true } = {}) {
  return useQuery({
    queryKey: ['assignments', 'me', { pending }],
    queryFn: () => get('/assignments/me', { pending }),
    enabled,
  })
}

export function useAssignment(id) {
  return useQuery({
    queryKey: ['assignments', 'detail', id],
    queryFn: () => get(`/assignments/${id}`),
    enabled: Boolean(id),
  })
}

export function useSubmissions(assignmentId, { enabled = true } = {}) {
  return useQuery({
    queryKey: ['assignments', 'detail', assignmentId, 'submissions'],
    queryFn: () => get(`/assignments/${assignmentId}/submissions`),
    enabled: Boolean(assignmentId) && enabled,
  })
}

function useAssignmentMutation(mutationFn) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['assignments'] }),
  })
}

export function useCreateAssignment() {
  return useAssignmentMutation((body) => api.post('/assignments', body).then((res) => res.data))
}

export function useUpdateAssignment() {
  return useAssignmentMutation(({ id, ...body }) =>
    api.patch(`/assignments/${id}`, body).then((res) => res.data),
  )
}

export function useDeleteAssignment() {
  return useAssignmentMutation((id) => api.delete(`/assignments/${id}`))
}

export function useSubmitAssignment() {
  return useAssignmentMutation(({ assignmentId, ...body }) =>
    api.put(`/assignments/${assignmentId}/submission`, body).then((res) => res.data),
  )
}

export function useWithdrawSubmission() {
  return useAssignmentMutation((assignmentId) =>
    api.delete(`/assignments/${assignmentId}/submission`),
  )
}

export function useGradeSubmission() {
  return useAssignmentMutation(({ assignmentId, submissionId, ...body }) =>
    api
      .patch(`/assignments/${assignmentId}/submissions/${submissionId}/grade`, body)
      .then((res) => res.data),
  )
}
