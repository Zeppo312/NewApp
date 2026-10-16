/**
 * Translation boundary for the tab navigation and global route titles.
 *
 * German remains active until a global locale provider is introduced. All
 * navigation labels already live in one typed catalog so switching locales
 * later does not require another router refactor.
 */
export type NavigationLocale = 'de' | 'en' | 'es';

export const DEFAULT_NAVIGATION_LOCALE: NavigationLocale = 'de';

const de = {
  'common.back': 'Zurück',
  'period.previousDay': 'Vorheriger Tag', 'period.previousWeek': 'Vorherige Woche', 'period.previousMonth': 'Vorheriger Monat', 'period.nextDay': 'Nächster Tag', 'period.nextWeek': 'Nächste Woche', 'period.nextMonth': 'Nächster Monat',
  'tab.development': 'Entwicklungssprünge',
  'tab.baby': 'Mein Baby',
  'tab.checklist': 'Checkliste',
  'tab.birthPlan': 'Geburtsplan',
  'tab.selfcare': 'Mama Selfcare',
  'tab.babyWeather': 'Babywetter',
  'tab.weight': 'Gewicht',
  'tab.size': 'Größe',
  'tab.periodTracker': 'Perioden-Tracker',
  'tab.countdown': 'Countdown',
  'tab.contractions': 'Wehen',
  'tab.sleepTracker': 'Schlaftracker',
  'tab.ourDay': 'Unser Tag',
  'tab.home': 'Home',
  'tab.blog': 'Blog',
  'tab.notifications': 'Benachrichtigungen',
  'tab.community': 'Community',
  'tab.shoppingList': 'Einkaufsliste',
  'tab.debug': 'Debug',
  'tab.groups': 'Gruppen',
  'tab.group': 'Gruppe',
  'tab.more': 'Mehr',
} as const;

export type NavigationTranslationKey = keyof typeof de;
type Catalog = Record<NavigationTranslationKey, string>;

const en: Catalog = {
  'common.back': 'Back',
  'period.previousDay': 'Previous day', 'period.previousWeek': 'Previous week', 'period.previousMonth': 'Previous month', 'period.nextDay': 'Next day', 'period.nextWeek': 'Next week', 'period.nextMonth': 'Next month',
  'tab.development': 'Development leaps',
  'tab.baby': 'My baby',
  'tab.checklist': 'Checklist',
  'tab.birthPlan': 'Birth plan',
  'tab.selfcare': 'Mom self-care',
  'tab.babyWeather': 'Baby weather',
  'tab.weight': 'Weight',
  'tab.size': 'Height',
  'tab.periodTracker': 'Period tracker',
  'tab.countdown': 'Countdown',
  'tab.contractions': 'Contractions',
  'tab.sleepTracker': 'Sleep tracker',
  'tab.ourDay': 'Our day',
  'tab.home': 'Home',
  'tab.blog': 'Blog',
  'tab.notifications': 'Notifications',
  'tab.community': 'Community',
  'tab.shoppingList': 'Shopping list',
  'tab.debug': 'Debug',
  'tab.groups': 'Groups',
  'tab.group': 'Group',
  'tab.more': 'More',
};

const es: Catalog = {
  'common.back': 'Atrás',
  'period.previousDay': 'Día anterior', 'period.previousWeek': 'Semana anterior', 'period.previousMonth': 'Mes anterior', 'period.nextDay': 'Día siguiente', 'period.nextWeek': 'Semana siguiente', 'period.nextMonth': 'Mes siguiente',
  'tab.development': 'Saltos de desarrollo',
  'tab.baby': 'Mi bebé',
  'tab.checklist': 'Lista de control',
  'tab.birthPlan': 'Plan de parto',
  'tab.selfcare': 'Autocuidado de mamá',
  'tab.babyWeather': 'Tiempo para el bebé',
  'tab.weight': 'Peso',
  'tab.size': 'Altura',
  'tab.periodTracker': 'Seguimiento menstrual',
  'tab.countdown': 'Cuenta atrás',
  'tab.contractions': 'Contracciones',
  'tab.sleepTracker': 'Seguimiento del sueño',
  'tab.ourDay': 'Nuestro día',
  'tab.home': 'Inicio',
  'tab.blog': 'Blog',
  'tab.notifications': 'Notificaciones',
  'tab.community': 'Comunidad',
  'tab.shoppingList': 'Lista de la compra',
  'tab.debug': 'Depuración',
  'tab.groups': 'Grupos',
  'tab.group': 'Grupo',
  'tab.more': 'Más',
};

export const NAVIGATION_TRANSLATIONS: Record<NavigationLocale, Catalog> = { de, en, es };

export const translateNavigationText = (
  locale: NavigationLocale,
  key: NavigationTranslationKey,
) => NAVIGATION_TRANSLATIONS[locale]?.[key] ?? de[key] ?? key;

const PERIOD_NAVIGATION_KEYS = {
  previous: { day: 'period.previousDay', week: 'period.previousWeek', month: 'period.previousMonth' },
  next: { day: 'period.nextDay', week: 'period.nextWeek', month: 'period.nextMonth' },
} as const;

export const getPeriodNavigationLabel = (
  locale: NavigationLocale,
  direction: 'previous' | 'next',
  period: 'day' | 'week' | 'month',
) => translateNavigationText(locale, PERIOD_NAVIGATION_KEYS[direction][period]);
