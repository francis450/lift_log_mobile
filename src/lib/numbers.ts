/** Parse a number typed on a phone keypad ("72", "71.5", "71,5"). Empty or invalid gives null. */
export function parseNumber(text: string): number | null {
  const cleaned = text.trim().replace(',', '.');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return '';
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(1)));
}

export type RangeCheck = { min: number; max: number; label: string; unit?: string; required?: boolean };

/** null when valid, otherwise the message to show under the field. */
export function checkRange(value: number | null, rule: RangeCheck): string | null {
  if (value === null) return rule.required ? `Enter your ${rule.label}.` : null;
  if (value < rule.min || value > rule.max) {
    return `Enter a ${rule.label} between ${rule.min} and ${rule.max}${rule.unit ? ` ${rule.unit}` : ''}.`;
  }
  return null;
}

export const RULES = {
  weight: { min: 25, max: 400, label: 'weight', unit: 'kg', required: true },
  height: { min: 100, max: 250, label: 'height', unit: 'cm' },
  age: { min: 10, max: 110, label: 'age' },
} satisfies Record<string, RangeCheck>;
