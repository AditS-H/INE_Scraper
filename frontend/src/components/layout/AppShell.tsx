import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { AlertsBell } from './AlertsBell'
import { HealthBanner } from './HealthBanner'
import { Icon } from '@/components/common/Icon'
import { Pulse } from '@/components/common/Pulse'
import { SearchModal } from '@/components/search/SearchModal'
import { useHealth } from '@/hooks/useApi'
import { cn } from '@/lib/cn'

export interface AppOutletContext {
  openSearch: () => void
}

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
    isActive ? 'bg-surface-2 text-ink-1' : 'text-ink-2 hover:text-ink-1',
  )

export function AppShell() {
  const [searchOpen, setSearchOpen] = useState(false)
  const { data: health, isError } = useHealth()

  const pulseState = isError ? 'unknown' : health?.overdue ? 'overdue' : health ? 'live' : 'unknown'
  const pulseLabel = isError ? 'Unreachable' : health?.overdue ? 'Overdue' : health ? 'Live' : 'Connecting'

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line bg-surface-0/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-5 py-3.5">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-line bg-surface-2">
              <Pulse state={pulseState} />
            </span>
            <span className="font-semibold tracking-tight text-ink-1">INE Price Tracker</span>
          </Link>

          <nav className="ml-2 flex items-center gap-1">
            <NavLink to="/" end className={navLinkClass}>
              Dashboard
            </NavLink>
            <NavLink to="/health" className={navLinkClass}>
              Health
            </NavLink>
          </nav>

          <div className="ml-auto flex items-center gap-1.5">
            <span className="hidden text-sm text-ink-3 sm:inline">{pulseLabel}</span>
            <AlertsBell />
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-signal px-3 py-1.5 text-sm font-medium text-surface-0 transition-transform active:scale-95"
            >
              <Icon name="plus" size={15} />
              <span className="hidden sm:inline">Track a product</span>
            </button>
          </div>
        </div>
      </header>

      <HealthBanner />

      <main className="mx-auto max-w-6xl px-5 py-8">
        <Outlet context={{ openSearch: () => setSearchOpen(true) } satisfies AppOutletContext} />
      </main>

      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
}
