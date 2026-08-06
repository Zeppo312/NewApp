import {
  translateBirthPlanText,
  type BirthPlanLocale,
  type BirthPlanTranslationKey,
} from '@/lib/birthPlanTranslations';

const SOURCE_LOCALES: readonly BirthPlanLocale[] = ['de', 'en', 'es'];
type SectionKey = Extract<
  BirthPlanTranslationKey,
  | 'section.general'
  | 'section.birthWishes'
  | 'section.interventions'
  | 'section.afterBirth'
  | 'section.emergency'
  | 'section.other'
>;

const localizedCandidates = (key: BirthPlanTranslationKey) =>
  SOURCE_LOCALES.map((locale) => translateBirthPlanText(locale, key));

const localizeStandardHeading = (
  section: string,
  key: BirthPlanTranslationKey,
  locale: BirthPlanLocale,
) => {
  const sourceHeading = localizedCandidates(key).find((heading) => section.includes(heading));
  return sourceHeading
    ? section.replace(sourceHeading, translateBirthPlanText(locale, key))
    : section;
};

const findSection = (
  sections: string[],
  key: SectionKey,
  locale: BirthPlanLocale,
) => {
  const headings = localizedCandidates(key);
  const section = sections.find((candidate) =>
    headings.some((heading) => candidate.includes(heading)),
  );
  return section ? localizeStandardHeading(section, key, locale) : '';
};

// Hilfsfunktion zum Formatieren des Inhalts
export const formatContent = (content: string): string => {
  // Ersetze Zeilenumbrüche durch <br>
  let formattedContent = content.replace(/\n/g, '<br>');
  
  // Ersetze Markdown-Überschriften durch HTML-Überschriften und entferne die Hashtags
  formattedContent = formattedContent.replace(/^# (.*)$/gm, '<h1>$1</h1>');
  formattedContent = formattedContent.replace(/^## (.*)$/gm, '<h2>$1</h2>');
  
  // Entferne alle verbliebenen Hashtags am Anfang von Zeilen
  formattedContent = formattedContent.replace(/^#+ (.*)(<br>|$)/gm, '<h3>$1</h3>');
  
  // Formatiere Schlüssel-Wert-Paare (z.B. "Name der Mutter: Anna")
  formattedContent = formattedContent.replace(/(.*?): (.*?)(<br>|$)/g, '<div class="item"><span class="item-label">$1:</span> <span class="item-value">$2</span></div>');
  
  return formattedContent;
};

// Funktion zum Formatieren der linken Spalte (Abschnitte 1-3)
export const formatContentForHTMLLeftColumn = (
  content: string,
  locale: BirthPlanLocale = 'de',
): string => {
  // Extrahiere die ersten drei Abschnitte (1-3)
  const sections = content.split(/\n\n/);
  let leftColumnContent = '';
  
  // Abschnitt 1: Allgemeine Angaben
  const documentTitles = localizedCandidates('export.documentTitle');
  if (sections.length > 0 && documentTitles.some((title) => sections[0].includes(title))) {
    leftColumnContent += localizeStandardHeading(sections[0], 'export.documentTitle', locale) + '\n\n';
  }

  for (const key of ['section.general', 'section.birthWishes', 'section.interventions'] as const) {
    const section = findSection(sections, key, locale);
    if (section) leftColumnContent += section + '\n\n';
  }
  
  // Formatiere den Inhalt
  let formattedContent = formatContent(leftColumnContent);
  
  // Gruppiere Abschnitte
  formattedContent = formattedContent.replace(/<h2>(.*?)<\/h2>/g, '</div><div class="section"><h2>$1</h2>');
  
  // Schließe den ersten Abschnitt und füge einen öffnenden div für den ersten Abschnitt hinzu
  formattedContent = '<div class="section">' + formattedContent + '</div>';
  
  // Entferne leere Abschnitte
  formattedContent = formattedContent.replace(/<div class="section"><\/div>/g, '');
  
  return formattedContent;
};

// Funktion zum Formatieren der rechten Spalte (Abschnitte 4-5)
export const formatContentForHTMLRightColumn = (
  content: string,
  locale: BirthPlanLocale = 'de',
): string => {
  // Extrahiere die letzten zwei Abschnitte (4-5)
  const sections = content.split(/\n\n/);
  let rightColumnContent = '';
  
  for (const key of ['section.afterBirth', 'section.emergency', 'section.other'] as const) {
    const section = findSection(sections, key, locale);
    if (section) rightColumnContent += section + '\n\n';
  }
  
  // Formatiere den Inhalt
  let formattedContent = formatContent(rightColumnContent);
  
  // Gruppiere Abschnitte
  formattedContent = formattedContent.replace(/<h2>(.*?)<\/h2>/g, '</div><div class="section"><h2>$1</h2>');
  
  // Schließe den ersten Abschnitt und füge einen öffnenden div für den ersten Abschnitt hinzu
  formattedContent = '<div class="section">' + formattedContent + '</div>';
  
  // Entferne leere Abschnitte
  formattedContent = formattedContent.replace(/<div class="section"><\/div>/g, '');
  
  return formattedContent;
};
