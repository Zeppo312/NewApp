import AsyncStorage from '@react-native-async-storage/async-storage';
import { listBabies } from '../baby';
import { refreshBabyListWithRetry, isTransientBabyListError } from '../babyListLoading';
import { getCachedUser, supabase } from '../supabase';

jest.mock('../dataConsentRuntime', () => ({ getRuntimeDataConsents: () => ({ userId:'user', generation:0 }), runtimeConsentAllowed: () => true }));
jest.mock('../supabase', () => ({ supabaseUrl:'https://fixture.supabase.co', supabase: { from: jest.fn() }, getCachedUser: jest.fn() }));

const levi = { id: 'levi', name: 'Levi', birth_date: '2024-01-01' };
const pregnancy = { id: 'pregnancy', name: 'Schwangerschaft', birth_date: null };
const timeout = { code: '57014', message: 'canceling statement due to statement timeout' };
const cacheKey = 'baby_list_cache_v1_user';
const from = jest.mocked(supabase.from);
const user = jest.mocked(getCachedUser);

function queue(...responses: { data: unknown; error: unknown; status?: number }[]) {
  for (const response of responses) {
    const chain: any = {};
    for (const method of ['select', 'eq', 'order', 'abortSignal']) chain[method] = jest.fn(() => chain);
    chain.then = (resolve: any, reject: any) => Promise.resolve(response).then(resolve, reject);
    from.mockReturnValueOnce(chain);
  }
}

beforeEach(async () => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  from.mockReset();
  user.mockReset();
  user.mockResolvedValue({ data: { user: { id: 'user' } }, error: null } as any);
  await AsyncStorage.clear();
});
afterEach(() => { jest.useRealTimers(); });

it('merges both complete results, deduplicates and caches the full list', async () => {
  queue({ data: [levi, pregnancy], error: null }, { data: [levi], error: null });
  const result = await listBabies(true);
  expect(result.data).toEqual([levi, pregnancy]);
  expect(result.error).toBeNull();
  expect(JSON.parse((await AsyncStorage.getItem(cacheKey))!).data).toEqual([levi, pregnancy]);
});

it.each(['member', 'owned'])('propagates a failed %s query despite surviving Levi and preserves the previous cache', async (failed) => {
  const previous = JSON.stringify({ data: [levi, pregnancy], timestamp: Date.now() });
  await AsyncStorage.setItem(cacheKey, previous);
  const success = { data: [levi], error: null };
  const failure = { data: null, error: timeout, status: 500 };
  queue(...(failed === 'member' ? [failure, success] : [success, failure]));
  const result = await listBabies(true);
  expect(result).toMatchObject({ data: null, error: timeout, retryable: true });
  expect(await AsyncStorage.getItem(cacheKey)).toBe(previous);
});

it('bypasses a previously shortened cache on forced refresh', async () => {
  await AsyncStorage.setItem(cacheKey, JSON.stringify({ data: [levi], timestamp: Date.now() }));
  queue({ data: [levi, pregnancy], error: null }, { data: [levi], error: null });
  expect((await listBabies(true)).data).toEqual([levi, pregnancy]);
  expect(from).toHaveBeenCalledTimes(2);
});

it('recovers the missing pregnancy after a transient failure', async () => {
  queue(
    { data: null, error: timeout }, { data: [levi], error: null },
    { data: [levi, pregnancy], error: null }, { data: [levi], error: null },
  );
  const pending = refreshBabyListWithRetry((signal) => listBabies(true, signal), new AbortController().signal);
  await jest.advanceTimersByTimeAsync(500);
  expect((await pending).data).toEqual([levi, pregnancy]);
  expect(from).toHaveBeenCalledTimes(4);
});

it('stops after two retries and does not cache a partial result', async () => {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    queue({ data: null, error: timeout }, { data: [levi], error: null });
  }
  const pending = refreshBabyListWithRetry((signal) => listBabies(true, signal), new AbortController().signal);
  await jest.advanceTimersByTimeAsync(2000);
  expect(await pending).toMatchObject({ data: null, error: timeout, retryable: true });
  expect(from).toHaveBeenCalledTimes(6);
  expect(await AsyncStorage.getItem(cacheKey)).toBeNull();
  expect(jest.getTimerCount()).toBe(0);
});

