import { cn } from '@/lib/utils'

export function Logo({ className }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <span
        aria-hidden
        className="flex size-8 items-center justify-center rounded-md bg-primary font-serif text-lg font-semibold leading-none text-primary-foreground"
      >
        e
      </span>
      <span className="font-serif text-lg font-semibold tracking-tight">Eduportal</span>
    </span>
  )
}
