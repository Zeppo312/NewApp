import { buildPrintsShopUrl } from '../printsShop';

describe('prints shop URL', () => {
  it.each(['de', 'en', 'es'] as const)(
    'passes the active %s app locale to the shop',
    (locale) => {
      expect(buildPrintsShopUrl(locale)).toBe(
        `https://lottibaby.de?source=app&lang=${locale}`,
      );
    },
  );

  it('falls back to German for an unsupported locale', () => {
    expect(buildPrintsShopUrl('fr')).toBe(
      'https://lottibaby.de?source=app&lang=de',
    );
  });
});
