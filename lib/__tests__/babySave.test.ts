import { saveBabyInfo, toBabyInfoWritePayload } from '../baby';
import { getCachedUser, supabase } from '../supabase';

jest.mock('../supabase', () => ({
  supabase: { from: jest.fn() },
  getCachedUser: jest.fn(),
}));

const mockedFrom = supabase.from as jest.Mock;
const mockedGetCachedUser = getCachedUser as jest.Mock;

const chainResolving = (result: { data: unknown; error: unknown }) => {
  const chain: any = {};
  for (const method of ['select', 'eq', 'insert', 'update', 'single', 'maybeSingle']) {
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

describe('baby profile writes', () => {
  it('removes identity fields from the database payload', () => {
    expect(
      toBabyInfoWritePayload({
        id: 'stale-baby-id',
        name: 'Charlie',
        birth_date: '2024-08-06T00:00:00.000Z',
        preferred_bedtime: '19:30',
        height: '55',
        weight: '3500',
        baby_gender: 'male',
        photo_url: 'https://example.test/photo.jpg',
      }),
    ).toEqual({
      name: 'Charlie',
      birth_date: '2024-08-06T00:00:00.000Z',
      preferred_bedtime: '19:30',
      height: '55',
      weight: '3500',
      baby_gender: 'male',
      photo_url: 'https://example.test/photo.jpg',
    });
  });

  it('updates the explicit target without writing a stale form id', async () => {
    const chain = chainResolving({ data: { id: 'target-baby-id' }, error: null });
    mockedFrom.mockReturnValue(chain);

    const result = await saveBabyInfo(
      {
        id: 'stale-baby-id',
        name: 'Charlie',
        birth_date: '2024-08-06T00:00:00.000Z',
        preferred_bedtime: '19:30',
        height: '55',
        baby_gender: 'male',
      },
      'target-baby-id',
    );

    expect(result.error).toBeNull();
    expect(chain.eq).toHaveBeenCalledWith('id', 'target-baby-id');
    expect(chain.update).toHaveBeenCalledTimes(1);
    expect(chain.update.mock.calls[0][0]).not.toHaveProperty('id');
    expect(chain.insert).not.toHaveBeenCalled();
  });

  it('does not insert a duplicate when the requested target cannot be updated', async () => {
    const chain = chainResolving({ data: null, error: null });
    mockedFrom.mockReturnValue(chain);

    const result = await saveBabyInfo({ name: 'Charlie' }, 'missing-baby-id');

    expect(result.data).toBeNull();
    expect(result.error).toBeInstanceOf(Error);
    expect(chain.insert).not.toHaveBeenCalled();
  });
});
