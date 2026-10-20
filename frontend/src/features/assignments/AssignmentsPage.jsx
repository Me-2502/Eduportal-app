import { isPast } from 'date-fns'
import { BookOpenCheck, Plus } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'

import { PageHeader } from '@/components/PageHeader'
import { EmptyState, ErrorNotice, SkeletonRows } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/features/auth/auth-context'
import { useClasses } from '@/features/people/api'
import { classLabel } from '@/lib/format'

import { useAssignments, useMyAssignments } from './api'
import { AssignmentDialog } from './AssignmentDialog'
import { AssignmentRow } from './AssignmentRow'
import { studentStatus } from './status'

function ListCard({ title, children }) {
  return (
    <section className="overflow-hidden rounded-lg border bg-card">
      {title && (
        <h2 className="border-b bg-muted/40 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h2>
      )}
      <ul className="divide-y">{children}</ul>
    </section>
  )
}

function StudentAssignments() {
  const [tab, setTab] = useState('todo')
  const query = useMyAssignments({ pending: tab === 'todo' })

  return (
    <>
      <PageHeader
        title="Assignments"
        description="Work set by your teachers."
        actions={
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="todo">To do</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />
      {query.isPending ? (
        <SkeletonRows rows={5} />
      ) : query.isError ? (
        <ErrorNotice error={query.error} onRetry={query.refetch} />
      ) : query.data.length === 0 ? (
        <EmptyState icon={BookOpenCheck} title={tab === 'todo' ? "You're all caught up." : 'No assignments yet.'}>
          {tab === 'todo' && 'Nothing is waiting for a submission right now.'}
        </EmptyState>
      ) : (
        <ListCard>
          {query.data.map(({ assignment, submission }) => (
            <AssignmentRow
              key={assignment.id}
              assignment={assignment}
              status={studentStatus(assignment, submission)}
            />
          ))}
        </ListCard>
      )}
    </>
  )
}

function StaffAssignments() {
  const { isFaculty } = useAuth()
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  const query = useAssignments()
  const classes = useClasses()
  const classById = new Map((classes.data ?? []).map((c) => [c.id, c]))

  const all = query.data ?? []
  const open = all.filter((a) => !isPast(new Date(a.due_at))).reverse() // soonest first
  const closed = all.filter((a) => isPast(new Date(a.due_at)))

  const row = (assignment) => {
    const classroom = classById.get(assignment.classroom_id)
    return (
      <AssignmentRow
        key={assignment.id}
        assignment={assignment}
        meta={classroom && `Class ${classLabel(classroom)}`}
      />
    )
  }

  return (
    <>
      <PageHeader
        title="Assignments"
        description="Work you have set for your classes."
        actions={
          isFaculty && (
            <Button onClick={() => setCreating(true)}>
              <Plus /> New assignment
            </Button>
          )
        }
      />
      {query.isPending ? (
        <SkeletonRows rows={5} />
      ) : query.isError ? (
        <ErrorNotice error={query.error} onRetry={query.refetch} />
      ) : all.length === 0 ? (
        <EmptyState
          icon={BookOpenCheck}
          title="You haven't set any assignments."
          action={
            isFaculty && (
              <Button variant="outline" onClick={() => setCreating(true)}>
                Set the first one
              </Button>
            )
          }
        />
      ) : (
        <div className="space-y-6">
          {open.length > 0 && <ListCard title="Open">{open.map(row)}</ListCard>}
          {closed.length > 0 && <ListCard title="Past due date">{closed.map(row)}</ListCard>}
        </div>
      )}
      <AssignmentDialog
        open={creating}
        onOpenChange={setCreating}
        onCreated={(created) => navigate(`/assignments/${created.id}`)}
      />
    </>
  )
}

export function AssignmentsPage() {
  const { isStudent } = useAuth()
  return isStudent ? <StudentAssignments /> : <StaffAssignments />
}
