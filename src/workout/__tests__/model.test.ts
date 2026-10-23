import type { ExerciseInfo, Program } from '@/api/types';
import program from '@/lib/__tests__/fixtures/program-block2.json';
import { sessionsByDate } from '@/workout/week';
import { callSentence } from '@/lib/nextCall';
import { routineFor } from '@/lib/program';

import {
  callFor,
  createDraft,
  dayStatus,
  effortRead,
  fromSession,
  hasLogged,
  historyFor,
  needsStart,
  nextItemFor,
  startDraft,
  summarise,
  targetLine,
  toPayload,
  toSession,
  withDeloadRows,
  WorkoutDraft,
} from '../model';

const block = program as unknown as Program;
const library: Record<string, ExerciseInfo> = {
  'Barbell back squat': { type: 'load', increment_kg: 2.5, form_url: null },
  'Barbell Romanian deadlift': { type: 'load', increment_kg: 2.5, form_url: null },
  'Hip thrust': { type: 'load', increment_kg: 2.5, form_url: null },
  'Standing calf raise': { type: 'load', increment_kg: 2.5, form_url: null },
  Plank: { type: 'time', increment_kg: 0, form_url: null },
};

function logged6Oct(): WorkoutDraft {
  const routine = routineFor(block, '2026-10-06')!;
  const draft = createDraft({
    date: '2026-10-06',
    week: 1,
    routine,
    suggestions: { 'Barbell back squat': { call: 'start', kg: 40, reason: '' } },
    now: new Date('2026-10-06T15:02:00Z'),
  });
  const fill = (exercise: string, sets: [number, number][]) => {
    draft.rows[exercise] = sets.map(([kg, reps]) => ({ kg: String(kg), reps: String(reps), done: true, effort: null }));
  };
  fill('Barbell back squat', [[40, 8], [40, 7], [40, 7]]);
  fill('Barbell Romanian deadlift', [[30, 10], [40, 10], [40, 10]]);
  fill('Hip thrust', [[50, 10], [50, 8], [50, 8]]);
  fill('Standing calf raise', [[40, 10], [40, 10], [40, 10]]);
  draft.status = 'done';
  draft.finished_at = '2026-10-06T15:54:00.000Z';
  return draft;
}

describe('workout drafts', () => {
  it('prefill the suggested weight and leave reps empty', () => {
    const routine = routineFor(block, '2026-10-06')!;
    const draft = createDraft({
      date: '2026-10-06',
      week: 1,
      routine,
      suggestions: { 'Barbell back squat': { call: 'start', kg: 40, reason: '' } },
      now: new Date('2026-10-06T15:00:00Z'),
    });
    expect(draft.exercises).toEqual(['Barbell back squat', 'Barbell Romanian deadlift', 'Hip thrust', 'Standing calf raise']);
    expect(draft.rows['Barbell back squat']).toHaveLength(3);
    expect(draft.rows['Barbell back squat'][0]).toEqual({ kg: '40', reps: '', done: false, effort: null });
    expect(draft.rows['Hip thrust'][0].kg).toBe('');
  });

  it('only saves rows with reps entered', () => {
    const routine = routineFor(block, '2026-10-06')!;
    const draft = createDraft({ date: '2026-10-06', week: 1, routine, suggestions: {}, now: new Date() });
    draft.rows['Barbell back squat'][0] = { kg: '40', reps: '8', done: true, effort: 'easy' };
    draft.rows['Barbell back squat'][2] = { kg: '', reps: '6', done: true, effort: null };
    const payload = toPayload(draft);
    expect(payload.sets).toEqual([
      { exercise: 'Barbell back squat', set_no: 1, kg: 40, amount: 8, effort: 'easy', done: true },
      { exercise: 'Barbell back squat', set_no: 2, kg: null, amount: 6, effort: null, done: true },
    ]);
  });

  it('round-trips through the server shape and pads to the planned sets', () => {
    const draft = logged6Oct();
    const back = fromSession(toSession(draft), routineFor(block, '2026-10-06'));
    expect(back.rows['Barbell back squat'].map((r) => r.reps)).toEqual(['8', '7', '7']);
    expect(toPayload(back).sets).toEqual(toPayload(draft).sets);
  });
});

describe('6 Oct example', () => {
  it('summarises like the design: 12 sets, 4,480 kg', () => {
    const summary = summarise(toSession(logged6Oct()), library);
    expect(summary).toMatchObject({ setsLogged: 12, totalKg: 4480, durationMin: 52 });
  });

  it('the next lower day says "Stay 40 kg, beat your reps"', () => {
    const local = [toSession(logged6Oct())];
    const nextLower = '2026-10-13';
    const item = routineFor(block, nextLower)!.items!.find((i) => i.exercise === 'Barbell back squat')!;
    const history = historyFor('Barbell back squat', nextLower, local, []);
    const call = callFor({ program: block, item, info: library['Barbell back squat'], history });
    expect(callSentence(call)).toBe('Stay 40 kg, beat your reps');
  });
});

describe('history', () => {
  it('merges local and server, newest first, local wins, before the date', () => {
    const server = [
      {
        date: '2026-10-06',
        week: 1,
        routine_key: 'lower',
        routine_name: 'Lower + Walk',
        status: 'done' as const,
        exercise: 'Barbell back squat',
        sets: [{ set_no: 1, kg: 35, amount: 8, effort: null, done: true }],
      },
    ];
    const local = [toSession(logged6Oct())];
    const history = historyFor('Barbell back squat', '2026-10-13', local, server);
    expect(history).toHaveLength(1);
    expect(history[0].sets[0].kg).toBe(40);
    expect(historyFor('Barbell back squat', '2026-10-06', local, server)).toEqual([]);
  });

  it('marks home deload sessions', () => {
    const deload = { ...toSession(logged6Oct()), session_date: '2026-10-28', routine_key: 'home_deload' };
    expect(historyFor('Hip thrust', '2026-11-02', [deload], [])[0].deload).toBe(true);
  });

  it('finds the next time an exercise comes up, with the current phase target', () => {
    expect(nextItemFor(block, 'Barbell back squat', '2026-10-07')?.reps).toBe('6-8');
    expect(nextItemFor(block, 'Barbell back squat', '2026-11-03')?.reps).toBe('5');
  });
});

