import {
  COUNTDOWN_TRANSLATIONS,
  getCountdownDayLabel,
  getCountdownFruitComparison,
  getCountdownLocaleTag,
  localizeBirthPreparationMeasure,
  translateCountdownText,
} from '../countdownTranslations';

describe('countdown translations', () => {
  it('keeps the German, English and Spanish catalogs in sync', () => {
    const germanKeys = Object.keys(COUNTDOWN_TRANSLATIONS.de).sort();

    expect(Object.keys(COUNTDOWN_TRANSLATIONS.en).sort()).toEqual(germanKeys);
    expect(Object.keys(COUNTDOWN_TRANSLATIONS.es).sort()).toEqual(germanKeys);
  });

  it('interpolates dynamic countdown copy', () => {
    expect(translateCountdownText('en', 'hero.week', { week: 28, day: 4 })).toBe('Week 28+4');
    expect(translateCountdownText('es', 'week.overdueTitle.other', { days: 3 }))
      .toBe('3 días después de la fecha prevista: lo importante ahora');
    expect(getCountdownDayLabel('de', 1)).toBe('1 Tag');
    expect(getCountdownDayLabel('en', -4, true)).toBe('4 days past due');
  });

  it('provides localized date tags and baby-size comparisons', () => {
    expect(getCountdownLocaleTag('de')).toBe('de-DE');
    expect(getCountdownLocaleTag('es')).toBe('es-ES');
    expect(getCountdownFruitComparison('en', 'eine Wassermelone')).toBe('a watermelon');
    expect(getCountdownFruitComparison('es', 'eine Heidelbeere')).toBe('un arándano');
  });

  it('localizes birth-preparation content without changing its identity', () => {
    const measure = {
      id: 'walking',
      icon: '🚶',
      title: 'Spaziergänge & leichte Bewegung',
      benefit: 'Deutsch',
      startAt: 'Deutsch',
      frequency: 'Deutsch',
      caution: 'Deutsch',
    };

    expect(localizeBirthPreparationMeasure('en', measure)).toMatchObject({
      id: 'walking',
      icon: '🚶',
      title: 'Walks and gentle movement',
    });
    expect(localizeBirthPreparationMeasure('de', measure)).toBe(measure);
  });
});
