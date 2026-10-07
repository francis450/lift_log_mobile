import type { FoodDay } from '@/api/types';
import { foodDayPut } from '@/db/database';
import { queryClient } from '@/state/queryClient';
import { enqueueAndSync } from '@/sync';

import { updateFoodDay } from '../data';
import { makeEntry, totals, withEntry } from '../model';
import { markFoodDaySynced } from '../store';

const mockRows = new Map<string, { day: FoodDay; synced: boolean }>();

jest.mock('@/db/database', () => ({
  foodDayGet: jest.fn(async (date: string) => mockRows.get(date) ?? null),
  foodDayPut: jest.fn(async (date: string, day: FoodDay, synced: boolean) => {
    mockRows.set(date, { day, synced });
  }),
  foodDaysSince: jest.fn(async () => []),
  cacheGet: jest.fn(async () => null),
  cacheSet: jest.fn(async () => undefined),
}));
jest.mock('@/sync', () => ({ enqueueAndSync: jest.fn(async () => undefined) }));

const date = '2026-10-07';
const chapati = { food_name: 'Chapati', portion: '1 medium', kcal: 180, protein_g: 4 };

beforeAll(() => {
  // No garbage-collection timers, so Jest can exit as soon as the tests finish.
  queryClient.setDefaultOptions({ queries: { gcTime: Infinity } });
});

beforeEach(() => {
  mockRows.clear();
  queryClient.clear();
  jest.clearAllMocks();
});

describe('food day on the phone', () => {
  it('shows an add at once, saves it locally as unsynced, and queues it', async () => {
    const entry = makeEntry({ meal: 'lunch', item: chapati, qty: 2, source: 'search', now: new Date() });
    await updateFoodDay(date, (d) => withEntry(d, entry));

    const shown = queryClient.getQueryData<{ day: FoodDay; synced: boolean }>(['food-local', date])!;
    expect(shown.synced).toBe(false);
    expect(totals(shown.day.entries)).toEqual({ kcal: 360, protein_g: 8, entries: 1 });
    expect(foodDayPut).toHaveBeenCalledWith(date, shown.day, false);
    expect(enqueueAndSync).toHaveBeenCalledWith('food_day', date, shown.day);
    // Survives a restart: it's in the local table.
    expect(mockRows.get(date)?.day.entries).toHaveLength(1);
  });

  it('stacks quick edits on top of each other, and keeps a confirmed repeat as two entries', async () => {
    const first = makeEntry({ meal: 'dinner', item: chapati, qty: 1, source: 'search', now: new Date() });
    const again = makeEntry({ meal: 'dinner', item: chapati, qty: 1, source: 'search', now: new Date() });
    await Promise.all([updateFoodDay(date, (d) => withEntry(d, first)), updateFoodDay(date, (d) => withEntry(d, again))]);
    const day = queryClient.getQueryData<{ day: FoodDay }>(['food-local', date])!.day;
    expect(day.entries.map((e) => e.client_id)).toEqual([first.client_id, again.client_id]);
  });

  it('builds on the server copy when the phone has no pending change', async () => {
    const server: FoodDay = {
      food_date: date,
      client_updated_at: '2026-10-07T08:33:46.094Z',
      entries: [makeEntry({ meal: 'breakfast', item: chapati, qty: 1, source: 'migrated', now: new Date() })],
    };
    queryClient.setQueryData(['food-day', date], server);
    await updateFoodDay(date, (d) => withEntry(d, makeEntry({ meal: 'lunch', item: chapati, qty: 1, source: 'search', now: new Date() })));
    expect(mockRows.get(date)?.day.entries).toHaveLength(2);
  });

  it('marks the day synced, unless a newer edit was made while sending', async () => {
    const sent = await updateFoodDay(date, (d) => withEntry(d, makeEntry({ meal: 'lunch', item: chapati, qty: 1, source: 'search', now: new Date() })));
    await new Promise((r) => setTimeout(r, 2));
    const newer = await updateFoodDay(date, (d) => withEntry(d, makeEntry({ meal: 'lunch', item: chapati, qty: 2, source: 'search', now: new Date() })));

    await markFoodDaySynced(sent, sent);
    expect(mockRows.get(date)).toEqual({ day: newer, synced: false });

    await markFoodDaySynced(newer, newer);
    expect(mockRows.get(date)?.synced).toBe(true);
  });
});
