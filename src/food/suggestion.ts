// Meal suggestions, only on request: pick a meal, tap Suggest. The last answer is kept on the phone
// for 3 hours, so reopening Food shows it again without another Claude call. "More ideas" adds to
// the options already shown, so they can be swiped through and compared.

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { NetworkError } from '@/api/client';
import * as api from '@/api/endpoints';
import type { Meal, SuggestionOption } from '@/api/types';
import { cacheGet, cacheSet } from '@/db/database';
import { formatKcal } from '@/lib/targets';
import { useAuth } from '@/state/auth';
import { queryClient } from '@/state/queryClient';

export const KEEP_MS = 3 * 60 * 60 * 1000;
export const MAX_OPTIONS = 12;

export interface SuggestionState {
  meal: Meal;
  fetchedAt: number;
  options: SuggestionOption[];
  /** The option on screen. */
  index: number;
  dismissed: boolean;
  /** This meal's share of what's left (missing on answers saved before budgets). */
  budget?: { kcal: number; protein_g: number };
}

/** A saved suggestion is shown while it's under 3 hours old and not closed. */
export function isShowable(state: SuggestionState | null | undefined, now: number): state is SuggestionState {
  return !!state && !state.dismissed && now - state.fetchedAt < KEEP_MS && state.options.length > 0;
}

/** New options after the ones shown, skipping repeats; the first new one goes on screen. */
export function appendOptions(state: SuggestionState, more: SuggestionOption[]): SuggestionState {
  const seen = new Set(state.options.map((o) => o.title.trim().toLowerCase()));
  const fresh = more.filter((o) => {
    const key = o.title.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const options = [...state.options, ...fresh].slice(0, MAX_OPTIONS);
  const added = options.length > state.options.length;
  return { ...state, options, index: added ? state.options.length : state.index };
}

/** "Leaves 588 kcal · 56 g protein for later", or how far an option goes over what's left today. */
export function leavesLine(option: SuggestionOption, kcalLeft: number, proteinLeft: number): string {
  const kcal = option.items.reduce((s, i) => s + i.kcal, 0);
  const protein = option.items.reduce((s, i) => s + i.protein_g, 0);
  const kcalAfter = Math.round(kcalLeft - kcal);
  if (kcalAfter < 0) return `${formatKcal(-kcalAfter)} kcal over what's left today`;
  return `Leaves ${formatKcal(kcalAfter)} kcal · ${Math.max(0, Math.round(proteinLeft - protein))} g protein for later`;
}

const storeKey = (date: string) => `suggest:${date}`;

export function useSuggestion(date: string) {
  const credentials = useAuth((s) => s.credentials);
  const queryKey = ['suggestion', date];
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reads the phone's copy only; never calls the server by itself.
  const query = useQuery({
    queryKey,
    staleTime: Infinity,
    queryFn: async () => {
      const saved = await cacheGet<SuggestionState>(storeKey(date));
      return isShowable(saved, Date.now()) ? saved : null;
    },
  });

  async function save(state: SuggestionState) {
    queryClient.setQueryData(queryKey, state);
    await cacheSet(storeKey(date), state);
  }

  async function request(meal: Meal, update: (options: SuggestionOption[], budget?: SuggestionState['budget']) => SuggestionState) {
    if (!credentials) return;
    setLoading(true);
    setError(null);
    try {
      const shown = state && state.meal === meal ? state.options.map((o) => o.title) : [];
      const result = await api.suggest(credentials, date, meal, shown);
      await save(update(result.options, result.budget));
    } catch (e) {
      setError(e instanceof NetworkError ? 'Suggestions need a connection.' : (e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const state = query.data && !query.data.dismissed && query.data.options.length ? query.data : null;
  return {
    state,
    loading,
    error,
    ask: (meal: Meal) =>
      request(meal, (options, budget) => ({ meal, fetchedAt: Date.now(), options, index: 0, dismissed: false, budget })),
    /** "More ideas": new options added after the ones already shown. */
    async more() {
      if (!state) return;
      await request(state.meal, (options, budget) => appendOptions({ ...state, budget: budget ?? state.budget }, options));
    },
    /** Remember the option on screen, so reopening Food shows the same one. */
    async setIndex(index: number) {
      if (state && index !== state.index) await save({ ...state, index });
    },
    async dismiss() {
      if (state) await save({ ...state, dismissed: true });
    },
  };
}
