import { useQuery } from '@tanstack/react-query';

import * as api from '@/api/endpoints';
import type { PlanChange, ReviewStats, WeeklyReview } from '@/api/types';
import { cacheGet, cacheSet } from '@/db/database';
import { useAuth } from '@/state/auth';
import { queryClient } from '@/state/queryClient';

async function cachedOr<T>(key: string, fetcher: () => Promise<T>, fallback?: T): Promise<T> {
  try {
    const data = await fetcher();
    await cacheSet(key, data);
    return data;
  } catch (error) {
    const hit = await cacheGet<T>(key);
    if (hit) return hit;
    if (fallback !== undefined) return fallback;
    throw error;
  }
}

/** The week's numbers (no Claude): shown as the stat tiles while the review is written. */
export function useReviewStats(week: number) {
  const credentials = useAuth((s) => s.credentials);
  return useQuery({
    queryKey: ['review-stats', week],
    enabled: !!credentials,
    queryFn: () => cachedOr<ReviewStats>(`review-stats:${week}`, () => api.reviewStats(credentials!, week)),
  });
}

export function useWeeklyReview(week: number) {
  const credentials = useAuth((s) => s.credentials);
  return useQuery({
    queryKey: ['weekly-review', week],
    enabled: !!credentials,
    retry: false,
    staleTime: Infinity,
    queryFn: () => cachedOr<WeeklyReview>(`weekly-review:${week}`, () => api.weeklyReview(credentials!, week)),
  });
}

export async function regenerateReview(week: number): Promise<WeeklyReview> {
  const credentials = useAuth.getState().credentials!;
  const review = await api.weeklyReview(credentials, week, true);
  queryClient.setQueryData(['weekly-review', week], review);
  await cacheSet(`weekly-review:${week}`, review);
  return review;
}

/** Accepted changes for a week; empty when offline with nothing cached or on an older server. */
export function usePlanChanges(week: number | null) {
  const credentials = useAuth((s) => s.credentials);
  return useQuery({
    queryKey: ['plan-changes', week],
    enabled: !!credentials && !!week,
    queryFn: () => cachedOr<PlanChange[]>(`plan-changes:${week}`, () => api.planChanges(credentials!, week!), []),
  });
}
