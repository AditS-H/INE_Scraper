import { useEffect, useRef, useState } from 'react'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'

const easeOut = (t: number) => 1 - (1 - t) ** 3

/**
 * Animates a number ticking from its previous value to a new one — never on first
 * mount, only when `value` actually changes, so a grid of cards doesn't all count
 * up from zero on load. That would be decoration; a price that visibly moves when
 * it changes is the earned version (dynamic-web: "communicates system state").
 */
export function useCountUp(value: number | null | undefined, durationMs = 700): number | null {
  const [displayed, setDisplayed] = useState<number | null>(value ?? null)
  const previous = useRef<number | null>(value ?? null)
  const raf = useRef(0)
  const reduced = usePrefersReducedMotion()

  useEffect(() => {
    const target = value ?? null
    const from = previous.current

    if (target === null || from === null || from === target || reduced) {
      previous.current = target
      setDisplayed(target)
      return
    }

    const start = performance.now()
    const tick = (now: number) => {
      const progress = Math.min((now - start) / durationMs, 1)
      const next = from + (target - from) * easeOut(progress)
      setDisplayed(next)
      if (progress < 1) {
        raf.current = requestAnimationFrame(tick)
      } else {
        previous.current = target
      }
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [value, durationMs, reduced])

  return displayed
}
