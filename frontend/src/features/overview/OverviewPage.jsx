import { addDays, format, startOfDay } from 'date-fns'
import { ArrowRight, CalendarCheck2, ClipboardList } from 'lucide-react'
import { Link } from 'react-router'

import { ErrorNotice, SkeletonRows } from '@/components/states'
import { Button } from '@/components/ui/button'
import { useMyAssignments } from '@/features/assignments/api'
import { AssignmentRow } from '@/features/assignments/AssignmentRow'
import { studentStatus } from '@/features/assignments/status'
import { useAuth } from '@/features/auth/auth-context'
import { useEvents } from '@/features/events/api'
import { EventItem } from '@/features/events/EventItem'
import { useMyClassroom } from '@/features/people/api'
import { useMyTimetable } from '@/features/timetable/api'
import { slotDetail } from '@/features/timetable/slot-detail'
import { isNotImplemented } from '@/lib/api'
import { classLabel, greeting, subjectTone, todayDayOfWeek } from '@/lib/format'
import { cn } from '@/lib/utils'

function Card({ title, link, children, className }) {
  return (
    <section className={cn('rounded-lg border bg-card', className)}>
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="font-medium">{title}</h2>
        {link && (
          <Link to={link.to} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            {link.label} <ArrowRight className="size-3.5" />
          </Link>
        )}
      </div>
      {children}
    </section>
  )
}

function TodayClasses() {
  const { isStudent } = useAuth()
  const timetable = useMyTimetable()
  const day = todayDayOfWeek()
  const slots = (timetable.data ?? []).filter((s) => s.day_of_week === day).sort((a, b) => a.period - b.period)

  return (
    <Card title="Today's periods" link={{ to: '/timetable', label: 'Full week' }}>
      <div className="p-4">
        {timetable.isPending ? (
          <SkeletonRows rows={3} />
        ) : timetable.isError ? (
          <ErrorNotice error={timetable.error} onRetry={timetable.refetch} />
        ) : day === 7 ? (
          <p className="text-sm text-muted-foreground">It&apos;s Sunday. No school today.</p>
        ) : slots.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing on the timetable today.</p>
        ) : (
          <ol className="space-y-1.5">
            {slots.map((slot) => (
              <li key={slot.period} className="flex items-center gap-3">
                <span className="w-14 shrink-0 text-xs text-muted-foreground">Period {slot.period}</span>
                <span className={cn('flex-1 rounded-md border-l-[3px] px-3 py-2', subjectTone(slot.subject.code))}>
                  <span className="text-sm font-medium">{slot.subject.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {slotDetail(slot, isStudent ? 'student' : 'faculty')}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Card>
  )
}

function UpcomingEvents() {
  const from = startOfDay(new Date())
  const events = useEvents(from, addDays(from, 21))

  return (
    <Card title="Coming up" link={{ to: '/calendar', label: 'Calendar' }}>
      <div className="px-4">
        {events.isPending ? (
          <SkeletonRows rows={3} className="py-4" />
        ) : events.isError ? (
          <ErrorNotice error={events.error} onRetry={events.refetch} className="my-4" />
        ) : events.data.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">Nothing on the calendar for the next three weeks.</p>
        ) : (
          <div className="divide-y">
            {events.data.slice(0, 5).map((event) => (
              <EventItem key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}

function DueSoon() {
  const assignments = useMyAssignments({ pending: true })
  // hide the card entirely while the backend doesn't serve this list yet
  if (isNotImplemented(assignments.error)) return null

  return (
    <Card title="Due soon" link={{ to: '/assignments', label: 'All work' }}>
      {assignments.isPending ? (
        <SkeletonRows rows={2} className="p-4" />
      ) : assignments.isError ? (
        <ErrorNotice error={assignments.error} onRetry={assignments.refetch} className="m-4" />
      ) : assignments.data.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">You&apos;re all caught up.</p>
      ) : (
        <ul className="divide-y">
          {assignments.data.slice(0, 4).map(({ assignment, submission }) => (
            <AssignmentRow key={assignment.id} assignment={assignment} status={studentStatus(assignment, submission)} />
          ))}
        </ul>
      )}
    </Card>
  )
}

function StaffShortcuts() {
  const { user } = useAuth()
  const { classroom } = useMyClassroom()
  if (!classroom && !user.is_hod) return null

  return (
    <Card title="Shortcuts">
      <div className="grid gap-2 p-4">
        {classroom && (
          <Button asChild variant="outline" className="justify-start">
            <Link to="/attendance">
              <CalendarCheck2 /> Register for Class {classLabel(classroom)}
            </Link>
          </Button>
        )}
        {user.is_hod && (
          <Button asChild variant="outline" className="justify-start">
            <Link to="/marks">
              <ClipboardList /> Enter marks
            </Link>
          </Button>
        )}
      </div>
    </Card>
  )
}

export function OverviewPage() {
  const { user, isStudent, isFaculty } = useAuth()
  const now = new Date()

  return (
    <>
      <div className="mb-8">
        <p className="text-sm text-muted-foreground">{format(now, 'EEEE, d MMMM')}</p>
        <h1 className="mt-1 font-serif text-3xl font-semibold tracking-tight">
          {greeting(now)}, {user.first_name}
        </h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          {(isStudent || isFaculty) && <TodayClasses />}
          <UpcomingEvents />
        </div>
        <div className="space-y-6">
          {isStudent && <DueSoon />}
          {isFaculty && <StaffShortcuts />}
        </div>
      </div>
    </>
  )
}
