import {
  addRecipeIngredientsToShoppingList,
  adjustInventoryQuantity,
  clampQuantity,
  computeDaysLeft,
  dedupeParsedIngredients,
  fetchLowStockCount,
  isLowStock,
  normalizeItemName,
  parseIngredientLine,
  recordBottleUsage,
  recordDiaperUsage,
  resolveBarcodeProduct,
} from '../shopping';
import { getCachedUser, supabase } from '../supabase';

jest.mock('../supabase', () => ({
  supabase: { from: jest.fn() },
  getCachedUser: jest.fn(),
}));

const mockedFrom = supabase.from as jest.Mock;
const mockedGetCachedUser = getCachedUser as jest.Mock;

/** Chainable Query-Builder-Stub, der sich zu `result` auflöst. */
const chainResolving = (result: { data: unknown; error: unknown }) => {
  const chain: any = {};
  for (const method of ['select', 'eq', 'order', 'insert', 'update', 'delete', 'upsert', 'limit', 'single']) {
    chain[method] = jest.fn(() => chain);
  }
  chain.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return chain;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetCachedUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
});

describe('normalizeItemName', () => {
  it('normalisiert Groß-/Kleinschreibung und Whitespace', () => {
    expect(normalizeItemName('  Banane ')).toBe('banane');
    expect(normalizeItemName('Süß  Kartoffel')).toBe('süß kartoffel');
  });

  it('führt Singular und Plural zusammen (Banane / bananen)', () => {
    expect(normalizeItemName('Banane')).toBe(normalizeItemName('bananen'));
    expect(normalizeItemName('Möhren')).toBe(normalizeItemName('Möhre'));
  });

  it('liefert leeren String für Leerwerte', () => {
    expect(normalizeItemName('   ')).toBe('');
  });
});

describe('parseIngredientLine', () => {
  it('zerlegt Menge, Einheit und Name', () => {
    expect(parseIngredientLine('200 g Kürbis')).toEqual({
      title: '200 g Kürbis',
      normalizedName: 'kürbis',
      quantityValue: 200,
      quantityUnit: 'g',
    });
  });

  it('versteht Dezimalzahlen mit Komma', () => {
    const parsed = parseIngredientLine('1,5 Bananen');
    expect(parsed?.quantityValue).toBe(1.5);
    expect(parsed?.normalizedName).toBe('banane');
    expect(parsed?.quantityUnit).toBeNull();
  });

  it('lässt Zeilen ohne Menge unverändert', () => {
    expect(parseIngredientLine('Etwas Zimt')).toEqual({
      title: 'Etwas Zimt',
      normalizedName: 'etwas zimt',
      quantityValue: null,
      quantityUnit: null,
    });
  });

  it('liefert null für Leerwerte', () => {
    expect(parseIngredientLine('')).toBeNull();
    expect(parseIngredientLine('   ')).toBeNull();
  });
});

describe('dedupeParsedIngredients', () => {
  it('fasst gleiche Zutaten zusammen und summiert Mengen gleicher Einheit', () => {
    const deduped = dedupeParsedIngredients([
      parseIngredientLine('1 Banane')!,
      parseIngredientLine('2 bananen')!,
      parseIngredientLine('100 g Haferflocken')!,
    ]);
    expect(deduped).toHaveLength(2);
    const banana = deduped.find((item) => item.normalizedName === 'banane');
    expect(banana?.quantityValue).toBe(3);
  });

  it('behält Zutaten ohne Menge einfach einmal', () => {
    const deduped = dedupeParsedIngredients([
      parseIngredientLine('Zimt')!,
      parseIngredientLine('zimt')!,
    ]);
    expect(deduped).toHaveLength(1);
  });
});

describe('Mengenlogik', () => {
  it('clampQuantity verhindert negative Bestände', () => {
    expect(clampQuantity(-5)).toBe(0);
    expect(clampQuantity(3)).toBe(3);
  });

  it('isLowStock vergleicht mit dem Schwellenwert', () => {
    expect(isLowStock({ current_quantity: 4, reorder_threshold: 5 })).toBe(true);
    expect(isLowStock({ current_quantity: 5, reorder_threshold: 5 })).toBe(true);
    expect(isLowStock({ current_quantity: 6, reorder_threshold: 5 })).toBe(false);
    expect(isLowStock({ current_quantity: 0, reorder_threshold: 0 })).toBe(false);
  });

  it('computeDaysLeft rundet auf ganze Tage ab', () => {
    expect(computeDaysLeft({ current_quantity: 22, daily_usage_estimate: 6 })).toBe(3);
    expect(computeDaysLeft({ current_quantity: 22, daily_usage_estimate: null })).toBeNull();
    expect(computeDaysLeft({ current_quantity: 22, daily_usage_estimate: 0 })).toBeNull();
  });
});

