import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parse,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/ConfirmDialog'
import { PageHeader } from '@/components/PageHeader'
import { ErrorNotice } from '@/components/states'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/auth-context'
import { getErrorMessage } from '@/lib/api'
import { EVENT_TYPE_STYLES, EVENT_TYPES } from '@/lib/constants'
import { cn } from '@/lib/utils'

import { useDeleteEvent, useEvents } from './api'
import { EventDialog } from './EventDialog'
import { EventItem } from './EventItem'

const WEEK = { weekStartsOn: 1 }
const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function eventsOn(day, events) {
  const dayStart = startOfDay(day)
  const dayEnd = endOfDay(day)
  return events.filter((event) => {
    const start = new Date(event.starts_at)
    const end = event.ends_at ? new Date(event.ends_at) : start
    return start <= dayEnd && end >= dayStart
  })
}

function useMonthParam() {
  const [params, setParams] = useSearchParams()
  const raw = params.get('month')
  const parsed = raw ? parse(raw, 'yyyy-MM', new Date()) : new Date()
  const month = Number.isNaN(parsed.getTime()) ? startOfMonth(new Date()) : startOfMonth(parsed)
  const setMonth = (next) => setParams({ month: format(next, 'yyyy-MM') }, { replace: true })
  return [month, setMonth]
}

export function CalendarPage() {
  const { user, isStaff, canManage } = useAuth()
  const [month, setMonth] = useMonthParam()
  const [selected, setSelected] = useState(() => startOfDay(new Date()))
  const [dialog, setDialog] = useState({ open: false, event: null })
  const [toDelete, setToDelete] = useState(null)

  const gridStart = startOfWeek(month, WEEK)
  const gridEnd = endOfWeek(endOfMonth(month), WEEK)
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })
  const eventsQuery = useEvents(gridStart, addDays(gridEnd, 1))
  const events = eventsQuery.data ?? []
  const deleteEvent = useDeleteEvent()

  const canEdit = (event) => isStaff && (event.creator?.id === user.id || canManage)
  const selectedEvents = eventsOn(selected, events)

  function goTo(next) {
    setMonth(next)
    setSelected(isSameMonth(next, new Date()) ? startOfDay(new Date()) : startOfMonth(next))
  }

  function confirmDelete() {
    deleteEvent.mutate(toDelete.id, {
      onSuccess: () => {
        toast.success('Event deleted.')
        setToDelete(null)
      },
      onError: (error) => toast.error(getErrorMessage(error)),
    })
  }

  return (
    <>
      <PageHeader
        title="Calendar"
        description="Holidays, exams and everything else happening at school."
        actions={
          isStaff && (
            <Button onClick={() => setDialog({ open: true, event: null })}>
              <Plus /> New event
            </Button>
          )
        }
      />

      {eventsQuery.isError && (
        <ErrorNotice error={eventsQuery.error} onRetry={eventsQuery.refetch} className="mb-4" />
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <section className="rounded-lg border bg-card">
          <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
            <h2 className="font-serif text-lg font-semibold">{format(month, 'MMMM yyyy')}</h2>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={() => goTo(startOfMonth(new Date()))}>
                Today
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={() => goTo(addMonths(month, -1))} aria-label="Previous month">
                <ChevronLeft />
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={() => goTo(addMonths(month, 1))} aria-label="Next month">
                <ChevronRight />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-7 border-b text-center text-xs font-medium text-muted-foreground">
            {WEEKDAY_LABELS.map((label) => (
              <div key={label} className="py-2">
                {label}
              </div>
            ))}
          </div>

          <div
            className={cn(
              'grid grid-cols-7 transition-opacity',
              eventsQuery.isPlaceholderData && 'opacity-60',
            )}
          >
            {days.map((day) => {
              const dayEvents = eventsOn(day, events)
              const inMonth = isSameMonth(day, month)
              const isSelected = isSameDay(day, selected)
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => setSelected(startOfDay(day))}
                  aria-pressed={isSelected}
                  aria-label={`${format(day, 'EEEE d MMMM')}, ${dayEvents.length} events`}
                  className={cn(
                    'relative flex min-h-16 flex-col items-stretch gap-1 border-b border-r p-1.5 text-left outline-none transition-colors sm:min-h-24',
                    '[&:nth-child(7n)]:border-r-0 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring',
                    inMonth ? 'hover:bg-accent/50' : 'bg-muted/40 text-muted-foreground',
                    isSelected && 'bg-primary/5 hover:bg-primary/5',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-6 items-center justify-center self-start rounded-full text-xs tabular',
                      isToday(day) && 'bg-marker font-semibold text-white',
                      isSelected && !isToday(day) && 'ring-1 ring-primary',
                    )}
                  >
                    {format(day, 'd')}
                  </span>
                  {/* chips on wider screens, dots on phones */}
                  <span className="hidden flex-col gap-0.5 sm:flex">
                    {dayEvents.slice(0, 2).map((event) => (
                      <span
                        key={event.id}
                        className={cn(
                          'truncate rounded-sm border px-1 py-px text-[0.7rem] leading-tight',
                          EVENT_TYPE_STYLES[event.type]?.chip,
                        )}
                      >
                        {event.title}
                      </span>
                    ))}
                    {dayEvents.length > 2 && (
                      <span className="px-1 text-[0.7rem] text-muted-foreground">
                        +{dayEvents.length - 2} more
                      </span>
                    )}
                  </span>
                  <span className="flex flex-wrap gap-0.5 sm:hidden">
                    {dayEvents.slice(0, 3).map((event) => (
                      <span key={event.id} className={cn('size-1.5 rounded-full', EVENT_TYPE_STYLES[event.type]?.dot)} />
                    ))}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-3 text-xs text-muted-foreground">
            {EVENT_TYPES.map((type) => (
              <span key={type.value} className="inline-flex items-center gap-1.5">
                <span className={cn('size-2 rounded-full', EVENT_TYPE_STYLES[type.value].dot)} />
                {type.label}
              </span>
            ))}
          </div>
        </section>

        <aside className="rounded-lg border bg-card lg:self-start">
          <div className="border-b px-4 py-3">
            <p className="text-xs text-muted-foreground">{format(selected, 'EEEE')}</p>
            <h2 className="font-serif text-lg font-semibold">{format(selected, 'd MMMM')}</h2>
          </div>
          <div className="px-4">
            {selectedEvents.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center text-sm text-muted-foreground">
                <CalendarDays className="mb-2 size-5 opacity-60" aria-hidden />
                Nothing planned for this day.
                {isStaff && (
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => setDialog({ open: true, event: null })}
                  >
                    Add an event
                  </Button>
                )}
              </div>
            ) : (
              <div className="divide-y">
                {selectedEvents.map((event) => (
                  <EventItem
                    key={event.id}
                    event={event}
                    showCreator
                    onEdit={canEdit(event) ? (ev) => setDialog({ open: true, event: ev }) : undefined}
                    onDelete={canEdit(event) ? setToDelete : undefined}
                  />
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>

      <EventDialog
        open={dialog.open}
        event={dialog.event}
        defaultDate={selected}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
      />
      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Delete this event?"
        description={toDelete && `"${toDelete.title}" will be removed from everyone's calendar.`}
        onConfirm={confirmDelete}
        pending={deleteEvent.isPending}
      />
    </>
  )
}
