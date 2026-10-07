// Workout data on the phone: drafts in SQLite, history from the server (cached), and month views.

import { useQueries, useQuery } from '@tanstack/react-query';

import { NetworkError } from '@/api/client';
import * as api from '@/api/endpoints';
import type { FoodMonthDay, HistoryItem, MonthSession, Session } from '@/api/types';
import { cacheGet, cacheSet, workoutAll, workoutGet, workoutPut } from '@/db/database';
import { useAuth } from '@/state/auth';
import { queryClient } from '@/state/queryClient';
import { enqueueAndSync } from '@/sync';

import { toPayload, toSession, WorkoutDraft } from './model';

/** Save a draft on the phone; with `sync`, also queue it for the server. */
export async function saveDraft(draft: WorkoutDraft, sync: boolean): Promise<void> {
  await workoutPut(draft.date, draft);
  if (sync) await enqueueAndSync('session', draft.date, toPayload(draft));
  await queryClient.invalidateQueries({ queryKey: ['local-workouts'] });
  void queryClient.invalidateQueries({ queryKey: ['session', draft.date] });
  if (sync) void queryClient.invalidateQueries({ queryKey: ['today'] });
}

export function loadDraft(date: string): Promise<WorkoutDraft | null> {
  return workoutGet<WorkoutDraft>(date);
}

/** Every workout logged on this phone, as sessions (newest first). */
export function useLocalWorkouts() {
  return useQuery({
    queryKey: ['local-workouts'],
    queryFn: async () => {
      const drafts = await workoutAll<WorkoutDraft>();
      return { drafts, sessions: drafts.map(toSession) as Session[] };
    },
  });
}

async function cached<T>(key: string, fetcher: () => Promise<T>, fallback: T): Promise<T> {
  try {
    const data = await fetcher();
    await cacheSet(key, data);
    return data;
  } catch (error) {
    const hit = await cacheGet<T>(key);
    if (hit) return hit;
    // Offline with nothing cached, or an older server without this endpoint: show what we have.
    if (error instanceof NetworkError || (error as { status?: number }).status) return fallback;
    throw error;
  }
}

/** Server history for each exercise (last 6 sessions), cached for offline use. */
export function useServerHistories(exercises: string[]) {
  const credentials = useAuth((s) => s.credentials);
  const results = useQueries({
    queries: exercises.map((exercise) => ({
      queryKey: ['history', exercise],
      enabled: !!credentials,
      queryFn: () => cached<HistoryItem[]>(`history:${exercise}`, () => api.sessionHistory(credentials!, exercise), []),
    })),
  });
  const byExercise: Record<string, HistoryItem[]> = {};
  exercises.forEach((exercise, i) => {
    byExercise[exercise] = results[i]?.data ?? [];
  });
  return { byExercise, ready: results.every((r) => !r.isPending) };
}

export function useSessionsMonth(month: string) {
  const credentials = useAuth((s) => s.credentials);
  return useQuery({
    queryKey: ['sessions-month', month],
    enabled: !!credentials,
    queryFn: () => cached<MonthSession[]>(`sessions-month:${month}`, () => api.sessionsMonth(credentials!, month), []),
  });
}

export function useFoodMonth(month: string) {
  const credentials = useAuth((s) => s.credentials);
  return useQuery({
    queryKey: ['food-month', month],
    enabled: !!credentials,
    queryFn: () => cached<FoodMonthDay[]>(`food-month:${month}`, () => api.foodMonth(credentials!, month), []),
  });
}

/** A session for the summary screen: this phone's copy first, else the server's. */
export function useSessionForDate(date: string) {
  const credentials = useAuth((s) => s.credentials);
  return useQuery({
    queryKey: ['session', date],
    enabled: !!credentials,
    queryFn: async (): Promise<Session | null> => {
      const local = await loadDraft(date);
      if (local) return toSession(local);
      return cached<Session | null>(`session:${date}`, () => api.getSession(credentials!, date), null);
    },
  });
}
