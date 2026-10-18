/** Translation boundary for the pregnancy statistics screen. */
export type PregnancyStatsLocale = 'de' | 'en' | 'es';
export const DEFAULT_PREGNANCY_STATS_LOCALE: PregnancyStatsLocale = 'de';

const de = {
  'common.error': 'Fehler', 'common.notice': 'Hinweis', 'common.success': 'Erfolg',
  'screen.title': 'Schwangerschaft', 'screen.subtitle': 'Countdown & Status', 'screen.noDateSubtitle': 'Countdown noch nicht gesetzt',
  'noDate.title': 'Geburtstermin fehlt', 'noDate.description': 'Bitte setze zuerst deinen Geburtstermin in der Countdown-Ansicht, um alle Details zu sehen.',
  'noDate.action': 'Zum Countdown', 'progress.title': 'Fortschritt', 'progress.journey': 'Deine Reise',
  'progress.daysLeft': 'Noch {{count}} Tage bis EGT', 'progress.daysPregnant': '{{count}} Tage seit Beginn',
  'dueDate.title': 'Errechneter Geburtstermin', 'dueDate.change': 'Tippen zum Ändern', 'dueDate.choose': 'Geburtstermin auswählen',
  'details.title': 'Schwangerschafts-Details', 'facts.title': 'Interessante Fakten',
  'fact.progress': 'Fortschritt', 'fact.ofDays': 'von 280 Tagen', 'fact.daysPregnant': 'Tage schwanger', 'fact.sinceStart': 'seit Beginn',
  'fact.daysToDue': 'Tage bis EGT', 'fact.remaining': 'verbleibend', 'fact.trimester': 'Trimester', 'fact.current': 'laufend',
  'detail.currentWeek': 'Aktuelle SSW', 'detail.weekValue': '{{week}}. SSW', 'detail.weekDay': 'Tag der Woche',
  'detail.day.one': '{{count}} Tag', 'detail.day.other': '{{count}} Tage', 'detail.calendarMonth': 'Kalendermonat',
  'detail.pregnancyMonth': 'Schwangerschaftsmonat', 'detail.monthValue': '{{month}}. Monat', 'detail.daysToDue': 'Tage bis zum EGT',
  'trimester.one': '1. Trimester', 'trimester.two': '2. Trimester', 'trimester.three': '3. Trimester',
  'alert.invalidDate': 'Ungültiges Datum.', 'alert.signIn': 'Bitte melde dich an, um deinen Geburtstermin zu speichern.',
  'alert.saveFailed': 'Der Geburtstermin konnte nicht gespeichert werden.', 'alert.saved': 'Geburtstermin erfolgreich gespeichert.',
  'alert.savedSynced': 'Geburtstermin gespeichert und mit {{names}} synchronisiert.',
} as const;
export type PregnancyStatsTranslationKey = keyof typeof de;
type Catalog = Record<PregnancyStatsTranslationKey, string>;

const en: Catalog = {
  'common.error': 'Error', 'common.notice': 'Note', 'common.success': 'Success',
  'screen.title': 'Pregnancy', 'screen.subtitle': 'Countdown & status', 'screen.noDateSubtitle': 'Countdown not set yet',
  'noDate.title': 'Due date missing', 'noDate.description': 'Set your due date in the countdown first to see all details.', 'noDate.action': 'Go to countdown',
  'progress.title': 'Progress', 'progress.journey': 'Your journey', 'progress.daysLeft': '{{count}} days until your due date',
  'progress.daysPregnant': '{{count}} days since the beginning', 'dueDate.title': 'Estimated due date', 'dueDate.change': 'Tap to change',
  'dueDate.choose': 'Choose due date', 'details.title': 'Pregnancy details', 'facts.title': 'Interesting facts',
  'fact.progress': 'Progress', 'fact.ofDays': 'of 280 days', 'fact.daysPregnant': 'Days pregnant', 'fact.sinceStart': 'since the beginning',
  'fact.daysToDue': 'Days until due date', 'fact.remaining': 'remaining', 'fact.trimester': 'Trimester', 'fact.current': 'current',
  'detail.currentWeek': 'Current week', 'detail.weekValue': 'Week {{week}}', 'detail.weekDay': 'Day of the week',
  'detail.day.one': '{{count}} day', 'detail.day.other': '{{count}} days', 'detail.calendarMonth': 'Calendar month',
  'detail.pregnancyMonth': 'Pregnancy month', 'detail.monthValue': 'Month {{month}}', 'detail.daysToDue': 'Days until due date',
  'trimester.one': '1st trimester', 'trimester.two': '2nd trimester', 'trimester.three': '3rd trimester',
  'alert.invalidDate': 'Invalid date.', 'alert.signIn': 'Please sign in to save your due date.', 'alert.saveFailed': 'The due date could not be saved.',
  'alert.saved': 'Due date saved successfully.', 'alert.savedSynced': 'Due date saved and synced with {{names}}.',
};

