import { AlertCircle, Hammer, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { getErrorMessage, isNotImplemented } from '@/lib/api'
import { cn } from '@/lib/utils'

export function Spinner({ className }) {
  return <Loader2 className={cn('size-4 animate-spin', className)} aria-hidden />
}

export function FullPageSpinner() {
  return (
    <div className="flex min-h-svh items-center justify-center text-muted-foreground">
      <Spinner className="size-5" />
      <span className="sr-only">Loading</span>
    </div>
  )
}

export function SkeletonRows({ rows = 4, className }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-11 w-full" />
      ))}
    </div>
  )
}

export function EmptyState({ icon: Icon, title, children, action, className }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center rounded-lg border border-dashed px-6 py-12 text-center',
        className,
      )}
    >
      {Icon && <Icon className="mb-3 size-6 text-muted-foreground/70" aria-hidden />}
      <p className="font-medium">{title}</p>
      {children && <div className="mt-1 max-w-sm text-sm text-muted-foreground">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

/**
 * Error block for a failed query. A 501 from the API is a feature that is still
 * being built on the backend, so it gets a calmer message than a real failure.
 */
export function ErrorNotice({ error, onRetry, className }) {
  if (isNotImplemented(error)) {
    return (
      <EmptyState icon={Hammer} title="Coming soon" className={className}>
        This section isn&apos;t available on the server yet.
      </EmptyState>
    )
  }
  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm',
        className,
      )}
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
      <div className="flex-1">
        <p className="font-medium text-destructive">Couldn&apos;t load this</p>
        <p className="mt-0.5 text-muted-foreground">{getErrorMessage(error)}</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={() => onRetry()}>
          Try again
        </Button>
      )}
    </div>
  )
}
