import { Logo } from '@/components/layout/Logo'

export function AuthLayout({ title, description, children, footer }) {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center px-4 py-10">
      {/* faint ruled-paper lines, fading out towards the bottom */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(to_bottom,transparent_0,transparent_31px,var(--border)_31px,var(--border)_32px)] opacity-40 [mask-image:linear-gradient(to_bottom,transparent,black_20%,transparent_70%)]"
      />
      <div className="relative w-full max-w-sm">
        <Logo className="mb-8 justify-center" />
        <div className="rounded-xl border bg-card p-6 shadow-sm sm:p-7">
          <h1 className="font-serif text-xl font-semibold">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
          <div className="mt-6">{children}</div>
        </div>
        {footer && <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>}
      </div>
    </div>
  )
}
