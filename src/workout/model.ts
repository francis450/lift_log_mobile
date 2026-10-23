// Pure workout model: drafts saved on the phone, conversion to the API shape, history for the
// add-weight rule, the summary numbers and day statuses. No React, no storage.

import type {
  ExerciseInfo,
  HistoryItem,
  Program,
  Routine,
  RoutineItem,
  Session,
  SessionPayload,
  SetEntry,
  Side,
} from '@/api/types';
import { formatNumber, parseNumber } from '@/lib/numbers';
import { Effort, nextCall, NextCall, parseRepRange, RuleSession } from '@/lib/nextCall';
import { addDays } from '@/lib/dates';
import { isDeload, isTraining, routineFor, weekFor } from '@/lib/program';

export interface DraftRow {
  kg: string;
  reps: string;
  done: boolean;
  effort: Effort | null;
  /** Per-side exercises: each set is an L row then an R row. */
  side?: Side;
}

/** Logged left and right separately (the program marks these "per side"). */
export function isPerSide(item: RoutineItem | undefined): boolean {
  return item?.note === 'per side';
}

function emptyRows(perSide: boolean, sets: number, kg = ''): DraftRow[] {
  const blank = (side?: Side): DraftRow => ({ kg, reps: '', done: false, effort: null, ...(side ? { side } : {}) });
  return Array.from({ length: sets }, () => (perSide ? [blank('L'), blank('R')] : [blank()])).flat();
}

/** The rows "+ Add set" appends: an L and R pair for per-side exercises, else one row. */
export function newSetRows(rows: DraftRow[], perSide: boolean): DraftRow[] {
  const kg = rows[rows.length - 1]?.kg ?? '';
  // Older sessions logged per-side exercises as plain rows; keep adding plain rows to those.
  const pairs = perSide && (rows.length === 0 || rows.some((r) => r.side));
  return emptyRows(pairs, 1, kg);
}

