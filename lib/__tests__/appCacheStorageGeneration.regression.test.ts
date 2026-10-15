import type AsyncStorage from '@react-native-async-storage/async-storage';
import { DATA_CONSENT_VERSION, type DataConsentSnapshot } from '../dataConsentTypes';

jest.mock('../supabase', () => ({
  getCachedUser: jest.fn(),
  supabase: { from: jest.fn() },
}));
jest.mock('../revenuecat', () => ({ getRevenueCatEntitlementStatus: jest.fn() }));
jest.mock('../familySubscriptionAccess', () => ({ refreshFamilyAccess: jest.fn() }));

let cache: typeof import('../appCache');
let consent: typeof import('../dataConsentRuntime');
let storage: typeof AsyncStorage;
let query: { maybeSingle: jest.Mock };
let from: jest.Mock;
const originalConsentFlag = process.env.EXPO_PUBLIC_DATA_CONSENTS_ENABLED;

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

const grantConsent = (userId: string) => {
  const snapshot: DataConsentSnapshot = {
    enabled: true, userId, revision: 1, documentVersion: DATA_CONSENT_VERSION,
    healthAllowed: true, aiAllowed: false, ai: null,
    health: { decision: 'granted', documentVersion: DATA_CONSENT_VERSION, decidedAt: '2026-10-15T00:00:00Z' },
  };
  consent.setConsentIdentity(userId);
  consent.setRuntimeDataConsents(snapshot);
};

const persist = (key: string, data: object, timestamp = Date.now()) =>
  storage.setItem(key, JSON.stringify({ data, timestamp }));

// Exercise the real appCache module through its AsyncStorage import. Only the
// native adapter is Jest's official AsyncStorage adapter (jest.setup.js).
// Capture the actual stored value before delaying its delivery across eviction.
const holdReads = (key: string, count = 1) => {
  const gates = Array.from({ length: count }, () => ({
    entered: deferred<void>(), release: deferred<void>(),
  }));
  const getItem = jest.mocked(storage.getItem).getMockImplementation()!;
  let next = 0;
  const spy = jest.spyOn(storage, 'getItem').mockImplementation(async (readKey) => {
    const gate = readKey === key ? gates[next++] : undefined;
    const value = await getItem(readKey);
    if (gate) {
      gate.entered.resolve();
      await gate.release.promise;
    }
    return value;
  });
  return { gates, readCount: () => spy.mock.calls.filter(([readKey]) => readKey === key).length };
};

beforeEach(async () => {
  jest.resetModules();
  process.env.EXPO_PUBLIC_DATA_CONSENTS_ENABLED = 'true';
  storage = jest.requireMock('@react-native-async-storage/async-storage');
  consent = jest.requireActual('../dataConsentRuntime');
  cache = jest.requireActual('../appCache');
  grantConsent('user-a');
  jest.spyOn(console, 'log').mockImplementation(() => {});
  await storage.clear();
  await cache.invalidateAllCaches();
  const mocks = jest.requireMock('../supabase');
  mocks.getCachedUser.mockResolvedValue({ data: { user: { id: 'user-a' } }, error: null });
  query = { maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }) };
  const chain = {
    select: () => chain, eq: () => chain, order: () => chain,
    limit: () => chain, maybeSingle: query.maybeSingle,
  };
  from = mocks.supabase.from.mockReturnValue(chain);
});

afterEach(() => {
  jest.restoreAllMocks();
  if (originalConsentFlag === undefined) delete process.env.EXPO_PUBLIC_DATA_CONSENTS_ENABLED;
  else process.env.EXPO_PUBLIC_DATA_CONSENTS_ENABLED = originalConsentFlag;
});

const cases = [
  {
    name: 'settings', prefix: 'cache_user_settings',
    read: (id: string) => cache.getCachedUserSettings(id),
    invalidate: () => cache.invalidateUserSettingsCache(),
    old: { theme: 'old' }, fresh: { theme: 'fresh' },
  },
  {
    name: 'profile', prefix: 'cache_user_profile',
    read: (id: string) => cache.getCachedUserProfile(id),
    invalidate: () => cache.invalidateUserProfileCache(),
    old: { id: 'user-a', first_name: 'Old' }, fresh: { id: 'user-a', first_name: 'Fresh' },
  },
];

