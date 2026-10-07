import { checkinDate, nextPhotoWeek, photoDue, stepWeight } from '../checkin';

describe('check-in', () => {
  it('asks for a progress photo every 4 weeks', () => {
    expect([1, 2, 3, 4, 5, 8, 12].map(photoDue)).toEqual([false, false, false, true, false, true, true]);
    expect(nextPhotoWeek(1, 12)).toBe(4);
    expect(nextPhotoWeek(4, 12)).toBe(4);
    expect(nextPhotoWeek(9, 12)).toBe(12);
    expect(nextPhotoWeek(13, 12)).toBeNull();
  });

  it('records today inside the week, else the Sunday', () => {
    const week1 = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11'];
    expect(checkinDate(week1, '2026-10-11')).toBe('2026-10-11');
    expect(checkinDate(week1, '2026-10-09')).toBe('2026-10-09');
    expect(checkinDate(week1, '2026-10-14')).toBe('2026-10-11');
  });

  it('steps weight by 0.1 kg without float drift', () => {
    expect(stepWeight(72, 0.1)).toBe(72.1);
    expect(stepWeight(72.1, -0.1)).toBe(72);
    expect(stepWeight(0, -0.1)).toBe(0);
  });
});
