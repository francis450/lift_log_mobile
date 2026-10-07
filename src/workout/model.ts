// Pure workout model: drafts saved on the phone, conversion to the API shape, history for the
// add-weight rule, the summary numbers and day statuses. No React, no storage.

import type { ExerciseInfo, HistoryItem, Program, Routine, RoutineItem, Session, SessionPayload, SetEntry } from '@/api/types';
import { formatNumber, parseNumber } from '@/lib/numbers';
import { Effort, nextCall, NextCall, parseRepRange, RuleSession } from '@/lib/nextCall';
import { addDays } from '@/lib/dates';
import { isDeload, isTraining, routineFor, weekFor } from '@/lib/program';

export interface DraftRow {
  kg: string;
  reps: string;
  done: boolean;
  effort: Effort | null;
}

export interface WorkoutDraft {
  date: string;
  week: number | null;
  routine_key: string | null;
  routine_name: string | null;
  status: 'in_progress' | 'done';
  started_at: string;
  finished_at: string | null;
  note: string;
  client_updated_at: string;
  /** Exercise names in order. */
  exercises: string[];
  rows: Record<string, DraftRow[]>;
  /** Index of the exercise on screen, so a killed app resumes where it was. */
  current: number;
  /** Epoch ms when the rest timer ends, or null. */
  restEndsAt: number | null;
  /** Home deload: the round on screen and the moves ticked per round. */
  round?: number;
  ticks?: Record<string, number[]>;
}

const FALLBACK_EXERCISE: ExerciseInfo = { type: 'load', increment_kg: 2.5, form_url: null };

export function exerciseInfo(library: Record<string, ExerciseInfo> | undefined, name: string): ExerciseInfo {
  return library?.[name] ?? FALLBACK_EXERCISE;
}

export function usesKg(info: ExerciseInfo): boolean {
  return info.type === 'load' || info.type === 'distance';
}

/** "reps", "seconds" or "metres". */
export function amountUnit(info: ExerciseInfo): string {
  if (info.type === 'time') return 'seconds';
  if (info.type === 'distance') return 'metres';
  return 'reps';
}

/** "3 × 6–8 reps · rest 2 min" */
export function targetLine(item: RoutineItem, info: ExerciseInfo): string {
  const reps = item.reps.replace('-', '–');
  const unit = item.reps === 'max' ? 'reps' : info.type === 'time' ? 's' : info.type === 'distance' ? 'm' : 'reps';
  const rest = item.main ? 'rest 2 min' : 'rest 90 s';
  return `${item.sets} × ${reps} ${unit}${item.note ? ` ${item.note}` : ''} · ${rest}`;
}

export function createDraft(params: {
  date: string;
  week: number | null;
  routine: Routine;
  suggestions: Record<string, NextCall>;
  now: Date;
}): WorkoutDraft {
  const { date, week, routine, suggestions, now } = params;
  const items = routine.items ?? [];
  const rows: Record<string, DraftRow[]> = {};
  for (const item of items) {
    const kg = suggestions[item.exercise]?.kg;
    rows[item.exercise] = Array.from({ length: item.sets }, () => ({
      kg: kg !== undefined ? formatNumber(kg) : '',
      reps: '',
      done: false,
      effort: null,
    }));
  }
  const iso = now.toISOString();
  return {
    date,
    week,
    routine_key: routine.key,
    routine_name: routine.name,
    status: 'in_progress',
    started_at: iso,
    finished_at: null,
    note: '',
    client_updated_at: iso,
    exercises: items.map((i) => i.exercise),
    rows,
    current: 0,
    restEndsAt: null,
  };
}

/** The API body. Rows with no reps entered are not saved. */
export function toPayload(draft: WorkoutDraft): SessionPayload {
  const sets: SetEntry[] = [];
  for (const exercise of draft.exercises) {
    let setNo = 0;
    for (const row of draft.rows[exercise] ?? []) {
      const amount = parseNumber(row.reps);
      if (amount === null) continue;
      setNo += 1;
      sets.push({ exercise, set_no: setNo, kg: parseNumber(row.kg), amount, effort: row.effort, done: row.done });
    }
  }
  return {
    session_date: draft.date,
    week: draft.week,
    routine_key: draft.routine_key,
    routine_name: draft.routine_name,
    status: draft.status,
    started_at: draft.started_at,
    finished_at: draft.finished_at,
    note: draft.note,
    client_updated_at: draft.client_updated_at,
    sets,
  };
}

/** The session as the server would return it, for summaries and history. */
export function toSession(draft: WorkoutDraft): Session {
  return { ...toPayload(draft), name: '', program: null };
}

/** A stored session back into an editable draft (resume, edit, or a 409 server copy). */
export function fromSession(session: Session, routine: Routine | null): WorkoutDraft {
  const order = [...(routine?.items ?? []).map((i) => i.exercise)];
  for (const s of session.sets) if (!order.includes(s.exercise)) order.push(s.exercise);
  const rows: Record<string, DraftRow[]> = {};
  for (const exercise of order) {
    rows[exercise] = session.sets
      .filter((s) => s.exercise === exercise)
      .map((s) => ({ kg: formatNumber(s.kg), reps: formatNumber(s.amount), done: s.done, effort: s.effort }));
    const planned = routine?.items?.find((i) => i.exercise === exercise)?.sets ?? 0;
    while (rows[exercise].length < planned) rows[exercise].push({ kg: '', reps: '', done: false, effort: null });
  }
  return {
    date: session.session_date,
    week: session.week,
    routine_key: session.routine_key,
    routine_name: session.routine_name,
    status: session.status,
    started_at: session.started_at ?? session.client_updated_at ?? new Date().toISOString(),
    finished_at: session.finished_at,
    note: session.note ?? '',
    client_updated_at: session.client_updated_at ?? new Date().toISOString(),
    exercises: order,
    rows,
    current: 0,
    restEndsAt: null,
  };
}

