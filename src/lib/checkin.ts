// Sunday check-in rules (docs/01, "Check-in").

/** A progress photo every 4 weeks: weeks 4, 8, 12. */
export const PHOTO_EVERY = 4;

export function photoDue(week: number): boolean {
  return week % PHOTO_EVERY === 0;
}

/** The next photo week on or after `week`, or null after the block. */
export function nextPhotoWeek(week: number, lastWeek: number): number | null {
  const next = Math.ceil(week / PHOTO_EVERY) * PHOTO_EVERY;
  return next <= lastWeek ? next : null;
}

/** The date a check-in records: today if today is in that week, else the week's Sunday. */
export function checkinDate(weekDates: string[], today: string): string {
  return weekDates.includes(today) ? today : weekDates[weekDates.length - 1];
}

/** − / + 0.1 kg, to one decimal. */
export function stepWeight(kg: number, by: number): number {
  return Math.max(0, Math.round((kg + by) * 10) / 10);
}

export const MEASURE_RULES = {
  weight: { min: 25, max: 400, label: 'weight', unit: 'kg', required: true },
  waist: { min: 40, max: 200, label: 'waist', unit: 'cm' },
  forearm: { min: 15, max: 60, label: 'forearm', unit: 'cm' },
};