const es: Catalog = {
  'common.error': 'Error', 'common.notice': 'Aviso', 'common.success': 'Éxito',
  'screen.title': 'Embarazo', 'screen.subtitle': 'Cuenta atrás y estado', 'screen.noDateSubtitle': 'La cuenta atrás aún no está configurada',
  'noDate.title': 'Falta la fecha probable de parto', 'noDate.description': 'Configura primero la fecha probable de parto en la cuenta atrás para ver todos los detalles.',
  'noDate.action': 'Ir a la cuenta atrás', 'progress.title': 'Progreso', 'progress.journey': 'Tu camino',
  'progress.daysLeft': 'Faltan {{count}} días para la fecha prevista', 'progress.daysPregnant': '{{count}} días desde el inicio',
  'dueDate.title': 'Fecha probable de parto', 'dueDate.change': 'Toca para cambiar', 'dueDate.choose': 'Elegir fecha probable de parto',
  'details.title': 'Detalles del embarazo', 'facts.title': 'Datos interesantes', 'fact.progress': 'Progreso', 'fact.ofDays': 'de 280 días',
  'fact.daysPregnant': 'Días de embarazo', 'fact.sinceStart': 'desde el inicio', 'fact.daysToDue': 'Días hasta la fecha prevista',
  'fact.remaining': 'restantes', 'fact.trimester': 'Trimestre', 'fact.current': 'actual', 'detail.currentWeek': 'Semana actual',
  'detail.weekValue': 'Semana {{week}}', 'detail.weekDay': 'Día de la semana', 'detail.day.one': '{{count}} día', 'detail.day.other': '{{count}} días',
  'detail.calendarMonth': 'Mes natural', 'detail.pregnancyMonth': 'Mes de embarazo', 'detail.monthValue': 'Mes {{month}}',
  'detail.daysToDue': 'Días hasta la fecha prevista', 'trimester.one': '1.er trimestre', 'trimester.two': '2.º trimestre', 'trimester.three': '3.er trimestre',
  'alert.invalidDate': 'Fecha no válida.', 'alert.signIn': 'Inicia sesión para guardar la fecha probable de parto.',
  'alert.saveFailed': 'No se pudo guardar la fecha probable de parto.', 'alert.saved': 'Fecha probable de parto guardada.',
  'alert.savedSynced': 'Fecha probable de parto guardada y sincronizada con {{names}}.',
};

export const PREGNANCY_STATS_TRANSLATIONS: Record<PregnancyStatsLocale, Catalog> = { de, en, es };
export const getPregnancyStatsLocaleTag = (locale: PregnancyStatsLocale) => ({ de: 'de-DE', en: 'en-US', es: 'es-ES' })[locale];
export const translatePregnancyStatsText = (locale: PregnancyStatsLocale, key: PregnancyStatsTranslationKey, params: Record<string, string | number> = {}) =>
  (PREGNANCY_STATS_TRANSLATIONS[locale]?.[key] ?? de[key] ?? key).replace(/\{\{(\w+)\}\}/g, (_, token: string) => String(params[token] ?? `{{${token}}}`));

export const getPregnancyStatsDayLabel = (locale: PregnancyStatsLocale, count: number) =>
  translatePregnancyStatsText(locale, count === 1 ? 'detail.day.one' : 'detail.day.other', { count });
