import { translateModerationText } from '../moderationTranslations';

describe('moderation translations', () => {
  it('übersetzt Platzhalter in allen Sprachen', () => {
    expect(translateModerationText('de', 'block.confirmMessage', { name: 'Lena' })).toContain(
      'Lena',
    );
    expect(translateModerationText('en', 'block.successMessage', { name: 'Lena' })).toContain(
      'Lena',
    );
    expect(translateModerationText('es', 'unblock.confirmMessage', { name: 'Lena' })).toContain(
      'Lena',
    );
  });

  it('nennt die 24-Stunden-Zusage in der Bestätigung', () => {
    expect(translateModerationText('de', 'report.successMessage')).toContain('24 Stunden');
    expect(translateModerationText('en', 'report.successMessage')).toContain('24 hours');
    expect(translateModerationText('es', 'report.successMessage')).toContain('24 horas');
  });

  it('fällt auf Deutsch zurück, wenn ein Katalog fehlt', () => {
    // @ts-expect-error – unbekannte Locale wird absichtlich getestet
    expect(translateModerationText('fr', 'sheet.report')).toBe('Inhalt melden');
  });

  it('deckt alle Meldegründe ab', () => {
    const reasons = [
      'spam',
      'harassment',
      'hate',
      'sexual',
      'violence',
      'self_harm',
      'misinformation',
      'other',
    ] as const;

    reasons.forEach((reason) => {
      const key = `report.reason.${reason}` as const;
      expect(translateModerationText('de', key)).not.toBe(key);
      expect(translateModerationText('en', key)).not.toBe(key);
      expect(translateModerationText('es', key)).not.toBe(key);
    });
  });

  it('deckt alle Zielarten für das Backoffice ab', () => {
    const targets = [
      'post',
      'comment',
      'nested_comment',
      'group_post',
      'group_comment',
      'group_nested_comment',
      'group_message',
      'direct_message',
      'profile',
    ] as const;

    targets.forEach((target) => {
      const key = `target.${target}` as const;
      expect(translateModerationText('de', key)).not.toBe(key);
      expect(translateModerationText('en', key)).not.toBe(key);
      expect(translateModerationText('es', key)).not.toBe(key);
    });
  });

  it('beschreibt die atomare Entfernen-und-Sperren-Aktion in allen Sprachen', () => {
    (['de', 'en', 'es'] as const).forEach((locale) => {
      expect(translateModerationText(locale, 'admin.removeAndSuspend')).not.toBe(
        'admin.removeAndSuspend',
      );
      expect(translateModerationText(locale, 'admin.removeAndSuspendConfirmMessage')).not.toBe(
        'admin.removeAndSuspendConfirmMessage',
      );
    });
  });
});
