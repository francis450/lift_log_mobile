// Daily targets (docs/01, "Targets"). Same formulas as the server's lift_log/targets.py:
// the server is the source of truth; these give the Setup screen a live preview.

export const DEFAULT_KCAL = 2200;

function roundTo(value: number, step: number): number {
  // Half up, like the server.
  return Math.floor(value / step + 0.5) * step;
}

/** round(1.8 x weight / 5) x 5 grams. 130 g at 72 kg. */
export function proteinTarget(weightKg: number | null | undefined): number | null {
  if (!weightKg) return null;
  return roundTo(1.8 * weightKg, 5);
}

/** Mifflin-St Jeor (men) x 1.55 - 500, to the nearest 50. 2,200 without weight, height or age. */
export function kcalTarget(
  weightKg: number | null | undefined,
  heightCm: number | null | undefined,
  age: number | null | undefined,
): number {
  if (!weightKg || !heightCm || !age) return DEFAULT_KCAL;
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
  return roundTo(bmr * 1.55 - 500, 50);
}

export function formatKcal(kcal: number): string {
  return Math.round(kcal).toLocaleString('en-US');
}
