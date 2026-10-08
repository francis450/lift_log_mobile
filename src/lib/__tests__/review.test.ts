import type { PlanChange, Program, ReviewStats } from '@/api/types';
import { callFor, historyFor } from '@/workout/model';

import program from './fixtures/program-block2.json';
import { callLabel, callSentence } from '../nextCall';
import { routineFor } from '../program';
import { movedFrom, periodLabel, reviewDelta, statTiles } from '../review';

const block = program as unknown as Program;

const stats = (overrides: Partial<ReviewStats['checkin']> = {}): ReviewStats => ({
  week: 1,
  phase: 'build',
  period: ['2026-10-05', '2026-10-11'],
  targets: { kcal: 2200, protein_g: 130 },
  sessions: { planned: 5, done: 4, missed: ['Upper A (Mon)'], items: [] },
  effort: { easy: 7, right: 4, hard: 1, unrated: 0 },
  food: { days_logged: 6, avg_kcal: 1890, avg_protein_g: 98, protein_days_hit: 1, by_day: [] },
  checkin: { weight_kg: 72, weight_change_kg: null, waist_cm: null, forearm_cm: null, sleep: 3, energy: 4, ...overrides },
  goals: '',
});

const squatUp: PlanChange = {
  change_type: 'weight',
  title: 'Squat: +2.5 kg',
  why: 'Easy sets',
  exercise: 'Barbell back squat',
  delta_kg: 2.5,
};

describe('stat tiles', () => {
  it('match the design for a first weigh-in', () => {
    expect(statTiles(stats())).toEqual([
      { value: '4 / 5', caption: 'sessions' },
      { value: '98 g', caption: 'avg protein' },
      { value: '1,890', caption: 'avg kcal' },
      { value: '72.0', caption: 'kg, first weigh-in' },
    ]);
  });

  it('show the weight change, or no weigh-in', () => {
    expect(statTiles(stats({ weight_kg: 71.6, weight_change_kg: -0.4 }))[3]).toEqual({ value: '71.6', caption: 'kg, −0.4' });
    expect(statTiles(stats({ weight_kg: null }))[3]).toEqual({ value: '–', caption: 'no weigh-in' });
  });

  it('label the period', () => {
    expect(periodLabel(['2026-10-05', '2026-10-11'])).toBe('5–11 Oct');
    expect(periodLabel(['2026-10-26', '2026-11-01'])).toBe('26 Oct – 1 Nov');
  });
});

describe('accepted weight changes', () => {
  it('make the next lower session suggest 2.5 kg more, from the weekly review', () => {
    const nextLower = '2026-10-13';
    const item = routineFor(block, nextLower)!.items!.find((i) => i.exercise === 'Barbell back squat')!;
    const history = historyFor('Barbell back squat', nextLower, [], [
      {
        date: '2026-10-06',
        week: 1,
        routine_key: 'lower',
        routine_name: 'Lower + Walk',
        status: 'done',
        exercise: 'Barbell back squat',
        sets: [8, 7, 7].map((amount, i) => ({ set_no: i + 1, kg: 40, amount, effort: null, done: true })),
      },
    ]);
    const info = { type: 'load' as const, increment_kg: 2.5, form_url: null };
    const plain = callFor({ program: block, item, info, history });
    const reviewed = callFor({ program: block, item, info, history, reviewDeltaKg: reviewDelta([squatUp], 'Barbell back squat') });
    expect(plain.kg).toBe(40);
    expect(reviewed).toEqual({ call: 'hold', kg: 42.5, reason: 'From your weekly review' });
    expect(callLabel(reviewed)).toBe('Stay 42.5 kg');
    expect(callSentence(reviewed)).toBe('Stay 42.5 kg, from your weekly review');
  });

  it('only count weight changes for that exercise', () => {
    const whey: PlanChange = { change_type: 'nutrition', title: 'Whey', why: '', exercise: null, delta_kg: null };
    expect(reviewDelta([squatUp, whey], 'Barbell back squat')).toBe(2.5);
    expect(reviewDelta([squatUp], 'Hip thrust')).toBe(0);
    expect(reviewDelta(undefined, 'Hip thrust')).toBe(0);
  });
});

describe('moving a missed day to Saturday', () => {
  const move: PlanChange = {
    change_type: 'schedule',
    title: 'Move a missed Monday to Saturday',
    why: 'Keeps 5 sessions when Monday slips',
    exercise: null,
    delta_kg: null,
  };

  it('puts a missed Monday on Saturday', () => {
    expect(movedFrom(block, '2026-10-17', [move], () => false)).toBe('2026-10-12');
  });

  it('does nothing when Monday was trained, without the change, or on other days', () => {
    expect(movedFrom(block, '2026-10-17', [move], (d) => d === '2026-10-12')).toBeNull();
    expect(movedFrom(block, '2026-10-17', [], () => false)).toBeNull();
    expect(movedFrom(block, '2026-10-16', [move], () => false)).toBeNull();
  });
});
