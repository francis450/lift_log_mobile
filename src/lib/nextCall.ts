// The add-weight rule (docs/01, "Add-weight rule"). One pure function; every branch is unit-tested.
// The server's weekly review ports the same rule to Python and shares this test table (M7).
//
// Since Block 3 the rule judges working sets only (warm-ups are skipped), reads effort as reps in
// reserve (RIR 0-4), and handles assisted exercises, where the logged kg is the machine's help and
// less help is progress.

export type ExerciseType = 'load' | 'bodyweight' | 'time' | 'distance' | 'assisted';
/** The old three-button effort scale. Still read for sets logged before RIR. */
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
  /** Legacy rating; `rir` wins when both are set. */
  effort?: Effort | null;
  /** Reps in reserve: 0 = nothing left, 4 = four or more left. */
  rir?: number | null;
  /** Warm-up sets never count. */
  warmup?: boolean;
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
  /** Set on assisted exercises: kg is the machine's help, so "up" means less help. */
  assist?: true;
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

/**
 * The working weight: the kg used for the most sets. A tie goes to the harder weight
 * (heavier, or for assisted exercises the one with less help), so one top set plus
 * back-off sets is judged on the back-off sets.
 */
export function workingKg(session: RuleSession, assisted = false): number {
  const counts = new Map<number, number>();
  for (const s of session.sets) counts.set(s.kg ?? 0, (counts.get(s.kg ?? 0) ?? 0) + 1);
  let best = 0;
  let bestCount = -1;
  for (const [kg, count] of counts) {
    const harder = assisted ? kg < best : kg > best;
    if (count > bestCount || (count === bestCount && harder)) {
      best = kg;
      bestCount = count;
    }
  }
  return best;
}

function workSets(session: RuleSession, kg: number): RuleSet[] {
  return session.sets.filter((s) => (s.kg ?? 0) === kg);
}

const LEGACY_RIR: Record<Effort, number> = { easy: 3, right: 1, hard: 0 };

/** Reps in reserve for a set: the logged RIR, else the old effort read as easy 3, right 1, hard 0. */
export function rirOf(s: Pick<RuleSet, 'rir' | 'effort'>): number | null {
  if (s.rir !== null && s.rir !== undefined) return s.rir;
  return s.effort ? LEGACY_RIR[s.effort] : null;
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : String(round2(n));
}

