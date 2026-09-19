import { Link } from 'react-router-dom'
import { EmptyState } from '@/components/common/EmptyState'

export function NotFound() {
  return (
    <EmptyState
      icon="search"
      title="Page not found"
      description="That link doesn't match anything here."
      action={
        <Link to="/" className="mt-1 text-sm font-medium text-signal-ink hover:underline">
          Back to dashboard
        </Link>
      }
    />
  )
}
