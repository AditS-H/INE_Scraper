import { useEffect, useRef, useState } from 'react'
import { isNotImplemented } from '@/api/types'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { Icon } from '@/components/common/Icon'
import { SkeletonRow } from '@/components/common/Skeleton'
import { useToast } from '@/components/common/toast-context'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useStoreSearch, useTrackedIdSet, useTrackedProducts, useTrackProduct } from '@/hooks/useApi'
import { SEARCH_DEBOUNCE_MS } from '@/lib/constants'
import { SearchResultRow } from './SearchResultRow'

interface SearchModalProps {
  open: boolean
  onClose: () => void
}

export function SearchModal({ open, onClose }: SearchModalProps) {
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS)
  const inputRef = useRef<HTMLInputElement>(null)
  const { show } = useToast()

  const search = useStoreSearch(debouncedQuery)
  const tracked = useTrackedProducts()
  const trackedIds = useTrackedIdSet(tracked.data?.items)
  const trackMutation = useTrackProduct()

  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  const trimmed = debouncedQuery.trim()
  const items = search.data?.items ?? []

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-surface-0/70 px-4 pb-10 pt-[12vh] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative z-10 w-full max-w-lg animate-pop-in overflow-hidden rounded-2xl border border-line bg-surface-1 shadow-2xl shadow-black/50"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-line px-4 py-3.5">
          <Icon name="search" size={17} className="shrink-0 text-ink-3" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search products by name…"
            className="w-full bg-transparent text-sm text-ink-1 placeholder:text-ink-3 focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-md p-1 text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink-1"
          >
            <Icon name="close" size={15} />
          </button>
        </div>

        <div className="max-h-[55vh] overflow-y-auto p-1.5">
          {trimmed.length < 2 && (
            <p className="px-3 py-8 text-center text-sm text-ink-3">
              Type at least 2 characters to search the store.
            </p>
          )}

          {trimmed.length >= 2 && search.isLoading && (
            <div className="flex flex-col gap-1">
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </div>
          )}

          {trimmed.length >= 2 && search.isError && (
            <ErrorState
              compact
              message={search.error instanceof Error ? search.error.message : 'Search failed.'}
              onRetry={() => search.refetch()}
            />
          )}

          {trimmed.length >= 2 && search.isSuccess && items.length === 0 && (
            <EmptyState
              icon="search"
              title="No matches"
              description={`Nothing in the store matches “${trimmed}”.`}
            />
          )}

          {trimmed.length >= 2 && search.isSuccess && items.length > 0 && (
            <div className="flex flex-col gap-0.5">
              {items.map((product) => (
                <SearchResultRow
                  key={product.id}
                  product={product}
                  isTracked={trackedIds.has(String(product.id))}
                  isPending={
                    trackMutation.isPending && trackMutation.variables?.store_product_id === String(product.id)
                  }
                  onTrack={() => {
                    trackMutation.mutate(
                      {
                        store_product_id: String(product.id),
                        name: product.name,
                        category: product.category,
                        brand: product.brand,
                        description: product.description,
                      },
                      {
                        onSuccess: () => show(`Tracking ${product.name}`, 'success'),
                        onError: (error) =>
                          show(error instanceof Error ? error.message : 'Could not track that product.', 'error'),
                      },
                    )
                  }}
                />
              ))}
            </div>
          )}

          {tracked.isError && !isNotImplemented(tracked.error) && (
            <p className="border-t border-line-soft px-3 py-2 text-xs text-ink-3">
              Couldn't confirm which products are already tracked.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}