/** The next weight the equipment has: the smallest multiple of inc above w. */
export function stepUp(w: number, inc: number): number {
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

/**
 * Per-side sets (side L and R sharing a set_no) become one set judged on the weaker side:
 * the lower kg, the lower amount and the fewer reps in reserve. Sets without a side pass through.
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
      const first: RuleSet = { kg: s.kg, amount: s.amount, rir: rirOf(s) };
      bySetNo.set(s.set_no, first);
      out.push(first);
      continue;
    }
    if (s.kg !== null) pair.kg = pair.kg === null ? s.kg : Math.min(pair.kg, s.kg);
    pair.amount = Math.min(pair.amount, s.amount);
    const rirs = [pair.rir, rirOf(s)].filter((r): r is number => r !== null && r !== undefined);
    pair.rir = rirs.length ? Math.min(...rirs) : null;
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
  const isGym = exercise.type === 'load' || exercise.type === 'distance' || exercise.type === 'assisted';
  const sessions = history
    .filter((s) => !(isGym && s.deload))
    .map((s) => ({ ...s, sets: weakerSide(s.sets.filter((x) => !x.warmup)) }))
    .filter((s) => s.sets.length > 0);

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
    const kg = Math.max(snap(result.kg + delta, exercise.increment_kg), 0);
    return { ...result, kg, reason: 'From your weekly review' };
  }
  return result;
}

function weightCall(
  exercise: RuleExercise,
  target: RuleTarget,
  [a, b]: [number, number],
  sessions: RuleSession[],
): NextCall {
  const assisted = exercise.type === 'assisted';
  const tag = (call: NextCall): NextCall => (assisted ? { ...call, assist: true } : call);

  // 3. No history.
  if (!sessions.length) {
    if (target.startingKg) {
      return tag({ call: 'start', kg: target.startingKg, reason: `Start around ${fmt(target.startingKg)} kg` });
    }
    return tag({
      call: 'start',
      reason: assisted ? 'Pick the help that lets you do clean reps' : 'Pick a weight you can do with clean form',
    });
  }

  const inc = exercise.increment_kg;
  const w = workingKg(sessions[0], assisted);
  const work = workSets(sessions[0], w);
  // Harder means more kg, or for assisted exercises less help.
  const harder = (kg: number) => (assisted ? stepDown(kg, inc) : stepUp(kg, inc));
  const easier = (kg: number) => (assisted ? stepUp(kg, inc) : stepDown(kg, inc));
  // A jump of more than 10% needs reps to spare first (dumbbells 5 -> 7.5 kg, an empty bar 20 -> 25 kg).
  const big = exercise.type === 'load' && bigStep(w, stepUp(w, inc) - w);
  const need = big ? b + 2 : b;
  const zeros = (sets: RuleSet[]) => sets.filter((x) => rirOf(x) === 0).length;

  // 4. Every working set at the top of the range (+2 reps before a big jump), with at most one set to failure.
  if (work.length >= target.sets && work.every((s) => s.amount >= need) && zeros(work) <= 1) {
    if (assisted && w === 0) return tag({ call: 'hold', kg: 0, reason: 'No help needed: beat your reps' });
    if (assisted && inc <= 0) return tag({ call: 'up', reason: 'Hit the top of the range: take one step less help' });
    return tag({
      call: 'up',
      kg: harder(w),
      reason: big ? 'Hit the top of the range with reps to spare' : 'Hit the top of the range',
    });
  }

  // The last sessions at this working weight.
  const atW = sessions.filter((s) => workingKg(s, assisted) === w);
  if (atW.length >= 2) {
    const lastTwo = atW.slice(0, 2);
    // 5. Felt easy (3+ reps in reserve) two sessions running. Skipped on a big step.
    const easy = lastTwo.every((s) => {
      const sets = workSets(s, w);
      const easyCount = sets.filter((x) => (rirOf(x) ?? -1) >= 3).length;
      return sets.length > 0 && sets.every((x) => x.amount >= a) && easyCount * 3 >= sets.length * 2 && zeros(sets) === 0;
    });
    if (!big && easy && !(assisted && (w === 0 || inc <= 0))) {
      return tag({ call: 'up', kg: harder(w), reason: 'Felt easy two sessions running' });
    }

    // 6. Struggling two sessions running: half the sets to failure and half short of the range.
    const hard = lastTwo.every((s) => {
      const sets = workSets(s, w);
      const shortCount = sets.filter((x) => x.amount < a).length;
      return sets.length > 0 && zeros(sets) * 2 >= sets.length && shortCount * 2 >= sets.length;
    });
    if (hard && !(assisted && inc <= 0)) {
      return tag({ call: 'down', kg: easier(w), reason: 'Two hard sessions: drop a step and rebuild' });
    }
  }

  // 7. Stalled: three sessions running at this weight without adding a rep.
  const runAtW: RuleSession[] = [];
  for (const s of sessions) {
    if (workingKg(s, assisted) !== w) break;
    runAtW.push(s);
  }
  const full = (s: RuleSession) => workSets(s, w).length >= target.sets;
  if (runAtW.length >= 3 && full(runAtW[0]) && full(runAtW[2])) {
    const reps = (s: RuleSession) =>
      workSets(s, w)
        .slice(0, target.sets)
        .reduce((sum, x) => sum + x.amount, 0);
    if (reps(runAtW[0]) <= reps(runAtW[2])) {
      if (big || (assisted && inc <= 0) || easier(w) === w) {
        return tag({ call: 'hold', kg: w, reason: 'No progress in 3 sessions: rest 3 min and check sleep and food' });
      }
      return tag({ call: 'down', kg: easier(w), reason: 'No progress in 3 sessions: drop a step and rebuild' });
    }
  }

  // 8. Otherwise hold.
  return tag({ call: 'hold', kg: w, reason: big ? `Build to ${fmt(need)} reps before moving up` : 'Beat your reps' });
}

/** Short chip label: "Up to 42.5 kg", "Stay 40 kg", "Start around 40 kg". */
export function callLabel(call: NextCall): string {
  const kg = call.kg !== undefined ? `${fmt(call.kg)} kg` : '';
  if (call.assist && (call.call === 'up' || call.call === 'hold' || call.call === 'down')) {
    if (call.call === 'up') return kg ? `Less help: ${kg}` : 'Less help';
    if (call.call === 'down') return `More help: ${kg}`;
    return call.kg === 0 ? 'No help' : `Stay ${kg} help`;
  }
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
