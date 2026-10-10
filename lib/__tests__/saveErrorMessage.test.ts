import { saveErrorMessage } from '../saveErrorMessage';
import { offlineText } from '../offlineTranslations';

describe('safe save messages', () => {
  it.each(['de', 'en', 'es'])('replaces native offline diagnostics in %s', locale => {
    const native = new Error('fetch failed: UnexpectedException: keine Verbindung zum Internet (at ExpoModulesCore/Promise.swift:56)');
    expect(saveErrorMessage(native, locale, 'fallback')).toBe(offlineText(locale, 'saveConnectionLost'));
  });

  it.each([
    { message: 'connection denied', status: 403 },
    { message: 'network denied', code: '42501' },
    { message: 'offline field invalid', code: '22007' },
    { message: 'connection already exists', code: '23505' },
    { message: 'internet consent required', name: 'DataConsentRequiredError' },
  ])('keeps authorization and validation failures distinct from connection loss: %j', error => {
    expect(saveErrorMessage(error, 'de', 'Speichern fehlgeschlagen.')).toBe('Speichern fehlgeschlagen.');
  });

  it('keeps backend diagnostic details out of the alert', () => {
    expect(saveErrorMessage({ message: 'column private_schema.secret does not exist' }, 'de', 'Speichern fehlgeschlagen.')).toBe('Speichern fehlgeschlagen.');
    expect(saveErrorMessage(null, 'de', 'Speichern fehlgeschlagen.')).toBe('Speichern fehlgeschlagen.');
  });

  it('treats interrupted writes as unconfirmed rather than claiming no write happened', () => {
    expect(saveErrorMessage({ name: 'AbortError' }, 'de', 'fallback')).toContain('nicht bestätigt');
    expect(saveErrorMessage('Network request failed', 'de', 'fallback')).toContain('Verlauf');
  });
});
