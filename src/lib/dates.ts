// Dates are YYYY-MM-DD in the user's time zone (default Africa/Nairobi). Times are stored in UTC.

export const DEFAULT_TZ = 'Africa/Nairobi';

const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Today's date (YYYY-MM-DD) in a time zone. */
export function todayIn(timeZone: string = DEFAULT_TZ, now: Date = new Date()): string {
  return localParts(timeZone, now).date;
}

/** Minutes since local midnight in a time zone. */
export function minutesNowIn(timeZone: string = DEFAULT_TZ, now: Date = new Date()): number {
  return localParts(timeZone, now).minutes;
}

function localParts(timeZone: string, now: Date): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
  };
}

/** Parse YYYY-MM-DD as a calendar date (UTC midnight, so no time-zone drift). */
export function parseDay(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDays(day: string, n: number): string {
  const date = parseDay(day);
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
}

/** "Wed 7 Oct" */
export function formatDayShort(day: string): string {
  const d = parseDay(day);
  return `${DOW_SHORT[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** "5 Oct" */
export function formatDayMonth(day: string): string {
  const d = parseDay(day);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** "MON" and 5, for the week strip. */
export function weekdayLabel(day: string): { dow: string; num: number } {
  const d = parseDay(day);
  return { dow: DOW[d.getUTCDay()], num: d.getUTCDate() };
}

/** "18:00" -> "6:00 PM" */
export function formatTime12(hhmm: string | null | undefined): string {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`;
}

/** ISO 8601 UTC with milliseconds, the API's time format. */
export function nowUtcIso(now: Date = new Date()): string {
  return now.toISOString();
}
