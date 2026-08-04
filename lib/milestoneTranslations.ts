import {
  addMonths,
  addYears,
  differenceInCalendarDays,
  differenceInMonths,
  differenceInYears,
} from 'date-fns';
import type { MilestoneCategory } from './milestones';

/**
 * i18n boundary for the milestones screen and its generated photobook.
 * Keep persisted category values language-neutral and translate only at the UI boundary.
 */
export type MilestoneLocale = 'de' | 'en' | 'es';
export const DEFAULT_MILESTONE_LOCALE: MilestoneLocale = 'de';

type Catalog = Record<string, string>;

const de: Catalog = {
  'common.error': 'Fehler',
  'common.notice': 'Hinweis',
  'common.cancel': 'Abbrechen',
  'common.done': 'Fertig',
  'common.delete': 'Löschen',
  'common.save': 'Speichern',
  'common.saving': 'Speichern…',

  'screen.title': 'Meilensteine',
  'screen.subtitle': 'Erste Male und besondere Momente',
  'screen.previewSubtitle': 'Vorschau-Modus: nur ansehen',
  'preview.title': 'Nur Vorschau aktiv',
  'preview.body': 'Du schaust den Babymodus an. Meilensteine sind hier gesperrt.',
  'preview.alertTitle': 'Nur Vorschau',
  'preview.alertBody':
    'Du bist im Babymodus zur Vorschau. Meilensteine können erst nach der Geburt bearbeitet werden.',

  'category.all': 'Alle',
  'category.motorik': 'Motorik',
  'category.ernaehrung': 'Ernährung',
  'category.sprache': 'Sprache',
  'category.zahn': 'Zähne',
  'category.schlaf': 'Schlaf',
  'category.sonstiges': 'Sonstiges',

  'suggestion.crawling': 'Erstes Krabbeln',
  'suggestion.steps': 'Erste Schritte',
  'suggestion.puree': 'Erster Brei',
  'suggestion.word': 'Erstes Wort',
  'suggestion.tooth': 'Erster Zahn',
  'suggestion.sleepingThrough': 'Erste durchgeschlafene Nacht',

  'alert.loadFailed': 'Meilensteine konnten nicht geladen werden.',
  'alert.selectBaby': 'Bitte zuerst ein Baby auswählen.',
  'alert.enterTitle': 'Bitte einen Titel eingeben.',
  'alert.saveFailed': 'Der Meilenstein konnte nicht gespeichert werden.',
  'alert.createFailed': 'Der Meilenstein konnte nicht erstellt werden.',
  'alert.deleteFailed': 'Der Meilenstein konnte nicht gelöscht werden.',
  'alert.photoPermissionTitle': 'Berechtigung benötigt',
  'alert.photoPermissionBody': 'Bitte erlaube den Zugriff auf deine Fotos.',
  'alert.changePhotoTitle': 'Foto ändern',
  'alert.selectPhotoTitle': 'Foto auswählen',
  'alert.photoChoiceBody':
    'Möchtest du das vollständige Bild verwenden oder es vorher zuschneiden?',
  'alert.useOriginal': 'Original verwenden',
  'alert.cropSquare': 'Quadratisch zuschneiden',
  'alert.deleteTitle': 'Meilenstein löschen',
  'alert.deleteBody': 'Möchtest du diesen Meilenstein wirklich löschen?',

  'share.unavailableTitle': 'Teilen nicht verfügbar',
  'share.imageUnavailableBody': 'Auf diesem Gerät ist das Teilen von Bildern nicht verfügbar.',
  'share.captureFailed': 'Share-Karte konnte nicht erstellt werden',
  'share.dialogTitle': 'Meilenstein teilen',
  'share.failedTitle': 'Teilen nicht möglich',
  'share.failedBody': 'Die Erinnerung konnte nicht geteilt werden. Bitte versuche es erneut.',
  'share.modalTitle': 'Erinnerung teilen',
  'share.modalSubtitle': 'So wird deine Karte geteilt',
  'share.close': 'Teilen schließen',
  'share.eyebrowWithName': 'MEILENSTEIN VON {{name}}',
  'share.eyebrowDefault': 'UNSER MEILENSTEIN',
  'share.button': 'Als Bild teilen',
  'share.creating': 'Karte wird erstellt…',
  'share.loadingPhoto': 'Foto wird geladen…',
  'share.accessibility': 'Meilenstein als Bild teilen',

  'photobook.exportAccessibility': 'Fotobuch als PDF exportieren',
  'photobook.exporting': 'Fotobuch wird erstellt…',
  'photobook.exportTitle': 'Fotobuch als PDF',
  'photobook.exportSubtitle': 'Alle Erinnerungen gestaltet exportieren',
  'photobook.emptyTitle': 'Noch keine Erinnerungen',
  'photobook.emptyBody': 'Füge zuerst mindestens einen Meilenstein zum Fotobuch hinzu.',
  'photobook.pdfUnavailableBody':
    'Das PDF wurde erstellt, kann auf diesem Gerät aber nicht geteilt werden.',
  'photobook.shareDialogTitle': 'LottiBaby Fotobuch speichern',
  'photobook.createdTitle': 'Fotobuch erstellt',
  'photobook.warning.one': '{{pages}} Seiten wurden erstellt. Ein Foto konnte nicht geladen werden.',
  'photobook.warning.other':
    '{{pages}} Seiten wurden erstellt. {{warnings}} Fotos konnten nicht geladen werden.',
  'photobook.failedTitle': 'PDF nicht erstellt',
  'photobook.failedBody': 'Das Fotobuch konnte nicht erstellt werden. Bitte versuche es erneut.',

  'list.loading': 'Lade Meilensteine…',
  'list.emptyTitle': 'Noch keine Meilensteine',
  'list.emptyBody': 'Trage z. B. „Erstes Krabbeln“ oder „Erster Brei“ ein.',
  'card.eyebrow': 'UNSER FOTOBUCH',
  'card.placeholder': 'Ein Moment zum Festhalten',
  'card.page': 'SEITE {{number}}',
  'card.fullscreenAccessibility': '{{title}} in Vollbild anzeigen',
  'card.shareAccessibility': '{{title}} teilen',
  'card.closeFullscreen': 'Vollbildansicht schließen',
  'card.specialMoment': 'Ein besonderer Moment',
  'card.brand': 'LOTTI BABY',

  'form.editTitle': 'Meilenstein bearbeiten',
  'form.createTitle': 'Neuer Meilenstein',
  'form.suggestions': 'Vorschläge',
  'form.title': 'Titel',
  'form.titlePlaceholder': 'z. B. Erste Schritte',
  'form.category': 'Kategorie',
  'form.date': 'Datum',
  'form.chooseDate': 'Datum wählen',
  'form.notes': 'Notiz (optional)',
  'form.notesPlaceholder': 'Kurz notieren, wie es war…',
  'form.photo': 'Foto (optional)',
  'form.changeImage': 'Bild ändern',
  'form.selectImage': 'Bild auswählen',
  'form.removeImage': 'Bild entfernen',

  'age.year.one': '{{count}} Jahr',
  'age.year.other': '{{count}} Jahren',
  'age.month.one': '{{count}} Monat',
  'age.month.other': '{{count}} Monaten',
  'age.day.one': '{{count}} Tag',
  'age.day.other': '{{count}} Tagen',
  'age.at': 'Mit {{age}}',
  'age.birthDay': 'Am Tag der Geburt',

  'pdf.defaultBabyName': 'unserem Baby',
  'pdf.dateRange': '{{from}} bis {{to}}',
  'pdf.memory': 'ERINNERUNG',
  'pdf.memoriesBy': 'ERINNERUNGEN VON {{name}}',
  'pdf.memoryBy': 'ERINNERUNG VON {{name}}',
  'pdf.thoughts': 'FÜR EURE GEDANKEN',
  'pdf.coverKicker': 'LOTTI BABY FOTOBUCH',
  'pdf.coverTitle': 'Unsere<br />Meilensteine',
  'pdf.coverSubtitle': 'Die ersten Male und besonderen Momente von {{name}}.',
  'pdf.ourPhotobook': 'Unser Fotobuch',
  'pdf.ourStory': 'Unsere Geschichte',
  'pdf.memoryCount.one': '{{count}} Erinnerung',
  'pdf.memoryCount.other': '{{count}} Erinnerungen',
  'pdf.emptyError': 'Es sind noch keine Erinnerungen für das Fotobuch vorhanden.',
  'pdf.cacheError': 'Das temporäre App-Verzeichnis ist nicht verfügbar.',
  'pdf.photoWarning': 'Das Foto zu „{{title}}“ konnte nicht in das PDF übernommen werden.',
  'pdf.fileLabel': 'Fotobuch',
  'pdf.defaultFileName': 'Baby',
};

