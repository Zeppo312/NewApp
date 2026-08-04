import { getLocales } from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const SUPPORTED_APP_LOCALES = ['de', 'en', 'es'] as const;

export type AppLocale = (typeof SUPPORTED_APP_LOCALES)[number];
export type LanguagePreference = 'system' | AppLocale;

export const DEFAULT_APP_LOCALE: AppLocale = 'de';
export const DEFAULT_LANGUAGE_PREFERENCE: LanguagePreference = 'system';
export const LANGUAGE_PREFERENCE_STORAGE_KEY = '@lottibaby:language-preference';

export const isAppLocale = (value: unknown): value is AppLocale =>
  typeof value === 'string' && SUPPORTED_APP_LOCALES.includes(value as AppLocale);

export const isLanguagePreference = (value: unknown): value is LanguagePreference =>
  value === 'system' || isAppLocale(value);

export const getAppLocaleTag = (locale: AppLocale) => ({
  de: 'de-DE',
  en: 'en-US',
  es: 'es-ES',
})[locale];

export const getDeviceAppLocale = (): AppLocale => {
  try {
    const deviceLocale = getLocales()[0]?.languageCode;
    return isAppLocale(deviceLocale) ? deviceLocale : DEFAULT_APP_LOCALE;
  } catch {
    return DEFAULT_APP_LOCALE;
  }
};

export const resolveAppLocale = (
  preference: LanguagePreference,
  deviceLocale = getDeviceAppLocale(),
): AppLocale => preference === 'system' ? deviceLocale : preference;

export const getPersistedAppLocale = async (): Promise<AppLocale> => {
  try {
    const preference = await AsyncStorage.getItem(LANGUAGE_PREFERENCE_STORAGE_KEY);
    return isLanguagePreference(preference) ? resolveAppLocale(preference) : getDeviceAppLocale();
  } catch {
    return getDeviceAppLocale();
  }
};
