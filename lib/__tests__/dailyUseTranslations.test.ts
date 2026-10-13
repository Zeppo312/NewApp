import { CONTRACTION_TRANSLATIONS } from '../contractionTranslations';
import { DAILY_TRANSLATIONS } from '../dailyTranslations';
import { HOME_TRANSLATIONS } from '../homeTranslations';
import { MORE_TRANSLATIONS } from '../moreTranslations';
import { NAVIGATION_TRANSLATIONS } from '../navigationTranslations';
import { NOTIFICATIONS_TRANSLATIONS } from '../notificationsTranslations';
import { PLANNER_TRANSLATIONS } from '../plannerTranslations';
import { PREGNANCY_HOME_TRANSLATIONS } from '../pregnancyHomeTranslations';
import { SLEEP_TRACKER_TRANSLATIONS } from '../sleepTrackerTranslations';

const catalogs = {
  navigation: NAVIGATION_TRANSLATIONS,
  home: HOME_TRANSLATIONS,
  pregnancyHome: PREGNANCY_HOME_TRANSLATIONS,
  daily: DAILY_TRANSLATIONS,
  sleepTracker: SLEEP_TRACKER_TRANSLATIONS,
  contractions: CONTRACTION_TRANSLATIONS,
  planner: PLANNER_TRANSLATIONS,
  notifications: NOTIFICATIONS_TRANSLATIONS,
  more: MORE_TRANSLATIONS,
};

const placeholders = (value: string) =>
  [...value.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1]).sort();

describe('daily-use translation catalogs', () => {
  it.each(Object.entries(catalogs))('%s keeps de, en, and es in sync', (_name, catalog) => {
    const de = catalog.de as Record<string, string>;
    const en = catalog.en as Record<string, string>;
    const es = catalog.es as Record<string, string>;
    const germanKeys = Object.keys(de).sort();

    expect(Object.keys(en).sort()).toEqual(germanKeys);
    expect(Object.keys(es).sort()).toEqual(germanKeys);

    for (const key of germanKeys) {
      expect(de[key].trim()).not.toBe('');
      expect(en[key].trim()).not.toBe('');
      expect(es[key].trim()).not.toBe('');
      expect(en[key]).not.toBe(key);
      expect(es[key]).not.toBe(key);
      expect(placeholders(en[key])).toEqual(placeholders(de[key]));
      expect(placeholders(es[key])).toEqual(placeholders(de[key]));
    }
  });
});