const en: Catalog = {
  'common.error': 'Error',
  'common.notice': 'Notice',
  'common.cancel': 'Cancel',
  'common.done': 'Done',
  'common.delete': 'Delete',
  'common.save': 'Save',
  'common.saving': 'Saving…',

  'screen.title': 'Milestones',
  'screen.subtitle': 'Firsts and special moments',
  'screen.previewSubtitle': 'Preview mode: view only',
  'preview.title': 'Preview only',
  'preview.body': 'You are previewing baby mode. Milestones are locked here.',
  'preview.alertTitle': 'Preview only',
  'preview.alertBody': 'You are previewing baby mode. Milestones can be edited after the birth.',

  'category.all': 'All',
  'category.motorik': 'Movement',
  'category.ernaehrung': 'Food',
  'category.sprache': 'Language',
  'category.zahn': 'Teeth',
  'category.schlaf': 'Sleep',
  'category.sonstiges': 'Other',

  'suggestion.crawling': 'First crawl',
  'suggestion.steps': 'First steps',
  'suggestion.puree': 'First solid food',
  'suggestion.word': 'First word',
  'suggestion.tooth': 'First tooth',
  'suggestion.sleepingThrough': 'First night sleeping through',

  'alert.loadFailed': 'Milestones could not be loaded.',
  'alert.selectBaby': 'Please select a baby first.',
  'alert.enterTitle': 'Please enter a title.',
  'alert.saveFailed': 'The milestone could not be saved.',
  'alert.createFailed': 'The milestone could not be created.',
  'alert.deleteFailed': 'The milestone could not be deleted.',
  'alert.photoPermissionTitle': 'Permission required',
  'alert.photoPermissionBody': 'Please allow access to your photos.',
  'alert.changePhotoTitle': 'Change photo',
  'alert.selectPhotoTitle': 'Select photo',
  'alert.photoChoiceBody': 'Would you like to use the full image or crop it first?',
  'alert.useOriginal': 'Use original',
  'alert.cropSquare': 'Crop to square',
  'alert.deleteTitle': 'Delete milestone',
  'alert.deleteBody': 'Are you sure you want to delete this milestone?',

  'share.unavailableTitle': 'Sharing unavailable',
  'share.imageUnavailableBody': 'Sharing images is not available on this device.',
  'share.captureFailed': 'Share card could not be created',
  'share.dialogTitle': 'Share milestone',
  'share.failedTitle': 'Unable to share',
  'share.failedBody': 'The memory could not be shared. Please try again.',
  'share.modalTitle': 'Share memory',
  'share.modalSubtitle': 'This is how your card will be shared',
  'share.close': 'Close sharing',
  'share.eyebrowWithName': '{{name}}’S MILESTONE',
  'share.eyebrowDefault': 'OUR MILESTONE',
  'share.button': 'Share as image',
  'share.creating': 'Creating card…',
  'share.loadingPhoto': 'Loading photo…',
  'share.accessibility': 'Share milestone as an image',

  'photobook.exportAccessibility': 'Export photobook as PDF',
  'photobook.exporting': 'Creating photobook…',
  'photobook.exportTitle': 'Photobook as PDF',
  'photobook.exportSubtitle': 'Export all memories in a designed layout',
  'photobook.emptyTitle': 'No memories yet',
  'photobook.emptyBody': 'Add at least one milestone to the photobook first.',
  'photobook.pdfUnavailableBody': 'The PDF was created, but cannot be shared on this device.',
  'photobook.shareDialogTitle': 'Save LottiBaby photobook',
  'photobook.createdTitle': 'Photobook created',
  'photobook.warning.one': '{{pages}} pages were created. One photo could not be loaded.',
  'photobook.warning.other': '{{pages}} pages were created. {{warnings}} photos could not be loaded.',
  'photobook.failedTitle': 'PDF not created',
  'photobook.failedBody': 'The photobook could not be created. Please try again.',

  'list.loading': 'Loading milestones…',
  'list.emptyTitle': 'No milestones yet',
  'list.emptyBody': 'Add something like “First crawl” or “First solid food.”',
  'card.eyebrow': 'OUR PHOTOBOOK',
  'card.placeholder': 'A moment worth remembering',
  'card.page': 'PAGE {{number}}',
  'card.fullscreenAccessibility': 'View {{title}} full screen',
  'card.shareAccessibility': 'Share {{title}}',
  'card.closeFullscreen': 'Close full-screen view',
  'card.specialMoment': 'A special moment',
  'card.brand': 'LOTTI BABY',

  'form.editTitle': 'Edit milestone',
  'form.createTitle': 'New milestone',
  'form.suggestions': 'Suggestions',
  'form.title': 'Title',
  'form.titlePlaceholder': 'e.g. First steps',
  'form.category': 'Category',
  'form.date': 'Date',
  'form.chooseDate': 'Choose date',
  'form.notes': 'Note (optional)',
  'form.notesPlaceholder': 'Write down what it was like…',
  'form.photo': 'Photo (optional)',
  'form.changeImage': 'Change image',
  'form.selectImage': 'Select image',
  'form.removeImage': 'Remove image',

  'age.year.one': '{{count}} year',
  'age.year.other': '{{count}} years',
  'age.month.one': '{{count}} month',
  'age.month.other': '{{count}} months',
  'age.day.one': '{{count}} day',
  'age.day.other': '{{count}} days',
  'age.at': 'At {{age}}',
  'age.birthDay': 'On the day of birth',

  'pdf.defaultBabyName': 'our baby',
  'pdf.dateRange': '{{from}} to {{to}}',
  'pdf.memory': 'MEMORY',
  'pdf.memoriesBy': '{{name}}’S MEMORIES',
  'pdf.memoryBy': '{{name}}’S MEMORY',
  'pdf.thoughts': 'YOUR THOUGHTS',
  'pdf.coverKicker': 'LOTTI BABY PHOTOBOOK',
  'pdf.coverTitle': 'Our<br />Milestones',
  'pdf.coverSubtitle': 'The firsts and special moments of {{name}}.',
  'pdf.ourPhotobook': 'Our photobook',
  'pdf.ourStory': 'Our story',
  'pdf.memoryCount.one': '{{count}} memory',
  'pdf.memoryCount.other': '{{count}} memories',
  'pdf.emptyError': 'There are no memories for the photobook yet.',
  'pdf.cacheError': 'The temporary app directory is unavailable.',
  'pdf.photoWarning': 'The photo for “{{title}}” could not be added to the PDF.',
  'pdf.fileLabel': 'Photobook',
  'pdf.defaultFileName': 'Baby',
};

