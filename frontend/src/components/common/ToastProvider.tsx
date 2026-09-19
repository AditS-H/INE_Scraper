import { useCallback, useState, type ReactNode } from 'react'
import { Icon } from './Icon'
import { ToastContext, type ToastItem, type ToastTone } from './toast-context'
import { cn } from '@/lib/cn'

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const show = useCallback((message: string, tone: ToastTone = 'default') => {
    const id = Math.random().toString(36).slice(2)
    setToasts((current) => [...current, { id, message, tone }])
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id))
    }, 3400)
  }, [])

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={cn(
              'animate-pop-in pointer-events-auto flex items-center gap-2 rounded-full border px-4 py-2 text-sm shadow-lg shadow-black/30 backdrop-blur',
              toast.tone === 'success' && 'border-ok/30 bg-ok-dim text-ok',
              toast.tone === 'error' && 'border-bad/30 bg-bad-dim text-bad',
              toast.tone === 'default' && 'border-line bg-surface-2 text-ink-1',
            )}
          >
            {toast.tone === 'error' && <Icon name="alertTriangle" size={14} />}
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
