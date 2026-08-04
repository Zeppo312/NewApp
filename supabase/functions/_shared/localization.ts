export type SupportedLocale = 'de' | 'en' | 'es';

export const normalizeLocale = (value?: string | null): SupportedLocale => {
  if (value === 'en' || value === 'es') return value;
  return 'de';
};

export const getSettingsLocale = (settings?: {
  resolved_language?: string | null;
  language_preference?: string | null;
} | null): SupportedLocale =>
  normalizeLocale(settings?.resolved_language || settings?.language_preference);

export const localeTag = (locale: SupportedLocale): string => {
  if (locale === 'en') return 'en-US';
  if (locale === 'es') return 'es-ES';
  return 'de-DE';
};

export const localize = <T>(
  locale: SupportedLocale,
  values: Record<SupportedLocale, T>
): T => values[locale];
