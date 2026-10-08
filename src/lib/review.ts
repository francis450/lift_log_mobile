// Weekly review helpers: the four stat tiles, accepted plan changes, and the "move a missed day" schedule change.

import type { PlanChange, Program, ReviewStats } from '@/api/types';

import { formatDayMonth, parseDay } from './dates';
import { isTraining, routineFor, weekDates, weekFor } from './program';
import { formatKcal } from './targets';

export interface Tile {
  value: string;
  caption: string;
}

/** Sessions done of planned, average protein, average kcal on logged days, weight and change. */
export function statTiles(stats: ReviewStats): Tile[] {
  const { weight_kg: weight, weight_change_kg: change } = stats.checkin;
  let weightCaption = 'no weigh-in';
  if (weight !== null) {
    weightCaption = change === null ? 'kg, first weigh-in' : `kg, ${change > 0 ? '+' : change < 0 ? '−' : '±'}${Math.abs(change).toFixed(1)}`;
  }
  return [
    { value: `${stats.sessions.done} / ${stats.sessions.planned}`, caption: 'sessions' },
    { value: stats.food.avg_protein_g !== null ? `${stats.food.avg_protein_g} g` : '–', caption: 'avg protein' },
    { value: stats.food.avg_kcal !== null ? formatKcal(stats.food.avg_kcal) : '–', caption: 'avg kcal' },
    { value: weight !== null ? weight.toFixed(1) : '–', caption: weightCaption },
  ];
}

/** "5–11 Oct" */
export function periodLabel([start, end]: [string, string]): string {
  const a = formatDayMonth(start);
  const b = formatDayMonth(end);
  return a.split(' ')[1] === b.split(' ')[1] ? `${a.split(' ')[0]}–${b}` : `${a} – ${b}`;
}

/** Accepted weight changes for an exercise this week, added on top of the add-weight call. */
export function reviewDelta(plan: PlanChange[] | undefined, exercise: string): number {
  return (plan ?? [])
    .filter((c) => c.change_type === 'weight' && c.exercise === exercise && c.delta_kg)
    .reduce((sum, c) => sum + (c.delta_kg ?? 0), 0);
}

const WEEKDAY_WORDS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

/**
 * An accepted schedule change such as "Move a missed Monday to Saturday" puts that weekday's routine on
 * Saturday when the weekday was missed. Returns the original date to train from, or null.
 */
export function movedFrom(program: Program, saturday: string, plan: PlanChange[] | undefined, trained: (date: string) => boolean): string | null {
  if (parseDay(saturday).getUTCDay() !== 6) return null;
  const week = weekFor(program, saturday);
  if (!week) return null;
  for (const change of plan ?? []) {
    if (change.change_type !== 'schedule') continue;
    const text = `${change.title} ${change.why}`.toLowerCase();
    if (!text.includes('saturday')) continue;
    const index = WEEKDAY_WORDS.findIndex((day) => text.includes(day));
    if (index < 0) continue;
    const from = weekDates(program, week)[index];
    if (isTraining(routineFor(program, from)) && !trained(from)) return from;
  }
  return null;
}
