import { cn } from '@/lib/cn'

interface PulseProps {
  state: 'live' | 'overdue' | 'unknown'
}

/**
 * The one recurring motion motif in the app: a breathing dot that says "this system is
 * being watched." Live breathes gently; overdue holds still and red, which reads as
 * more alarming than motion would — stillness is the signal here, not another animation.
 */
export function Pulse({ state }: PulseProps) {
  if (state === 'unknown') {
    return <span className="inline-block h-2 w-2 rounded-full bg-ink-3" />
  }

  if (state === 'overdue') {
    return (
      <span className="relative inline-flex h-2 w-2">
        <span className="inline-block h-2 w-2 rounded-full bg-bad" />
      </span>
    )
  }

  return (
    <span className="relative inline-flex h-2 w-2 items-center justify-center">
      <span className="absolute inline-block h-2 w-2 animate-breathe rounded-full bg-ok" />
      <span className={cn('inline-block h-1.5 w-1.5 rounded-full bg-ok')} />
    </span>
  )
}
