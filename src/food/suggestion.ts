// The "Suggested lunch" card: fetched when Food opens if the day has 300+ kcal left and no
// suggestion was fetched for that meal in the last 3 hours.

import { useQuery } from '@tanstack/react-query';

import * as api from '@/api/endpoints';
import type { Meal, SuggestionOption } from '@/api/types';
import { cacheGet, cacheSet } from '@/db/database';
import { useAuth } from '@/state/auth';
import { queryClient } from '@/state/queryClient';

export const REFRESH_MS = 3 * 60 * 60 * 1000;
export const MIN_KCAL_LEFT = 300;

export interface SuggestionState {
  meal: Meal;
  fetchedAt: number;
  options: SuggestionOption[];
  index: number;
  dismissed: boolean;
}

/** A new request is due when there's nothing for this meal, or it's 3+ hours old. */
export function suggestionDue(cached: SuggestionState | null, meal: Meal, now: number): boolean {
  return !cached || cached.meal !== meal || now - cached.fetchedAt >= REFRESH_MS;
}

export function shouldSuggest(params: { isToday: boolean; aiReady: boolean; kcalLeft: number }): boolean {
  return params.isToday && params.aiReady && params.kcalLeft >= MIN_KCAL_LEFT;
}

const storeKey = (date: string) => `suggest:${date}`;

export function useSuggestion(date: string, meal: Meal, enabled: boolean) {
  const credentials = useAuth((s) => s.credentials);
  const queryKey = ['suggestion', date, meal];

  async function fetchFresh(): Promise<SuggestionState> {
    const result = await api.suggest(credentials!, date, meal);
    const state: SuggestionState = { meal, fetchedAt: Date.now(), options: result.options, index: 0, dismissed: false };
    await cacheSet(storeKey(date), state);
    return state;
  }

  const query = useQuery({
    queryKey,
    enabled: enabled && !!credentials,
    staleTime: Infinity,
    retry: false,
    queryFn: async () => {
      const cached = await cacheGet<SuggestionState>(storeKey(date));
      return suggestionDue(cached, meal, Date.now()) ? fetchFresh() : cached!;
    },
  });

  async function save(state: SuggestionState) {
    queryClient.setQueryData(queryKey, state);
    await cacheSet(storeKey(date), state);
  }

  const state = query.data;
  return {
    option: state && !state.dismissed ? state.options[state.index] : null,
    loading: query.isFetching,
    /** "Other ideas": the next option from the last answer, then a fresh request. */
    async next() {
      if (state && state.index + 1 < state.options.length) return save({ ...state, index: state.index + 1 });
      const fresh = await fetchFresh().catch(() => null);
      if (fresh) queryClient.setQueryData(queryKey, fresh);
    },
    async dismiss() {
      if (state) await save({ ...state, dismissed: true });
    },
  };
}
