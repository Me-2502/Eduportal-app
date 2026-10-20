import { useQuery } from '@tanstack/react-query'

import { useAuth } from '@/features/auth/auth-context'
import { useMyTimetable } from '@/features/timetable/api'
import { api } from '@/lib/api'

const get = (url, params) => api.get(url, { params }).then((res) => res.data)

export function useClassmates() {
  return useQuery({ queryKey: ['classmates'], queryFn: () => get('/students/me/classmates') })
}

export function useFaculty({ enabled = true } = {}) {
  return useQuery({
    queryKey: ['faculty'],
    queryFn: () => get('/faculty'),
    staleTime: 5 * 60_000,
    enabled,
  })
}

export function useSubjects() {
  return useQuery({ queryKey: ['subjects'], queryFn: () => get('/subjects'), staleTime: Infinity })
}

export function useClasses({ enabled = true } = {}) {
  return useQuery({
    queryKey: ['classes'],
    queryFn: () => get('/classes'),
    staleTime: 5 * 60_000,
    enabled,
  })
}

export function useClassStudents(classId) {
  return useQuery({
    queryKey: ['classes', classId, 'students'],
    queryFn: () => get(`/classes/${classId}/students`),
    enabled: Boolean(classId),
  })
}

/**
 * The class the user belongs to: a student's own class, or the class a faculty member
 * is class teacher of. /auth/me only has the id, so the details come from data that is
 * loaded elsewhere anyway (a student's timetable, the staff class list).
 */
export function useMyClassroom() {
  const { user, isStudent, isFaculty } = useAuth()
  const timetable = useMyTimetable({ enabled: isStudent })
  const classes = useClasses({ enabled: isFaculty })

  if (isStudent) {
    return { classroom: timetable.data?.[0]?.classroom ?? null, isPending: timetable.isPending }
  }
  if (isFaculty) {
    const classroom = classes.data?.find((item) => item.class_teacher?.id === user.id) ?? null
    return { classroom, isPending: classes.isPending }
  }
  return { classroom: null, isPending: false }
}
