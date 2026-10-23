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
  /** Per-side exercises log each set as an L and an R entry sharing a set_no. */
  side?: 'L' | 'R' | null;
  set_no?: number;
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

/** The next weight the equipment has: the smallest multiple of inc above w. */
function stepUp(w: number, inc: number): number {
  if (inc <= 0) return round2(w);
  return round2((Math.floor(w / inc + 1e-9) + 1) * inc);
}

/** The largest multiple of inc below w, not below 0. */
function stepDown(w: number, inc: number): number {
  if (inc <= 0) return round2(w);
  return Math.max(round2((Math.ceil(w / inc - 1e-9) - 1) * inc), 0);
}

/** The nearest multiple of inc. */
function snap(kg: number, inc: number): number {
  return inc > 0 ? round2(Math.floor(kg / inc + 0.5) * inc) : round2(kg);
}

/** A step of more than 10% of the weight (dumbbells 5 -> 7.5 kg is +50%). */
export function bigStep(w: number, inc: number): boolean {
  return w > 0 && inc > w * 0.1;
}

const EFFORT_RANK: Record<Effort, number> = { easy: 1, right: 2, hard: 3 };

/**
 * Per-side sets (side L and R sharing a set_no) become one set judged on the weaker side:
 * the lower kg, the lower amount and the harder effort. Sets without a side pass through.
 */
export function weakerSide(sets: RuleSet[]): RuleSet[] {
  const out: RuleSet[] = [];
  const bySetNo = new Map<number | undefined, RuleSet>();
  for (const s of sets) {
    if (s.side !== 'L' && s.side !== 'R') {
      out.push(s);
      continue;
    }
    const pair = bySetNo.get(s.set_no);
    if (!pair) {
      const first: RuleSet = { kg: s.kg, amount: s.amount, effort: s.effort };
      bySetNo.set(s.set_no, first);
      out.push(first);
      continue;
    }
    if (s.kg !== null) pair.kg = pair.kg === null ? s.kg : Math.min(pair.kg, s.kg);
    pair.amount = Math.min(pair.amount, s.amount);
    const efforts = [pair.effort, s.effort].filter((e): e is Effort => !!e);
    pair.effort = efforts.length ? efforts.reduce((a, b) => (EFFORT_RANK[b] > EFFORT_RANK[a] ? b : a)) : null;
  }
  return out;
}

/**
 * history: earlier sessions containing this exercise, newest first, each with only this exercise's sets.
 * Per-side sets are judged on the weaker side (weakerSide).
 */
export function nextCall(
  exercise: RuleExercise,
  target: RuleTarget,
  history: RuleSession[],
  options: RuleOptions = {},
): NextCall {
  const isGym = exercise.type === 'load' || exercise.type === 'distance';
  const sessions = history
    .filter((s) => s.sets.length > 0 && !(isGym && s.deload))
    .map((s) => ({ ...s, sets: weakerSide(s.sets) }));

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
    return { call: result.call, kg: Math.max(snap(result.kg + delta, exercise.increment_kg), 0), reason: 'From your weekly review' };
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
    return { call: 'up', kg: stepUp(w, inc), reason: 'Hit the top of the range' };
  }

  // The last two sessions at this weight.
  const atW = sessions.filter((s) => topKg(s) === w).slice(0, 2);
  if (atW.length === 2) {
    // 5 is skipped on a big step: stay and build reps to the top of the range first.
    const big = bigStep(w, inc);
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
    if (!big && easy) return { call: 'up', kg: stepUp(w, inc), reason: 'Felt easy two sessions running' };

    // 6. Struggling two sessions running.
    const hard = atW.every((s) => {
      const sets = workSets(s, w);
      const hardCount = sets.filter((x) => x.effort === 'hard').length;
      const shortCount = sets.filter((x) => x.amount < a).length;
      return sets.length > 0 && hardCount * 2 >= sets.length && shortCount * 2 >= sets.length;
    });
    if (hard) {
      return { call: 'down', kg: stepDown(w, inc), reason: 'Two hard sessions: drop a step and rebuild' };
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