/** Set numbers for the rows: per-side rows share theirs with their pair. */
export function setNumbers(rows: DraftRow[]): number[] {
  let plain = 0;
  let sided = 0;
  return rows.map((r) => (r.side ? Math.floor(sided++ / 2) + 1 : ++plain));
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
  /** Start workout was tapped. Phone only; drafts saved before this field count as begun once anything is logged. */
  begun?: boolean;
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
    rows[item.exercise] = emptyRows(isPerSide(item), item.sets, kg !== undefined ? formatNumber(kg) : '');
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

/** Anything entered: a set with reps or ticked, or a deload move ticked. */
export function hasLogged(draft: WorkoutDraft): boolean {
  const rows = Object.values(draft.rows).flat();
  return rows.some((r) => r.reps || r.done) || Object.values(draft.ticks ?? {}).some((rounds) => rounds.length > 0);
}

/**
 * Opened but not started: the day's exercises are shown with a Start button, no timer, nothing saved.
 * Also covers sessions that were opened before Start existed and never had anything logged.
 */
export function needsStart(draft: WorkoutDraft): boolean {
  return draft.status === 'in_progress' && !draft.begun && !hasLogged(draft);
}

/** Start workout: the clock starts now. */
export function startDraft(draft: WorkoutDraft, now: Date): WorkoutDraft {
  const iso = now.toISOString();
  return { ...draft, begun: true, started_at: iso, client_updated_at: iso };
}

/** The API body. Rows with no reps entered are not saved. */
export function toPayload(draft: WorkoutDraft): SessionPayload {
  const sets: SetEntry[] = [];
  for (const exercise of draft.exercises) {
    // Plain rows are numbered by what was logged; per-side rows keep their pair's number.
    let setNo = 0;
    const rows = draft.rows[exercise] ?? [];
    const pairNo = setNumbers(rows);
    rows.forEach((row, i) => {
      const amount = parseNumber(row.reps);
      if (amount === null) return;
      const entry: SetEntry = {
        exercise,
        set_no: row.side ? pairNo[i] : ++setNo,
        kg: parseNumber(row.kg),
        amount,
        effort: row.effort,
        done: row.done,
      };
      sets.push(row.side ? { ...entry, side: row.side } : entry);
    });
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
    const item = routine?.items?.find((i) => i.exercise === exercise);
    const logged = session.sets.filter((s) => s.exercise === exercise);
    // Per-side sets go back to their L/R slots; older plain rows of a per-side exercise stay plain.
    if (isPerSide(item) && (logged.length === 0 || logged.some((s) => s.side))) {
      rows[exercise] = sideRows(logged, item?.sets ?? 0);
      continue;
    }
    rows[exercise] = logged.map(toDraftRow);
    const planned = item?.sets ?? 0;
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

function toDraftRow(s: SetEntry): DraftRow {
  const row: DraftRow = { kg: formatNumber(s.kg), reps: formatNumber(s.amount), done: s.done, effort: s.effort };
  return s.side ? { ...row, side: s.side } : row;
}

/** Stored per-side sets placed in their L/R slots, padded to the planned sets. */
function sideRows(logged: SetEntry[], plannedSets: number): DraftRow[] {
  const sets = Math.max(plannedSets, ...logged.map((s) => s.set_no));
  const rows = emptyRows(true, sets);
  for (const s of logged) {
    const slot = (s.set_no - 1) * 2 + (s.side === 'R' ? 1 : 0);
    if (s.side && slot >= 0 && slot < rows.length) rows[slot] = toDraftRow(s);
  }
  return rows;
}

/**
 * Placeholder amounts for a card's rows: last session's amount for the same set (and side),
 * else its last amount, else the fallback (the bottom of the target range).
 */
export function placeholdersFor(
  rows: DraftRow[],
  last: { amount: number; side?: Side | null; set_no?: number }[],
  fallback: string,
): string[] {
  const numbers = setNumbers(rows);
  const plainLast = last.filter((s) => !s.side);
  return rows.map((row, i) => {
    const same = row.side
      ? (last.find((s) => s.side === row.side && s.set_no === numbers[i]) ?? plainLast[numbers[i] - 1])
      : plainLast[i];
    const any = same ?? last[last.length - 1];
    return any ? formatNumber(any.amount) : fallback;
  });
}

/** Rule history for one exercise: local sessions win over server copies of the same date. */
export function historyFor(
  exercise: string,
  beforeDate: string,
  local: Session[],
  server: HistoryItem[],
): RuleSession[] {
  const byDate = new Map<string, { routine_key: string | null; sets: RuleSession['sets'] }>();
  const ruleSet = (s: HistoryItem['sets'][number]): RuleSession['sets'][number] => ({
    kg: s.kg,
    amount: s.amount,
    effort: s.effort,
    ...(s.side ? { side: s.side, set_no: s.set_no } : {}),
  });
  for (const item of server) {
    byDate.set(item.date, { routine_key: item.routine_key, sets: item.sets.map(ruleSet) });
  }
  for (const session of local) {
    const sets = session.sets.filter((s) => s.exercise === exercise);
    if (!sets.length) continue;
    byDate.set(session.session_date, { routine_key: session.routine_key, sets: sets.map(ruleSet) });
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
  /** Accepted weekly-review weight change for this week. */
  reviewDeltaKg?: number;
}): NextCall {
  const { program, item, info, history, reviewDeltaKg } = params;
  return nextCall(
    { name: item.exercise, type: info.type, increment_kg: info.increment_kg },
    { sets: item.sets, reps: item.reps, test: item.test, startingKg: program.starting_weights_kg?.[item.exercise] ?? null },
    history,
    { reviewDeltaKg },
  );
}

export interface SessionSummary {
  durationMin: number | null;
  setsLogged: number;
  totalKg: number;
  effort: { easy: number; right: number; hard: number; unrated: number };
}

/**
 * Duration, sets, total kg (kg x reps over load exercises, twice for a pair of dumbbells) and the
 * effort split. A per-side set counts as two entries: each side has its own reps and effort.
 */
export function summarise(session: Session, library: Record<string, ExerciseInfo> | undefined): SessionSummary {
  const effort = { easy: 0, right: 0, hard: 0, unrated: 0 };
  let totalKg = 0;
  for (const s of session.sets) {
    if (s.effort) effort[s.effort] += 1;
    else effort.unrated += 1;
    const info = exerciseInfo(library, s.exercise);
    if (info.type === 'load' && s.kg) totalKg += s.kg * s.amount * (info.pair ? 2 : 1);
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