const es: Catalog = {
  'common.error': 'Error', 'common.notice': 'Aviso', 'common.cancel': 'Cancelar', 'common.done': 'Listo', 'common.delete': 'Eliminar', 'common.save': 'Guardar', 'common.saving': 'Guardando…',
  'screen.title': 'Hitos', 'screen.subtitle': 'Primeras veces y momentos especiales', 'screen.previewSubtitle': 'Modo de vista previa: solo lectura',
  'preview.title': 'Solo vista previa', 'preview.body': 'Estás viendo el modo bebé. Los hitos están bloqueados aquí.', 'preview.alertTitle': 'Solo vista previa', 'preview.alertBody': 'Estás viendo el modo bebé. Los hitos se podrán editar después del nacimiento.',
  'category.all': 'Todos', 'category.motorik': 'Movimiento', 'category.ernaehrung': 'Alimentación', 'category.sprache': 'Lenguaje', 'category.zahn': 'Dientes', 'category.schlaf': 'Sueño', 'category.sonstiges': 'Otros',
  'suggestion.crawling': 'Gateó por primera vez', 'suggestion.steps': 'Primeros pasos', 'suggestion.puree': 'Primera comida sólida', 'suggestion.word': 'Primera palabra', 'suggestion.tooth': 'Primer diente', 'suggestion.sleepingThrough': 'Primera noche del tirón',
  'alert.loadFailed': 'No se pudieron cargar los hitos.', 'alert.selectBaby': 'Selecciona primero un bebé.', 'alert.enterTitle': 'Introduce un título.', 'alert.saveFailed': 'No se pudo guardar el hito.', 'alert.createFailed': 'No se pudo crear el hito.', 'alert.deleteFailed': 'No se pudo eliminar el hito.', 'alert.photoPermissionTitle': 'Permiso necesario', 'alert.photoPermissionBody': 'Permite el acceso a tus fotos.', 'alert.changePhotoTitle': 'Cambiar foto', 'alert.selectPhotoTitle': 'Seleccionar foto', 'alert.photoChoiceBody': '¿Quieres usar la imagen completa o recortarla primero?', 'alert.useOriginal': 'Usar original', 'alert.cropSquare': 'Recortar en cuadrado', 'alert.deleteTitle': 'Eliminar hito', 'alert.deleteBody': '¿Seguro que quieres eliminar este hito?',
  'share.unavailableTitle': 'No se puede compartir', 'share.imageUnavailableBody': 'No se pueden compartir imágenes en este dispositivo.', 'share.captureFailed': 'No se pudo crear la tarjeta para compartir', 'share.dialogTitle': 'Compartir hito', 'share.failedTitle': 'No se pudo compartir', 'share.failedBody': 'No se pudo compartir el recuerdo. Inténtalo de nuevo.', 'share.modalTitle': 'Compartir recuerdo', 'share.modalSubtitle': 'Así se compartirá tu tarjeta', 'share.close': 'Cerrar', 'share.eyebrowWithName': 'HITO DE {{name}}', 'share.eyebrowDefault': 'NUESTRO HITO', 'share.button': 'Compartir como imagen', 'share.creating': 'Creando tarjeta…', 'share.loadingPhoto': 'Cargando foto…', 'share.accessibility': 'Compartir el hito como imagen',
  'photobook.exportAccessibility': 'Exportar álbum como PDF', 'photobook.exporting': 'Creando álbum…', 'photobook.exportTitle': 'Álbum en PDF', 'photobook.exportSubtitle': 'Exporta todos los recuerdos con un diseño cuidado', 'photobook.emptyTitle': 'Aún no hay recuerdos', 'photobook.emptyBody': 'Añade primero al menos un hito al álbum.', 'photobook.pdfUnavailableBody': 'Se ha creado el PDF, pero no se puede compartir en este dispositivo.', 'photobook.shareDialogTitle': 'Guardar álbum de LottiBaby', 'photobook.createdTitle': 'Álbum creado', 'photobook.warning.one': 'Se han creado {{pages}} páginas. No se pudo cargar una foto.', 'photobook.warning.other': 'Se han creado {{pages}} páginas. No se pudieron cargar {{warnings}} fotos.', 'photobook.failedTitle': 'No se creó el PDF', 'photobook.failedBody': 'No se pudo crear el álbum. Inténtalo de nuevo.',
  'list.loading': 'Cargando hitos…', 'list.emptyTitle': 'Aún no hay hitos', 'list.emptyBody': 'Añade, por ejemplo, «Gateó por primera vez» o «Primera comida sólida».',
  'card.eyebrow': 'NUESTRO ÁLBUM', 'card.placeholder': 'Un momento para recordar', 'card.page': 'PÁGINA {{number}}', 'card.fullscreenAccessibility': 'Ver {{title}} a pantalla completa', 'card.shareAccessibility': 'Compartir {{title}}', 'card.closeFullscreen': 'Cerrar pantalla completa', 'card.specialMoment': 'Un momento especial', 'card.brand': 'LOTTI BABY',
  'form.editTitle': 'Editar hito', 'form.createTitle': 'Nuevo hito', 'form.suggestions': 'Sugerencias', 'form.title': 'Título', 'form.titlePlaceholder': 'p. ej., Primeros pasos', 'form.category': 'Categoría', 'form.date': 'Fecha', 'form.chooseDate': 'Elegir fecha', 'form.notes': 'Nota (opcional)', 'form.notesPlaceholder': 'Anota brevemente cómo fue…', 'form.photo': 'Foto (opcional)', 'form.changeImage': 'Cambiar imagen', 'form.selectImage': 'Seleccionar imagen', 'form.removeImage': 'Eliminar imagen',
  'age.year.one': '{{count}} año', 'age.year.other': '{{count}} años', 'age.month.one': '{{count}} mes', 'age.month.other': '{{count}} meses', 'age.day.one': '{{count}} día', 'age.day.other': '{{count}} días', 'age.at': 'Con {{age}}', 'age.birthDay': 'El día del nacimiento',
  'pdf.defaultBabyName': 'nuestro bebé', 'pdf.dateRange': '{{from}} a {{to}}', 'pdf.memory': 'RECUERDO', 'pdf.memoriesBy': 'RECUERDOS DE {{name}}', 'pdf.memoryBy': 'RECUERDO DE {{name}}', 'pdf.thoughts': 'PARA VUESTROS PENSAMIENTOS', 'pdf.coverKicker': 'ÁLBUM DE LOTTI BABY', 'pdf.coverTitle': 'Nuestros<br />hitos', 'pdf.coverSubtitle': 'Las primeras veces y los momentos especiales de {{name}}.', 'pdf.ourPhotobook': 'Nuestro álbum', 'pdf.ourStory': 'Nuestra historia', 'pdf.memoryCount.one': '{{count}} recuerdo', 'pdf.memoryCount.other': '{{count}} recuerdos', 'pdf.emptyError': 'Aún no hay recuerdos para el álbum.', 'pdf.cacheError': 'El directorio temporal de la aplicación no está disponible.', 'pdf.photoWarning': 'No se pudo añadir al PDF la foto de «{{title}}».', 'pdf.fileLabel': 'Álbum', 'pdf.defaultFileName': 'Bebé',
};
export const MILESTONE_TRANSLATIONS: Record<MilestoneLocale, Catalog> = { de, en, es };

