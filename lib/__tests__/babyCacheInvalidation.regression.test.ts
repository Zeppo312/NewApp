import AsyncStorage from '@react-native-async-storage/async-storage';
import { getBabyInfo, type BabyInfo } from '../baby';
import { invalidateBabyCache, loadBabyInfoWithCache } from '../babyCache';
import {
  cacheData,
  CacheStrategy,
  invalidateCacheAfterAction,
  loadCachedData,
} from '../screenCache';

// Keep both cache modules real; only replace the backend I/O boundary.
// AsyncStorage uses the package's stateful mock from jest.setup.js.
jest.mock('../baby', () => ({ getBabyInfo: jest.fn() }));

const mockedGetBabyInfo = jest.mocked(getBabyInfo);
const babyA = 'qa-baby-a';
const keyA = `screen_cache_baby_info_${babyA}`;
const keyB = 'screen_cache_baby_info_qa-baby-b';
const oldProfile: BabyInfo = { id: babyA, name: 'Old profile' };
const freshProfile: BabyInfo = {
  id: babyA,
  name: 'Updated profile',
  birth_date: '2026-09-01T00:00:00.000Z',
  preferred_bedtime: '19:30',
  weight: '4200',
  height: '54',
  photo_url: null,
  baby_gender: 'unknown',
};

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  mockedGetBabyInfo.mockReset();
  mockedGetBabyInfo.mockResolvedValue({ data: freshProfile, error: null });
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('baby profile cache invalidation', () => {
  it('removes an existing entry stored under the original full key', async () => {
    await cacheData(keyA, oldProfile, CacheStrategy.LONG);
    expect(await loadCachedData(keyA)).toEqual(oldProfile);
    expect(await AsyncStorage.getItem(keyA)).not.toBeNull();

    await invalidateBabyCache(babyA);

    expect(await AsyncStorage.getItem(keyA)).toBeNull();
    expect(await loadCachedData(keyA)).toBeNull();
  });

  it('preserves baby B, another screen and entries sharing the key prefix', async () => {
    const unrelatedKeys = [keyB, 'screen_cache_daily_day_qa-baby-a', `${keyA}_other`];
    await cacheData(keyA, oldProfile, CacheStrategy.LONG);
    for (const key of unrelatedKeys) {
      await cacheData(key, { name: key }, CacheStrategy.LONG);
    }
    const before = await AsyncStorage.multiGet(unrelatedKeys);
    expect(before.every(([, value]) => value !== null)).toBe(true);

    await invalidateBabyCache(babyA);

    expect(await AsyncStorage.getItem(keyA)).toBeNull();
    expect(await AsyncStorage.multiGet(unrelatedKeys)).toEqual(before);
  });

  it('allows repeated invalidation and missing entries without errors', async () => {
    await cacheData(keyA, oldProfile, CacheStrategy.LONG);

    await expect(invalidateBabyCache(babyA)).resolves.toBeUndefined();
    await expect(invalidateBabyCache(babyA)).resolves.toBeUndefined();
    await expect(invalidateBabyCache('qa-missing')).resolves.toBeUndefined();

    expect(await AsyncStorage.getItem(keyA)).toBeNull();
    expect(console.error).not.toHaveBeenCalled();
  });

  it('reloads the fresh profile and caches it under the same key with LONG strategy', async () => {
    await cacheData(keyA, oldProfile, CacheStrategy.LONG);
    expect(await loadBabyInfoWithCache(babyA)).toMatchObject({ data: oldProfile, isStale: true });
    expect(mockedGetBabyInfo).not.toHaveBeenCalled();

    await invalidateBabyCache(babyA);
    const result = await loadBabyInfoWithCache(babyA);

    expect(result).toMatchObject({ data: freshProfile, isStale: false });
    expect(mockedGetBabyInfo).toHaveBeenCalledTimes(1);
    expect(mockedGetBabyInfo).toHaveBeenCalledWith(babyA);
    expect(await loadCachedData(keyA)).toEqual(freshProfile);
    expect(JSON.parse((await AsyncStorage.getItem(keyA))!)).toMatchObject({
      strategy: CacheStrategy.LONG,
      version: '1.0.0',
    });
    expect(await AsyncStorage.getAllKeys()).toEqual([keyA]);
  });

  it('does not return the old profile while the next fetch is delayed', async () => {
    await cacheData(keyA, oldProfile, CacheStrategy.LONG);
    await invalidateBabyCache(babyA);
    type FetchResult = Awaited<ReturnType<typeof getBabyInfo>>;
    let finishFetch!: (value: FetchResult) => void;
    let markFetchStarted!: () => void;
    const pendingFetch = new Promise<FetchResult>((resolve) => { finishFetch = resolve; });
    const fetchStarted = new Promise<void>((resolve) => { markFetchStarted = resolve; });
    mockedGetBabyInfo.mockImplementationOnce(() => {
      markFetchStarted();
      return pendingFetch;
    });
    let loaded: unknown;
    const loading = loadBabyInfoWithCache(babyA).then((result) => { loaded = result; return result; });

    // Drain the already queued cache-read continuations before releasing I/O.
    await AsyncStorage.getItem(keyA);
    expect(loaded).toBeUndefined();
    expect(await AsyncStorage.getItem(keyA)).toBeNull();
    // This assertion also fails promptly if the old cache bypasses the fetch.
    expect(mockedGetBabyInfo).toHaveBeenCalledWith(babyA);
    await fetchStarted;
    finishFetch({ data: freshProfile, error: null });

    expect(await loading).toMatchObject({ data: freshProfile, isStale: false });
  });

  it('propagates a failed reload without restoring old cache data and permits retry', async () => {
    await cacheData(keyA, oldProfile, CacheStrategy.LONG);
    await invalidateBabyCache(babyA);
    const error = new Error('Synthetic offline reload failure');
    mockedGetBabyInfo.mockResolvedValueOnce({ data: null, error });

    await expect(loadBabyInfoWithCache(babyA)).rejects.toBe(error);
    expect(await AsyncStorage.getItem(keyA)).toBeNull();
    expect(await loadCachedData(keyA)).toBeNull();
    expect(await loadBabyInfoWithCache(babyA)).toMatchObject({ data: freshProfile, isStale: false });
  });
});

describe('existing logical screen-key contract', () => {
  it.each([
    'sleep_history_supabase_qa-baby-a',
    'pregnancy_profile_qa-user',
    'daily_day_qa-baby-a',
  ])('invalidates the exact key and descendants for %s only', async (screenKey) => {
    const exactKey = `screen_cache_${screenKey}`;
    const childKey = `${exactKey}_2026-10-15`;
    const neighboringKey = `${exactKey}-other`;
    for (const key of [exactKey, childKey, neighboringKey, keyB]) {
      await cacheData(key, { key }, CacheStrategy.MEDIUM);
    }
    const preserved = await AsyncStorage.multiGet([neighboringKey, keyB]);

    await invalidateCacheAfterAction(screenKey);

    expect(await AsyncStorage.getItem(exactKey)).toBeNull();
    expect(await AsyncStorage.getItem(childKey)).toBeNull();
    expect(await AsyncStorage.multiGet([neighboringKey, keyB])).toEqual(preserved);
  });
});
