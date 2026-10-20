import { Menu } from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet } from 'react-router'

import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { useAuth } from '@/features/auth/auth-context'
import { cn } from '@/lib/utils'

import { Logo } from './Logo'
import { navForRole } from './nav'
import { UserMenu } from './UserMenu'

function NavItem({ item, onNavigate }) {
  const { to, label, icon: Icon, end } = item
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'group flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors',
          isActive
            ? 'bg-card font-medium text-foreground shadow-xs ring-1 ring-border'
            : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-foreground',
        )
      }
    >
      <Icon
        className="size-4 text-muted-foreground group-aria-[current=page]:text-primary"
        aria-hidden
      />
      {label}
    </NavLink>
  )
}

function SidebarNav({ onNavigate }) {
  const { user } = useAuth()

  return (
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4" aria-label="Main">
      {navForRole(user.role).map((section, index) => (
        <div key={section.title ?? index}>
          {section.title && (
            <p className="mb-1.5 px-2 text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground/80">
              {section.title}
            </p>
          )}
          <ul className="space-y-0.5">
            {section.items.map((item) => (
              <li key={item.to}>
                <NavItem item={item} onNavigate={onNavigate} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

function SidebarBody({ onNavigate }) {
  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="flex h-14 items-center px-5">
        <Logo />
      </div>
      <SidebarNav onNavigate={onNavigate} />
      <div className="border-t border-sidebar-border p-2">
        <UserMenu />
      </div>
    </div>
  )
}

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="min-h-svh lg:grid lg:grid-cols-[15.5rem_1fr]">
      <aside className="sticky top-0 hidden h-svh border-r border-sidebar-border lg:block">
        <SidebarBody />
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur lg:hidden">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
        >
          <Menu />
        </Button>
        <Logo />
      </header>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <SheetDescription className="sr-only">Main navigation</SheetDescription>
          <SidebarBody onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <main className="min-w-0">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
