import { BABY_NAMES_TRANSLATIONS, getLocalizedFallbackBabyNames, translateBabyNamesText } from '../babyNamesTranslations';
import { BABY_SIZE_TRANSLATIONS, getLocalizedBabySizeData, getLocalizedBabySizeForWeek } from '../babySizeTranslations';
import { BIRTH_PLAN_TRANSLATIONS, getBirthPlanOptions, translateBirthPlanText } from '../birthPlanTranslations';
import { DOCTOR_QUESTIONS_TRANSLATIONS } from '../doctorQuestionsTranslations';
import { GROWTH_TRACKER_TRANSLATIONS, translateGrowthTrackerText } from '../growthTrackerTranslations';
import {
  getHospitalChecklistCategories,
  getHospitalChecklistDefaultItems,
  PREGNANCY_CHECKLIST_TRANSLATIONS,
  translatePregnancyChecklistText,
} from '../pregnancyChecklistTranslations';
import { PREGNANCY_STATS_TRANSLATIONS, getPregnancyStatsDayLabel } from '../pregnancyStatsTranslations';
import { getLocalizedBabyTeeth, getToothSymptomOptions, TOOTH_TRACKER_TRANSLATIONS } from '../toothTrackerTranslations';
import {
  formatWeeklyMomentDuration,
  getLocalizedLottiLevels,
  getWeeklyMomentMood,
  WEEKLY_MOMENT_DAY_NAMES,
  WEEKLY_MOMENT_TRANSLATIONS,
} from '../weeklyMomentTranslations';
import {
  formatContentForHTMLLeftColumn,
  formatContentForHTMLRightColumn,
} from '@/components/geburtsplan/formatHelpers';

const expectCatalogsInSync = (catalogs: Record<'de' | 'en' | 'es', Record<string, string>>) => {
  const germanKeys = Object.keys(catalogs.de).sort();
  expect(Object.keys(catalogs.en).sort()).toEqual(germanKeys);
  expect(Object.keys(catalogs.es).sort()).toEqual(germanKeys);
  const placeholders = (value: string) => [...value.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1]).sort();
  for (const locale of ['de', 'en', 'es'] as const) {
    expect(Object.values(catalogs[locale]).every((value) => value.trim().length > 0)).toBe(true);
    for (const key of germanKeys) {
      expect(placeholders(catalogs[locale][key])).toEqual(placeholders(catalogs.de[key]));
    }
  }
};

