import { useQuery } from '@tanstack/react-query';

import { NetworkError } from '@/api/client';
import * as api from '@/api/endpoints';
import type { CheckinGetResponse, FoodDay, ProgressSummary } from '@/api/types';
import { cacheGet, cacheSet, foodDaysPending } from '@/db/database';
import { totals } from '@/food/model';
import { useAuth } from '@/state/auth';

async function cached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  try {
    const data = await fetcher();
    await cacheSet(key, data);
    return data;
  } catch (error) {
    if (error instanceof NetworkError) {
      const hit = await cacheGet<T>(key);
      if (hit) return hit;
    }
    throw error;
  }
}

/** Food logged on the phone but not yet synced counts toward the week's protein bars. */
export function withLocalProtein(summary: ProgressSummary, pending: FoodDay[]): ProgressSummary {
  const byDate = new Map(pending.map((d) => [d.food_date, d]));
  const protein_by_day = summary.protein_by_day.map((d) => {
    const local = byDate.get(d.date);
    if (!local) return d;
    return { date: d.date, protein_g: local.entries.length ? totals(local.entries).protein_g : null };
  });
  const target = summary.protein_target_g;
  const protein_days_hit = target
    ? protein_by_day.filter((d) => d.protein_g !== null && d.protein_g >= target).length
    : 0;
  return { ...summary, protein_by_day, protein_days_hit };
}

export function useProgress(week?: number) {
  const credentials = useAuth((s) => s.credentials);
  return useQuery({
    queryKey: ['progress', week ?? 'current'],
    enabled: !!credentials,
    queryFn: async () => {
      const summary = await cached(`progress:${week ?? 'current'}`, () => api.progressSummary(credentials!, week));
      return withLocalProtein(summary, await foodDaysPending<FoodDay>());
    },
  });
}

export function useCheckin(week: number) {
  const credentials = useAuth((s) => s.credentials);
  return useQuery({
    queryKey: ['checkin', week],
    enabled: !!credentials,
    queryFn: () => cached<CheckinGetResponse>(`checkin:${week}`, () => api.getCheckin(credentials!, week)),
  });
}
