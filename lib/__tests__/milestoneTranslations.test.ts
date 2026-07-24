import {
  formatBabyAgeAtMilestone,
  formatMilestoneDate,
  getMilestoneCategoryLabel,
  MILESTONE_TRANSLATIONS,
  translateMilestoneText,
} from '../milestoneTranslations';

describe('milestone translations', () => {
  it('keeps the German and English catalogs in sync', () => {
    expect(Object.keys(MILESTONE_TRANSLATIONS.en).sort()).toEqual(
      Object.keys(MILESTONE_TRANSLATIONS.de).sort(),
    );
  });

  it('translates categories and interpolates values', () => {
    expect(getMilestoneCategoryLabel('de', 'ernaehrung')).toBe('Ernährung');
    expect(getMilestoneCategoryLabel('en', 'ernaehrung')).toBe('Food');
    expect(translateMilestoneText('en', 'card.page', { number: '03' })).toBe('PAGE 03');
  });

  it('formats dates and ages for the selected locale', () => {
    expect(formatMilestoneDate('2025-02-03', 'de')).toContain('Februar');
    expect(formatMilestoneDate('2025-02-03', 'en')).toContain('February');
    expect(formatBabyAgeAtMilestone('2024-01-01', '2025-02-03', 'de')).toBe(
      'Mit 1 Jahr, 1 Monat und 2 Tagen',
    );
    expect(formatBabyAgeAtMilestone('2024-01-01', '2025-02-03', 'en')).toBe(
      'At 1 year, 1 month, and 2 days',
    );
  });
});
