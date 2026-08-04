import type { BabyToothDef, ToothPosition, ToothSymptom } from './toothData';

/** Translation boundary for the tooth tracker, symptoms, and all 20 tooth positions. */
export type ToothTrackerLocale = 'de' | 'en' | 'es';
export const DEFAULT_TOOTH_TRACKER_LOCALE: ToothTrackerLocale = 'de';

const de = {
  'common.error': 'Fehler', 'common.cancel': 'Abbrechen', 'common.delete': 'Löschen',
  'screen.title': 'Zahn-Tracker', 'screen.previewSubtitle': 'Vorschau-Modus: nur ansehen', 'preview.title': 'Nur Vorschau aktiv',
  'preview.alertTitle': 'Nur Vorschau', 'preview.description': 'Du schaust den Babymodus an. Zahntracking ist hier gesperrt.',
  'stats.total': 'von 20 Milchzähnen', 'stats.none': 'Noch kein Zahn sichtbar', 'stats.first': 'Der erste Zahn ist da 🦷✨',
  'stats.half': 'Halbzeit erreicht', 'stats.progress': 'Dein Baby bekommt sein Lächeln 🥹', 'stats.complete': 'Komplettes Milchgebiss 🎉',
  'chart.title': 'Gebiss-Übersicht', 'chart.chooseBaby': 'Bitte zuerst ein Baby auswählen.',
  'chart.hint': 'Tippe auf einen Zahn, um Details zu erfassen.', 'jaw.upper': 'Oberkiefer', 'jaw.lower': 'Unterkiefer',
  'timeline.title': 'Eingetragene Zähne', 'timeline.empty': 'Noch keine Zähne eingetragen.', 'action.add': '+ Zahn eintragen',
  'editor.add': 'Zahn eintragen', 'editor.edit': 'Zahn bearbeiten', 'editor.addSubtitle': 'Details eingeben',
  'editor.editSubtitle': 'Eintrag aktualisieren', 'editor.chooseTooth': 'Zahn auswählen', 'editor.date': 'Durchbruch-Datum',
  'editor.chooseDate': 'Durchbruch-Datum wählen', 'editor.symptoms': 'Symptome', 'editor.notes': 'Notizen',
  'editor.notesPlaceholder': 'Optional: Beobachtungen oder Hinweise', 'editor.delete': '🗑️ Eintrag löschen',
  'symptom.fever': 'Fieber', 'symptom.restlessness': 'Unruhe', 'symptom.teethingPain': 'Zahnungsschmerz',
  'alert.noBabyTitle': 'Kein Baby ausgewählt', 'alert.noBaby': 'Bitte wähle zuerst ein Baby aus.',
  'alert.completeTitle': 'Alles dokumentiert', 'alert.complete': 'Für dieses Baby sind bereits alle 20 Milchzähne eingetragen.',
  'alert.missingToothTitle': 'Zahn fehlt', 'alert.missingTooth': 'Bitte wähle einen Zahn aus.',
  'alert.invalidDateTitle': 'Ungültiges Datum', 'alert.invalidDate': 'Das Durchbruch-Datum darf nicht in der Zukunft liegen.',
  'alert.loadFailed': 'Die Zahneinträge konnten nicht geladen werden.', 'alert.saveFailed': 'Der Zahneintrag konnte nicht gespeichert werden.',
  'delete.title': 'Eintrag löschen', 'delete.confirm': 'Möchtest du diesen Zahneintrag wirklich löschen?',
  'delete.failed': 'Der Zahneintrag konnte nicht gelöscht werden.',
} as const;
export type ToothTrackerTranslationKey = keyof typeof de;
type Catalog = Record<ToothTrackerTranslationKey, string>;

