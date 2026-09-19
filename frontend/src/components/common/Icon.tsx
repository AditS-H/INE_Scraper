import type { ReactNode } from 'react'

export type IconName =
  | 'search'
  | 'plus'
  | 'close'
  | 'chevronDown'
  | 'refresh'
  | 'stopCircle'
  | 'external'
  | 'alertTriangle'
  | 'sliders'
  | 'clock'
  | 'box'
  | 'arrowUp'
  | 'arrowDown'
  | 'minus'
  | 'bell'
  | 'tableView'
  | 'chartView'
  | 'inbox'
  | 'check'

interface IconProps {
  name: IconName
  size?: number
  className?: string
}

/**
 * One small hand-built line-icon set instead of a library — every glyph shares the
 * same 24x24 grid, 1.75 stroke and round joins, so the set reads as one voice.
 */
export function Icon({ name, size = 18, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}

const paths: Record<IconName, ReactNode> = {
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16" y2="16" />
    </>
  ),
  plus: (
    <>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </>
  ),
  close: (
    <>
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </>
  ),
  chevronDown: <polyline points="6 9 12 15 18 9" />,
  refresh: (
    <>
      <path d="M12 4 A8 8 0 1 1 4 12" />
      <polyline points="7 9 4 12 7 15" />
    </>
  ),
  stopCircle: (
    <>
      <circle cx="12" cy="12" r="9" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </>
  ),
  external: (
    <>
      <rect x="4" y="4" width="12" height="12" rx="2" />
      <path d="M11 13 20 4" />
      <path d="M15 4 20 4 20 9" />
    </>
  ),
  alertTriangle: (
    <>
      <path d="M12 3 22 20 2 20 Z" />
      <line x1="12" y1="9" x2="12" y2="14" />
      <circle cx="12" cy="17" r="0.5" fill="currentColor" />
    </>
  ),
  sliders: (
    <>
      <line x1="5" y1="5" x2="5" y2="19" />
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="19" y1="5" x2="19" y2="19" />
      <circle cx="5" cy="9" r="2" />
      <circle cx="12" cy="15" r="2" />
      <circle cx="19" cy="7" r="2" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 16 14" />
    </>
  ),
  box: (
    <>
      <path d="M4 8 12 4 20 8 20 16 12 20 4 16 Z" />
      <polyline points="4 8 12 12 20 8" />
      <line x1="12" y1="12" x2="12" y2="20" />
    </>
  ),
  arrowUp: (
    <>
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="6 11 12 5 18 11" />
    </>
  ),
  arrowDown: (
    <>
      <line x1="12" y1="5" x2="12" y2="19" />
      <polyline points="6 13 12 19 18 13" />
    </>
  ),
  minus: <line x1="5" y1="12" x2="19" y2="12" />,
  bell: (
    <>
      <path d="M6 10a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </>
  ),
  tableView: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="1.5" />
      <line x1="3.5" y1="10" x2="20.5" y2="10" />
      <line x1="3.5" y1="14.5" x2="20.5" y2="14.5" />
      <line x1="12" y1="4.5" x2="12" y2="19.5" />
    </>
  ),
  chartView: (
    <>
      <polyline points="4 15 9 9 13 12 20 5" />
      <line x1="4" y1="19" x2="20" y2="19" />
    </>
  ),
  inbox: (
    <>
      <path d="M4 12 8 12 10 15 14 15 16 12 20 12" />
      <path d="M6 5 18 5 20 12 20 18 4 18 4 12 Z" />
    </>
  ),
  check: <polyline points="5 13 10 18 19 7" />,
}
