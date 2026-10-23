import { addDays, formatDayShort, formatTime12, hhmmIn, isoAt, minutesNowIn, todayIn, weekdayLabel } from '../dates';

describe('dates', () => {
  it("uses the user's time zone for today", () => {
    const lateUtc = new Date('2026-10-06T22:30:00Z'); // 01:30 on 7 Oct in Nairobi
    expect(todayIn('Africa/Nairobi', lateUtc)).toBe('2026-10-07');
    expect(todayIn('UTC', lateUtc)).toBe('2026-10-06');
    expect(minutesNowIn('Africa/Nairobi', lateUtc)).toBe(90);
  });

  it('formats days and times', () => {
    expect(formatDayShort('2026-10-07')).toBe('Wed 7 Oct');
    expect(weekdayLabel('2026-10-05')).toEqual({ dow: 'MON', num: 5 });
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(formatTime12('18:00')).toBe('6:00 PM');
    expect(formatTime12('00:30')).toBe('12:30 AM');
    expect(formatTime12('12:05')).toBe('12:05 PM');
  });
});

describe('local times for the time pickers', () => {
  it('reads a UTC time as local HH:MM', () => {
    expect(hhmmIn('2026-10-22T15:45:03.737Z', 'Africa/Nairobi')).toBe('18:45');
    expect(hhmmIn('2026-10-22T22:10:00Z', 'Africa/Nairobi')).toBe('01:10');
  });

  it('turns a local day and HH:MM into UTC', () => {
    expect(isoAt('2026-10-22', '18:45', 'Africa/Nairobi')).toBe('2026-10-22T15:45:00.000Z');
    expect(isoAt('2026-10-22', '01:10', 'Africa/Nairobi')).toBe('2026-10-21T22:10:00.000Z');
    // Across a DST change: London is UTC+1 in summer, UTC+0 after 25 Oct 2026.
    expect(isoAt('2026-10-26', '09:00', 'Europe/London')).toBe('2026-10-26T09:00:00.000Z');
    expect(isoAt('2026-10-24', '09:00', 'Europe/London')).toBe('2026-10-24T08:00:00.000Z');
  });
});
