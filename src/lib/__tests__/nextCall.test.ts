import table from './nextCall.cases.json';
import {
  callLabel,
  callSentence,
  Effort,
  nextCall,
  parseRepRange,
  RuleExercise,
  RuleSession,
  RuleTarget,
} from '../nextCall';

type RawSet = [number | null, number, string | null] | [number | null, number, string | null, 'L' | 'R', number];
interface RawCase {
  name: string;
  exercise: string;
  target: RuleTarget;
  reviewDeltaKg?: number;
  history: { date: string; deload?: boolean; sets: RawSet[] }[];
  expect: { call: string; kg?: number; reason: string };
}

const exercises = table.exercises as Record<string, RuleExercise>;

function history(raw: RawCase['history']): RuleSession[] {
  return raw.map((s) => ({
    date: s.date,
    deload: s.deload,
    sets: s.sets.map(([kg, amount, effort, side, set_no]) => ({ kg, amount, effort: effort as Effort | null, side, set_no })),
  }));
}

describe('nextCall (shared table)', () => {
  const cases = table.cases as RawCase[];

  it('covers at least 15 cases', () => {
    expect(cases.length).toBeGreaterThanOrEqual(15);
  });

  it.each(cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const result = nextCall(exercises[c.exercise], c.target, history(c.history), { reviewDeltaKg: c.reviewDeltaKg });
    expect(result).toEqual(c.expect);
  });
});

describe('display', () => {
  it('reads "Stay 40 kg, beat your reps" for the 6 Oct squat', () => {
    expect(callSentence({ call: 'hold', kg: 40, reason: 'Beat your reps' })).toBe('Stay 40 kg, beat your reps');
  });

  it('labels every call', () => {
    expect(callLabel({ call: 'up', kg: 42.5, reason: '' })).toBe('Up to 42.5 kg');
    expect(callLabel({ call: 'down', kg: 37.5, reason: '' })).toBe('Down to 37.5 kg');
    expect(callSentence({ call: 'start', kg: 40, reason: 'Start around 40 kg' })).toBe('First session: start around 40 kg');
    expect(callSentence({ call: 'start', reason: 'Pick a weight you can do with clean form' })).toBe(
      'First session: pick a weight you can do with clean form',
    );
    expect(callSentence({ call: 'bodyweight', reason: 'Beat last time: 12, 11' })).toBe('Beat last time: 12, 11');
  });

  it('parses rep targets', () => {
    expect(parseRepRange('6-8')).toEqual([6, 8]);
    expect(parseRepRange('5')).toEqual([5, 5]);
    expect(parseRepRange('max')).toBeNull();
  });
});
