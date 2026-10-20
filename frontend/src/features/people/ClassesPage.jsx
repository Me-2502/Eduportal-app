import { ChevronRight, School } from 'lucide-react'
import { Link } from 'react-router'

import { PageHeader } from '@/components/PageHeader'
import { EmptyState, ErrorNotice } from '@/components/states'
import { Skeleton } from '@/components/ui/skeleton'
import { useCurrentUser } from '@/features/auth/auth-context'
import { classLabel, fullName } from '@/lib/format'

import { useClasses } from './api'

export function ClassesPage() {
  const user = useCurrentUser()
  const classes = useClasses()

  // group by standard so 8-A, 8-B, 8-C sit together
  const byStandard = Map.groupBy(classes.data ?? [], (classroom) => classroom.standard)

  return (
    <>
      <PageHeader title="Classes" description="All classes this academic year." />
      {classes.isPending ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : classes.isError ? (
        <ErrorNotice error={classes.error} onRetry={classes.refetch} />
      ) : classes.data.length === 0 ? (
        <EmptyState icon={School} title="No classes for this year yet." />
      ) : (
        <div className="space-y-6">
          {[...byStandard].map(([standard, items]) => (
            <section key={standard}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Standard {standard}
              </h2>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((classroom) => {
                  const mine = classroom.class_teacher?.id === user.id
                  return (
                    <li key={classroom.id}>
                      <Link
                        to={`/classes/${classroom.id}`}
                        className="flex items-center gap-4 rounded-lg border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/40"
                      >
                        <span className="font-serif text-2xl font-semibold tabular">
                          {classLabel(classroom)}
                        </span>
                        <span className="min-w-0 flex-1 text-sm">
                          <span className="block text-muted-foreground">Room {classroom.room_no}</span>
                          <span className="block truncate">
                            {classroom.class_teacher ? fullName(classroom.class_teacher) : 'No class teacher'}
                          </span>
                        </span>
                        {mine && (
                          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[0.7rem] font-medium text-primary">
                            Your class
                          </span>
                        )}
                        <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  )
}
