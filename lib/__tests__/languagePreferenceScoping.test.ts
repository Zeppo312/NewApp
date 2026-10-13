import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_LANGUAGE_PREFERENCE,
  LANGUAGE_PREFERENCE_STORAGE_KEY,
  getDeviceAppLocale,
  getPersistedAppLocale,
  getUserLanguagePreferenceStorageKey,
  resolvePreferenceForUser,
} from '../localization';

describe('nutzerspezifischer Sprachschluessel', () => {
  it('leitet den Schluessel aus dem globalen Schluessel und der User-ID ab', () => {
    expect(getUserLanguagePreferenceStorageKey('user-1')).toBe(
      `${LANGUAGE_PREFERENCE_STORAGE_KEY}:user-1`,
    );
  });

  it('haelt die Schluessel zweier Nutzer auseinander', () => {
    expect(getUserLanguagePreferenceStorageKey('user-1')).not.toBe(
      getUserLanguagePreferenceStorageKey('user-2'),
    );
  });

  it('kollidiert nicht mit dem globalen Schluessel', () => {
    expect(getUserLanguagePreferenceStorageKey('user-1')).not.toBe(
      LANGUAGE_PREFERENCE_STORAGE_KEY,
    );
  });
});

describe('resolvePreferenceForUser', () => {
  it('uebernimmt einen gueltigen gespeicherten Wert', () => {
    expect(resolvePreferenceForUser('en')).toBe('en');
    expect(resolvePreferenceForUser('system')).toBe('system');
  });

  it('faellt ohne gespeicherten Wert auf den Standard zurueck, nie auf fremde Werte', () => {
    expect(resolvePreferenceForUser(null)).toBe(DEFAULT_LANGUAGE_PREFERENCE);
    expect(resolvePreferenceForUser(undefined)).toBe(DEFAULT_LANGUAGE_PREFERENCE);
    expect(resolvePreferenceForUser('klingonisch')).toBe(DEFAULT_LANGUAGE_PREFERENCE);
  });
});

describe('Background-Pfade ohne Nutzerkontext', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('liest weiterhin den globalen Schluessel', async () => {
    await AsyncStorage.setItem(LANGUAGE_PREFERENCE_STORAGE_KEY, 'en');

    await expect(getPersistedAppLocale()).resolves.toBe('en');
  });

  it('bevorzugt den globalen Schluessel gegenueber nutzerspezifischen Werten', async () => {
    await AsyncStorage.setItem(LANGUAGE_PREFERENCE_STORAGE_KEY, 'de');
    await AsyncStorage.setItem(getUserLanguagePreferenceStorageKey('user-1'), 'en');

    await expect(getPersistedAppLocale()).resolves.toBe('de');
  });

  it('faellt auf die Geraetesprache zurueck, wenn nur ein nutzerspezifischer Wert existiert', async () => {
    // Der Background-Pfad hat keinen Nutzerkontext und darf nicht raten.
    await AsyncStorage.setItem(getUserLanguagePreferenceStorageKey('user-1'), 'de');

    await expect(getPersistedAppLocale()).resolves.toBe(getDeviceAppLocale());
  });
});
