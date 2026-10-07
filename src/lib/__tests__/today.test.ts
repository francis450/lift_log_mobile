import type { Routine, Session } from '@/api/types';

import { checkRange, parseNumber, RULES } from '../numbers';
import {
  describeSets,
  phaseLabel,
  proteinBehindPace,
  proteinHint,
  routineChips,
  sessionCard,
  sessionEyebrow,
} from '../today';

const conditioning: Routine = {
  key: 'conditioning',
  name: 'Conditioning + Core',
  items: [
    { exercise: 'Plank', sets: 3, reps: '45-60' },
    { exercise: 'Dumbbell wrist curl', sets: 3, reps: '15-20', finisher: true },
  ],
};

const session = (status: Session['status']): Session => ({
  name: 'x',
  session_date: '2026-10-07',
  program: 'block-2-2026',
  week: 1,
  routine_key: 'conditioning',
  routine_name: 'Conditioning + Core',
  status,
  started_at: null,
  finished_at: null,
  note: '',
  client_updated_at: null,
  sets: [{ exercise: 'Plank', set_no: 1, kg: null, amount: 45, effort: null, done: true }],
});

describe('protein pace hint', () => {
  it('is hidden before 14:00', () => {
    expect(proteinBehindPace(0, 130, 13 * 60 + 59)).toBe(false);
  });
  it('shows under 40% from 14:00', () => {
    expect(proteinBehindPace(51, 130, 14 * 60)).toBe(true);
    expect(proteinBehindPace(52, 130, 14 * 60)).toBe(false);
  });
  it('shows under 70% from 19:00', () => {
    expect(proteinBehindPace(90, 130, 19 * 60)).toBe(true);
    expect(proteinBehindPace(91, 130, 19 * 60)).toBe(false);
  });
  it('needs a target', () => {
    expect(proteinBehindPace(0, null, 20 * 60)).toBe(false);
  });
  it('reads like the design', () => {
    expect(proteinHint(19, 130, 12 * 60, true)).toBe(
      '111 g protein to go. A high-protein lunch keeps you on track for tonight.',
    );
    expect(proteinHint(19, 130, 17 * 60, false)).toBe('111 g protein to go. A high-protein dinner keeps you on track.');
  });
});

describe('session card', () => {
  it('covers rest, check-in, optional, start, resume and done', () => {
    expect(sessionCard(null, null)).toEqual({ kind: 'rest' });
    expect(sessionCard({ key: 'checkin', name: 'Check-in', rest: true }, null)).toEqual({ kind: 'checkin' });
    expect(sessionCard({ key: 'easy', name: 'Easy (optional)', items: [] }, null).kind).toBe('optional');
    expect(sessionCard(conditioning, null).kind).toBe('start');
    expect(sessionCard(conditioning, session('in_progress')).kind).toBe('resume');
    expect(sessionCard(conditioning, session('done'))).toMatchObject({ kind: 'done', setsLogged: 1 });
  });

  it('labels the time and chips', () => {
    expect(sessionEyebrow('18:00', '6:00 PM')).toBe('Tonight · 6:00 PM');
    expect(sessionEyebrow('07:00', '7:00 AM')).toBe('Today · 7:00 AM');
    expect(routineChips(conditioning)).toEqual(['2 exercises', 'Forearms']);
    expect(phaseLabel('build')).toBe('Build phase');
    expect(phaseLabel(null)).toBeNull();
  });
});

describe('describeSets', () => {
  it('summarises the 6 Oct squat', () => {
    expect(
      describeSets('Barbell back squat', [
        { kg: 40, amount: 8 },
        { kg: 40, amount: 7 },
        { kg: 40, amount: 7 },
      ]),
    ).toBe('Squat 40 kg × 8, 7, 7');
  });
  it('handles mixed weights and bodyweight', () => {
    expect(
      describeSets('Barbell Romanian deadlift', [
        { kg: 30, amount: 10 },
        { kg: 40, amount: 10 },
      ]),
    ).toBe('Romanian deadlift 30 × 10, 40 × 10 kg');
    expect(describeSets('Plank', [{ kg: null, amount: 45 }])).toBe('Plank 45');
  });
});

describe('number input', () => {
  it('parses keypad input', () => {
    expect(parseNumber('71,5')).toBe(71.5);
    expect(parseNumber(' ')).toBeNull();
    expect(parseNumber('abc')).toBeNull();
  });
  it('checks ranges', () => {
    expect(checkRange(null, RULES.weight)).toBe('Enter your weight.');
    expect(checkRange(null, RULES.height)).toBeNull();
    expect(checkRange(20, RULES.weight)).toBe('Enter a weight between 25 and 400 kg.');
    expect(checkRange(72, RULES.weight)).toBeNull();
  });
});
