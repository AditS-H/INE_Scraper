export function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-line bg-surface-1 p-5">
      <div className="skeleton h-3.5 w-2/3 rounded" />
      <div className="skeleton mt-4 h-7 w-1/2 rounded" />
      <div className="skeleton mt-5 h-10 w-full rounded-lg" />
      <div className="mt-4 flex gap-2">
        <div className="skeleton h-6 w-20 rounded-full" />
        <div className="skeleton h-6 w-16 rounded-full" />
      </div>
    </div>
  )
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 border-b border-line-soft px-4 py-3">
      <div className="skeleton h-3.5 w-28 rounded" />
      <div className="skeleton h-3.5 w-20 rounded" />
      <div className="skeleton h-3.5 w-16 rounded" />
      <div className="skeleton ml-auto h-3.5 w-24 rounded" />
    </div>
  )
}

export function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`skeleton rounded-lg ${className ?? 'h-4 w-full'}`} />
}
