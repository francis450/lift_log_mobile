// Daily log: morning weight, sleep, steps and pain. Pure helpers, no React or storage.

import type { DailyLog, DailyLogPayload, WeightTrend } from '@/api/types';
import { checkRange, formatNumber, parseNumber } from '@/lib/numbers';

export interface DailyForm {
  weight: string;
  sleep: string;
  steps: string;
  pain: number | null;
}

export const DAILY_RULES = {
  weight: { min: 25, max: 300, label: 'weight', unit: 'kg' },
  sleep: { min: 0, max: 24, label: 'sleep', unit: 'hours' },
  steps: { min: 0, max: 100000, label: 'steps', unit: 'steps' },
};

export function formFromLog(log: DailyLog | null | undefined): DailyForm {
  return {
    weight: formatNumber(log?.weight_kg),
    sleep: formatNumber(log?.sleep_hours),
    steps: formatNumber(log?.steps),
    pain: log?.pain ?? null,
  };
}

export function dailyErrors(form: DailyForm): { weight: string | null; sleep: string | null; steps: string | null } {
  const steps = parseNumber(form.steps);
  return {
    weight: checkRange(parseNumber(form.weight), DAILY_RULES.weight),
    sleep: checkRange(parseNumber(form.sleep), DAILY_RULES.sleep),
    steps:
      steps !== null && !Number.isInteger(steps) ? 'Enter whole steps.' : checkRange(steps, DAILY_RULES.steps),
  };
}

/**
 * What to send: only fields that changed from the saved log, a cleared field as ''. The server
 * keeps fields that are left out, so a morning weigh-in and evening steps save separately.
 * Null when nothing changed.
 */
export function dailyPayload(
  date: string,
  form: DailyForm,
  saved: DailyLog | null | undefined,
  nowIso: string,
): DailyLogPayload | null {
  const before = formFromLog(saved);
  const out: DailyLogPayload = { log_date: date, client_updated_at: nowIso };
  let changed = false;
  const numbers: [keyof DailyForm, 'weight_kg' | 'sleep_hours' | 'steps'][] = [
    ['weight', 'weight_kg'],
    ['sleep', 'sleep_hours'],
    ['steps', 'steps'],
  ];
  for (const [field, key] of numbers) {
    const now = parseNumber(form[field] as string);
    const then = parseNumber(before[field] as string);
    if (now === then) continue;
    out[key] = now === null ? '' : now;
    changed = true;
  }
  if (form.pain !== before.pain) {
    out.pain = form.pain === null ? '' : form.pain;
    changed = true;
  }
  return changed ? out : null;
}

/** The saved log after a payload is applied, for showing an offline save at once. */
export function applyDailyPayload(saved: DailyLog | null | undefined, payload: DailyLogPayload): DailyLog {
  const base: DailyLog = saved ?? {
    log_date: payload.log_date,
    weight_kg: null,
    sleep_hours: null,
    steps: null,
    pain: null,
    pain_area: 'Lower back',
    note: '',
    client_updated_at: null,
  };
  const value = (v: number | '' | undefined, old: number | null) => (v === undefined ? old : v === '' ? null : v);
  return {
    ...base,
    weight_kg: value(payload.weight_kg, base.weight_kg),
    sleep_hours: value(payload.sleep_hours, base.sleep_hours),
    steps: value(payload.steps, base.steps),
    pain: value(payload.pain, base.pain),
    client_updated_at: payload.client_updated_at,
  };
}

/** "7-day average 70.9 kg · down 0.35 kg a week (0.5%)". */
export function trendLine(trend: WeightTrend | undefined): string {
  if (!trend || trend.avg_7d_kg === null) {
    const n = trend?.weigh_ins_7d ?? 0;
    return `Weigh in at least 4 mornings a week to see your trend (${n} of 7 so far).`;
  }
  const avg = `7-day average ${trend.avg_7d_kg.toFixed(1)} kg`;
  if (trend.change_kg_per_week === null) return `${avg}. A weekly change shows after two weeks.`;
  const kg = Math.abs(trend.change_kg_per_week);
  const pct = trend.change_pct_per_week !== null ? ` (${Math.abs(trend.change_pct_per_week).toFixed(1)}%)` : '';
  if (kg < 0.05) return `${avg} · steady this week`;
  return `${avg} · ${trend.change_kg_per_week < 0 ? 'down' : 'up'} ${kg.toFixed(2)} kg a week${pct}`;
}