/** Rule history for one exercise: local sessions win over server copies of the same date. */
export function historyFor(
  exercise: string,
  beforeDate: string,
  local: Session[],
  server: HistoryItem[],
): RuleSession[] {
  const byDate = new Map<string, { routine_key: string | null; sets: RuleSession['sets'] }>();
  for (const item of server) {
    byDate.set(item.date, {
      routine_key: item.routine_key,
      sets: item.sets.map((s) => ({ kg: s.kg, amount: s.amount, effort: s.effort })),
    });
  }
  for (const session of local) {
    const sets = session.sets.filter((s) => s.exercise === exercise);
    if (!sets.length) continue;
    byDate.set(session.session_date, {
      routine_key: session.routine_key,
      sets: sets.map((s) => ({ kg: s.kg, amount: s.amount, effort: s.effort })),
    });
  }
  return [...byDate.entries()]
    .filter(([date]) => date < beforeDate)
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([date, v]) => ({ date, deload: v.routine_key === 'home_deload', sets: v.sets }));
}

/** The next scheduled time an exercise comes up on or after a date, within two weeks. */
export function nextItemFor(program: Program, exercise: string, fromDate: string): RoutineItem | null {
  for (let i = 0; i < 14; i++) {
    const routine = routineFor(program, addDays(fromDate, i));
    const item = routine?.items?.find((x) => x.exercise === exercise);
    if (item) return item;
  }
  return null;
}

/** The add-weight call for one exercise. */
export function callFor(params: {
  program: Program;
  item: RoutineItem;
  info: ExerciseInfo;
  history: RuleSession[];
}): NextCall {
  const { program, item, info, history } = params;
  return nextCall(
    { name: item.exercise, type: info.type, increment_kg: info.increment_kg },
    { sets: item.sets, reps: item.reps, test: item.test, startingKg: program.starting_weights_kg?.[item.exercise] ?? null },
    history,
  );
}

export interface SessionSummary {
  durationMin: number | null;
  setsLogged: number;
  totalKg: number;
  effort: { easy: number; right: number; hard: number; unrated: number };
}

/** Duration, sets, total kg (kg x reps over load exercises) and the effort split. */
export function summarise(session: Session, library: Record<string, ExerciseInfo> | undefined): SessionSummary {
  const effort = { easy: 0, right: 0, hard: 0, unrated: 0 };
  let totalKg = 0;
  for (const s of session.sets) {
    if (s.effort) effort[s.effort] += 1;
    else effort.unrated += 1;
    if (exerciseInfo(library, s.exercise).type === 'load' && s.kg) totalKg += s.kg * s.amount;
  }
  const start = session.started_at ? Date.parse(session.started_at) : NaN;
  const end = session.finished_at ? Date.parse(session.finished_at) : NaN;
  const durationMin = Number.isFinite(start) && Number.isFinite(end) && end > start ? Math.round((end - start) / 60_000) : null;
  return { durationMin, setsLogged: session.sets.length, totalKg: Math.round(totalKg), effort };
}

/** One-line read of the effort split. */
export function effortRead(effort: SessionSummary['effort']): { text: string; tone: 'up' | 'hold' | 'accent' } {
  const rated = effort.easy + effort.right + effort.hard;
  if (!rated) return { text: 'No sets rated. Rate them Easy, Right or Hard to get earlier weight calls.', tone: 'accent' };
  if (effort.easy * 2 >= rated) return { text: "Most sets felt easy. There's room to go heavier.", tone: 'up' };
  if (effort.hard * 2 >= rated) return { text: 'Most sets felt hard. Hold the weight and build your reps.', tone: 'hold' };
  return { text: 'Most sets felt about right. Keep building reps.', tone: 'accent' };
}

/** Home deload: each ticked move in each round becomes a set at the target's first number. */
export function withDeloadRows(draft: WorkoutDraft, routine: Routine): WorkoutDraft {
  const rows: Record<string, DraftRow[]> = {};
  for (const item of routine.items ?? []) {
    const amount = parseRepRange(item.reps)?.[0];
    const rounds = [...(draft.ticks?.[item.exercise] ?? [])].sort();
    rows[item.exercise] = rounds.map(() => ({ kg: '', reps: amount !== undefined ? String(amount) : '', done: true, effort: null }));
  }
  return { ...draft, rows };
}

export type DayStatus = 'done' | 'in_progress' | 'missed' | 'today' | 'upcoming' | 'rest';

export function dayStatus(
  program: Program,
  day: string,
  today: string,
  session: { status: 'in_progress' | 'done' } | null,
): DayStatus {
  if (session?.status === 'done') return 'done';
  if (session) return 'in_progress';
  const routine = routineFor(program, day);
  if (!isTraining(routine)) return 'rest';
  if (day < today) return 'missed';
  if (day === today) return 'today';
  return 'upcoming';
}

export { isDeload, weekFor };
