import { getContractions, invalidateUserCache, supabase } from '../supabase';

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getUser: jest.fn(),
      onAuthStateChange: jest.fn(),
      startAutoRefresh: jest.fn(),
      stopAutoRefresh: jest.fn(),
    },
    rpc: jest.fn(),
    from: jest.fn(),
  }),
}));

const rpc = supabase.rpc as jest.Mock;
const from = supabase.from as jest.Mock;
const row = {
  id: 'contraction-1',
  start_time: '2026-09-10T10:00:00Z',
  end_time: '2026-09-10T10:01:00Z',
  duration: 60,
  intensity: 'mittel',
};
const legacyError = { code: '42803', message: 'column c.start_time must appear in GROUP BY' };

beforeEach(() => {
  jest.clearAllMocks();
  invalidateUserCache();
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'info').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

function fallback(error: unknown = null) {
  const query = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockResolvedValue({ data: error ? null : [row], error }),
  };
  from.mockReturnValue(query);
  return query;
}

it('normalizes RPC timestamps for the tracker and retains sync information', async () => {
  const syncInfo = { linkedUsers: [{ userId: 'partner-1' }] };
  rpc.mockResolvedValue({
    data: { contractions: [{ id: row.id, startTime: row.start_time, endTime: row.end_time, duration: 60 }], syncInfo },
    error: null,
  });

  const result = await getContractions();
  expect(result.data[0]).toMatchObject({ start_time: row.start_time, end_time: row.end_time, duration: 60 });
  expect(new Date(result.data[0].start_time).getTime()).toBe(Date.parse(row.start_time));
  expect(result.syncInfo).toEqual(syncInfo);
  expect(from).not.toHaveBeenCalled();
});

it('accepts snake_case timestamps and unfinished contractions', async () => {
  rpc.mockResolvedValue({ data: { contractions: [{ ...row, end_time: null }], syncInfo: {} }, error: null });
  expect((await getContractions()).data).toEqual([{ ...row, end_time: null }]);
});

it('recovers from the legacy SQL error without a warning overlay', async () => {
  rpc.mockResolvedValue({ data: null, error: legacyError });
  const query = fallback();

  expect(await getContractions()).toEqual({ data: [row], error: null });
  expect(from).toHaveBeenCalledWith('contractions');
  expect(query.eq).toHaveBeenCalledWith('user_id', 'user-1');
  expect(query.order).toHaveBeenCalledWith('start_time', { ascending: false });
  expect(console.warn).not.toHaveBeenCalled();
  expect(console.error).not.toHaveBeenCalled();
});

it('returns and reports a failed fallback', async () => {
  const error = { code: '42501', message: 'Permission denied' };
  rpc.mockResolvedValue({ data: null, error: legacyError });
  fallback(error);

  expect(await getContractions()).toEqual({ data: null, error });
  expect(console.error).toHaveBeenCalled();
});

it('does not query contractions without a signed-in user', async () => {
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: null }, error: null });
  expect((await getContractions()).error).toBeInstanceOf(Error);
  expect(rpc).not.toHaveBeenCalled();
  expect(from).not.toHaveBeenCalled();
});