it('does not retry or mask a permanent failure when the other query also times out', async () => {
  const forbidden = { code: '42501', message: 'permission denied' };
  queue({ data: null, error: timeout, status: 500 }, { data: null, error: forbidden, status: 403 });
  const result = await refreshBabyListWithRetry((signal) => listBabies(true, signal), new AbortController().signal);
  expect(result).toMatchObject({ error: forbidden, retryable: false });
  expect(from).toHaveBeenCalledTimes(2);
  expect(jest.getTimerCount()).toBe(0);
});

it('retains the real auth network error for a retry instead of calling it a missing login', async () => {
  const offline = new Error('Network request failed');
  user.mockResolvedValueOnce({ data: { user: null }, error: offline } as any);
  queue({ data: [levi, pregnancy], error: null }, { data: [levi], error: null });
  const pending = refreshBabyListWithRetry((signal) => listBabies(true, signal), new AbortController().signal);
  await jest.advanceTimersByTimeAsync(500);
  expect((await pending).data).toEqual([levi, pregnancy]);
  expect(user).toHaveBeenCalledTimes(2);
});

it.each([
  { name: 'DataConsentRequiredError', message: 'health_consent_required' },
  { message: 'DataConsentRequiredError: health_consent_required' },
  { name: 'AbortError', message: 'Request aborted' },
  { code: '42501', message: 'permission denied', status: 500 },
  { code: '42P01', message: 'relation missing', status: 500 },
  { message: 'Authentication failed', status: 401 },
])('does not treat explicit cancellation, consent or access errors as transient: %j', (error) => {
  expect(isTransientBabyListError(error)).toBe(false);
});

it('bounds hung requests and ignores their late results after timeout', async () => {
  let late!: (value: any) => void;
  const hung = new Promise<any>((resolve) => { late = resolve; });
  const signals: AbortSignal[] = [];
  const load = jest.fn((signal: AbortSignal) => { signals.push(signal); return hung; });
  const pending = refreshBabyListWithRetry(load, new AbortController().signal);
  await jest.advanceTimersByTimeAsync(32_000);
  expect(await pending).toMatchObject({ data: null, retryable: true });
  expect(load).toHaveBeenCalledTimes(3);
  expect(signals.every((signal) => signal.aborted)).toBe(true);
  late({ data: [levi, pregnancy], error: null });
  await Promise.resolve();
  expect(jest.getTimerCount()).toBe(0);
});

it('cancels pending backoff immediately without starting another request', async () => {
  const controller = new AbortController();
  const load = jest.fn().mockResolvedValue({ data: null, error: timeout, retryable: true });
  const pending = refreshBabyListWithRetry(load, controller.signal);
  await jest.advanceTimersByTimeAsync(0);
  controller.abort();
  expect(await pending).toMatchObject({ data: null, retryable: false });
  expect(load).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
});

it('does not save the late result of an aborted database request', async () => {
  const controller = new AbortController();
  let resolve!: (result: any) => void;
  const response = new Promise((done) => { resolve = done; });
  const chain: any = {};
  for (const method of ['select', 'eq', 'order', 'abortSignal']) chain[method] = jest.fn(() => chain);
  chain.then = (done: any) => response.then(done);
  from.mockReturnValue(chain);
  const pending = listBabies(true, controller.signal);
  await jest.advanceTimersByTimeAsync(0);
  expect(from).toHaveBeenCalledTimes(2);
  controller.abort();
  resolve({ data: [levi, pregnancy], error: null });
  expect((await pending).error).toBeTruthy();
  expect(await AsyncStorage.getItem(cacheKey)).toBeNull();
});

it('does not start an already cancelled refresh', async () => {
  const controller = new AbortController();
  const load = jest.fn().mockResolvedValue({ data: [levi], error: null });
  const pending = refreshBabyListWithRetry(load, controller.signal);
  controller.abort();
  expect((await pending).error).toBeTruthy();
  expect(load).not.toHaveBeenCalled();
  expect(jest.getTimerCount()).toBe(0);
});