describe('addRecipeIngredientsToShoppingList', () => {
  it('überspringt Zutaten, die bereits offen auf der Liste stehen', async () => {
    const existingChain = chainResolving({ data: [{ normalized_name: 'banane' }], error: null });
    const insertChain = chainResolving({ data: null, error: null });
    mockedFrom.mockReturnValueOnce(existingChain).mockReturnValueOnce(insertChain);

    const { data, error } = await addRecipeIngredientsToShoppingList(
      { id: 'recipe-1', ingredients: ['2 Bananen', '100 g Haferflocken', '  '] },
      'baby-1'
    );

    expect(error).toBeNull();
    expect(data).toEqual({ added: 1, skipped: 1 });
    const insertedRows = insertChain.insert.mock.calls[0][0];
    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0]).toMatchObject({
      baby_id: 'baby-1',
      created_by: 'user-1',
      normalized_name: 'haferflocke',
      quantity_value: 100,
      quantity_unit: 'g',
      source_type: 'recipe',
      source_recipe_id: 'recipe-1',
    });
  });

  it('fügt nichts ein, wenn alle Zutaten schon vorhanden sind', async () => {
    const existingChain = chainResolving({ data: [{ normalized_name: 'banane' }], error: null });
    mockedFrom.mockReturnValueOnce(existingChain);

    const { data } = await addRecipeIngredientsToShoppingList(
      { id: 'recipe-1', ingredients: ['1 Banane'] },
      'baby-1'
    );

    expect(data).toEqual({ added: 0, skipped: 1 });
    expect(mockedFrom).toHaveBeenCalledTimes(1);
  });

  it('gibt einen Fehler zurück, wenn kein Benutzer angemeldet ist', async () => {
    mockedGetCachedUser.mockResolvedValue({ data: { user: null }, error: null });

    const { data, error } = await addRecipeIngredientsToShoppingList(
      { id: 'recipe-1', ingredients: ['1 Banane'] },
      'baby-1'
    );

    expect(data).toBeNull();
    expect(error).toBeInstanceOf(Error);
  });
});

describe('adjustInventoryQuantity', () => {
  it('bucht Verbrauch und schreibt einen Audit-Eintrag', async () => {
    const updateChain = chainResolving({
      data: { id: 'inv-1', baby_id: 'baby-1', current_quantity: 18 },
      error: null,
    });
    const txChain = chainResolving({ data: null, error: null });
    mockedFrom.mockReturnValueOnce(updateChain).mockReturnValueOnce(txChain);

    const { data, error } = await adjustInventoryQuantity(
      { id: 'inv-1', baby_id: 'baby-1', current_quantity: 20 },
      -2,
      'usage'
    );

    expect(error).toBeNull();
    expect(data?.current_quantity).toBe(18);
    expect(updateChain.update).toHaveBeenCalledWith({ current_quantity: 18 });
    expect(txChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        transaction_type: 'usage',
        quantity_change: -2,
        quantity_after: 18,
      })
    );
  });

  it('lässt den Bestand nie unter 0 fallen', async () => {
    const updateChain = chainResolving({
      data: { id: 'inv-1', baby_id: 'baby-1', current_quantity: 0 },
      error: null,
    });
    const txChain = chainResolving({ data: null, error: null });
    mockedFrom.mockReturnValueOnce(updateChain).mockReturnValueOnce(txChain);

    await adjustInventoryQuantity(
      { id: 'inv-1', baby_id: 'baby-1', current_quantity: 3 },
      -10,
      'usage'
    );

    expect(updateChain.update).toHaveBeenCalledWith({ current_quantity: 0 });
    expect(txChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ quantity_change: -3, quantity_after: 0 })
    );
  });
});

