import { Link } from 'react-router'

import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60svh] flex-col items-center justify-center text-center">
      <p className="font-serif text-6xl font-semibold text-muted-foreground/50">404</p>
      <h1 className="mt-4 text-lg font-medium">This page doesn&apos;t exist</h1>
      <p className="mt-1 text-sm text-muted-foreground">The link may be old, or mistyped.</p>
      <Button asChild variant="outline" className="mt-6">
        <Link to="/">Back to overview</Link>
      </Button>
    </div>
  )
}