const en: Catalog = {
  'common.error': 'Error', 'common.cancel': 'Cancel', 'common.delete': 'Delete', 'screen.title': 'Tooth tracker',
  'screen.previewSubtitle': 'Preview mode: view only', 'preview.title': 'Preview only', 'preview.alertTitle': 'Preview only',
  'preview.description': 'You are previewing baby mode. Tooth tracking is locked here.', 'stats.total': 'of 20 baby teeth',
  'stats.none': 'No tooth visible yet', 'stats.first': 'The first tooth is here 🦷✨', 'stats.half': 'Halfway there',
  'stats.progress': "Your baby's smile is growing 🥹", 'stats.complete': 'All baby teeth are here 🎉',
  'chart.title': 'Teeth overview', 'chart.chooseBaby': 'Please select a baby first.', 'chart.hint': 'Tap a tooth to record details.',
  'jaw.upper': 'Upper jaw', 'jaw.lower': 'Lower jaw', 'timeline.title': 'Recorded teeth', 'timeline.empty': 'No teeth recorded yet.',
  'action.add': '+ Record tooth', 'editor.add': 'Record tooth', 'editor.edit': 'Edit tooth', 'editor.addSubtitle': 'Enter details',
  'editor.editSubtitle': 'Update entry', 'editor.chooseTooth': 'Choose tooth', 'editor.date': 'Eruption date',
  'editor.chooseDate': 'Choose eruption date', 'editor.symptoms': 'Symptoms', 'editor.notes': 'Notes',
  'editor.notesPlaceholder': 'Optional: observations or notes', 'editor.delete': '🗑️ Delete entry',
  'symptom.fever': 'Fever', 'symptom.restlessness': 'Restlessness', 'symptom.teethingPain': 'Teething pain',
  'alert.noBabyTitle': 'No baby selected', 'alert.noBaby': 'Please select a baby first.', 'alert.completeTitle': 'Everything recorded',
  'alert.complete': 'All 20 baby teeth have already been recorded for this baby.', 'alert.missingToothTitle': 'Tooth missing',
  'alert.missingTooth': 'Please choose a tooth.', 'alert.invalidDateTitle': 'Invalid date', 'alert.invalidDate': 'The eruption date cannot be in the future.',
  'alert.loadFailed': 'The tooth entries could not be loaded.', 'alert.saveFailed': 'The tooth entry could not be saved.',
  'delete.title': 'Delete entry', 'delete.confirm': 'Do you really want to delete this tooth entry?', 'delete.failed': 'The tooth entry could not be deleted.',
};

const es: Catalog = {
  'common.error': 'Error', 'common.cancel': 'Cancelar', 'common.delete': 'Eliminar', 'screen.title': 'Seguimiento de dientes',
  'screen.previewSubtitle': 'Modo de vista previa: solo lectura', 'preview.title': 'Solo vista previa', 'preview.alertTitle': 'Solo vista previa',
  'preview.description': 'Estás viendo el modo bebé. El seguimiento de dientes está bloqueado aquí.', 'stats.total': 'de 20 dientes de leche',
  'stats.none': 'Todavía no se ve ningún diente', 'stats.first': 'Ya está aquí el primer diente 🦷✨', 'stats.half': 'Ya está a mitad de camino',
  'stats.progress': 'La sonrisa de tu bebé está creciendo 🥹', 'stats.complete': 'Dentición de leche completa 🎉',
  'chart.title': 'Vista general de la dentición', 'chart.chooseBaby': 'Selecciona primero un bebé.', 'chart.hint': 'Toca un diente para registrar los detalles.',
  'jaw.upper': 'Maxilar superior', 'jaw.lower': 'Maxilar inferior', 'timeline.title': 'Dientes registrados', 'timeline.empty': 'Todavía no hay dientes registrados.',
  'action.add': '+ Registrar diente', 'editor.add': 'Registrar diente', 'editor.edit': 'Editar diente', 'editor.addSubtitle': 'Introducir detalles',
  'editor.editSubtitle': 'Actualizar entrada', 'editor.chooseTooth': 'Elegir diente', 'editor.date': 'Fecha de erupción',
  'editor.chooseDate': 'Elegir fecha de erupción', 'editor.symptoms': 'Síntomas', 'editor.notes': 'Notas',
  'editor.notesPlaceholder': 'Opcional: observaciones o indicaciones', 'editor.delete': '🗑️ Eliminar entrada',
  'symptom.fever': 'Fiebre', 'symptom.restlessness': 'Inquietud', 'symptom.teethingPain': 'Dolor de dentición',
  'alert.noBabyTitle': 'Ningún bebé seleccionado', 'alert.noBaby': 'Selecciona primero un bebé.', 'alert.completeTitle': 'Todo registrado',
  'alert.complete': 'Ya se han registrado los 20 dientes de leche de este bebé.', 'alert.missingToothTitle': 'Falta el diente',
  'alert.missingTooth': 'Elige un diente.', 'alert.invalidDateTitle': 'Fecha no válida', 'alert.invalidDate': 'La fecha de erupción no puede estar en el futuro.',
  'alert.loadFailed': 'No se pudieron cargar las entradas de dientes.', 'alert.saveFailed': 'No se pudo guardar la entrada del diente.',
  'delete.title': 'Eliminar entrada', 'delete.confirm': '¿Seguro que quieres eliminar esta entrada del diente?', 'delete.failed': 'No se pudo eliminar la entrada del diente.',
};

export const TOOTH_TRACKER_TRANSLATIONS: Record<ToothTrackerLocale, Catalog> = { de, en, es };
export const translateToothTrackerText = (locale: ToothTrackerLocale, key: ToothTrackerTranslationKey) =>
  TOOTH_TRACKER_TRANSLATIONS[locale]?.[key] ?? de[key] ?? key;

