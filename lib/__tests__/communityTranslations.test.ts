import {
  COMMUNITY_TRANSLATIONS,
  formatCommunityDate,
  getCommunityEventCopy,
  getCommunityLocaleTag,
  getCommunityRoleLabel,
  translateCommunityText,
} from '../communityTranslations';

describe('community translations', () => {
  it('keeps the German, English, and Spanish catalogs in sync', () => {
    const expectedKeys = Object.keys(COMMUNITY_TRANSLATIONS.de).sort();

    expect(Object.keys(COMMUNITY_TRANSLATIONS.en).sort()).toEqual(expectedKeys);
    expect(Object.keys(COMMUNITY_TRANSLATIONS.es).sort()).toEqual(expectedKeys);
  });

  it('interpolates dynamic community copy in every supported language', () => {
    expect(translateCommunityText('de', 'groups.invitedSuccess', { name: 'Mia' }))
      .toBe('Mia wurde eingeladen.');
    expect(translateCommunityText('en', 'groups.invitedSuccess', { name: 'Mia' }))
      .toBe('Mia was invited.');
    expect(translateCommunityText('es', 'groups.invitedSuccess', { name: 'Mia' }))
      .toBe('Se ha invitado a Mia.');
  });

  it('provides localized roles, event copy, and locale-aware dates', () => {
    expect(getCommunityRoleLabel('de', 'mama')).toBe('Mama');
    expect(getCommunityRoleLabel('en', 'mama')).toBe('Mom');
    expect(getCommunityRoleLabel('es', 'mama')).toBe('Mamá');
    expect(getCommunityEventCopy('es').maybe).toBe('Quizás');

    const date = new Date(2026, 6, 31, 12, 0);
    expect(formatCommunityDate(date, 'de')).toBe('31.07.2026');
    expect(formatCommunityDate(date, 'en')).toBe('07/31/2026');
    expect(formatCommunityDate(date, 'es')).toBe('31/07/2026');
    expect(getCommunityLocaleTag('de')).toBe('de-DE');
  });
});
