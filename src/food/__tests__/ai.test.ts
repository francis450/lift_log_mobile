import { addFoodsLabel, chosenItems, estimateRows } from '../model';
import { resizeTarget } from '../photo';
import { appendOptions, isShowable, KEEP_MS, leavesLine, MAX_OPTIONS, SuggestionState } from '../suggestion';

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

describe('suggestions on request', () => {
  const now = Date.parse('2026-10-07T09:00:00Z');
  const option = { title: 'Chicken stew and rice', why: '', items: [] };
  const saved: SuggestionState = { meal: 'lunch', fetchedAt: now - 60_000, options: [option], index: 0, dismissed: false };

  it('shows the last answer for 3 hours, without asking again', () => {
    expect(isShowable(saved, now)).toBe(true);
    expect(isShowable(saved, saved.fetchedAt + KEEP_MS)).toBe(false);
  });

  it('hides a closed or empty answer, and shows nothing before you ask', () => {
    expect(isShowable({ ...saved, dismissed: true }, now)).toBe(false);
    expect(isShowable({ ...saved, options: [] }, now)).toBe(false);
    expect(isShowable(null, now)).toBe(false);
  });

  it('still shows an answer saved before meal budgets', () => {
    expect(saved.budget).toBeUndefined();
    expect(isShowable(saved, now)).toBe(true);
  });
});

describe('more ideas', () => {
  const opt = (title: string) => ({ title, why: '', items: [] });
  const state: SuggestionState = {
    meal: 'lunch',
    fetchedAt: 0,
    options: [opt('Bean stew'), opt('Githeri')],
    index: 1,
    dismissed: false,
  };

  it('adds new options after the ones shown and puts the first new one on screen', () => {
    const next = appendOptions(state, [opt('Ndengu and rice'), opt('Fish and ugali')]);
    expect(next.options.map((o) => o.title)).toEqual(['Bean stew', 'Githeri', 'Ndengu and rice', 'Fish and ugali']);
    expect(next.index).toBe(2);
  });

  it('skips repeats, ignoring case, and stays put when nothing is new', () => {
    const next = appendOptions(state, [opt('bean stew '), opt('Githeri')]);
    expect(next.options).toHaveLength(2);
    expect(next.index).toBe(1);
    expect(appendOptions(state, [opt('Pilau'), opt('pilau')]).options).toHaveLength(3);
  });

  it(`keeps at most ${MAX_OPTIONS}`, () => {
    const many = Array.from({ length: 20 }, (_, i) => opt(`Meal ${i}`));
    expect(appendOptions(state, many).options).toHaveLength(MAX_OPTIONS);
  });
});

describe('what an option leaves for later', () => {
  const option = {
    title: 'Bean stew with chicken',
    why: '',
    items: [
      { food_name: 'Bean stew', portion: '300 g', kcal: 330, protein_g: 18 },
      { food_name: 'Chicken breast', portion: '150 g', kcal: 250, protein_g: 46 },
    ],
  };

  it('subtracts the option from what is left today', () => {
    expect(leavesLine(option, 1102, 105)).toBe('Leaves 522 kcal · 41 g protein for later');
  });

  it('says how far over an option goes, and never shows negative protein', () => {
    expect(leavesLine(option, 400, 30)).toBe("180 kcal over what's left today");
    expect(leavesLine(option, 600, 30)).toBe('Leaves 20 kcal · 0 g protein for later');
  });
});
