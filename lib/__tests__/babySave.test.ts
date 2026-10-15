import { createBaby, saveBabyInfo, toBabyInfoWritePayload } from '../baby';
import { getCachedUser, supabase } from '../supabase';
import { randomUUID } from 'expo-crypto';

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn() }));

jest.mock('../supabase', () => ({
  supabase: { from: jest.fn() },
  getCachedUser: jest.fn(),
}));

const mockedFrom = supabase.from as jest.Mock;
const mockedGetCachedUser = getCachedUser as jest.Mock;
const mockedRandomUUID = randomUUID as jest.Mock;
const createdBabyId = '30000000-0000-4000-8000-000000000010';

const chainResolving = (result: { data: unknown; error: unknown }) => {
  const chain: any = {};
  for (const method of ['select', 'eq', 'insert', 'update', 'single', 'maybeSingle', 'upsert', 'or']) {
    chain[method] = jest.fn(() => chain);
  }
  chain.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return chain;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetCachedUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
  mockedRandomUUID.mockReturnValue(createdBabyId);
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

  it('completes onboarding with an INSERT that returns no row', async () => {
    const chain = chainResolving({ data: null, error: null });
    mockedFrom.mockReturnValue(chain);

    const result = await saveBabyInfo({ name: 'Charlie', birth_date: null, baby_gender: 'unknown' });

    expect(result.error).toBeNull();
    expect(result.data).toEqual(expect.objectContaining({ id: createdBabyId, user_id: 'user-1', name: 'Charlie' }));
    expect(chain.insert).toHaveBeenCalledWith(expect.objectContaining({ id: createdBabyId, user_id: 'user-1', name: 'Charlie' }));
    expect(chain.select).not.toHaveBeenCalled();
  });

  it('does not report a denied onboarding INSERT as a successful save', async () => {
    const error = { code: '42501', message: 'health_consent_required' };
    const chain = chainResolving({ data: null, error });
    mockedFrom.mockReturnValue(chain);

    expect(await saveBabyInfo({ name: 'Charlie' })).toEqual({ data: null, error });
    expect(chain.insert).toHaveBeenCalledTimes(1);
    expect(chain.select).not.toHaveBeenCalled();
  });

  it('creates a baby without RETURNING and shares the confirmed ID with owner and partner', async () => {
    const babyChain = chainResolving({ data: null, error: null });
    const memberChain = chainResolving({ data: null, error: null });
    const linksChain = chainResolving({ data: [{ creator_id: 'user-1', invited_id: 'partner-1' }], error: null });
    mockedFrom.mockImplementation((table: string) => ({ baby_info: babyChain, baby_members: memberChain, account_links: linksChain })[table]);

    const result = await createBaby({ id: 'stale-baby-id', name: 'Charlie' });

    expect(result.error).toBeNull();
    expect(result.data?.id).toBe(createdBabyId);
    expect(babyChain.select).not.toHaveBeenCalled();
    expect(babyChain.insert).toHaveBeenCalledWith(expect.objectContaining({ id: createdBabyId, user_id: 'user-1', name: 'Charlie' }));
    expect(memberChain.upsert).toHaveBeenCalledWith(
      { baby_id: createdBabyId, user_id: 'user-1', role: 'owner' },
      { onConflict: 'baby_id,user_id' },
    );
    expect(memberChain.upsert).toHaveBeenCalledWith(
      [{ baby_id: createdBabyId, user_id: 'partner-1', role: 'partner' }],
      { onConflict: 'baby_id,user_id' },
    );
  });

  it('does not create memberships when the baby INSERT fails', async () => {
    const error = { code: '42501', message: 'new row violates row-level security policy' };
    const chain = chainResolving({ data: null, error });
    mockedFrom.mockReturnValue(chain);

    expect(await createBaby({ name: 'Charlie' })).toEqual({ data: null, error });
    expect(mockedFrom).toHaveBeenCalledTimes(1);
    expect(mockedFrom).toHaveBeenCalledWith('baby_info');
    expect(chain.select).not.toHaveBeenCalled();
    expect(chain.upsert).not.toHaveBeenCalled();
  });
});
