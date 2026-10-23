// State for one workout. Every change is saved on the phone at once; meaningful steps (tick, effort,
// next exercise, note, finish) are also queued for the server.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import * as api from '@/api/endpoints';
import type { RoutineItem } from '@/api/types';
import { useProfile } from '@/hooks/queries';
import { formatNumber } from '@/lib/numbers';
import { Effort, NextCall, parseRepRange } from '@/lib/nextCall';
import { restSeconds, routineFor, weekFor } from '@/lib/program';
import { reviewDelta } from '@/lib/review';
import { usePlanChanges } from '@/review/data';
import { useAuth } from '@/state/auth';

import { cancelWorkout, loadDraft, saveDraft, useLocalWorkouts, useServerHistories } from './data';
import {
  callFor,
  createDraft,
  DraftRow,
  exerciseInfo,
  fromSession,
  historyFor,
  isPerSide,
  needsStart,
  newSetRows,
  placeholdersFor,
  startDraft,
  withDeloadRows,
  WorkoutDraft,
} from './model';

/**
 * @param date the day the session is logged on
 * @param from the day whose routine to do, when a missed session was moved (weekly review schedule change)
 */
export function useWorkout(date: string, from?: string) {
  const profile = useProfile().data;
  const credentials = useAuth((s) => s.credentials);
  const program = profile?.program ?? null;
  const library = profile?.exercises;
  const routine = program ? routineFor(program, from ?? date) : null;
  const week = program ? weekFor(program, date) : null;
  const plan = usePlanChanges(week);
  const items = useMemo(() => routine?.items ?? [], [routine]);
  const exercises = useMemo(() => items.map((i) => i.exercise), [items]);

  const local = useLocalWorkouts();
  const server = useServerHistories(exercises);

  const histories = useMemo(() => {
    const out: Record<string, ReturnType<typeof historyFor>> = {};
    for (const exercise of exercises) {
      out[exercise] = historyFor(exercise, date, local.data?.sessions ?? [], server.byExercise[exercise] ?? []);
    }
    return out;
  }, [exercises, date, local.data, server.byExercise]);

  const suggestions = useMemo(() => {
    const out: Record<string, NextCall> = {};
    if (!program) return out;
    for (const item of items) {
      out[item.exercise] = callFor({
        program,
        item,
        info: exerciseInfo(library, item.exercise),
        history: histories[item.exercise] ?? [],
        reviewDeltaKg: reviewDelta(plan.data, item.exercise),
      });
    }
    return out;
  }, [program, items, library, histories, plan.data]);

  const [draft, setDraft] = useState<WorkoutDraft | null>(null);
  /** The draft came from the phone or the server, so Cancel workout has something to remove. */
  const [stored, setStored] = useState(false);

  /** Placeholder reps per row: last session's for that set (and side), else the bottom of the target range. */
  const placeholders = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const item of items) {
      const last = histories[item.exercise]?.[0]?.sets ?? [];
      const fallback = formatNumber(parseRepRange(item.reps)?.[0] ?? null);
      out[item.exercise] = placeholdersFor(draft?.rows[item.exercise] ?? [], last, fallback);
    }
    return out;
  }, [items, histories, draft?.rows]);
  const draftRef = useRef<WorkoutDraft | null>(null);
  const started = useRef(false);
  // Wait for the plan too, so a review's weight change is in the prefilled weights.
  const ready = !!program && local.isSuccess && server.ready && !plan.isLoading;

  const commit = useCallback((next: WorkoutDraft, sync: boolean) => {
    draftRef.current = next;
    setDraft(next);
    void saveDraft(next, sync);
  }, []);

  // Open the saved draft (resume after a kill), else the server's copy, else a new one. A new or
  // never-started session stays on screen only (a preview) until Start workout.
  useEffect(() => {
    if (!ready || !routine || started.current) return;
    started.current = true;
    void (async () => {
      let existing = await loadDraft(date);
      if (!existing && credentials) {
        const stored = await api.getSession(credentials, date).catch(() => null);
        if (stored) existing = fromSession(stored, routine);
      }
      if (existing) {
        if (existing.status === 'done') {
          // Editing a finished session: open on the first exercise with nothing logged.
          const empty = existing.exercises.findIndex((ex) => !(existing!.rows[ex] ?? []).some((r) => r.reps));
          existing = { ...existing, current: empty >= 0 ? empty : 0, restEndsAt: null };
        }
        draftRef.current = existing;
        setDraft(existing);
        setStored(true);
        return;
      }
      const fresh = createDraft({ date, week, routine, suggestions, now: new Date() });
      draftRef.current = fresh;
      setDraft(fresh);
    })();
  }, [ready, routine, date, week, suggestions, credentials, commit]);

  const preview = !!draft && needsStart(draft);

  /** Start workout: saves the session (locally and to the server) with the clock starting now. */
  const start = useCallback(() => {
    const prev = draftRef.current;
    if (prev) {
      commit(startDraft(prev, new Date()), true);
      setStored(true);
    }
  }, [commit]);

  const update = useCallback(
    (fn: (d: WorkoutDraft) => WorkoutDraft, sync = false) => {
      const prev = draftRef.current;
      // Nothing is saved before Start workout.
      if (!prev || needsStart(prev)) return;
      commit({ ...fn(prev), client_updated_at: new Date().toISOString() }, sync);
    },
    [commit],
  );

  const setRow = useCallback(
    (exercise: string, index: number, patch: Partial<DraftRow>, sync = false) =>
      update((d) => {
        const rows = [...(d.rows[exercise] ?? [])];
        rows[index] = { ...rows[index], ...patch };
        return { ...d, rows: { ...d.rows, [exercise]: rows } };
      }, sync),
    [update],
  );

  const toggleDone = useCallback(
    (item: RoutineItem, index: number) =>
      update((d) => {
        const rows = [...(d.rows[item.exercise] ?? [])];
        const row = rows[index];
        const done = !row.done;
        rows[index] = {
          ...row,
          done,
          // Ticking an empty set takes the placeholder (last time's reps) as what was done.
          reps: done && !row.reps ? (placeholders[item.exercise]?.[index] ?? '') : row.reps,
          effort: done ? row.effort : null,
        };
        return {
          ...d,
          rows: { ...d.rows, [item.exercise]: rows },
          restEndsAt: done ? Date.now() + restSeconds(item) * 1000 : d.restEndsAt,
        };
      }, true),
    [update, placeholders],
  );

  const setEffort = useCallback(
    (exercise: string, index: number, effort: Effort | null) => setRow(exercise, index, { effort }, true),
    [setRow],
  );

  const addSet = useCallback(
    (exercise: string) =>
      update((d) => {
        const rows = d.rows[exercise] ?? [];
        const perSide = isPerSide(items.find((i) => i.exercise === exercise));
        return { ...d, rows: { ...d.rows, [exercise]: [...rows, ...newSetRows(rows, perSide)] } };
      }, true),
    [update, items],
  );

  const goTo = useCallback((index: number) => update((d) => ({ ...d, current: index }), true), [update]);
  const setNote = useCallback((note: string) => update((d) => ({ ...d, note }), true), [update]);
  /** Fix the start time (UTC ISO), e.g. after starting by mistake. Restart clock passes now. */
  const setStartedAt = useCallback((iso: string) => update((d) => ({ ...d, started_at: iso }), true), [update]);

  /** Cancel workout: removes the session from the phone and the server. */
  const cancel = useCallback(async () => {
    const prev = draftRef.current;
    draftRef.current = null;
    setDraft(null);
    setStored(false);
    if (prev) await cancelWorkout(prev.date);
  }, []);
  const addRest = useCallback(
    (seconds: number) => update((d) => ({ ...d, restEndsAt: Math.max(d.restEndsAt ?? 0, Date.now()) + seconds * 1000 })),
    [update],
  );
  const skipRest = useCallback(() => update((d) => ({ ...d, restEndsAt: null })), [update]);

  const setRound = useCallback((round: number) => update((d) => ({ ...d, round }), true), [update]);
  const toggleTick = useCallback(
    (exercise: string, round: number) =>
      update((d) => {
        const ticks = { ...(d.ticks ?? {}) };
        const rounds = ticks[exercise] ?? [];
        ticks[exercise] = rounds.includes(round) ? rounds.filter((r) => r !== round) : [...rounds, round];
        // Every move ticked: on to the next round.
        const allDone = items.every((i) => (ticks[i.exercise] ?? []).includes(round));
        const nextRound = allDone && round < 3 ? round + 1 : round;
        return { ...d, ticks, round: nextRound };
      }, true),
    [update, items],
  );

  const finish = useCallback(async () => {
    const prev = draftRef.current;
    if (!prev || !routine) return;
    const base = routine.key === 'home_deload' ? withDeloadRows(prev, routine) : prev;
    const now = new Date().toISOString();
    // Editing a finished session keeps when it was finished, so its duration stays right.
    const finishedAt = prev.status === 'done' && prev.finished_at ? prev.finished_at : now;
    const done: WorkoutDraft = { ...base, status: 'done', finished_at: finishedAt, restEndsAt: null, client_updated_at: now };
    draftRef.current = done;
    setDraft(done);
    await saveDraft(done, true);
  }, [routine]);

  return {
    ready: ready && (!!draft || !routine),
    program,
    library,
    routine,
    week,
    items,
    draft,
    preview,
    stored,
    start,
    setStartedAt,
    cancel,
    suggestions,
    placeholders,
    setRow,
    toggleDone,
    setEffort,
    addSet,
    goTo,
    setNote,
    addRest,
    skipRest,
    setRound,
    toggleTick,
    finish,
  };
}
