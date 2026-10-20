import { LayoutGrid } from 'lucide-react'

import { PageHeader } from '@/components/PageHeader'
import { EmptyState, ErrorNotice, SkeletonRows } from '@/components/states'
import { useAuth } from '@/features/auth/auth-context'
import { classLabel } from '@/lib/format'

import { useMyTimetable } from './api'
import { TimetableGrid } from './TimetableGrid'

export function TimetablePage() {
  const { isStudent } = useAuth()
  const timetable = useMyTimetable()
  const classroom = timetable.data?.[0]?.classroom

  const description = isStudent
    ? classroom
      ? `Class ${classLabel(classroom)} · Room ${classroom.room_no}`
      : 'Your class timetable'
    : 'The periods you teach this academic year'

  return (
    <>
      <PageHeader title="Timetable" description={description} />
      {timetable.isPending ? (
        <SkeletonRows rows={6} />
      ) : timetable.isError ? (
        <ErrorNotice error={timetable.error} onRetry={timetable.refetch} />
      ) : timetable.data.length === 0 ? (
        <EmptyState icon={LayoutGrid} title="No timetable yet">
          The school hasn&apos;t published a timetable for you this year.
        </EmptyState>
      ) : (
        <TimetableGrid slots={timetable.data} perspective={isStudent ? 'student' : 'faculty'} />
      )}
    </>
  )
}
