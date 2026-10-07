// State for one workout. Every change is saved on the phone at once; meaningful steps (tick, effort,
// next exercise, note, finish) are also queued for the server.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import * as api from '@/api/endpoints';
import type { RoutineItem } from '@/api/types';
import { useProfile } from '@/hooks/queries';
import { formatNumber } from '@/lib/numbers';
import { Effort, NextCall, parseRepRange } from '@/lib/nextCall';
import { restSeconds, routineFor, weekFor } from '@/lib/program';
import { useAuth } from '@/state/auth';

import { loadDraft, saveDraft, useLocalWorkouts, useServerHistories } from './data';
import { callFor, createDraft, DraftRow, exerciseInfo, fromSession, historyFor, withDeloadRows, WorkoutDraft } from './model';

export function useWorkout(date: string) {
  const profile = useProfile().data;
  const credentials = useAuth((s) => s.credentials);
  const program = profile?.program ?? null;
  const library = profile?.exercises;
  const routine = program ? routineFor(program, date) : null;
  const week = program ? weekFor(program, date) : null;
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
      });
    }
    return out;
  }, [program, items, library, histories]);

  /** Placeholder reps per set: last session's, else the bottom of the target range. */
  const placeholders = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const item of items) {
      const last = histories[item.exercise]?.[0]?.sets.map((s) => formatNumber(s.amount)) ?? [];
      const fallback = formatNumber(parseRepRange(item.reps)?.[0] ?? null);
      out[item.exercise] = Array.from({ length: 12 }, (_, i) => last[i] ?? last[last.length - 1] ?? fallback);
    }
    return out;
  }, [items, histories]);

  const [draft, setDraft] = useState<WorkoutDraft | null>(null);
  const draftRef = useRef<WorkoutDraft | null>(null);
  const started = useRef(false);
  const ready = !!program && local.isSuccess && server.ready;

  const commit = useCallback((next: WorkoutDraft, sync: boolean) => {
    draftRef.current = next;
    setDraft(next);
    void saveDraft(next, sync);
  }, []);

  // Open the saved draft (resume after a kill), else the server's copy, else start a new session.
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
        draftRef.current = existing;
        setDraft(existing);
        return;
      }
      commit(createDraft({ date, week, routine, suggestions, now: new Date() }), true);
    })();
  }, [ready, routine, date, week, suggestions, credentials, commit]);

  const update = useCallback(
    (fn: (d: WorkoutDraft) => WorkoutDraft, sync = false) => {
      const prev = draftRef.current;
      if (!prev) return;
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
        const kg = rows[rows.length - 1]?.kg ?? '';
        return { ...d, rows: { ...d.rows, [exercise]: [...rows, { kg, reps: '', done: false, effort: null }] } };
      }, true),
    [update],
  );

  const goTo = useCallback((index: number) => update((d) => ({ ...d, current: index }), true), [update]);
  const setNote = useCallback((note: string) => update((d) => ({ ...d, note }), true), [update]);
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
    const done: WorkoutDraft = { ...base, status: 'done', finished_at: now, restEndsAt: null, client_updated_at: now };
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
