import { selectWidgetItems, wasPurchasedToday } from '../shoppingWidget';
import type { ShoppingListItem } from '../shopping';

const makeItem = (overrides: Partial<ShoppingListItem>): ShoppingListItem => ({
  id: 'id',
  baby_id: 'baby',
  created_by: 'user',
  title: 'Windeln',
  normalized_name: 'windeln',
  category: 'diapers',
  quantity_value: null,
  quantity_unit: null,
  source_type: 'manual',
  source_recipe_id: null,
  inventory_item_id: null,
  is_purchased: false,
  notes: null,
  created_at: '2026-08-20T08:00:00.000Z',
  updated_at: '2026-08-20T08:00:00.000Z',
  ...overrides,
});

const now = new Date('2026-08-20T18:00:00');

describe('wasPurchasedToday', () => {
  it('erkennt einen heute abgehakten Posten', () => {
    const item = makeItem({ is_purchased: true, updated_at: new Date('2026-08-20T09:30:00').toISOString() });
    expect(wasPurchasedToday(item, now)).toBe(true);
  });

  it('ignoriert gestern abgehakte Posten', () => {
    const item = makeItem({ is_purchased: true, updated_at: new Date('2026-08-19T23:59:00').toISOString() });
    expect(wasPurchasedToday(item, now)).toBe(false);
  });

  it('gilt nie für offene Posten', () => {
    const item = makeItem({ is_purchased: false, updated_at: new Date('2026-08-20T09:30:00').toISOString() });
    expect(wasPurchasedToday(item, now)).toBe(false);
  });

  it('bleibt bei kaputtem Zeitstempel bei false', () => {
    const item = makeItem({ is_purchased: true, updated_at: 'kein-datum' });
    expect(wasPurchasedToday(item, now)).toBe(false);
  });
});

describe('selectWidgetItems', () => {
  it('behält alle offenen Posten und nur die heute abgehakten', () => {
    const open = makeItem({ id: 'open' });
    const doneToday = makeItem({
      id: 'today',
      is_purchased: true,
      updated_at: new Date('2026-08-20T10:00:00').toISOString(),
    });
    const doneEarlier = makeItem({
      id: 'earlier',
      is_purchased: true,
      updated_at: new Date('2026-08-17T10:00:00').toISOString(),
    });

    const result = selectWidgetItems([open, doneToday, doneEarlier], now);

    expect(result.open.map((item) => item.id)).toEqual(['open']);
    expect(result.doneToday.map((item) => item.id)).toEqual(['today']);
  });
});
