import type { FoodDay, ProgressSummary } from '@/api/types';
import { niceScale } from '@/components/LineChart';
import { barScale } from '@/components/ProteinBars';
import { makeEntry } from '@/food/model';

import { withLocalProtein } from '../data';

jest.mock('@/db/database', () => ({ cacheGet: jest.fn(), cacheSet: jest.fn(), foodDaysPending: jest.fn(async () => []) }));
jest.mock('react-native-svg', () => ({}));

const summary: ProgressSummary = {
  week: 1,
  sessions: { done: 1, planned_to_date: 2 },
  protein_target_g: 130,
  protein_days_hit: 0,
  protein_by_day: [
    { date: '2026-10-05', protein_g: null },
    { date: '2026-10-06', protein_g: 125 },
    { date: '2026-10-07', protein_g: 19 },
    { date: '2026-10-08', protein_g: null },
    { date: '2026-10-09', protein_g: null },
    { date: '2026-10-10', protein_g: null },
    { date: '2026-10-11', protein_g: null },
  ],
  lifts: [],
  bodyweight: [],
  forearm: [],
};

describe('protein bars follow the food days', () => {
  it('uses unsynced food logged on the phone and recounts days hit', () => {
    const now = new Date('2026-10-07T18:00:00Z');
    const pending: FoodDay = {
      food_date: '2026-10-07',
      client_updated_at: now.toISOString(),
      entries: [
        makeEntry({ meal: 'breakfast', item: { food_name: 'Mandazi', portion: '1', kcal: 250, protein_g: 4 }, qty: 2, source: 'search', now }),
        makeEntry({ meal: 'dinner', item: { food_name: 'Chicken breast', portion: '250 g', kcal: 410, protein_g: 77 }, qty: 2, source: 'search', now }),
      ],
    };
    const merged = withLocalProtein(summary, [pending]);
    expect(merged.protein_by_day[2]).toEqual({ date: '2026-10-07', protein_g: 162 });
    expect(merged.protein_by_day[1].protein_g).toBe(125);
    expect(merged.protein_days_hit).toBe(1);
  });

  it('leaves the server numbers alone with nothing pending', () => {
    expect(withLocalProtein(summary, [])).toEqual(summary);
  });
});

describe('chart scales', () => {
  it('puts the target line under the top with headroom', () => {
    const { targetY, heights } = barScale([null, 125, 19], 130, 104);
    expect(targetY).toBeCloseTo(83.2);
    expect(heights[0]).toBeNull();
    expect(heights[1]).toBeCloseTo(80);
    expect(heights[2]).toBeGreaterThanOrEqual(4);
  });

  it('gives clean y ticks around body weights', () => {
    const { lo, hi, ticks } = niceScale([72, 71.6, 71.2]);
    expect(lo).toBeLessThanOrEqual(71.2);
    expect(hi).toBeGreaterThanOrEqual(72);
    expect(ticks.length).toBeGreaterThanOrEqual(3);
    expect(ticks.length).toBeLessThanOrEqual(5);
    expect(ticks.every((t) => Number.isFinite(t))).toBe(true);
  });

  it('never collapses a flat series', () => {
    const { lo, hi } = niceScale([29, 29]);
    expect(hi).toBeGreaterThan(lo);
  });
});
