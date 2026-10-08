import type { Program } from '@/api/types';

import program from './fixtures/program-block2.json';
import { planReminders, zonedTime } from '../reminders';

const block = program as unknown as Program;
const all = { workout: true, dinner: true, checkin: true };

function plan(overrides: Partial<Parameters<typeof planReminders>[0]> = {}) {
  return planReminders({
    program: block,
    today: '2026-10-07',
    now: new Date('2026-10-07T06:00:00Z'), // 09:00 in Nairobi, Wednesday
    timeZone: 'Africa/Nairobi',
    sessionTime: '18:00',
    reminders: all,
    dinnerLogged: () => false,
    days: 7,
    ...overrides,
  });
}

describe('reminders', () => {
  it('converts wall-clock times in the user time zone', () => {
    expect(zonedTime('2026-10-07', '18:00', 'Africa/Nairobi').toISOString()).toBe('2026-10-07T15:00:00.000Z');
    expect(zonedTime('2026-10-07', '18:00', 'UTC').toISOString()).toBe('2026-10-07T18:00:00.000Z');
  });

  it('reminds 30 min before training sessions only', () => {
    const workouts = plan().filter((r) => r.kind === 'workout');
    expect(workouts.map((r) => r.id)).toEqual([
      'workout:2026-10-07',
      'workout:2026-10-08',
      'workout:2026-10-09',
      'workout:2026-10-12',
      'workout:2026-10-13',
    ]);
    expect(workouts[0].at.toISOString()).toBe('2026-10-07T14:30:00.000Z');
    expect(workouts[0].title).toBe('Conditioning + Core in 30 minutes');
    expect(workouts[0].body).toBe('Your session starts at 6:00 PM.');
  });

  it('only the deload days in week 4', () => {
    const ids = plan({ today: '2026-10-26', now: new Date('2026-10-26T00:00:00Z') })
      .filter((r) => r.kind === 'workout')
      .map((r) => r.id);
    expect(ids).toEqual(['workout:2026-10-26', 'workout:2026-10-28', 'workout:2026-10-30']);
  });

  it('skips dinner once logged, and anything already past', () => {
    const dinners = plan({ dinnerLogged: (d) => d === '2026-10-08' }).filter((r) => r.kind === 'dinner');
    expect(dinners.map((r) => r.id)).not.toContain('dinner:2026-10-08');
    expect(dinners[0]).toMatchObject({ id: 'dinner:2026-10-07', title: 'Log dinner', url: '/food' });
    const late = plan({ now: new Date('2026-10-07T18:00:00Z') });
    expect(late.map((r) => r.id)).not.toContain('dinner:2026-10-07');
    expect(late.map((r) => r.id)).not.toContain('workout:2026-10-07');
  });

  it('checks in on Sunday at 09:00', () => {
    const checkins = plan().filter((r) => r.kind === 'checkin');
    expect(checkins).toHaveLength(1);
    expect(checkins[0]).toMatchObject({ id: 'checkin:2026-10-11', url: '/checkin' });
    expect(checkins[0].at.toISOString()).toBe('2026-10-11T06:00:00.000Z');
  });

  it('plans nothing of a kind that is switched off', () => {
    const items = plan({ reminders: { workout: false, dinner: true, checkin: false } });
    expect(new Set(items.map((r) => r.kind))).toEqual(new Set(['dinner']));
  });
});
