import { lazy, Suspense } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { isApiConfigured } from '@/api/client'
import { Spinner } from '@/components/common/Spinner'
import { ToastProvider } from '@/components/common/ToastProvider'
import { AppShell } from '@/components/layout/AppShell'
import { queryClient } from '@/lib/queryClient'
import { ConfigError } from '@/pages/ConfigError'
import { NotFound } from '@/pages/NotFound'

// Lazy-loaded so Recharts (only needed on the product page) doesn't bloat the
// dashboard's initial bundle.
const Dashboard = lazy(() => import('@/pages/Dashboard').then((m) => ({ default: m.Dashboard })))
const ProductDetail = lazy(() => import('@/pages/ProductDetail').then((m) => ({ default: m.ProductDetail })))
const Health = lazy(() => import('@/pages/Health').then((m) => ({ default: m.Health })))

function PageFallback() {
  return (
    <div className="flex justify-center py-24 text-ink-3">
      <Spinner size={22} />
    </div>
  )
}

export default function App() {
  if (!isApiConfigured) {
    return <ConfigError />
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppShell />}>
              <Route
                path="/"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <Dashboard />
                  </Suspense>
                }
              />
              <Route
                path="/p/:id"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <ProductDetail />
                  </Suspense>
                }
              />
              <Route
                path="/health"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <Health />
                  </Suspense>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  )
}
