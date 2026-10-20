import { Pencil, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { EVENT_TYPE_LABELS, EVENT_TYPE_STYLES } from '@/lib/constants'
import { formatEventWhen, fullName } from '@/lib/format'
import { cn } from '@/lib/utils'

export function EventTypeBadge({ type, className }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded border px-1.5 py-0.5 text-[0.7rem] font-medium',
        EVENT_TYPE_STYLES[type]?.chip,
        className,
      )}
    >
      {EVENT_TYPE_LABELS[type] ?? type}
    </span>
  )
}

export function EventItem({ event, onEdit, onDelete, showCreator = false }) {
  return (
    <div className="group flex gap-3 py-3">
      <span
        className={cn('mt-1.5 size-2 shrink-0 rounded-full', EVENT_TYPE_STYLES[event.type]?.dot)}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="font-medium leading-snug">{event.title}</p>
          <EventTypeBadge type={event.type} />
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">{formatEventWhen(event)}</p>
        {event.description && (
          <p className="mt-1.5 whitespace-pre-line text-sm text-foreground/85">{event.description}</p>
        )}
        {showCreator && event.creator && (
          <p className="mt-1.5 text-xs text-muted-foreground">Added by {fullName(event.creator)}</p>
        )}
      </div>
      {(onEdit || onDelete) && (
        <div className="flex shrink-0 gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
          {onEdit && (
            <Button variant="ghost" size="icon-sm" onClick={() => onEdit(event)} aria-label="Edit event">
              <Pencil />
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onDelete(event)}
              aria-label="Delete event"
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 />
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
