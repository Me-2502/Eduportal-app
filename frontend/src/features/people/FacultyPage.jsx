import { UserRound } from 'lucide-react'
import { useState } from 'react'

import { PageHeader } from '@/components/PageHeader'
import { SearchInput } from '@/components/SearchInput'
import { EmptyState, ErrorNotice } from '@/components/states'
import { Skeleton } from '@/components/ui/skeleton'
import { UserAvatar } from '@/components/UserAvatar'
import { fullName, matchesName } from '@/lib/format'

import { useFaculty } from './api'

export function FacultyPage() {
  const faculty = useFaculty()
  const [query, setQuery] = useState('')
  const visible = (faculty.data ?? []).filter(
    (person) =>
      matchesName(person, query) ||
      person.subjects.some((s) => s.name.toLowerCase().includes(query.trim().toLowerCase())),
  )

  return (
    <>
      <PageHeader
        title="Faculty"
        description="Teachers at school and the subjects they take."
        actions={
          <SearchInput
            placeholder="Search name or subject"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full sm:w-64"
          />
        }
      />

      {faculty.isPending ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : faculty.isError ? (
        <ErrorNotice error={faculty.error} onRetry={faculty.refetch} />
      ) : visible.length === 0 ? (
        <EmptyState icon={UserRound} title={query ? 'Nobody matches that search.' : 'No faculty listed yet.'} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((person) => (
            <li key={person.id} className="flex gap-3 rounded-lg border bg-card p-4">
              <UserAvatar person={person} className="size-10" />
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-medium">
                  <span className="truncate">{fullName(person)}</span>
                  {person.is_hod && (
                    <span className="shrink-0 rounded bg-marker/15 px-1.5 py-0.5 text-[0.7rem] font-semibold text-marker">
                      HOD
                    </span>
                  )}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {person.subjects.length > 0
                    ? person.subjects.map((subject) => subject.name).join(', ')
                    : 'No subjects assigned'}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
