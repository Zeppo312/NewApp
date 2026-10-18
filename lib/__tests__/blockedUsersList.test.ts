jest.mock('../supabase', () => ({
  supabase: {
    auth: { getUser: jest.fn() },
    rpc: jest.fn(),
    from: jest.fn(),
  },
  getCachedUser: jest.fn(),
}));

import { getBlockedUsers } from '../moderation';
import { getCachedUser, supabase } from '../supabase';

const mockGetCachedUser = getCachedUser as jest.Mock;
const mockRpc = supabase.rpc as jest.Mock;
const mockFrom = supabase.from as jest.Mock;

const blockRow = { blocked_id: 'blocked-1', created_at: '2026-08-20T10:00:00.000Z' };

const mockTables = (profilesResult: { data: unknown; error: unknown }) => {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'user_blocks') {
      return {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(async () => ({ data: [blockRow], error: null })),
          })),
        })),
      };
    }

    if (table === 'profiles') {
      return {
        select: jest.fn(() => ({
          in: jest.fn(async () => profilesResult),
        })),
      };
    }

    throw new Error(`unexpected table ${table}`);
  });
};

describe('getBlockedUsers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCachedUser.mockResolvedValue({ data: { user: { id: 'me' } } });
    mockRpc.mockResolvedValue({ data: [], error: null });
  });

  it('nutzt den Profilnamen, wenn die Tabelle ihn herausgibt', async () => {
    mockTables({
      data: [{ id: 'blocked-1', username: 'levi', first_name: 'Levi', last_name: 'Z', avatar_url: null }],
      error: null,
    });

    await expect(getBlockedUsers()).resolves.toEqual([
      { id: 'blocked-1', name: 'levi', avatar_url: null, created_at: blockRow.created_at },
    ]);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('lädt den Namen per RPC nach, wenn RLS das Profil verbirgt', async () => {
    mockTables({ data: [], error: null });
    mockRpc.mockResolvedValue({
      data: [
        {
          id: 'blocked-1',
          first_name: 'Levi',
          last_name: 'Zeppenfeld',
          username: null,
          avatar_url: 'https://example.test/avatar.png',
        },
      ],
      error: null,
    });

    await expect(getBlockedUsers()).resolves.toEqual([
      {
        id: 'blocked-1',
        name: 'Levi Zeppenfeld',
        avatar_url: 'https://example.test/avatar.png',
        created_at: blockRow.created_at,
      },
    ]);
    expect(mockRpc).toHaveBeenCalledWith('get_user_profile', { user_id_param: 'blocked-1' });
  });

  it('liefert name = null, wenn auch die RPC nichts findet', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockTables({ data: null, error: { message: 'permission denied' } });
    mockRpc.mockResolvedValue({ data: [], error: null });

    await expect(getBlockedUsers()).resolves.toEqual([
      { id: 'blocked-1', name: null, avatar_url: null, created_at: blockRow.created_at },
    ]);

    errorSpy.mockRestore();
  });
});
