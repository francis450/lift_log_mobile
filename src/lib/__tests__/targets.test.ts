import type { Profile } from '@/api/types';

import { applyProfileUpdate } from '../profile';
import { DEFAULT_KCAL, kcalTarget, proteinTarget } from '../targets';

describe('targets', () => {
  it('72 kg with no height or age gives 2,200 kcal and 130 g', () => {
    expect(kcalTarget(72, null, null)).toBe(2200);
    expect(proteinTarget(72)).toBe(130);
  });

  it('needs weight, height and age for the calorie formula', () => {
    expect(kcalTarget(72, 175, null)).toBe(DEFAULT_KCAL);
    expect(kcalTarget(72, null, 25)).toBe(DEFAULT_KCAL);
    expect(kcalTarget(null, 175, 25)).toBe(DEFAULT_KCAL);
  });

  it('entering height and age recalculates (72 kg, 175 cm, 25 gives 2,150)', () => {
    expect(kcalTarget(72, 175, 25)).toBe(2150);
  });

  it('rounds protein to the nearest 5 g', () => {
    expect(proteinTarget(75)).toBe(135);
    expect(proteinTarget(71.5)).toBe(130);
    expect(proteinTarget(null)).toBeNull();
  });
});

const base: Profile = {
  user: 'njoro@example.com',
  weight_kg: 72,
  height_cm: null,
  age: 25,
  goal: 'Lose fat, get stronger',
  kcal_target: 2200,
  kcal_target_manual: false,
  protein_target_g: 130,
  protein_target_manual: false,
  targets_note: null,
  session_time: '18:00',
  training_days: 'mon,tue,wed,thu,fri',
  time_zone: 'Africa/Nairobi',
  active_program: 'block-2-2026',
  ai_enabled: true,
  reminders: { workout: true, dinner: true, checkin: true },
  program: null,
  exists: true,
};

describe('applyProfileUpdate (offline saves)', () => {
  it('recalculates automatic targets when height is added', () => {
    expect(applyProfileUpdate(base, { height_cm: 175 }).kcal_target).toBe(2150);
  });

  it('a hand-set target turns manual and stops following the formula', () => {
    const manual = applyProfileUpdate(base, { kcal_target: 2000 });
    expect(manual.kcal_target_manual).toBe(true);
    expect(applyProfileUpdate(manual, { height_cm: 175 }).kcal_target).toBe(2000);
  });

  it('switching back to automatic recalculates', () => {
    const manual = applyProfileUpdate({ ...base, height_cm: 175 }, { kcal_target: 2000 });
    const auto = applyProfileUpdate(manual, { kcal_target_manual: 0 });
    expect(auto.kcal_target_manual).toBe(false);
    expect(auto.kcal_target).toBe(2150);
  });

  it('a new weight updates protein', () => {
    expect(applyProfileUpdate(base, { weight_kg: 75 }).protein_target_g).toBe(135);
  });
});
