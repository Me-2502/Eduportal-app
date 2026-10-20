import { format } from 'date-fns'
import { useState } from 'react'
import { toast } from 'sonner'

import { Field, FormError } from '@/components/Field'
import { Spinner } from '@/components/states'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { getErrorMessage } from '@/lib/api'
import { EVENT_TYPES } from '@/lib/constants'
import { isAllDay } from '@/lib/format'

import { useCreateEvent, useUpdateEvent } from './api'

function initialValues(event, defaultDate) {
  if (!event) {
    return {
      title: '',
      type: 'event',
      description: '',
      allDay: true,
      startDate: format(defaultDate ?? new Date(), 'yyyy-MM-dd'),
      startTime: '09:00',
      endDate: '',
      endTime: '',
    }
  }
  const start = new Date(event.starts_at)
  const end = event.ends_at ? new Date(event.ends_at) : null
  return {
    title: event.title,
    type: event.type,
    description: event.description ?? '',
    allDay: isAllDay(event),
    startDate: format(start, 'yyyy-MM-dd'),
    startTime: format(start, 'HH:mm'),
    endDate: end ? format(end, 'yyyy-MM-dd') : '',
    endTime: end ? format(end, 'HH:mm') : '',
  }
}

/** Form values -> API body. Local dates/times become timezone-aware ISO strings. */
function toPayload(values) {
  const local = (date, time) => new Date(`${date}T${time}`)
  let startsAt
  let endsAt = null

  if (values.allDay) {
    startsAt = local(values.startDate, '00:00')
    endsAt = local(values.endDate || values.startDate, '23:59')
  } else {
    startsAt = local(values.startDate, values.startTime || '00:00')
    if (values.endTime) endsAt = local(values.endDate || values.startDate, values.endTime)
  }

  if (endsAt && endsAt < startsAt) return { error: 'The end must be after the start.' }

  return {
    body: {
      title: values.title.trim(),
      type: values.type,
      description: values.description.trim() || null,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt ? endsAt.toISOString() : null,
    },
  }
}

function EventForm({ event, defaultDate, onDone }) {
  const [values, setValues] = useState(() => initialValues(event, defaultDate))
  const [localError, setLocalError] = useState('')
  const create = useCreateEvent()
  const update = useUpdateEvent()
  const mutation = event ? update : create

  const set = (field) => (e) => setValues((v) => ({ ...v, [field]: e.target.value }))

  function handleSubmit(e) {
    e.preventDefault()
    const { body, error } = toPayload(values)
    setLocalError(error ?? '')
    if (error) return
    mutation.mutate(event ? { id: event.id, ...body } : body, {
      onSuccess: () => {
        toast.success(event ? 'Event updated.' : 'Event added to the calendar.')
        onDone()
      },
    })
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <Field label="Title" htmlFor="ev-title">
        <Input
          id="ev-title"
          maxLength={100}
          value={values.title}
          onChange={set('title')}
          placeholder="e.g. Annual sports day"
          autoFocus
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Type" htmlFor="ev-type">
          <Select value={values.type} onValueChange={(type) => setValues((v) => ({ ...v, type }))}>
            <SelectTrigger id="ev-type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EVENT_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <div className="flex items-end pb-2">
          <Label className="flex items-center gap-2 font-normal">
            <Switch
              checked={values.allDay}
              onCheckedChange={(allDay) => setValues((v) => ({ ...v, allDay }))}
            />
            All day
          </Label>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Starts" htmlFor="ev-start">
          <div className="flex gap-2">
            <Input id="ev-start" type="date" value={values.startDate} onChange={set('startDate')} required />
            {!values.allDay && (
              <Input
                type="time"
                aria-label="Start time"
                className="w-28"
                value={values.startTime}
                onChange={set('startTime')}
              />
            )}
          </div>
        </Field>
        <Field
          label="Ends"
          htmlFor="ev-end"
          hint={values.allDay ? 'Leave empty for a one-day event.' : 'Optional.'}
        >
          <div className="flex gap-2">
            <Input
              id="ev-end"
              type="date"
              min={values.startDate}
              value={values.endDate}
              onChange={set('endDate')}
            />
            {!values.allDay && (
              <Input
                type="time"
                aria-label="End time"
                className="w-28"
                value={values.endTime}
                onChange={set('endTime')}
              />
            )}
          </div>
        </Field>
      </div>

      <Field label="Details" htmlFor="ev-desc">
        <Textarea
          id="ev-desc"
          rows={3}
          maxLength={2000}
          value={values.description}
          onChange={set('description')}
          placeholder="Optional"
        />
      </Field>

      <FormError>{localError || (mutation.error && getErrorMessage(mutation.error))}</FormError>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={mutation.isPending || !values.title.trim() || !values.startDate}>
          {mutation.isPending && <Spinner />}
          {event ? 'Save changes' : 'Add event'}
        </Button>
      </DialogFooter>
    </form>
  )
}

export function EventDialog({ open, onOpenChange, event, defaultDate }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{event ? 'Edit event' : 'New event'}</DialogTitle>
          <DialogDescription>Everyone at school can see calendar events.</DialogDescription>
        </DialogHeader>
        {/* keyed so the form resets each time the dialog opens for a different event */}
        {open && (
          <EventForm
            key={event?.id ?? 'new'}
            event={event}
            defaultDate={defaultDate}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
