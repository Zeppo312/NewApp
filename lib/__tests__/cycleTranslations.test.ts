import {
  CYCLE_TRANSLATIONS,
  translateCycleText,
} from '../cycleTranslations';

describe('cycle translations', () => {
  it('keeps the German and English catalogs in sync', () => {
    expect(Object.keys(CYCLE_TRANSLATIONS.en).sort()).toEqual(
      Object.keys(CYCLE_TRANSLATIONS.de).sort(),
    );
  });

  it('interpolates forecast values', () => {
    expect(
      translateCycleText('en', 'forecast.confidence', { confidence: 82 }),
    ).toBe('Forecast confidence 82% · improves with every cycle');
  });

  it('returns the configured German copy', () => {
    expect(translateCycleText('de', 'screen.title')).toBe('Zyklus');
  });
});
