import { isAppLocale } from './localization';

export const PRINTS_SHOP_BASE_URL = 'https://lottibaby.de';

export const buildPrintsShopUrl = (locale: unknown): string => {
  const shopLocale = isAppLocale(locale) ? locale : 'de';
  return `${PRINTS_SHOP_BASE_URL}?source=app&lang=${shopLocale}`;
};