export const getToothSymptomOptions = (locale: ToothTrackerLocale): { key: ToothSymptom; label: string }[] => [
  { key: 'fever', label: translateToothTrackerText(locale, 'symptom.fever') },
  { key: 'restlessness', label: translateToothTrackerText(locale, 'symptom.restlessness') },
  { key: 'teething_pain', label: translateToothTrackerText(locale, 'symptom.teethingPain') },
];

const toothType = {
  en: { central_incisor: 'central incisor', lateral_incisor: 'lateral incisor', canine: 'canine', first_molar: 'first molar', second_molar: 'second molar' },
  es: { central_incisor: 'incisivo central', lateral_incisor: 'incisivo lateral', canine: 'canino', first_molar: 'primer molar', second_molar: 'segundo molar' },
} as const;

const toothDefinitions: readonly BabyToothDef[] = [
  { key: 'upper_right_second_molar', label: 'Oberer 2. Backenzahn rechts', row: 'upper', side: 'right', type: 'molar' },
  { key: 'upper_right_first_molar', label: 'Oberer 1. Backenzahn rechts', row: 'upper', side: 'right', type: 'molar' },
  { key: 'upper_right_canine', label: 'Oberer Eckzahn rechts', row: 'upper', side: 'right', type: 'canine' },
  { key: 'upper_right_lateral_incisor', label: 'Oberer seitl. Schneidezahn rechts', row: 'upper', side: 'right', type: 'incisor' },
  { key: 'upper_right_central_incisor', label: 'Oberer mittl. Schneidezahn rechts', row: 'upper', side: 'right', type: 'incisor' },
  { key: 'upper_left_central_incisor', label: 'Oberer mittl. Schneidezahn links', row: 'upper', side: 'left', type: 'incisor' },
  { key: 'upper_left_lateral_incisor', label: 'Oberer seitl. Schneidezahn links', row: 'upper', side: 'left', type: 'incisor' },
  { key: 'upper_left_canine', label: 'Oberer Eckzahn links', row: 'upper', side: 'left', type: 'canine' },
  { key: 'upper_left_first_molar', label: 'Oberer 1. Backenzahn links', row: 'upper', side: 'left', type: 'molar' },
  { key: 'upper_left_second_molar', label: 'Oberer 2. Backenzahn links', row: 'upper', side: 'left', type: 'molar' },
  { key: 'lower_right_second_molar', label: 'Unterer 2. Backenzahn rechts', row: 'lower', side: 'right', type: 'molar' },
  { key: 'lower_right_first_molar', label: 'Unterer 1. Backenzahn rechts', row: 'lower', side: 'right', type: 'molar' },
  { key: 'lower_right_canine', label: 'Unterer Eckzahn rechts', row: 'lower', side: 'right', type: 'canine' },
  { key: 'lower_right_lateral_incisor', label: 'Unterer seitl. Schneidezahn rechts', row: 'lower', side: 'right', type: 'incisor' },
  { key: 'lower_right_central_incisor', label: 'Unterer mittl. Schneidezahn rechts', row: 'lower', side: 'right', type: 'incisor' },
  { key: 'lower_left_central_incisor', label: 'Unterer mittl. Schneidezahn links', row: 'lower', side: 'left', type: 'incisor' },
  { key: 'lower_left_lateral_incisor', label: 'Unterer seitl. Schneidezahn links', row: 'lower', side: 'left', type: 'incisor' },
  { key: 'lower_left_canine', label: 'Unterer Eckzahn links', row: 'lower', side: 'left', type: 'canine' },
  { key: 'lower_left_first_molar', label: 'Unterer 1. Backenzahn links', row: 'lower', side: 'left', type: 'molar' },
  { key: 'lower_left_second_molar', label: 'Unterer 2. Backenzahn links', row: 'lower', side: 'left', type: 'molar' },
];

const translateToothLabel = (locale: ToothTrackerLocale, tooth: BabyToothDef) => {
  if (locale === 'de') return tooth.label;
  const key = tooth.key.replace(/^(upper|lower)_(left|right)_/, '') as keyof typeof toothType.en;
  const upper = tooth.row === 'upper';
  const left = tooth.side === 'left';
  if (locale === 'en') return `${upper ? 'Upper' : 'Lower'} ${toothType.en[key]} ${left ? 'left' : 'right'}`;
  return `${toothType.es[key]} ${upper ? 'superior' : 'inferior'} ${left ? 'izquierdo' : 'derecho'}`;
};

export const getLocalizedBabyTeeth = (locale: ToothTrackerLocale): (BabyToothDef & { key: ToothPosition })[] =>
  toothDefinitions.map((tooth) => ({ ...tooth, label: translateToothLabel(locale, tooth) }));
