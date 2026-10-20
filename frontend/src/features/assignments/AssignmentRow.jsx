import { format } from 'date-fns'
import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'

import { subjectTone } from '@/lib/format'
import { cn } from '@/lib/utils'

const TONES = {
  good: 'bg-ev-holiday/12 text-ev-holiday',
  neutral: 'bg-secondary text-secondary-foreground',
  warn: 'bg-ev-meeting/15 text-ev-meeting',
  bad: 'bg-destructive/10 text-destructive',
  todo: 'bg-ev-event/12 text-ev-event',
}

export function StatusBadge({ status }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-xs font-medium whitespace-nowrap',
        TONES[status.tone],
      )}
    >
      {status.label}
    </span>
  )
}

/** One line in an assignment list. `meta` is extra text, e.g. the class for staff. */
export function AssignmentRow({ assignment, status, meta }) {
  return (
    // container query: in a narrow card the badge drops under the title instead of squeezing it
    <li className="@container">
      <Link
        to={`/assignments/${assignment.id}`}
        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/40"
      >
        <span
          className={cn('w-1 self-stretch shrink-0 rounded-full border-l-[3px]', subjectTone(assignment.subject.code))}
          aria-hidden
        />
        <span className="flex min-w-0 flex-1 flex-col gap-1.5 @lg:flex-row @lg:items-center @lg:gap-3">
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{assignment.title}</span>
            <span className="block truncate text-sm text-muted-foreground">
              {[assignment.subject.name, meta, `Due ${format(new Date(assignment.due_at), 'EEE d MMM, HH:mm')}`]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </span>
          {status && (
            <span>
              <StatusBadge status={status} />
            </span>
          )}
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </li>
  )
}
