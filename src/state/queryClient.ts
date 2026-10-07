import { QueryClient } from '@tanstack/react-query';

import { NetworkError } from '@/api/client';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Queries fall back to the SQLite cache themselves when offline, so always run them.
      networkMode: 'always',
      staleTime: 30_000,
      retry: (failureCount, error) => !(error instanceof NetworkError) && failureCount < 1,
    },
    mutations: { networkMode: 'always' },
  },
});