export const MILESTONE_SUGGESTION_KEYS = [
  'suggestion.crawling',
  'suggestion.steps',
  'suggestion.puree',
  'suggestion.word',
  'suggestion.tooth',
  'suggestion.sleepingThrough',
] as const;

export const getMilestoneLocaleTag = (locale: MilestoneLocale) =>
  ({ de: 'de-DE', en: 'en-US', es: 'es-ES' })[locale];

export const translateMilestoneText = (
  locale: MilestoneLocale,
  key: string,
  params?: Record<string, string | number>,
): string => {
  const template = MILESTONE_TRANSLATIONS[locale]?.[key] ?? de[key] ?? key;
  if (!params) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_match, name: string) =>
    params[name] !== undefined ? String(params[name]) : '',
  );
};

export const getMilestoneCategoryLabel = (
  locale: MilestoneLocale,
  category: MilestoneCategory,
) => translateMilestoneText(locale, `category.${category}`);

const fromDateOnly = (value: string) => {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day);
};

export const formatMilestoneDate = (value: string, locale: MilestoneLocale) =>
  new Intl.DateTimeFormat(getMilestoneLocaleTag(locale), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(fromDateOnly(value));

export const formatBabyAgeAtMilestone = (
  birthDateValue: string | null | undefined,
  eventDateValue: string,
  locale: MilestoneLocale,
) => {
  if (!birthDateValue) return null;

  const birthDate = fromDateOnly(birthDateValue);
  const milestoneDate = fromDateOnly(eventDateValue);
  if (
    Number.isNaN(birthDate.getTime()) ||
    Number.isNaN(milestoneDate.getTime()) ||
    milestoneDate < birthDate
  ) {
    return null;
  }

  const years = differenceInYears(milestoneDate, birthDate);
  const afterYears = addYears(birthDate, years);
  const months = differenceInMonths(milestoneDate, afterYears);
  const afterMonths = addMonths(afterYears, months);
  const days = differenceInCalendarDays(milestoneDate, afterMonths);
  const t = (key: string, params?: Record<string, string | number>) =>
    translateMilestoneText(locale, key, params);
  const parts = [
    years > 0 ? t(`age.year.${years === 1 ? 'one' : 'other'}`, { count: years }) : null,
    months > 0 ? t(`age.month.${months === 1 ? 'one' : 'other'}`, { count: months }) : null,
    days > 0 ? t(`age.day.${days === 1 ? 'one' : 'other'}`, { count: days }) : null,
  ].filter((part): part is string => Boolean(part));

  if (parts.length === 0) return t('age.birthDay');
  const age = new Intl.ListFormat(getMilestoneLocaleTag(locale), {
    style: 'long',
    type: 'conjunction',
  }).format(parts);
  return t('age.at', { age });
};
