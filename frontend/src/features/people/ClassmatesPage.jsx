import { useState } from 'react'

import { PageHeader } from '@/components/PageHeader'
import { SearchInput } from '@/components/SearchInput'
import { ErrorNotice, SkeletonRows } from '@/components/states'
import { useCurrentUser } from '@/features/auth/auth-context'
import { classLabel, matchesName } from '@/lib/format'

import { useClassmates, useMyClassroom } from './api'
import { StudentRoster } from './StudentRoster'

export function ClassmatesPage() {
  const user = useCurrentUser()
  const classmates = useClassmates()
  const { classroom } = useMyClassroom()
  const [query, setQuery] = useState('')

  // the API leaves the current student out; put them back in their roll-number spot
  const everyone = classmates.data
    ? [...classmates.data, user].sort((a, b) => (a.roll_no ?? 0) - (b.roll_no ?? 0))
    : []
  const visible = everyone.filter((student) => matchesName(student, query))

  const description = [
    classroom && `Class ${classLabel(classroom)}`,
    classmates.data && `${everyone.length} students`,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <>
      <PageHeader
        title="Classmates"
        description={description || 'Everyone in your class'}
        actions={
          <SearchInput
            placeholder="Search by name"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full sm:w-64"
          />
        }
      />
      {classmates.isPending ? (
        <SkeletonRows rows={8} />
      ) : classmates.isError ? (
        <ErrorNotice error={classmates.error} onRetry={classmates.refetch} />
      ) : (
        <StudentRoster students={visible} highlightId={user.id} emptyText="Nobody matches that name." />
      )}
    </>
  )
}
