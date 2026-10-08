import type { Program } from '@/api/types';
import program from '@/lib/__tests__/fixtures/program-block2.json';
import { planReminders } from '@/lib/reminders';

import { applyReminders, Scheduler } from '..';

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  SchedulableTriggerInputTypes: { DATE: 'date' },
  AndroidImportance: { DEFAULT: 3 },
}));
jest.mock('@/db/database', () => ({ cacheGet: jest.fn(), foodDayGet: jest.fn() }));

function fakeScheduler(existing: string[] = []) {
  const ids = new Set(existing);
  const scheduler: Scheduler = {
    getAllScheduledNotificationsAsync: async () => [...ids].map((identifier) => ({ identifier })),
    cancelScheduledNotificationAsync: async (identifier) => {
      ids.delete(identifier);
    },
    scheduleNotificationAsync: async (request) => {
      ids.add(request.identifier!);
      return request.identifier!;
    },
  };
  return { scheduler, ids };
}

const base = {
  program: program as unknown as Program,
  today: '2026-10-07',
  now: new Date('2026-10-07T06:00:00Z'),
  timeZone: 'Africa/Nairobi',
  sessionTime: '18:00',
  dinnerLogged: () => false,
  days: 7,
};

describe('applying reminders', () => {
  it('schedules the plan with stable ids', async () => {
    const { scheduler, ids } = fakeScheduler();
    await applyReminders(planReminders({ ...base, reminders: { workout: true, dinner: true, checkin: true } }), scheduler);
    expect(ids.has('workout:2026-10-07')).toBe(true);
    expect(ids.has('dinner:2026-10-07')).toBe(true);
    expect(ids.has('checkin:2026-10-11')).toBe(true);
  });

  it('turning a reminder off cancels its scheduled notifications', async () => {
    const { scheduler, ids } = fakeScheduler();
    await applyReminders(planReminders({ ...base, reminders: { workout: true, dinner: true, checkin: true } }), scheduler);
    await applyReminders(planReminders({ ...base, reminders: { workout: false, dinner: true, checkin: true } }), scheduler);
    expect([...ids].some((id) => id.startsWith('workout:'))).toBe(false);
    expect([...ids].some((id) => id.startsWith('dinner:'))).toBe(true);
  });

  it("leaves other apps' notifications alone", async () => {
    const { scheduler, ids } = fakeScheduler(['someone-else']);
    await applyReminders([], scheduler);
    expect([...ids]).toEqual(['someone-else']);
  });
});
