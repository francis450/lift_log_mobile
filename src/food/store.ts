// Food-day storage shared by the screens and the sync queue (kept free of the sync import).

import type { FoodDay } from '@/api/types';
import { cacheSet, foodDayGet, foodDayPut } from '@/db/database';
import { queryClient } from '@/state/queryClient';

export const localKey = (date: string) => ['food-local', date];
export const serverKey = (date: string) => ['food-day', date];

/** Called by the sync queue once the server has the day (or sent back a newer copy). */
export async function markFoodDaySynced(sent: FoodDay | null, stored: FoodDay): Promise<void> {
  const date = stored.food_date;
  const local = await foodDayGet<FoodDay>(date);
  // A newer edit was made while this one was sending: keep it pending.
  if (sent && local && !local.synced && local.day.client_updated_at !== sent.client_updated_at) return;
  await foodDayPut(date, stored, true);
  queryClient.setQueryData(localKey(date), { day: stored, synced: true });
  queryClient.setQueryData(serverKey(date), stored);
  await cacheSet(`food-day:${date}`, stored);
}
