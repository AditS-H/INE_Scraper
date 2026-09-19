import { keepPreviousData, QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 15_000,
      // Switching range/page shows the previous data instead of flashing empty —
      // and react-query already keeps last-good `data` on a failed background
      // refetch by default, which covers contract §23's "errors preserve existing data".
      placeholderData: keepPreviousData,
    },
    mutations: {
      retry: 0,
    },
  },
})
