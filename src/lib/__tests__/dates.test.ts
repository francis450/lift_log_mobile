import { addDays, formatDayShort, formatTime12, minutesNowIn, todayIn, weekdayLabel } from '../dates';

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
