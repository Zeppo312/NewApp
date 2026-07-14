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
export type MilestoneLocale = 'de' | 'en';
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

export const MILESTONE_TRANSLATIONS: Record<MilestoneLocale, Catalog> = { de, en };

export const MILESTONE_SUGGESTION_KEYS = [
  'suggestion.crawling',
  'suggestion.steps',
  'suggestion.puree',
  'suggestion.word',
  'suggestion.tooth',
  'suggestion.sleepingThrough',
] as const;

export const getMilestoneLocaleTag = (locale: MilestoneLocale) =>
  locale === 'de' ? 'de-DE' : 'en-US';

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
