// Pure helpers behind the Today screen.

import type { Routine, Session } from '@/api/types';

const PHASE_LABELS: Record<string, string> = {
  build: 'Build phase',
  deload: 'Home deload',
  strength: 'Strength phase',
  peak: 'Peak phase',
  test: 'Test week',
};

export function phaseLabel(phase: string | null | undefined): string | null {
  if (!phase) return null;
  return PHASE_LABELS[phase] ?? phase;
}

/**
 * The hint banner shows when protein is behind pace (docs/02):
 * less than 40% of target by 14:00, or less than 70% by 19:00.
 */
export function proteinBehindPace(protein: number, target: number | null, minutesNow: number): boolean {
  if (!target) return false;
  const pct = protein / target;
  if (minutesNow >= 19 * 60) return pct < 0.7;
  if (minutesNow >= 14 * 60) return pct < 0.4;
  return false;
}

export function nextMealName(minutesNow: number): 'breakfast' | 'lunch' | 'dinner' {
  if (minutesNow < 11 * 60) return 'breakfast';
  if (minutesNow < 16 * 60) return 'lunch';
  return 'dinner';
}

/** "111 g protein to go. A high-protein lunch keeps you on track for tonight." */
export function proteinHint(protein: number, target: number, minutesNow: number, trainingToday: boolean): string {
  const left = Math.max(Math.round(target - protein), 0);
  return `${left} g protein to go. A high-protein ${nextMealName(minutesNow)} keeps you on track${
    trainingToday ? ' for tonight' : ''
  }.`;
}

export type SessionCard =
  | { kind: 'rest' }
  | { kind: 'checkin' }
  | { kind: 'optional'; routine: Routine }
  | { kind: 'start' | 'resume' | 'done'; routine: Routine; setsLogged: number };

export function sessionCard(routine: Routine | null, session: Session | null): SessionCard {
  if (!routine) return { kind: 'rest' };
  if (routine.rest) return { kind: 'checkin' };
  if (!routine.items?.length) return { kind: 'optional', routine };
  const setsLogged = session?.sets.length ?? 0;
  if (session?.status === 'done') return { kind: 'done', routine, setsLogged };
  if (session) return { kind: 'resume', routine, setsLogged };
  return { kind: 'start', routine, setsLogged };
}

/** "Tonight · 6:00 PM" for evening sessions, "Today · 7:00 AM" otherwise. */
export function sessionEyebrow(sessionTime: string | null | undefined, formatted: string): string {
  if (!sessionTime) return 'Today';
  const hour = Number(sessionTime.split(':')[0]);
  return `${hour >= 17 ? 'Tonight' : 'Today'} · ${formatted}`;
}

export function routineChips(routine: Routine): string[] {
  const items = routine.items ?? [];
  const chips = [`${items.length} ${items.length === 1 ? 'exercise' : 'exercises'}`];
  if (items.some((i) => i.finisher)) chips.push('Forearms');
  return chips;
}

const SHORT_NAMES: Record<string, string> = {
  'Barbell back squat': 'Squat',
  'Barbell bench press': 'Bench press',
  'Conventional deadlift': 'Deadlift',
  'Barbell Romanian deadlift': 'Romanian deadlift',
  'Bent-over barbell row': 'Row',
  'Standing overhead press': 'Overhead press',
};

export function shortExerciseName(name: string): string {
  return SHORT_NAMES[name] ?? name;
}

function fmtKg(kg: number): string {
  return Number.isInteger(kg) ? String(kg) : kg.toFixed(1).replace(/\.0$/, '');
}

/** "Squat 40 kg × 8, 7, 7" (same weight), "Romanian deadlift 30 × 10, 40 × 10 kg" (mixed), "Plank 45, 50". */
export function describeSets(exercise: string, sets: { kg: number | null; amount: number }[]): string {
  const name = shortExerciseName(exercise);
  if (!sets.length) return name;
  const weights = sets.map((s) => s.kg);
  const amounts = sets.map((s) => fmtKg(s.amount)).join(', ');
  if (weights.every((w) => !w)) return `${name} ${amounts}`;
  if (weights.every((w) => w === weights[0])) return `${name} ${fmtKg(weights[0]!)} kg × ${amounts}`;
  return `${name} ${sets.map((s) => `${fmtKg(s.kg ?? 0)} × ${fmtKg(s.amount)}`).join(', ')} kg`;
}
