// The add-weight rule (docs/01, "Add-weight rule"). One pure function; every branch is unit-tested.
// The server's weekly review ports the same rule to Python and shares this test table (M7).

export type ExerciseType = 'load' | 'bodyweight' | 'time' | 'distance';
export type Effort = 'easy' | 'right' | 'hard';
export type CallKind = 'up' | 'hold' | 'down' | 'start' | 'test' | 'bodyweight';

export interface RuleExercise {
  name: string;
  type: ExerciseType;
  increment_kg: number;
}

export interface RuleTarget {
  sets: number;
  /** "6-8", "5" or "max" */
  reps: string;
  /** Part of a test routine (week 12). */
  test?: boolean;
  /** The program's starting_weights_kg value for this exercise, if any. */
  startingKg?: number | null;
}

export interface RuleSet {
  kg: number | null;
  amount: number;
  effort: Effort | null;
}

export interface RuleSession {
  date: string;
  /** Home deload sessions don't count as history for gym exercises. */
  deload?: boolean;
  /** Only this exercise's sets. */
  sets: RuleSet[];
}

export interface NextCall {
  call: CallKind;
  kg?: number;
  reason: string;
}

export interface RuleOptions {
  /** Accepted weekly-review weight change for the coming week (LL Plan Change.delta_kg). */
  reviewDeltaKg?: number;
}

/** "6-8" -> [6, 8]; "5" -> [5, 5]; "max" -> null. */
export function parseRepRange(reps: string): [number, number] | null {
  const match = /^\s*(\d+(?:\.\d+)?)\s*(?:[-–]\s*(\d+(?:\.\d+)?))?\s*$/.exec(reps);
  if (!match) return null;
  const a = Number(match[1]);
  return [a, match[2] ? Number(match[2]) : a];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function topKg(session: RuleSession): number {
  return Math.max(0, ...session.sets.map((s) => s.kg ?? 0));
}

function workSets(session: RuleSession, kg: number): RuleSet[] {
  return session.sets.filter((s) => (s.kg ?? 0) === kg);
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : String(round2(n));
}

/**
 * history: earlier sessions containing this exercise, newest first, each with only this exercise's sets.
 */
export function nextCall(
  exercise: RuleExercise,
  target: RuleTarget,
  history: RuleSession[],
  options: RuleOptions = {},
): NextCall {
  const isGym = exercise.type === 'load' || exercise.type === 'distance';
  const sessions = history.filter((s) => s.sets.length > 0 && !(isGym && s.deload));

  // 1. Test routine.
  if (target.test) {
    const best = Math.max(0, ...sessions.map(topKg));
    return best
      ? { call: 'test', kg: best, reason: `Work up past ${fmt(best)} kg if it moves well` }
      : { call: 'test', reason: 'Work up to your heaviest clean 5' };
  }

  // 2. Bodyweight, time, or a "max" target.
  const range = parseRepRange(target.reps);
  if (!isGym || range === null) {
    const last = sessions[0];
    return {
      call: 'bodyweight',
      reason: last ? `Beat last time: ${last.sets.map((s) => fmt(s.amount)).join(', ')}` : 'Beat last time',
    };
  }

  const result = weightCall(exercise, target, range, sessions);
  const delta = options.reviewDeltaKg ?? 0;
  if (delta && result.kg !== undefined) {
    return { call: result.call, kg: Math.max(round2(result.kg + delta), 0), reason: 'From your weekly review' };
  }
  return result;
}

function weightCall(
  exercise: RuleExercise,
  target: RuleTarget,
  [a, b]: [number, number],
  sessions: RuleSession[],
): NextCall {
  // 3. No history.
  if (!sessions.length) {
    return target.startingKg
      ? { call: 'start', kg: target.startingKg, reason: `Start around ${fmt(target.startingKg)} kg` }
      : { call: 'start', reason: 'Pick a weight you can do with clean form' };
  }

  const inc = exercise.increment_kg;
  const last = sessions[0];
  const w = topKg(last);
  const work = workSets(last, w);

  // 4. Every work set at the top of the range.
  if (work.length >= target.sets && work.every((s) => s.amount >= b)) {
    return { call: 'up', kg: round2(w + inc), reason: 'Hit the top of the range' };
  }

  // The last two sessions at this weight.
  const atW = sessions.filter((s) => topKg(s) === w).slice(0, 2);
  if (atW.length === 2) {
    // 5. Felt easy two sessions running.
    const easy = atW.every((s) => {
      const sets = workSets(s, w);
      const easyCount = sets.filter((x) => x.effort === 'easy').length;
      return (
        sets.length > 0 &&
        sets.every((x) => x.amount >= a) &&
        easyCount * 3 >= sets.length * 2 &&
        !sets.some((x) => x.effort === 'hard')
      );
    });
    if (easy) return { call: 'up', kg: round2(w + inc), reason: 'Felt easy two sessions running' };

    // 6. Struggling two sessions running.
    const hard = atW.every((s) => {
      const sets = workSets(s, w);
      const hardCount = sets.filter((x) => x.effort === 'hard').length;
      const shortCount = sets.filter((x) => x.amount < a).length;
      return sets.length > 0 && hardCount * 2 >= sets.length && shortCount * 2 >= sets.length;
    });
    if (hard) {
      return { call: 'down', kg: Math.max(round2(w - inc), 0), reason: 'Two hard sessions: drop a step and rebuild' };
    }
  }

  // 7. Otherwise hold.
  return { call: 'hold', kg: w, reason: 'Beat your reps' };
}

/** Short chip label: "Up to 42.5 kg", "Stay 40 kg", "Start around 40 kg". */
export function callLabel(call: NextCall): string {
  const kg = call.kg !== undefined ? `${fmt(call.kg)} kg` : '';
  switch (call.call) {
    case 'up':
      return `Up to ${kg}`;
    case 'hold':
      return `Stay ${kg}`;
    case 'down':
      return `Down to ${kg}`;
    case 'start':
      return kg ? `Start around ${kg}` : 'Pick a weight';
    case 'test':
      return 'Test';
    case 'bodyweight':
      return 'Beat last time';
  }
}

/** One line for the workout card: "Stay 40 kg, beat your reps". */
export function callSentence(call: NextCall): string {
  switch (call.call) {
    case 'start':
      return call.kg !== undefined ? `First session: start around ${fmt(call.kg)} kg` : `First session: ${lowerFirst(call.reason)}`;
    case 'test':
    case 'bodyweight':
      return call.reason;
    default:
      return `${callLabel(call)}, ${lowerFirst(call.reason)}`;
  }
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/** CallChip colour for a call (docs/01, "Display"). */
export function chipKind(call: CallKind): 'up' | 'hold' | 'start' | 'down' {
  if (call === 'up') return 'up';
  if (call === 'start' || call === 'test') return 'start';
  if (call === 'down') return 'down';
  return 'hold';
}
