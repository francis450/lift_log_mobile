import type { Program } from '@/api/types';

import program from './fixtures/program-block2.json';
import { isMissed, isTraining, mainReps, phaseFor, phaseSpans, routineFor, weekDates, weekFor } from '../program';

const block = program as unknown as Program;

describe('program engine', () => {
  it('7 Oct is week 1, build, Conditioning + Core', () => {
    expect(weekFor(block, '2026-10-07')).toBe(1);
    expect(phaseFor(block, 1)).toBe('build');
    expect(routineFor(block, '2026-10-07')?.name).toBe('Conditioning + Core');
  });

  it('week 4 shows the home deload on Mon, Wed and Fri only', () => {
    const days = weekDates(block, 4);
    expect(days[0]).toBe('2026-10-26');
    expect(days.map((d) => routineFor(block, d)?.key ?? null)).toEqual([
      'home_deload',
      null,
      'home_deload',
      null,
      'home_deload',
      null,
      'checkin',
    ]);
    expect(days.filter((d) => isTraining(routineFor(block, d)))).toEqual(['2026-10-26', '2026-10-28', '2026-10-30']);
  });

  it('is empty outside the block', () => {
    expect(weekFor(block, '2026-10-04')).toBeNull();
    expect(weekFor(block, '2026-12-28')).toBeNull();
    expect(routineFor(block, '2026-12-28')).toBeNull();
  });

  it('flags missed sessions', () => {
    const monday = routineFor(block, '2026-10-05');
    expect(isMissed(monday, '2026-10-05', '2026-10-07', false)).toBe(true);
    expect(isMissed(monday, '2026-10-05', '2026-10-07', true)).toBe(false);
    expect(isMissed(monday, '2026-10-12', '2026-10-07', false)).toBe(false);
    expect(isMissed(routineFor(block, '2026-10-10'), '2026-10-10', '2026-10-12', false)).toBe(false);
  });

  it('describes phases', () => {
    expect(phaseSpans(block).map((p) => p.weeks)).toEqual([3, 1, 4, 3, 1]);
    expect(mainReps(block, 1)).toBe('6-8');
    expect(mainReps(block, 5)).toBe('5-6');
  });
});