describe('recordDiaperUsage', () => {
  it('bucht eine Windel vom ältesten Posten mit Restbestand ab', async () => {
    const lookupChain = chainResolving({
      data: [
        { id: 'inv-empty', baby_id: 'baby-1', category: 'diapers', current_quantity: 0 },
        { id: 'inv-full', baby_id: 'baby-1', category: 'diapers', current_quantity: 30 },
      ],
      error: null,
    });
    const updateChain = chainResolving({
      data: { id: 'inv-full', baby_id: 'baby-1', current_quantity: 29 },
      error: null,
    });
    const txChain = chainResolving({ data: null, error: null });
    mockedFrom
      .mockReturnValueOnce(lookupChain)
      .mockReturnValueOnce(updateChain)
      .mockReturnValueOnce(txChain);

    const { data, error } = await recordDiaperUsage('baby-1');

    expect(error).toBeNull();
    expect(data?.current_quantity).toBe(29);
    expect(updateChain.update).toHaveBeenCalledWith({ current_quantity: 29 });
    expect(txChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ transaction_type: 'usage', quantity_change: -1 })
    );
  });

  it('bucht vom explizit gewählten Posten ab, auch wenn ein älterer Restbestand hat', async () => {
    const lookupChain = chainResolving({
      data: [
        { id: 'inv-old', baby_id: 'baby-1', category: 'diapers', current_quantity: 10 },
        { id: 'inv-chosen', baby_id: 'baby-1', category: 'diapers', current_quantity: 44 },
      ],
      error: null,
    });
    const updateChain = chainResolving({
      data: { id: 'inv-chosen', baby_id: 'baby-1', current_quantity: 43 },
      error: null,
    });
    const txChain = chainResolving({ data: null, error: null });
    mockedFrom
      .mockReturnValueOnce(lookupChain)
      .mockReturnValueOnce(updateChain)
      .mockReturnValueOnce(txChain);

    const { data } = await recordDiaperUsage('baby-1', 'inv-chosen');

    expect(data?.id).toBe('inv-chosen');
    expect(updateChain.update).toHaveBeenCalledWith({ current_quantity: 43 });
    expect(updateChain.eq).toHaveBeenCalledWith('id', 'inv-chosen');
  });

  it('tut nichts, wenn kein Windel-Vorrat angelegt ist', async () => {
    mockedFrom.mockReturnValueOnce(chainResolving({ data: [], error: null }));

    const { data, error } = await recordDiaperUsage('baby-1');

    expect(data).toBeNull();
    expect(error).toBeNull();
    expect(mockedFrom).toHaveBeenCalledTimes(1);
  });

  it('bucht nicht unter 0, wenn alle Posten leer sind', async () => {
    mockedFrom.mockReturnValueOnce(
      chainResolving({
        data: [{ id: 'inv-empty', baby_id: 'baby-1', category: 'diapers', current_quantity: 0 }],
        error: null,
      })
    );

    const { data, error } = await recordDiaperUsage('baby-1');

    expect(error).toBeNull();
    expect(data?.current_quantity).toBe(0);
    expect(mockedFrom).toHaveBeenCalledTimes(1);
  });
});

describe('recordBottleUsage', () => {
  it('rechnet ml über die Dosierung in Gramm um und bucht ab', async () => {
    const lookupChain = chainResolving({
      data: [
        {
          id: 'formula-1',
          baby_id: 'baby-1',
          category: 'formula',
          current_quantity: 500,
          dosage_grams_per_100ml: 10.5,
        },
      ],
      error: null,
    });
    const updateChain = chainResolving({
      data: { id: 'formula-1', baby_id: 'baby-1', current_quantity: 482.2 },
      error: null,
    });
    const txChain = chainResolving({ data: null, error: null });
    mockedFrom
      .mockReturnValueOnce(lookupChain)
      .mockReturnValueOnce(updateChain)
      .mockReturnValueOnce(txChain);

    // 170 ml × 10,5 g/100 ml = 17,85 → auf eine Nachkommastelle gerundet 17,8 g
    const { data, error } = await recordBottleUsage('baby-1', 170);

    expect(error).toBeNull();
    expect(data?.current_quantity).toBe(482.2);
    expect(updateChain.update).toHaveBeenCalledWith({ current_quantity: 482.2 });
    expect(txChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        transaction_type: 'usage',
        quantity_change: -17.8,
        note: 'Fläschchen 170 ml',
      })
    );
  });

  it('überspringt Posten ohne Dosierung und tut ohne Kandidaten nichts', async () => {
    mockedFrom.mockReturnValueOnce(
      chainResolving({
        data: [
          {
            id: 'formula-no-dosage',
            baby_id: 'baby-1',
            category: 'formula',
            current_quantity: 500,
            dosage_grams_per_100ml: null,
          },
        ],
        error: null,
      })
    );

    const { data, error } = await recordBottleUsage('baby-1', 120);

    expect(data).toBeNull();
    expect(error).toBeNull();
    expect(mockedFrom).toHaveBeenCalledTimes(1);
  });

  it('ignoriert ungültige Volumina', async () => {
    const { data, error } = await recordBottleUsage('baby-1', 0);
    expect(data).toBeNull();
    expect(error).toBeNull();
    expect(mockedFrom).not.toHaveBeenCalled();
  });
});

