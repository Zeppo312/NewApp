import {
  formatShoppingDate,
  formatShoppingQuantity,
  getShoppingCategoryLabel,
  getShoppingLevelLabel,
  SHOPPING_TRANSLATIONS,
  translateShoppingText,
} from '../shoppingTranslations';

describe('shopping translations', () => {
  it('keeps the German, English and Spanish catalogs in sync', () => {
    const germanKeys = Object.keys(SHOPPING_TRANSLATIONS.de).sort();
    expect(Object.keys(SHOPPING_TRANSLATIONS.en).sort()).toEqual(germanKeys);
    expect(Object.keys(SHOPPING_TRANSLATIONS.es).sort()).toEqual(germanKeys);
  });

  it('translates categories, stock levels and interpolated messages', () => {
    expect(getShoppingCategoryLabel('de', 'diapers')).toBe('Windeln');
    expect(getShoppingCategoryLabel('en', 'diapers')).toBe('Diapers');
    expect(getShoppingCategoryLabel('es', 'diapers')).toBe('Pañales');
    expect(getShoppingLevelLabel('es', 20)).toBe('Poco');
    expect(translateShoppingText('en', 'inventory.added', { name: 'Diapers' })).toBe(
      'Diapers is now on the shopping list.',
    );
  });

  it('formats dates, decimal separators and built-in units for each locale', () => {
    expect(formatShoppingDate('de', '2026-07-24T12:00:00Z', { month: 'long' })).toContain(
      'Juli',
    );
    expect(formatShoppingDate('en', '2026-07-24T12:00:00Z', { month: 'long' })).toContain(
      'July',
    );
    expect(formatShoppingDate('es', '2026-07-24T12:00:00Z', { month: 'long' })).toContain(
      'julio',
    );
    expect(formatShoppingQuantity('de', 1.5, 'Stück')).toBe('1,5 Stück');
    expect(formatShoppingQuantity('en', 1.5, 'Stück')).toBe('1.5 pcs');
    expect(formatShoppingQuantity('es', 1.5, 'Stück')).toBe('1,5 uds.');
  });
});