describe.each(cases)('$name storage generation', (entry) => {
  const key = `${entry.prefix}:user-a`;

  it('starts a fresh read after targeted invalidation instead of joining obsolete A', async () => {
    await persist(key, entry.old);
    const { gates: [a] } = holdReads(key);
    const callA = entry.read('user-a');
    await a.entered.promise;
    await entry.invalidate();
    await persist(key, entry.fresh);
    const callB = entry.read('user-a');
    a.release.resolve();

    expect(await callA).toBeNull();
    expect(await callB).toEqual(entry.fresh);
    expect(await entry.read('user-a')).toEqual(entry.fresh);
    expect(from).not.toHaveBeenCalled();
  });

  it('keeps fresh B deduplicated when A finishes after targeted invalidation', async () => {
    await persist(key, entry.old);
    const { gates: [a, b], readCount } = holdReads(key, 2);
    const callA = entry.read('user-a');
    await a.entered.promise;
    await entry.invalidate();
    await persist(key, entry.fresh);
    const callB = entry.read('user-a');
    // Check before waiting: a stale dedupe entry must fail this assertion,
    // rather than hanging forever waiting for B's storage access to begin.
    expect(readCount()).toBe(2);
    await b.entered.promise;
    a.release.resolve();
    expect(await callA).toBeNull();
    expect(cache.getCacheStats().keys).not.toContain(key);

    const callC = entry.read('user-a');
    b.release.resolve();
    expect(await Promise.all([callB, callC])).toEqual([entry.fresh, entry.fresh]);
    expect(readCount()).toBe(2);
    expect(JSON.parse((await storage.getItem(key))!).data).toEqual(entry.fresh);
    expect(from).not.toHaveBeenCalled();
  });

  it('starts a fresh network fallback after targeted invalidation of a running fallback', async () => {
    const entered = deferred<void>();
    const resultA = deferred<{ data: object; error: null }>();
    query.maybeSingle
      .mockImplementationOnce(() => { entered.resolve(); return resultA.promise; })
      .mockResolvedValueOnce({ data: entry.fresh, error: null });
    const callA = entry.read('user-a');
    await entered.promise;
    await entry.invalidate();
    const callB = entry.read('user-a');
    resultA.resolve({ data: entry.old, error: null });

    expect(await callA).toBeNull();
    expect(await callB).toEqual(entry.fresh);
    expect(query.maybeSingle).toHaveBeenCalledTimes(2);
    expect(await entry.read('user-a')).toEqual(entry.fresh);
    expect(JSON.parse((await storage.getItem(key))!).data).toEqual(entry.fresh);
  });

  it('discards a disk read delivered after full invalidation, including for the next caller', async () => {
    await persist(key, entry.old);
    const { gates: [a] } = holdReads(key);
    const callA = entry.read('user-a');
    await a.entered.promise;
    await cache.invalidateAllCaches();
    a.release.resolve();

    expect(await callA).toBeNull();
    expect(cache.getCacheStats().keys).not.toContain(key);
    expect(await storage.getItem(key)).toBeNull();
    await persist(key, entry.fresh);
    expect(await entry.read('user-a')).toEqual(entry.fresh);
    expect(from).not.toHaveBeenCalled();
  });

  it('keeps B and its deduplication entry when invalidated A finishes later', async () => {
    await persist(key, entry.old);
    const { gates: [a, b], readCount } = holdReads(key, 2);
    const callA = entry.read('user-a');
    await a.entered.promise;
    await cache.invalidateAllCaches();
    await persist(key, entry.fresh);
    const callB = entry.read('user-a');
    await b.entered.promise;
    a.release.resolve();
    expect(await callA).toBeNull();
    expect(cache.getCacheStats().keys).not.toContain(key);

    const callC = entry.read('user-a');
    b.release.resolve();
    expect(await Promise.all([callB, callC])).toEqual([entry.fresh, entry.fresh]);
    expect(readCount()).toBe(2);
    expect(await entry.read('user-a')).toEqual(entry.fresh);
    expect(JSON.parse((await storage.getItem(key))!).data).toEqual(entry.fresh);
    expect(from).not.toHaveBeenCalled();
  });

  it('does not let an expired read from A remove the newer storage value', async () => {
    await persist(key, entry.old, Date.now() - 60 * 60 * 1000);
    const { gates: [a] } = holdReads(key);
    const callA = entry.read('user-a');
    await a.entered.promise;
    await cache.invalidateAllCaches();
    await persist(key, entry.fresh);
    a.release.resolve();

    expect(await callA).toBeNull();
    expect(JSON.parse((await storage.getItem(key))!).data).toEqual(entry.fresh);
    expect(from).not.toHaveBeenCalled();
  });

  it('uses valid persisted data and bundles parallel reads without invalidation', async () => {
    await persist(key, entry.fresh);
    const { gates: [a], readCount } = holdReads(key);
    const first = entry.read('user-a');
    await a.entered.promise;
    const second = entry.read('user-a');
    a.release.resolve();

    expect(await Promise.all([first, second])).toEqual([entry.fresh, entry.fresh]);
    expect(await entry.read('user-a')).toEqual(entry.fresh);
    expect(readCount()).toBe(1);
    expect(from).not.toHaveBeenCalled();
  });

  it.each(['missing', 'malformed', 'failed'])('does not start an unbound fallback after an invalidated %s disk read', async (kind) => {
    if (kind === 'malformed') await storage.setItem(key, 'invalid-json');
    const { gates: [a] } = holdReads(key);
    query.maybeSingle.mockResolvedValue({ data: entry.old, error: null });
    const callA = entry.read('user-a');
    await a.entered.promise;
    await cache.invalidateAllCaches();
    if (kind === 'failed') a.release.reject(new Error('synthetic storage error'));
    else a.release.resolve();

    expect(await callA).toBeNull();
    expect(from).not.toHaveBeenCalled();
    expect(cache.getCacheStats().keys).not.toContain(key);
    expect(await storage.getItem(key)).toBeNull();
  });

  it('rejects a late network fallback as well as its cache writes', async () => {
    const entered = deferred<void>();
    const result = deferred<{ data: object; error: null }>();
    query.maybeSingle.mockImplementation(() => { entered.resolve(); return result.promise; });
    const callA = entry.read('user-a');
    await entered.promise;
    await cache.invalidateAllCaches();
    result.resolve({ data: entry.old, error: null });

    expect(await callA).toBeNull();
    expect(cache.getCacheStats().keys).not.toContain(key);
    expect(await storage.getItem(key)).toBeNull();

    query.maybeSingle.mockResolvedValueOnce({ data: entry.fresh, error: null });
    expect(await entry.read('user-a')).toEqual(entry.fresh);
    expect(query.maybeSingle).toHaveBeenCalledTimes(2);
  });

  it('rejects a disk read after a real runtime consent withdrawal', async () => {
    await persist(key, entry.old);
    const { gates: [a] } = holdReads(key);
    const callA = entry.read('user-a');
    await a.entered.promise;
    consent.setPendingConsentWithdrawal(['health']);
    expect(consent.runtimeConsentAllowed('health')).toBe(false);
    a.release.resolve();

    expect(await callA).toBeNull();
    expect(cache.getCacheStats().keys).not.toContain(key);
    expect(from).not.toHaveBeenCalled();
  });

  it('binds an in-progress disk read to the runtime identity and keeps user keys separate', async () => {
    await persist(key, entry.old);
    const keyB = `${entry.prefix}:user-b`;
    const dataB = { ...entry.fresh, id: 'user-b' };
    await persist(keyB, dataB);
    const { gates: [a] } = holdReads(key);
    const callA = entry.read('user-a');
    await a.entered.promise;
    grantConsent('user-b');
    expect(await entry.read('user-b')).toEqual(dataB);
    a.release.resolve();

    expect(await callA).toBeNull();
    expect(cache.getCacheStats().keys).toEqual([keyB]);
    expect(await entry.read('user-b')).toEqual(dataB);
    expect(from).not.toHaveBeenCalled();
  });

  it('preserves the local consent barrier and the existing network return contract', async () => {
    await persist(key, entry.old);
    expect(await entry.read('user-a')).toEqual(entry.old);
    consent.setPendingConsentWithdrawal(['health']);
    query.maybeSingle.mockResolvedValue({ data: entry.fresh, error: null });
    const getItem = jest.spyOn(storage, 'getItem').mockClear();
    const setItem = jest.spyOn(storage, 'setItem').mockClear();

    expect(await entry.read('user-a')).toEqual(entry.fresh);
    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    expect(from).toHaveBeenCalledTimes(1);
  });
});
