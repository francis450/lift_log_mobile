// Pure food-day logic: entries, totals, meal presets, the double-add guard and search ranking.

import type { EstimateItem, FoodDay, FoodEntry, FoodItem, FoodSource, Meal } from '@/api/types';

export const MEALS: { key: Meal; label: string }[] = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
  { key: 'snacks', label: 'Snacks' },
];

export function mealLabel(meal: Meal): string {
  return MEALS.find((m) => m.key === meal)?.label ?? meal;
}

/** Before 11:00 breakfast, before 16:00 lunch, before 21:00 dinner, else snacks. */
export function mealForTime(minutesNow: number): Meal {
  if (minutesNow < 11 * 60) return 'breakfast';
  if (minutesNow < 16 * 60) return 'lunch';
  if (minutesNow < 21 * 60) return 'dinner';
  return 'snacks';
}

/** A client-generated id: the server ignores a second write of the same one. */
export function newClientId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyDay(date: string): FoodDay {
  return { food_date: date, client_updated_at: null, entries: [] };
}

export function entryKcal(e: FoodEntry): number {
  return e.qty * e.kcal_per_portion;
}

export function entryProtein(e: FoodEntry): number {
  return e.qty * e.protein_per_portion;
}

export function totals(entries: FoodEntry[]): { kcal: number; protein_g: number; entries: number } {
  return {
    kcal: Math.round(entries.reduce((s, e) => s + entryKcal(e), 0)),
    protein_g: Math.round(entries.reduce((s, e) => s + entryProtein(e), 0)),
    entries: entries.length,
  };
}

/** "× 1.5" */
export function formatQty(qty: number): string {
  return `× ${Number.isInteger(qty) ? qty : qty.toFixed(1).replace(/\.0$/, '')}`;
}

export function makeEntry(params: {
  meal: Meal;
  item: Pick<FoodItem, 'food_name' | 'portion' | 'kcal' | 'protein_g'>;
  qty: number;
  source: FoodSource;
  now: Date;
}): FoodEntry {
  const { meal, item, qty, source, now } = params;
  return {
    client_id: newClientId(),
    meal,
    food_name: item.food_name.trim(),
    portion: item.portion ?? '',
    qty,
    kcal_per_portion: item.kcal,
    protein_per_portion: item.protein_g,
    source,
    added_at: now.toISOString(),
  };
}

export function withEntry(day: FoodDay, entry: FoodEntry): FoodDay {
  return { ...day, entries: [...day.entries, entry] };
}

export function withoutEntry(day: FoodDay, clientId: string): FoodDay {
  return { ...day, entries: day.entries.filter((e) => e.client_id !== clientId) };
}

export function withQty(day: FoodDay, clientId: string, qty: number): FoodDay {
  return { ...day, entries: day.entries.map((e) => (e.client_id === clientId ? { ...e, qty } : e)) };
}

/** − / + in 0.5 steps, never below 0.5. */
export function stepQty(qty: number, by: number): number {
  return Math.max(0.5, Math.round((qty + by) * 2) / 2);
}

export interface LastAdd {
  food_name: string;
  portion: string;
  qty: number;
  meal: Meal;
  at: number;
}

/** The same food added to the same meal within 10 s of an identical add asks "Add it again?" first. */
export function isDoubleAdd(last: LastAdd | null, entry: FoodEntry, now: number): boolean {
  return (
    !!last &&
    now - last.at < 10_000 &&
    last.meal === entry.meal &&
    last.food_name.toLowerCase() === entry.food_name.toLowerCase() &&
    last.portion === entry.portion &&
    last.qty === entry.qty
  );
}

export interface SearchGroup {
  label: string;
  items: FoodItem[];
}

function matches(item: FoodItem, q: string): boolean {
  return item.food_name.toLowerCase().includes(q);
}

function ranked(items: FoodItem[], q: string): FoodItem[] {
  return [...items].sort((a, b) => {
    const pa = a.food_name.toLowerCase().startsWith(q) ? 0 : 1;
    const pb = b.food_name.toLowerCase().startsWith(q) ? 0 : 1;
    return pa - pb;
  });
}

/** Recent foods first, then the user's own, then the seed library ("Common foods"). */
export function searchFoods(
  sources: { recent: FoodItem[]; mine: FoodItem[]; library: FoodItem[] },
  query: string,
  limit = 20,
): SearchGroup[] {
  const q = query.trim().toLowerCase();
  const pick = (items: FoodItem[], max: number) => ranked(items.filter((i) => matches(i, q)), q).slice(0, max);
  return [
    { label: 'Recent', items: pick(sources.recent, q ? limit : 8) },
    { label: 'My foods', items: pick(sources.mine, limit) },
    { label: 'Common foods', items: pick(sources.library, limit) },
  ].filter((g) => g.items.length > 0);
}

/** Recent foods from day entries, most recent first, one per name and portion. */
export function recentFromDays(days: FoodDay[]): FoodItem[] {
  const seen = new Set<string>();
  const out: FoodItem[] = [];
  const entries = days
    .flatMap((d) => d.entries.map((e) => ({ e, date: d.food_date })))
    .sort((a, b) => (a.date === b.date ? (b.e.added_at ?? '').localeCompare(a.e.added_at ?? '') : a.date < b.date ? 1 : -1));
  for (const { e } of entries) {
    const key = `${e.food_name.toLowerCase()}|${e.portion.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name: null, food_name: e.food_name, portion: e.portion, kcal: e.kcal_per_portion, protein_g: e.protein_per_portion });
  }
  return out;
}

export interface EstimateRow {
  item: EstimateItem;
  checked: boolean;
  kcal: string;
  protein: string;
}

/** Estimated foods as editable, ticked rows. */
export function estimateRows(items: EstimateItem[]): EstimateRow[] {
  return items.map((item) => ({ item, checked: true, kcal: String(item.kcal), protein: String(item.protein_g) }));
}

function num(text: string): number | null {
  const n = Number(text.trim().replace(',', '.'));
  return text.trim() && Number.isFinite(n) && n >= 0 ? n : null;
}

/** The ticked rows with their (edited) numbers; rows with an invalid number are left out. */
export function chosenItems(rows: EstimateRow[]): EstimateItem[] {
  return rows.flatMap((r) => {
    const kcal = num(r.kcal);
    const protein = num(r.protein);
    if (!r.checked || kcal === null || protein === null) return [];
    return [{ ...r.item, kcal, protein_g: protein }];
  });
}

/** "Add 3 foods · 610 kcal · 34 g" */
export function addFoodsLabel(items: EstimateItem[]): string {
  const kcal = Math.round(items.reduce((s, i) => s + i.kcal, 0));
  const protein = Math.round(items.reduce((s, i) => s + i.protein_g, 0));
  const noun = items.length === 1 ? 'food' : 'foods';
  return `Add ${items.length} ${noun} · ${kcal.toLocaleString('en-US')} kcal · ${protein} g`;
}

export function mergeRecent(local: FoodItem[], server: FoodItem[]): FoodItem[] {
  const seen = new Set<string>();
  return [...local, ...server].filter((i) => {
    const key = `${i.food_name.toLowerCase()}|${i.portion.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