describe('fetchLowStockCount', () => {
  it('zählt Posten auf oder unter dem Schwellenwert', async () => {
    mockedFrom.mockReturnValueOnce(
      chainResolving({
        data: [
          { current_quantity: 3, reorder_threshold: 5 },
          { current_quantity: 10, reorder_threshold: 5 },
          { current_quantity: 5, reorder_threshold: 5 },
          { current_quantity: 0, reorder_threshold: 0 },
        ],
        error: null,
      })
    );

    const { count, error } = await fetchLowStockCount('baby-1');

    expect(error).toBeNull();
    expect(count).toBe(2);
  });

  it('liefert 0 bei Fehler', async () => {
    mockedFrom.mockReturnValueOnce(chainResolving({ data: null, error: { message: 'boom' } }));

    const { count, error } = await fetchLowStockCount('baby-1');

    expect(count).toBe(0);
    expect(error).not.toBeNull();
  });
});

describe('resolveBarcodeProduct', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('bevorzugt den lokalen Produktkatalog', async () => {
    mockedFrom.mockReturnValueOnce(
      chainResolving({
        data: [
          {
            barcode: '4000000000001',
            name: 'Windeln Gr. 3',
            brand: null,
            category: 'diapers',
            default_package_quantity: 52,
            default_unit: 'Stück',
          },
        ],
        error: null,
      })
    );
    global.fetch = jest.fn();

    const { data } = await resolveBarcodeProduct('4000000000001');

    expect(data).toMatchObject({
      status: 'known',
      source: 'catalog',
      product: { name: 'Windeln Gr. 3', packageQuantity: 52 },
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('fällt auf Open Food Facts zurück', async () => {
    mockedFrom.mockReturnValueOnce(chainResolving({ data: [], error: null }));
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 1,
        product: { product_name: 'Bio Milchpulver', brands: 'TestMarke', quantity: '600 g' },
      }),
    });

    const { data } = await resolveBarcodeProduct('4000000000002');

    expect(data).toMatchObject({
      status: 'known',
      source: 'open_food_facts',
      product: { name: 'Bio Milchpulver', packageQuantity: 600, unit: 'g' },
    });
  });

  it('fällt auf Open Beauty Facts zurück, wenn Open Food Facts das Produkt nicht kennt', async () => {
    mockedFrom.mockReturnValueOnce(chainResolving({ data: [], error: null }));
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 0 }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 1,
          product: { product_name: 'Feuchttücher Sensitive', brands: 'Pampers', quantity: '56' },
        }),
      });

    const { data } = await resolveBarcodeProduct('4015400636649');

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect((global.fetch as jest.Mock).mock.calls[1][0]).toContain('openbeautyfacts');
    expect(data).toMatchObject({
      status: 'known',
      source: 'open_food_facts',
      product: { name: 'Feuchttücher Sensitive', category: 'care' },
    });
  });

  it('liefert unknown, wenn keine Quelle das Produkt kennt', async () => {
    mockedFrom.mockReturnValueOnce(chainResolving({ data: [], error: null }));
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 0 }),
    });

    const { data } = await resolveBarcodeProduct('4000000000003');

    expect(data).toEqual({ status: 'unknown', barcode: '4000000000003' });
  });

  it('liefert unknown, wenn der API-Aufruf fehlschlägt', async () => {
    mockedFrom.mockReturnValueOnce(chainResolving({ data: [], error: null }));
    global.fetch = jest.fn().mockRejectedValue(new Error('offline'));

    const { data, error } = await resolveBarcodeProduct('4000000000004');

    expect(error).toBeNull();
    expect(data).toEqual({ status: 'unknown', barcode: '4000000000004' });
  });
});
