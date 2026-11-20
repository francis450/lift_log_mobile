import type { DailyLog } from '@/api/types';

import { applyDailyPayload, dailyErrors, dailyPayload, formFromLog, trendLine } from '../model';

const NOW = '2026-11-24T04:00:00.000Z';
const saved: DailyLog = {
  log_date: '2026-11-24',
  weight_kg: 71.4,
  sleep_hours: 6.5,
  steps: null,
  pain: 3,
  pain_area: 'Lower back',
  note: '',
  client_updated_at: '2026-11-24T03:00:00.000Z',
};

describe('dailyPayload', () => {
  it('sends only what changed', () => {
    const form = { ...formFromLog(saved), steps: '8432' };
    expect(dailyPayload('2026-11-24', form, saved, NOW)).toEqual({
      log_date: '2026-11-24',
      client_updated_at: NOW,
      steps: 8432,
    });
  });

  it('sends a cleared field as an empty string, and 0 pain as 0', () => {
    const form = { ...formFromLog(saved), weight: '', pain: 0 };
    expect(dailyPayload('2026-11-24', form, saved, NOW)).toEqual({
      log_date: '2026-11-24',
      client_updated_at: NOW,
      weight_kg: '',
      pain: 0,
    });
  });

  it('is null when nothing changed', () => {
    expect(dailyPayload('2026-11-24', formFromLog(saved), saved, NOW)).toBeNull();
    expect(dailyPayload('2026-11-24', formFromLog(null), null, NOW)).toBeNull();
  });

  it('applies a payload for an offline save', () => {
    const payload = dailyPayload('2026-11-24', { ...formFromLog(saved), weight: '', steps: '9000' }, saved, NOW)!;
    expect(applyDailyPayload(saved, payload)).toMatchObject({ weight_kg: null, sleep_hours: 6.5, steps: 9000, pain: 3 });
    expect(applyDailyPayload(null, { log_date: '2026-11-25', client_updated_at: NOW, weight_kg: 71 })).toMatchObject({
      weight_kg: 71,
      pain: null,
    });
  });
});

describe('dailyErrors', () => {
  it('checks ranges and whole steps', () => {
    expect(dailyErrors({ weight: '7', sleep: '', steps: '', pain: null }).weight).toBeTruthy();
    expect(dailyErrors({ weight: '71', sleep: '25', steps: '', pain: null }).sleep).toBeTruthy();
    expect(dailyErrors({ weight: '71', sleep: '7', steps: '100.5', pain: null }).steps).toBe('Enter whole steps.');
    expect(dailyErrors({ weight: '71', sleep: '7', steps: '9000', pain: null })).toEqual({ weight: null, sleep: null, steps: null });
  });
});

describe('trendLine', () => {
  it('asks for more weigh-ins until there are 4 in a week', () => {
    expect(trendLine({ avg_7d_kg: null, weigh_ins_7d: 2, previous_avg_7d_kg: null, change_kg_per_week: null, change_pct_per_week: null })).toBe(
      'Weigh in at least 4 mornings a week to see your trend (2 of 7 so far).',
    );
  });

  it('shows the average and the weekly change', () => {
    expect(
      trendLine({ avg_7d_kg: 70.7, weigh_ins_7d: 7, previous_avg_7d_kg: 71.05, change_kg_per_week: -0.35, change_pct_per_week: -0.49 }),
    ).toBe('7-day average 70.7 kg · down 0.35 kg a week (0.5%)');
    expect(trendLine({ avg_7d_kg: 70.7, weigh_ins_7d: 5, previous_avg_7d_kg: null, change_kg_per_week: null, change_pct_per_week: null })).toBe(
      '7-day average 70.7 kg. A weekly change shows after two weeks.',
    );
  });
});
