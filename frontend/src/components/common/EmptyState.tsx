import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

interface EmptyStateProps {
  icon: IconName
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line px-6 py-16 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 text-ink-2">
        <Icon name={icon} size={20} />
      </div>
      <h3 className="text-base font-medium text-ink-1">{title}</h3>
      {description && <p className="max-w-sm text-sm text-ink-2">{description}</p>}
      {action}
    </div>
  )
}
