import type { FoodDay, FoodItem } from '@/api/types';

import {
  emptyDay,
  isDoubleAdd,
  makeEntry,
  mealForTime,
  mergeRecent,
  recentFromDays,
  searchFoods,
  stepQty,
  totals,
  withEntry,
  withoutEntry,
  withQty,
} from '../model';

const chapati: FoodItem = { name: 'x', food_name: 'Chapati', portion: '1 medium', kcal: 180, protein_g: 4 };
const chai: FoodItem = { name: 'y', food_name: 'Chai with milk and sugar', portion: '1 cup', kcal: 90, protein_g: 2 };
const stew: FoodItem = { name: 'z', food_name: 'Chicken stew', portion: 'fist-size (~100 g)', kcal: 220, protein_g: 25 };
const choma: FoodItem = { name: 'w', food_name: 'Nyama choma (goat)', portion: '200 g', kcal: 400, protein_g: 48 };

describe('meal preset by time of day', () => {
  it.each([
    [10 * 60 + 59, 'breakfast'],
    [11 * 60, 'lunch'],
    [15 * 60 + 59, 'lunch'],
    [16 * 60, 'dinner'],
    [20 * 60 + 59, 'dinner'],
    [21 * 60, 'snacks'],
  ])('%i minutes -> %s', (minutes, meal) => {
    expect(mealForTime(minutes)).toBe(meal);
  });
});

describe('food day', () => {
  it('adds, edits and removes entries; totals follow', () => {
    const now = new Date('2026-10-07T08:00:00Z');
    let day: FoodDay = emptyDay('2026-10-07');
    const mandazi = makeEntry({ meal: 'breakfast', item: { food_name: 'Mandazi', portion: '1', kcal: 250, protein_g: 4 }, qty: 2, source: 'search', now });
    const egg = makeEntry({ meal: 'breakfast', item: { food_name: 'Boiled egg', portion: '1 egg', kcal: 70, protein_g: 6 }, qty: 1, source: 'search', now });
    const samosa = makeEntry({ meal: 'breakfast', item: { food_name: 'Beef Samosa', portion: '1', kcal: 150, protein_g: 5 }, qty: 1, source: 'custom', now });
    day = withEntry(withEntry(withEntry(day, mandazi), egg), samosa);
    expect(totals(day.entries)).toEqual({ kcal: 720, protein_g: 19, entries: 3 });
    day = withQty(day, mandazi.client_id, 1.5);
    expect(totals(day.entries).kcal).toBe(595);
    day = withoutEntry(day, egg.client_id);
    expect(totals(day.entries)).toEqual({ kcal: 525, protein_g: 11, entries: 2 });
    expect(new Set([mandazi.client_id, egg.client_id, samosa.client_id]).size).toBe(3);
  });

  it('steps portions by 0.5, never below 0.5', () => {
    expect(stepQty(1, 0.5)).toBe(1.5);
    expect(stepQty(0.5, -0.5)).toBe(0.5);
    expect(stepQty(2, -0.5)).toBe(1.5);
  });
});

describe('double-add guard', () => {
  const now = new Date('2026-10-07T18:00:00Z');
  const entry = makeEntry({ meal: 'dinner', item: chapati, qty: 2, source: 'search', now });
  const last = { food_name: 'Chapati', portion: '1 medium', qty: 2, meal: 'dinner' as const, at: now.getTime() };

  it('asks for an identical add within 10 s', () => {
    expect(isDoubleAdd(last, entry, now.getTime() + 9_999)).toBe(true);
  });
  it('does not ask after 10 s, for another meal, or another quantity', () => {
    expect(isDoubleAdd(last, entry, now.getTime() + 10_000)).toBe(false);
    expect(isDoubleAdd({ ...last, meal: 'lunch' }, entry, now.getTime() + 1)).toBe(false);
    expect(isDoubleAdd({ ...last, qty: 1 }, entry, now.getTime() + 1)).toBe(false);
    expect(isDoubleAdd(null, entry, now.getTime())).toBe(false);
  });
});

describe('search', () => {
  const sources = { recent: [stew], mine: [], library: [choma, chai, chapati, stew] };

  it('"cha" lists Chapati and Chai, prefix matches first', () => {
    const groups = searchFoods(sources, 'cha');
    const common = groups.find((g) => g.label === 'Common foods')!;
    expect(common.items.map((i) => i.food_name)).toEqual(['Chai with milk and sugar', 'Chapati']);
  });

  it('groups recent, mine and common foods, dropping empty groups', () => {
    expect(searchFoods(sources, 'stew').map((g) => g.label)).toEqual(['Recent', 'Common foods']);
    expect(searchFoods(sources, 'zzz')).toEqual([]);
  });

  it('builds recent foods from logged days, newest first, de-duplicated', () => {
    const now = new Date('2026-10-07T08:00:00Z');
    const days: FoodDay[] = [
      { food_date: '2026-10-06', client_updated_at: null, entries: [makeEntry({ meal: 'lunch', item: stew, qty: 1, source: 'search', now })] },
      {
        food_date: '2026-10-07',
        client_updated_at: null,
        entries: [makeEntry({ meal: 'breakfast', item: chapati, qty: 1, source: 'search', now }), makeEntry({ meal: 'lunch', item: stew, qty: 2, source: 'search', now })],
      },
    ];
    expect(recentFromDays(days).map((i) => i.food_name)).toEqual(['Chapati', 'Chicken stew']);
    expect(mergeRecent([chapati], [chapati, chai]).map((i) => i.food_name)).toEqual(['Chapati', 'Chai with milk and sugar']);
  });
});
