import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

/** Label + control + optional hint, so forms don't repeat the same wrapper everywhere. */
export function Field({ label, htmlFor, hint, className, children }) {
  return (
    <div className={cn('grid gap-1.5', className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

/** Inline error under a form, e.g. the message from a failed mutation. */
export function FormError({ children }) {
  if (!children) return null
  return (
    <p role="alert" className="text-sm text-destructive">
      {children}
    </p>
  )
}
