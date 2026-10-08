// Meal suggestions, only on request: pick a meal, tap Suggest. The last answer is kept on the phone
// for 3 hours, so reopening Food shows it again without another Claude call.

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { NetworkError } from '@/api/client';
import * as api from '@/api/endpoints';
import type { Meal, SuggestionOption } from '@/api/types';
import { cacheGet, cacheSet } from '@/db/database';
import { useAuth } from '@/state/auth';
import { queryClient } from '@/state/queryClient';

export const KEEP_MS = 3 * 60 * 60 * 1000;

export interface SuggestionState {
  meal: Meal;
  fetchedAt: number;
  options: SuggestionOption[];
  index: number;
  dismissed: boolean;
}

/** A saved suggestion is shown while it's under 3 hours old and not closed. */
export function isShowable(state: SuggestionState | null | undefined, now: number): state is SuggestionState {
  return !!state && !state.dismissed && now - state.fetchedAt < KEEP_MS && state.options.length > 0;
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

  async function ask(meal: Meal) {
    if (!credentials) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.suggest(credentials, date, meal);
      await save({ meal, fetchedAt: Date.now(), options: result.options, index: 0, dismissed: false });
    } catch (e) {
      setError(e instanceof NetworkError ? 'Suggestions need a connection.' : (e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const state = query.data;
  return {
    current: state && !state.dismissed && state.options.length ? { meal: state.meal, option: state.options[state.index] } : null,
    loading,
    error,
    ask,
    /** "Other ideas": the next option from the last answer, then a fresh request. */
    async next() {
      if (!state) return;
      if (state.index + 1 < state.options.length) return save({ ...state, index: state.index + 1 });
      await ask(state.meal);
    },
    async dismiss() {
      if (state) await save({ ...state, dismissed: true });
    },
  };
}
