import { getCachedUser, supabase } from '@/lib/supabase';
import { DEFAULT_ADVISOR_SETTINGS, fetchAdvisorSettings, saveAdvisorSettings } from '../advisor/advisorStorage';

jest.mock('@/lib/supabase', () => ({ getCachedUser: jest.fn(), supabase: { from: jest.fn() } }));
const getUser = getCachedUser as jest.Mock;
const from = supabase.from as jest.Mock;
const query = { upsert: jest.fn(), select: jest.fn(), eq: jest.fn(), abortSignal: jest.fn(), single: jest.fn(), maybeSingle: jest.fn() };
beforeEach(() => {
  jest.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: 'user-a' } }, error: null });
  from.mockReturnValue(query);
  for (const fn of [query.upsert, query.select, query.eq, query.abortSignal]) fn.mockReturnValue(query);
});

it.each([
  [{ data: { user_id: 'user-a' }, error: null }, true],
  [{ data: null, error: { message: 'offline' } }, false],
  [{ data: null, error: null }, false],
  [{ data: { user_id: 'user-b' }, error: null }, false],
])('accepts only the confirmed account row: %j', async (result, saved) => {
  query.single.mockResolvedValue(result);
  expect(await saveAdvisorSettings(DEFAULT_ADVISOR_SETTINGS, { expectedUserId: 'user-a' })).toBe(saved);
});

it('returns a failure for thrown requests, missing authentication, and switched accounts', async () => {
  query.single.mockRejectedValueOnce(new Error('network disconnected'));
  expect(await saveAdvisorSettings(DEFAULT_ADVISOR_SETTINGS)).toBe(false);
  getUser.mockResolvedValueOnce({ data: { user: null } });
  expect(await saveAdvisorSettings(DEFAULT_ADVISOR_SETTINGS)).toBe(false);
  getUser.mockResolvedValueOnce({ data: { user: { id: 'user-b' } } });
  expect(await saveAdvisorSettings(DEFAULT_ADVISOR_SETTINGS, { expectedUserId: 'user-a' })).toBe(false);
  expect(query.upsert).toHaveBeenCalledTimes(1);
});

it('preserves an intentionally empty theme selection after loading', async () => {
  query.maybeSingle.mockResolvedValue({ data: { themes: [], enabled: true }, error: null });
  expect((await fetchAdvisorSettings('user-a')).themes).toEqual([]);
});

it('surfaces read errors and uses defaults only when there is no settings row', async () => {
  query.maybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'offline' } });
  await expect(fetchAdvisorSettings('user-a')).rejects.toEqual({ message: 'offline' });
  query.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
  expect(await fetchAdvisorSettings('user-a')).toEqual(DEFAULT_ADVISOR_SETTINGS);
});

it('passes cancellation to the write and never starts an already cancelled save', async () => {
  const request = new AbortController();
  query.single.mockResolvedValue({ data: { user_id: 'user-a' }, error: null });
  expect(await saveAdvisorSettings(DEFAULT_ADVISOR_SETTINGS, { signal: request.signal })).toBe(true);
  expect(query.abortSignal).toHaveBeenCalledWith(request.signal);
  request.abort();
  expect(await saveAdvisorSettings(DEFAULT_ADVISOR_SETTINGS, { signal: request.signal })).toBe(false);
  expect(query.upsert).toHaveBeenCalledTimes(1);
});
