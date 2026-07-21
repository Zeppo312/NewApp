import {
  createLoyaltyCard,
  deleteLoyaltyCard,
  fetchLoyaltyCards,
} from '../loyalty-cards';
import { getCachedUser, supabase } from '../supabase';

jest.mock('../supabase', () => ({
  supabase: { from: jest.fn() },
  getCachedUser: jest.fn(),
}));

const mockedFrom = supabase.from as jest.Mock;
const mockedGetCachedUser = getCachedUser as jest.Mock;

const chainResolving = (result: { data: unknown; error: unknown }) => {
  const chain: any = {};
  for (const method of ['select', 'eq', 'order', 'insert', 'delete', 'single']) {
    chain[method] = jest.fn(() => chain);
  }
  chain.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return chain;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetCachedUser.mockResolvedValue({
    data: { user: { id: 'user-1' } },
    error: null,
  });
});

describe('Kundenkarten in Supabase', () => {
  it('lädt nur die Karten des angemeldeten Benutzers', async () => {
    const chain = chainResolving({
      data: [
        {
          id: 'card-1',
          name: 'PAYBACK',
          barcode: '123456789',
          scanned_type: 'code128',
          color: '#1B63B7',
          created_at: '2026-07-21T10:00:00.000Z',
        },
      ],
      error: null,
    });
    mockedFrom.mockReturnValue(chain);

    const { data, error } = await fetchLoyaltyCards();

    expect(error).toBeNull();
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(data).toEqual([
      {
        id: 'card-1',
        name: 'PAYBACK',
        barcode: '123456789',
        scannedType: 'code128',
        color: '#1B63B7',
        createdAt: '2026-07-21T10:00:00.000Z',
      },
    ]);
  });

  it('speichert neue Karten mit der aktuellen user_id', async () => {
    const row = {
      id: 'card-2',
      name: 'EDEKA',
      barcode: '987654321',
      scanned_type: 'ean13',
      color: '#F3C400',
      created_at: '2026-07-21T11:00:00.000Z',
    };
    const chain = chainResolving({ data: row, error: null });
    mockedFrom.mockReturnValue(chain);

    const { data, error } = await createLoyaltyCard({
      name: 'EDEKA',
      barcode: '987654321',
      scannedType: 'ean13',
      color: '#F3C400',
    });

    expect(error).toBeNull();
    expect(chain.insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      name: 'EDEKA',
      barcode: '987654321',
      scanned_type: 'ean13',
      color: '#F3C400',
    });
    expect(data?.id).toBe('card-2');
  });

  it('begrenzt das Löschen zusätzlich auf den angemeldeten Benutzer', async () => {
    const chain = chainResolving({ data: null, error: null });
    mockedFrom.mockReturnValue(chain);

    const { error } = await deleteLoyaltyCard('card-1');

    expect(error).toBeNull();
    expect(chain.eq).toHaveBeenNthCalledWith(1, 'id', 'card-1');
    expect(chain.eq).toHaveBeenNthCalledWith(2, 'user_id', 'user-1');
  });
});