describe('home deload', () => {
  it('turns ticked moves per round into sets', () => {
    const routine = routineFor(block, '2026-10-26')!;
    const draft = createDraft({ date: '2026-10-26', week: 4, routine, suggestions: {}, now: new Date() });
    draft.ticks = { 'Push-ups': [2, 1], Plank: [1] };
    const sets = toPayload(withDeloadRows(draft, routine)).sets;
    expect(sets).toEqual([
      { exercise: 'Push-ups', set_no: 1, kg: null, amount: 10, effort: null, done: true },
      { exercise: 'Push-ups', set_no: 2, kg: null, amount: 10, effort: null, done: true },
      { exercise: 'Plank', set_no: 1, kg: null, amount: 45, effort: null, done: true },
    ]);
  });
});

describe('summary read and day status', () => {
  it('reads the effort split', () => {
    expect(effortRead({ easy: 7, right: 4, hard: 1, unrated: 0 }).text).toBe(
      "Most sets felt easy. There's room to go heavier.",
    );
    expect(effortRead({ easy: 1, right: 1, hard: 3, unrated: 0 }).tone).toBe('hold');
    expect(effortRead({ easy: 0, right: 0, hard: 0, unrated: 12 }).tone).toBe('accent');
  });

  it('gives each day a status', () => {
    const today = '2026-10-07';
    expect(dayStatus(block, '2026-10-05', today, null)).toBe('missed');
    expect(dayStatus(block, '2026-10-06', today, { status: 'done' })).toBe('done');
    expect(dayStatus(block, '2026-10-07', today, null)).toBe('today');
    expect(dayStatus(block, '2026-10-07', today, { status: 'in_progress' })).toBe('in_progress');
    expect(dayStatus(block, '2026-10-08', today, null)).toBe('upcoming');
    expect(dayStatus(block, '2026-10-10', today, null)).toBe('rest');
  });

  it('describes targets', () => {
    const squat = routineFor(block, '2026-10-06')!.items![0];
    expect(targetLine(squat, library['Barbell back squat'])).toBe('3 × 6–8 reps · rest 2 min');
    const plank = routineFor(block, '2026-10-07')!.items![0];
    expect(targetLine(plank, library.Plank)).toBe('3 × 45–60 s · rest 90 s');
  });
});

describe('starting a workout', () => {
  const fresh = (): WorkoutDraft =>
    createDraft({
      date: '2026-10-13',
      week: 2,
      routine: routineFor(block, '2026-10-06')!,
      suggestions: { 'Barbell back squat': { call: 'hold', kg: 40, reason: '' } },
      now: new Date('2026-10-13T06:00:00Z'),
    });

  it('opens a new session as a preview, with weights prefilled but nothing logged', () => {
    const draft = fresh();
    expect(hasLogged(draft)).toBe(false);
    expect(needsStart(draft)).toBe(true);
  });

  it('treats a session opened before Start existed as not started while nothing is logged', () => {
    const legacy = fresh();
    delete legacy.begun;
    expect(needsStart(legacy)).toBe(true);
    legacy.rows['Barbell back squat'][0] = { kg: '40', reps: '8', done: false, effort: null };
    expect(hasLogged(legacy)).toBe(true);
    expect(needsStart(legacy)).toBe(false);
  });

  it('counts a ticked set or a ticked deload move as logged', () => {
    const ticked = fresh();
    ticked.rows['Barbell back squat'][0] = { ...ticked.rows['Barbell back squat'][0], done: true };
    expect(needsStart(ticked)).toBe(false);
    expect(needsStart({ ...fresh(), ticks: { Plank: [1] } })).toBe(false);
    expect(needsStart({ ...fresh(), ticks: { Plank: [] } })).toBe(true);
  });

  it('never asks to start a finished session', () => {
    expect(needsStart({ ...fresh(), status: 'done' })).toBe(false);
  });

  it('starts the clock when Start is tapped', () => {
    const started = startDraft(fresh(), new Date('2026-10-13T15:05:00Z'));
    expect(started.begun).toBe(true);
    expect(started.started_at).toBe('2026-10-13T15:05:00.000Z');
    expect(started.client_updated_at).toBe('2026-10-13T15:05:00.000Z');
    expect(needsStart(started)).toBe(false);
    // The flag stays on the phone.
    expect(toPayload(started)).not.toHaveProperty('begun');
  });

  it('shows Start, not Resume, on Train for a session opened but never started', () => {
    const server = [
      { date: '2026-10-13', routine_key: 'lower', routine_name: 'Lower + Walk', sets: 0, status: 'in_progress' as const },
      { date: '2026-10-12', routine_key: 'upper', routine_name: 'Upper', sets: 4, status: 'in_progress' as const },
    ];
    expect(sessionsByDate(server, [fresh()]).has('2026-10-13')).toBe(false);
    expect(sessionsByDate(server, []).get('2026-10-12')?.status).toBe('in_progress');
    // Started but nothing logged yet: Resume.
    const started = startDraft(fresh(), new Date('2026-10-13T15:05:00Z'));
    expect(sessionsByDate(server, [started]).get('2026-10-13')?.status).toBe('in_progress');
  });
});
