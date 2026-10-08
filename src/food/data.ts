// Food days on the phone: edits save to SQLite first and sync through the outbox. A day with an
// unsynced change shows the phone's copy; otherwise the server's.

import { useQuery } from '@tanstack/react-query';

import * as api from '@/api/endpoints';
import type { FoodDay, FoodItem, FoodSearchResult } from '@/api/types';
import { cacheGet, cacheSet, foodDayGet, foodDayPut, foodDaysSince, LocalFoodDay } from '@/db/database';
import { addDays } from '@/lib/dates';
import { useAuth } from '@/state/auth';
import { queryClient } from '@/state/queryClient';
import { syncReminders } from '@/reminders';
import { enqueueAndSync } from '@/sync';

import { emptyDay, mergeRecent, recentFromDays } from './model';
import { localKey, serverKey } from './store';

async function fetchServerDay(date: string): Promise<FoodDay | null> {
  const credentials = useAuth.getState().credentials;
  if (!credentials) return null;
  try {
    const day = await api.getFoodDay(credentials, date);
    await cacheSet(`food-day:${date}`, day);
    return day;
  } catch {
    return cacheGet<FoodDay>(`food-day:${date}`);
  }
}

export function useFoodDay(date: string) {
  const local = useQuery({ queryKey: localKey(date), queryFn: () => foodDayGet<FoodDay>(date) });
  const server = useQuery({ queryKey: serverKey(date), queryFn: () => fetchServerDay(date) });
  const pending = !!local.data && !local.data.synced;
  const day = (pending ? local.data!.day : (server.data ?? local.data?.day)) ?? emptyDay(date);
  return {
    day,
    pending,
    loading: local.isPending || (server.isPending && !local.data),
    refetch: () => Promise.all([local.refetch(), server.refetch()]),
  };
}

/** The day as currently shown, read from the query cache at call time so rapid edits stack up. */
function currentDay(date: string): FoodDay {
  const local = queryClient.getQueryData<LocalFoodDay<FoodDay> | null>(localKey(date));
  if (local && !local.synced) return local.day;
  return queryClient.getQueryData<FoodDay | null>(serverKey(date)) ?? local?.day ?? emptyDay(date);
}

/** Apply an edit to a day: shown at once, saved on the phone, queued for the server. */
export async function updateFoodDay(date: string, edit: (day: FoodDay) => FoodDay): Promise<FoodDay> {
  const next: FoodDay = { ...edit(currentDay(date)), food_date: date, client_updated_at: new Date().toISOString() };
  queryClient.setQueryData(localKey(date), { day: next, synced: false });
  await foodDayPut(date, next, false);
  await enqueueAndSync('food_day', date, next);
  void queryClient.invalidateQueries({ queryKey: ['today'] });
  void queryClient.invalidateQueries({ queryKey: ['food-recent'] });
  // Logging dinner cancels tonight's "Log dinner" reminder.
  void syncReminders();
  return next;
}

/** Recent, mine and library foods: fetched once and searched on the phone, so search works offline. */
export function useFoodLibrary(today: string) {
  const credentials = useAuth((s) => s.credentials);
  const server = useQuery({
    queryKey: ['food-library'],
    enabled: !!credentials,
    queryFn: async (): Promise<FoodSearchResult> => {
      try {
        const result = await api.foodSearch(credentials!, '', 100);
        await cacheSet('food-library', result);
        return result;
      } catch {
        return (await cacheGet<FoodSearchResult>('food-library')) ?? { recent: [], mine: [], library: [] };
      }
    },
  });
  const local = useQuery({
    queryKey: ['food-recent'],
    queryFn: () => foodDaysSince<FoodDay>(addDays(today, -30)),
  });
  const result = server.data ?? { recent: [], mine: [], library: [] };
  return {
    recent: mergeRecent(recentFromDays(local.data ?? []), result.recent),
    mine: result.mine,
    library: result.library,
    loading: server.isPending,
  };
}

/** Save a custom food to "my foods": shown in search at once, synced in the background. */
export async function saveCustomFood(item: Omit<FoodItem, 'name'>): Promise<void> {
  const existing = queryClient.getQueryData<FoodSearchResult>(['food-library']);
  if (existing) {
    const mine = [
      { ...item, name: null },
      ...existing.mine.filter((m) => m.food_name.toLowerCase() !== item.food_name.toLowerCase()),
    ];
    queryClient.setQueryData(['food-library'], { ...existing, mine });
  }
  await enqueueAndSync('food_item', item.food_name.toLowerCase(), item);
}
