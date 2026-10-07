import { addFoodsLabel, chosenItems, estimateRows } from '../model';
import { resizeTarget } from '../photo';
import { REFRESH_MS, shouldSuggest, SuggestionState, suggestionDue } from '../suggestion';

jest.mock('expo-image-manipulator', () => ({ ImageManipulator: {}, SaveFormat: { JPEG: 'jpeg' } }));
jest.mock('expo-image-picker', () => ({}));
jest.mock('@/db/database', () => ({ cacheGet: jest.fn(), cacheSet: jest.fn() }));

const found = [
  { food_name: 'Chicken stew', portion: 'fist-size, ~100 g', kcal: 220, protein_g: 25 },
  { food_name: 'Rice, cooked', portion: '1.5 cups', kcal: 310, protein_g: 6 },
  { food_name: 'Sukuma wiki', portion: '1 cup', kcal: 80, protein_g: 3 },
];

describe('photo resizing', () => {
  it('brings the long edge down to 1568 px', () => {
    expect(resizeTarget(4000, 3000)).toEqual({ width: 1568 });
    expect(resizeTarget(3000, 4000)).toEqual({ height: 1568 });
    expect(resizeTarget(1568, 1000)).toBeNull();
    expect(resizeTarget(800, 600)).toBeNull();
  });
});

describe('estimate results', () => {
  it('labels the add button like the design', () => {
    expect(addFoodsLabel(chosenItems(estimateRows(found)))).toBe('Add 3 foods · 610 kcal · 34 g');
  });

  it('uses edited numbers, skips unticked rows and invalid numbers', () => {
    const rows = estimateRows(found);
    rows[0] = { ...rows[0], kcal: '260' };
    rows[1] = { ...rows[1], checked: false };
    rows[2] = { ...rows[2], protein: 'abc' };
    const chosen = chosenItems(rows);
    expect(chosen).toEqual([{ ...found[0], kcal: 260 }]);
    expect(addFoodsLabel(chosen)).toBe('Add 1 food · 260 kcal · 25 g');
  });
});

describe('suggestion timing', () => {
  const now = Date.parse('2026-10-07T09:00:00Z');
  const cached: SuggestionState = { meal: 'lunch', fetchedAt: now - 60_000, options: [], index: 0, dismissed: false };

  it('reuses a suggestion for the same meal for 3 hours', () => {
    expect(suggestionDue(cached, 'lunch', now)).toBe(false);
    expect(suggestionDue(cached, 'lunch', cached.fetchedAt + REFRESH_MS)).toBe(true);
    expect(suggestionDue(cached, 'dinner', now)).toBe(true);
    expect(suggestionDue(null, 'lunch', now)).toBe(true);
  });

  it('only suggests today, with AI set up and 300+ kcal left', () => {
    expect(shouldSuggest({ isToday: true, aiReady: true, kcalLeft: 300 })).toBe(true);
    expect(shouldSuggest({ isToday: true, aiReady: true, kcalLeft: 299 })).toBe(false);
    expect(shouldSuggest({ isToday: false, aiReady: true, kcalLeft: 1500 })).toBe(false);
    expect(shouldSuggest({ isToday: true, aiReady: false, kcalLeft: 1500 })).toBe(false);
  });
});
