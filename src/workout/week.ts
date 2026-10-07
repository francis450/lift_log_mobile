// What the Train week list and History need for a day, combining this phone's drafts and the
// server's month view.

import type { Highlight, MonthSession, Program, Routine } from '@/api/types';
import { formatTime12 } from '@/lib/dates';
import { routineFor } from '@/lib/program';
import { describeSets, shortExerciseName } from '@/lib/today';

import { dayStatus, DayStatus, WorkoutDraft } from './model';

export interface DaySession {
  status: 'in_progress' | 'done';
  routine_name: string | null;
  sets: number;
  highlight: Highlight | null;
}

/** Local drafts win over the server's month rows for the same date. */
export function sessionsByDate(server: MonthSession[], drafts: WorkoutDraft[]): Map<string, DaySession> {
  const map = new Map<string, DaySession>();
  for (const s of server) {
    map.set(s.date, { status: s.status, routine_name: s.routine_name, sets: s.sets, highlight: s.highlight ?? null });
  }
  for (const d of drafts) {
    const first = d.exercises.find((ex) => (d.rows[ex] ?? []).some((r) => r.reps));
    const highlight = first
      ? {
          exercise: first,
          sets: d.rows[first].filter((r) => r.reps).map((r) => ({ kg: r.kg ? Number(r.kg) : null, amount: Number(r.reps) })),
        }
      : null;
    const sets = Object.values(d.rows).flat().filter((r) => r.reps).length;
    map.set(d.date, { status: d.status, routine_name: d.routine_name, sets, highlight });
  }
  return map;
}

/** "Bench press 4 × 6–8 + forearms" */
export function routineDetail(routine: Routine): string {
  const items = routine.items ?? [];
  const main = items.find((i) => i.main) ?? items[0];
  if (!main) return '';
  const forearms = items.some((i) => i.finisher) ? ' + forearms' : '';
  return `${shortExerciseName(main.exercise)} ${main.sets} × ${main.reps.replace('-', '–')}${forearms}`;
}

export interface WeekRow {
  date: string;
  routine: Routine;
  status: DayStatus;
  detail: string;
}

export function weekRows(
  program: Program,
  dates: string[],
  today: string,
  sessions: Map<string, DaySession>,
  sessionTime: string,
): WeekRow[] {
  const rows: WeekRow[] = [];
  for (const date of dates) {
    const routine = routineFor(program, date);
    const session = sessions.get(date) ?? null;
    if (!routine?.items?.length && !session) continue;
    const status = dayStatus(program, date, today, session);
    let detail = routine ? routineDetail(routine) : '';
    if (session?.highlight) detail = describeSets(session.highlight.exercise, session.highlight.sets);
    else if (status === 'today') detail = `${Number(sessionTime.split(':')[0]) >= 17 ? 'Tonight' : 'Today'} ${formatTime12(sessionTime)}`;
    rows.push({ date, routine: routine ?? { key: 'extra', name: session?.routine_name ?? 'Workout' }, status, detail });
  }
  return rows;
}

/** "Sat rest · Sun check-in" */
export function restDaysLine(program: Program, dates: string[]): string {
  const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return dates
    .map((date, i) => {
      const routine = routineFor(program, date);
      if (routine?.rest) return `${names[i]} check-in`;
      if (routine && !routine.items?.length) return `${names[i]} ${routine.name.toLowerCase()}`;
      if (!routine) return `${names[i]} rest`;
      return null;
    })
    .filter(Boolean)
    .join(' · ');
}