describe('prepared pregnancy and baby feature translations', () => {
  it('keeps every German, English, and Spanish UI catalog synchronized', () => {
    [
      PREGNANCY_CHECKLIST_TRANSLATIONS,
      BIRTH_PLAN_TRANSLATIONS,
      GROWTH_TRACKER_TRANSLATIONS,
      BABY_SIZE_TRANSLATIONS,
      PREGNANCY_STATS_TRANSLATIONS,
      BABY_NAMES_TRANSLATIONS,
      DOCTOR_QUESTIONS_TRANSLATIONS,
      TOOTH_TRACKER_TRANSLATIONS,
      WEEKLY_MOMENT_TRANSLATIONS,
    ].forEach(expectCatalogsInSync);
  });

  it('provides a complete localized hospital checklist with stable IDs', () => {
    const de = getHospitalChecklistDefaultItems('de');
    const en = getHospitalChecklistDefaultItems('en');
    const es = getHospitalChecklistDefaultItems('es');

    expect(de).toHaveLength(33);
    expect(en.map((item) => item.id)).toEqual(de.map((item) => item.id));
    expect(es.map((item) => item.categoryId)).toEqual(de.map((item) => item.categoryId));
    expect(getHospitalChecklistCategories('es')).toHaveLength(5);
    expect(translatePregnancyChecklistText('en', 'summary.completed', { completed: 8, total: 33 })).toBe('8/33 done');
  });

  it('contains every birth-plan section and localized option group', () => {
    expect(translateBirthPlanText('es', 'section.emergency')).toBe('5. Emergencia / cesárea');
    expect(getBirthPlanOptions('en', 'positions')).toHaveLength(5);
    expect(getBirthPlanOptions('es', 'yesNoDiscuss').map((option) => option.id)).toEqual([
      'common.yes', 'common.no', 'option.discuss',
    ]);
  });

  it('recognizes legacy birth-plan headings in every supported language', () => {
    const englishLegacyPlan = [
      'BIRTH PLAN',
      '1. General information\nName: Maya',
      '2. Wishes for birth\nPosition: Standing',
      '3. Medical interventions & procedures\nMonitoring: Yes',
      '4. After birth\nBonding: Yes',
      '5. Emergency / C-section\nSupport person: Yes',
      '6. Other wishes / notes\nPlease keep the room quiet.',
    ].join('\n\n');

    expect(formatContentForHTMLLeftColumn(englishLegacyPlan, 'es')).toContain('1. Datos generales');
    expect(formatContentForHTMLLeftColumn(englishLegacyPlan, 'es')).toContain('3. Intervenciones y medidas médicas');
    expect(formatContentForHTMLRightColumn(englishLegacyPlan, 'es')).toContain('4. Después del parto');
    expect(formatContentForHTMLRightColumn(englishLegacyPlan, 'es')).toContain('6. Otros deseos / indicaciones');
  });

  it('localizes all 42 baby-size comparisons and weekly development texts', () => {
    for (const locale of ['de', 'en', 'es'] as const) {
      const entries = getLocalizedBabySizeData(locale);
      expect(entries).toHaveLength(42);
      expect(entries.map((entry) => entry.week)).toEqual(Array.from({ length: 42 }, (_, index) => index + 1));
      expect(entries.every((entry) => entry.description.length > 30 && entry.fruitComparison.length > 2)).toBe(true);
    }
    expect(getLocalizedBabySizeForWeek('en', 38)?.fruitComparison).toBe('a watermelon');
    expect(getLocalizedBabySizeForWeek('es', 7)?.fruitComparison).toBe('un arándano');
  });

  it('formats dynamic growth, pregnancy-stat, and name copy', () => {
    expect(translateGrowthTrackerText('en', 'weight.invalid', { unit: 'grams' })).toBe('Please enter a valid weight in grams.');
    expect(translateGrowthTrackerText('de', 'weight.overviewTitle', { subject: 'dich' })).toBe('Überblick für dich');
    expect(translateGrowthTrackerText('en', 'weight.chartTitle')).toBe('Your progress');
    expect(translateGrowthTrackerText('es', 'weight.addFirst')).toBe('Añadir el primer peso');
    expect(getPregnancyStatsDayLabel('es', 2)).toBe('2 días');
    expect(translateBabyNamesText('es', 'delete.confirm', { name: 'Mila' })).toBe('¿Seguro que quieres eliminar «Mila»?');
    expect(getLocalizedFallbackBabyNames('en')).toHaveLength(15);
  });

  it('provides localized tooth labels, symptoms, weekdays, and every Lotti stage', () => {
    expect(getLocalizedBabyTeeth('en')).toHaveLength(20);
    expect(getLocalizedBabyTeeth('es')[0].label).toBe('segundo molar superior derecho');
    expect(getToothSymptomOptions('es').map((item) => item.label)).toContain('Dolor de dentición');
    expect(WEEKLY_MOMENT_DAY_NAMES.en).toHaveLength(7);
    expect(getLocalizedLottiLevels('en')).toHaveLength(30);
    expect(getLocalizedLottiLevels('es')[29].name).toBe('Vuestro mundo de recuerdos');
    expect(formatWeeklyMomentDuration('en', 95)).toBe('1 hr 35 min');
    expect(getWeeklyMomentMood('es', { feeding: 2, care: 2, sleep: 2 }).word).toBe('En equilibrio');
  });
});
