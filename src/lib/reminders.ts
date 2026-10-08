// Reminder planning (docs/01, "Reminders"): pure, so it can be tested without a phone.
// - 30 min before session time on training days
// - 20:00 "Log dinner" if dinner is empty that day
// - Sunday 09:00 check-in

import type { Program, Reminders } from '@/api/types';

import { addDays, formatTime12, parseDay } from './dates';
import { isTraining, routineFor, weekFor } from './program';

export const DAYS_AHEAD = 14;
export const KINDS = ['workout', 'dinner', 'checkin'] as const;
export type ReminderKind = (typeof KINDS)[number];

export interface PlannedReminder {
  id: string;
  kind: ReminderKind;
  at: Date;
  title: string;
  body: string;
  url: string;
}

function offsetMs(timeZone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')) - at.getTime();
}

/** A wall-clock time on a date in a time zone, as an instant. */
export function zonedTime(day: string, hhmm: string, timeZone: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  const [h, mi] = hhmm.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi);
  return new Date(guess - offsetMs(timeZone, new Date(guess)));
}

export function planReminders(params: {
  program: Program | null;
  today: string;
  now: Date;
  timeZone: string;
  sessionTime: string;
  reminders: Reminders;
  /** True when that day's dinner already has an entry. */
  dinnerLogged: (date: string) => boolean;
  days?: number;
}): PlannedReminder[] {
  const { program, today, now, timeZone, sessionTime, reminders, dinnerLogged, days = DAYS_AHEAD } = params;
  const out: PlannedReminder[] = [];
  const add = (item: PlannedReminder) => {
    if (item.at.getTime() > now.getTime()) out.push(item);
  };
  for (let i = 0; i < days; i++) {
    const date = addDays(today, i);
    const routine = program ? routineFor(program, date) : null;
    if (reminders.workout && isTraining(routine)) {
      add({
        id: `workout:${date}`,
        kind: 'workout',
        at: new Date(zonedTime(date, sessionTime, timeZone).getTime() - 30 * 60_000),
        title: `${routine.name} in 30 minutes`,
        body: `Your session starts at ${formatTime12(sessionTime)}.`,
        url: '/',
      });
    }
    if (reminders.dinner && !dinnerLogged(date)) {
      add({
        id: `dinner:${date}`,
        kind: 'dinner',
        at: zonedTime(date, '20:00', timeZone),
        title: 'Log dinner',
        body: 'Dinner is still empty today.',
        url: '/food',
      });
    }
    const sunday = parseDay(date).getUTCDay() === 0;
    if (reminders.checkin && sunday && (!program || weekFor(program, date))) {
      add({
        id: `checkin:${date}`,
        kind: 'checkin',
        at: zonedTime(date, '09:00', timeZone),
        title: 'Sunday check-in',
        body: 'Weigh in, then review your week.',
        url: '/checkin',
      });
    }
  }
  return out;
}

export function isOurs(identifier: string): boolean {
  return KINDS.some((kind) => identifier.startsWith(`${kind}:`));
}
