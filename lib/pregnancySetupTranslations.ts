/** Translation boundary for the standalone pregnancy setup flow. */
export type PregnancySetupLocale = 'de' | 'en' | 'es';

export const DEFAULT_PREGNANCY_SETUP_LOCALE: PregnancySetupLocale = 'de';

const de = {
  'common.error': 'Fehler',
  'common.missing': 'Fehlt',
  'common.cancel': 'Abbrechen',
  'common.done': 'Fertig',
  'screen.title': 'Schwangerschaft anlegen',
  'screen.subtitle': 'Nur die wichtigsten Angaben',
  'dueDate.label': 'Errechneter Termin (ET)',
  'dueDate.placeholder': 'ET auswählen',
  'dueDate.pickerTitle': 'Entbindungstermin auswählen',
  'gender.label': 'Geschlecht (optional, falls bekannt)',
  'gender.boy': 'Junge',
  'gender.girl': 'Mädchen',
  'gender.unknown': 'Unbekannt',
  'name.label': 'Habt ihr schon einen Namen? (optional)',
  'name.placeholder': 'Name eingeben',
  'submit.idle': 'Schwangerschaft anlegen',
  'submit.saving': 'Wird angelegt...',
  'validation.signIn': 'Bitte melde dich an.',
  'validation.dueDate': 'Bitte gib zuerst den ET an.',
  'fallback.name': 'Schwangerschaft',
  'error.createBaby': 'Kind konnte nicht angelegt werden.',
  'error.noBaby': 'Kein Kind für die Schwangerschaft ausgewählt.',
  'error.saveDueDate': 'ET konnte nicht gespeichert werden.',
  'error.createPregnancy': 'Die Schwangerschaft konnte nicht angelegt werden.',
} as const;

export type PregnancySetupTranslationKey = keyof typeof de;
type Catalog = Record<PregnancySetupTranslationKey, string>;

const en: Catalog = {
  'common.error': 'Error',
  'common.missing': 'Missing information',
  'common.cancel': 'Cancel',
  'common.done': 'Done',
  'screen.title': 'Set up pregnancy',
  'screen.subtitle': 'Just the essential details',
  'dueDate.label': 'Estimated due date',
  'dueDate.placeholder': 'Choose due date',
  'dueDate.pickerTitle': 'Choose due date',
  'gender.label': 'Gender (optional, if known)',
  'gender.boy': 'Boy',
  'gender.girl': 'Girl',
  'gender.unknown': 'Unknown',
  'name.label': 'Do you already have a name? (optional)',
  'name.placeholder': 'Enter name',
  'submit.idle': 'Set up pregnancy',
  'submit.saving': 'Setting up...',
  'validation.signIn': 'Please sign in.',
  'validation.dueDate': 'Enter the estimated due date first.',
  'fallback.name': 'Pregnancy',
  'error.createBaby': 'The child profile could not be created.',
  'error.noBaby': 'No child profile was selected for this pregnancy.',
  'error.saveDueDate': 'The due date could not be saved.',
  'error.createPregnancy': 'The pregnancy could not be set up.',
};

const es: Catalog = {
  'common.error': 'Error',
  'common.missing': 'Faltan datos',
  'common.cancel': 'Cancelar',
  'common.done': 'Listo',
  'screen.title': 'Configurar embarazo',
  'screen.subtitle': 'Solo los datos esenciales',
  'dueDate.label': 'Fecha estimada de parto',
  'dueDate.placeholder': 'Seleccionar fecha de parto',
  'dueDate.pickerTitle': 'Seleccionar fecha de parto',
  'gender.label': 'Sexo (opcional, si se conoce)',
  'gender.boy': 'Niño',
  'gender.girl': 'Niña',
  'gender.unknown': 'Desconocido',
  'name.label': '¿Ya tenéis un nombre? (opcional)',
  'name.placeholder': 'Introducir nombre',
  'submit.idle': 'Configurar embarazo',
  'submit.saving': 'Configurando...',
  'validation.signIn': 'Inicia sesión.',
  'validation.dueDate': 'Introduce primero la fecha estimada de parto.',
  'fallback.name': 'Embarazo',
  'error.createBaby': 'No se pudo crear el perfil del bebé.',
  'error.noBaby': 'No se ha seleccionado ningún perfil de bebé para este embarazo.',
  'error.saveDueDate': 'No se pudo guardar la fecha de parto.',
  'error.createPregnancy': 'No se pudo configurar el embarazo.',
};

export const PREGNANCY_SETUP_TRANSLATIONS: Record<PregnancySetupLocale, Catalog> = { de, en, es };

export const getPregnancySetupLocaleTag = (locale: PregnancySetupLocale) => ({
  de: 'de-DE',
  en: 'en-US',
  es: 'es-ES',
})[locale];

export const translatePregnancySetupText = (
  locale: PregnancySetupLocale,
  key: PregnancySetupTranslationKey,
  params: Record<string, string | number> = {},
) => {
  const template = PREGNANCY_SETUP_TRANSLATIONS[locale]?.[key] ?? de[key] ?? key;
  return template.replace(/\{\{(\w+)\}\}/g, (_, token: string) =>
    String(params[token] ?? `{{${token}}}`),
  );
};
