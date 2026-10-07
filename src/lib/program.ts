// Program engine: week, phase and routine for a date, from the program JSON (docs/01, "The program").

import type { Program, ProgramWeek, Routine, RoutineItem } from '@/api/types';

import { addDays, parseDay } from './dates';

export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

function dayIndex(day: string): number {
  // Monday = 0
  return (parseDay(day).getUTCDay() + 6) % 7;
}

function daysBetween(from: string, to: string): number {
  return Math.round((parseDay(to).getTime() - parseDay(from).getTime()) / 86_400_000);
}

/** floor((date - start_date) / 7) + 1, or null outside the program. */
export function weekFor(program: Program, day: string): number | null {
  const week = Math.floor(daysBetween(program.start_date, day) / 7) + 1;
  return week >= 1 && week <= program.weeks.length ? week : null;
}

export function weekEntry(program: Program, week: number | null): ProgramWeek | null {
  if (!week) return null;
  return program.weeks.find((w) => w.week === week) ?? null;
}

export function phaseFor(program: Program, week: number | null): string | null {
  return weekEntry(program, week)?.phase ?? null;
}

/** The routine for a date: a training routine, a rest marker (Sunday check-in) or null. */
export function routineFor(program: Program, day: string): Routine | null {
  const entry = weekEntry(program, weekFor(program, day));
  return entry?.days[WEEKDAYS[dayIndex(day)]] ?? null;
}

/** A routine that counts as a planned session: not rest, and has exercises. */
export function isTraining(routine: Routine | null | undefined): routine is Routine {
  return !!routine && !routine.rest && !!routine.items?.length;
}

/** Monday to Sunday of a program week. */
export function weekDates(program: Program, week: number): string[] {
  const monday = addDays(program.start_date, 7 * (week - 1));
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** A planned training day in the past with no session. */
export function isMissed(routine: Routine | null | undefined, day: string, today: string, hasSession: boolean): boolean {
  return isTraining(routine) && day < today && !hasSession;
}

export function isDeload(routine: Routine | null | undefined): boolean {
  return routine?.key === 'home_deload';
}

export function isTestRoutine(routine: Routine | null | undefined): boolean {
  return !!routine?.items?.some((i) => i.test);
}

/** Rest in seconds after a set: 90 s, or 2 min for exercises flagged main. */
export function restSeconds(item: RoutineItem): number {
  return item.main ? 120 : 90;
}

export interface PhaseSpan {
  key: string;
  name: string;
  weeks: number;
}

/** Phase spans in order, for the 12-week bar (Build 3, Home 1, Strength 4, Peak 3, Test 1). */
export function phaseSpans(program: Program): PhaseSpan[] {
  return program.phases.map((p) => ({ key: p.key, name: p.name, weeks: p.weeks[1] - p.weeks[0] + 1 }));
}

/** The rep target of the week's main lifts, e.g. "6-8", for the phase blurb. */
export function mainReps(program: Program, week: number): string | null {
  const entry = weekEntry(program, week);
  for (const routine of Object.values(entry?.days ?? {})) {
    const main = routine?.items?.find((i) => i.main);
    if (main) return main.reps;
  }
  return null;
}
