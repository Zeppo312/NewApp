import {
  adaptPlannerColor,
  isSamePlannerColor,
  normalizePlannerColor,
  PLANNER_ITEM_COLORS,
} from '../../constants/PlannerColors';

describe('planner item colors', () => {
  it('exposes a unique palette in the stored format', () => {
    const hexValues = PLANNER_ITEM_COLORS.map((option) => option.hex);
    expect(new Set(hexValues).size).toBe(hexValues.length);
    hexValues.forEach((hex) => {
      expect(hex).toMatch(/^#[0-9a-f]{6}$/i);
      expect(normalizePlannerColor(hex)).toBe(hex.toLowerCase());
    });

    const keys = PLANNER_ITEM_COLORS.map((option) => option.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('normalises only well formed hex values', () => {
    expect(normalizePlannerColor('#D2566E')).toBe('#d2566e');
    expect(normalizePlannerColor('  #d2566e  ')).toBe('#d2566e');
    expect(normalizePlannerColor('#fff')).toBeNull();
    expect(normalizePlannerColor('red')).toBeNull();
    expect(normalizePlannerColor('')).toBeNull();
    expect(normalizePlannerColor(null)).toBeNull();
    expect(normalizePlannerColor(undefined)).toBeNull();
    expect(normalizePlannerColor('#12345g')).toBeNull();
  });

  it('compares colors case-insensitively and treats empty values as equal', () => {
    expect(isSamePlannerColor('#D2566E', '#d2566e')).toBe(true);
    expect(isSamePlannerColor('#d2566e', '#3e7bc4')).toBe(false);
    expect(isSamePlannerColor(null, undefined)).toBe(true);
    expect(isSamePlannerColor(null, '#d2566e')).toBe(false);
  });

  it('lightens colors for dark mode and keeps them untouched in light mode', () => {
    const base = '#3e7bc4';
    expect(adaptPlannerColor(base, false)).toBe(base);

    const dark = adaptPlannerColor(base, true);
    expect(dark).toMatch(/^#[0-9a-f]{6}$/);
    expect(dark).not.toBe(base);
    expect(parseInt(dark.slice(1), 16)).toBeGreaterThan(parseInt(base.slice(1), 16));
  });
});
