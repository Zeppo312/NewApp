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
  'tab.debug': 'Debug',
  'tab.groups': 'Gruppen',
  'tab.group': 'Gruppe',
  'tab.more': 'Mehr',
} as const;

export type NavigationTranslationKey = keyof typeof de;
type Catalog = Record<NavigationTranslationKey, string>;

const en: Catalog = {
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
  'tab.debug': 'Debug',
  'tab.groups': 'Groups',
  'tab.group': 'Group',
  'tab.more': 'More',
};

const es: Catalog = {
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
