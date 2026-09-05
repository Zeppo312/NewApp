import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getCachedUserProfile,
  getCachedUserSettings,
  invalidateAllCaches,
  preloadAppData,
} from '../appCache';

const createDeferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

const profileQuery = {
  maybeSingle: jest.fn(),
};

const settingsQuery = {
  maybeSingle: jest.fn(),
};

jest.mock('../supabase', () => ({
  getCachedUser: jest.fn(),
  supabase: {
    from: jest.fn(),
  },
}));

jest.mock('../revenuecat', () => ({
  getRevenueCatEntitlementStatus: jest.fn(),
}));

const { getCachedUser: mockGetCachedUser, supabase: mockSupabase } =
  jest.requireMock('../supabase');

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  await invalidateAllCaches();

  mockGetCachedUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });

  mockSupabase.from.mockImplementation((table: string) => {
    if (table === 'profiles') {
      return { select: () => ({ eq: () => profileQuery }) };
    }
    return {
      select: () => ({
        eq: () => ({ order: () => ({ limit: () => settingsQuery }) }),
      }),
    };
  });
});

describe('startup preload', () => {
  it('laedt Settings und Profil fuer die uebergebene ID', async () => {
    settingsQuery.maybeSingle.mockResolvedValue({ data: { theme: 'light' }, error: null });
    profileQuery.maybeSingle.mockResolvedValue({ data: { id: 'user-1' }, error: null });

    await preloadAppData('user-1');

    expect(mockSupabase.from).toHaveBeenCalledWith('user_settings');
    expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
  });

  it('loest die User-ID in den Gettern nicht erneut ueber getCachedUser auf', async () => {
    // Kern des Startpatches: mit durchgereichter ID entfaellt der
    // getUser()-Roundtrip in beiden Gettern.
    settingsQuery.maybeSingle.mockResolvedValue({ data: { theme: 'light' }, error: null });
    profileQuery.maybeSingle.mockResolvedValue({ data: { id: 'user-1' }, error: null });

    await getCachedUserSettings('user-1');
    await getCachedUserProfile('user-1');

    expect(mockGetCachedUser).not.toHaveBeenCalled();
    expect(mockSupabase.from).toHaveBeenCalledWith('user_settings');
    expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
  });

  it('faellt ohne uebergebene ID auf getCachedUser zurueck', async () => {
    settingsQuery.maybeSingle.mockResolvedValue({ data: {}, error: null });
    profileQuery.maybeSingle.mockResolvedValue({ data: null, error: null });

    await preloadAppData();

    expect(mockGetCachedUser).toHaveBeenCalled();
  });

  it('startet ohne Nutzer keine Abfragen', async () => {
    mockGetCachedUser.mockResolvedValue({ data: { user: null }, error: null });

    await preloadAppData();

    expect(mockSupabase.from).not.toHaveBeenCalled();
  });
});

describe('in-flight deduplication', () => {
  it('buendelt parallele Settings-Abfragen zu einem Request', async () => {
    const deferred = createDeferred<{ data: unknown; error: null }>();
    settingsQuery.maybeSingle.mockReturnValue(deferred.promise);

    const first = getCachedUserSettings('user-1');
    const second = getCachedUserSettings('user-1');

    deferred.resolve({ data: { theme: 'dark' }, error: null });

    const [a, b] = await Promise.all([first, second]);

    expect(settingsQuery.maybeSingle).toHaveBeenCalledTimes(1);
    expect(a).toEqual({ theme: 'dark' });
    expect(b).toEqual({ theme: 'dark' });
  });

  it('buendelt parallele Profil-Abfragen zu einem Request', async () => {
    const deferred = createDeferred<{ data: unknown; error: null }>();
    profileQuery.maybeSingle.mockReturnValue(deferred.promise);

    const first = getCachedUserProfile('user-1');
    const second = getCachedUserProfile('user-1');

    deferred.resolve({ data: { id: 'user-1' }, error: null });
    await Promise.all([first, second]);

    expect(profileQuery.maybeSingle).toHaveBeenCalledTimes(1);
  });

  it('haelt Requests verschiedener Nutzer getrennt', async () => {
    settingsQuery.maybeSingle
      .mockResolvedValueOnce({ data: { theme: 'a' }, error: null })
      .mockResolvedValueOnce({ data: { theme: 'b' }, error: null });

    const [a, b] = await Promise.all([
      getCachedUserSettings('user-1'),
      getCachedUserSettings('user-2'),
    ]);

    expect(settingsQuery.maybeSingle).toHaveBeenCalledTimes(2);
    expect(a).toEqual({ theme: 'a' });
    expect(b).toEqual({ theme: 'b' });
  });

  it('laesst ein spaetes finally den Nachfolger-Request nicht abraeumen', async () => {
    // A startet, wird invalidiert, B startet, erst danach faellt A's finally an.
    // Loescht A blind den Key, startet C einen dritten Request statt B beizutreten.
    const requestA = createDeferred<{ data: unknown; error: null }>();
    const requestB = createDeferred<{ data: unknown; error: null }>();
    settingsQuery.maybeSingle
      .mockReturnValueOnce(requestA.promise)
      .mockReturnValueOnce(requestB.promise);

    const callA = getCachedUserSettings('user-1');

    await invalidateAllCaches();
    await AsyncStorage.clear();

    const callB = getCachedUserSettings('user-1');

    // A antwortet erst jetzt und raeumt sein finally ab.
    requestA.resolve({ data: { theme: 'a' }, error: null });
    await callA;

    // C muss sich an den laufenden Request B haengen.
    const callC = getCachedUserSettings('user-1');

    requestB.resolve({ data: { theme: 'b' }, error: null });
    const [b, c] = await Promise.all([callB, callC]);

    expect(settingsQuery.maybeSingle).toHaveBeenCalledTimes(2);
    expect(b).toEqual({ theme: 'b' });
    expect(c).toEqual({ theme: 'b' });
  });

  it('schreibt eine Antwort aus invalidierter Generation nicht in den Cache', async () => {
    const stale = createDeferred<{ data: unknown; error: null }>();
    settingsQuery.maybeSingle.mockReturnValueOnce(stale.promise);

    const staleCall = getCachedUserSettings('user-1');

    await invalidateAllCaches();
    await AsyncStorage.clear();

    // Die alte Antwort trifft erst nach der Invalidierung ein.
    stale.resolve({ data: { theme: 'veraltet' }, error: null });
    await staleCall;

    settingsQuery.maybeSingle.mockResolvedValueOnce({ data: { theme: 'frisch' }, error: null });
    const fresh = await getCachedUserSettings('user-1');

    expect(fresh).toEqual({ theme: 'frisch' });
    expect(settingsQuery.maybeSingle).toHaveBeenCalledTimes(2);
  });

  it('schreibt ein Profil aus invalidierter Generation nicht in den Cache', async () => {
    const stale = createDeferred<{ data: unknown; error: null }>();
    profileQuery.maybeSingle.mockReturnValueOnce(stale.promise);

    const staleCall = getCachedUserProfile('user-1');

    await invalidateAllCaches();
    await AsyncStorage.clear();

    stale.resolve({ data: { id: 'user-1', paywall_access_role: 'veraltet' }, error: null });
    await staleCall;

    profileQuery.maybeSingle.mockResolvedValueOnce({
      data: { id: 'user-1', paywall_access_role: 'frisch' },
      error: null,
    });
    const fresh = await getCachedUserProfile('user-1');

    expect(fresh).toEqual({ id: 'user-1', paywall_access_role: 'frisch' });
    expect(profileQuery.maybeSingle).toHaveBeenCalledTimes(2);
  });

  it('startet nach abgeschlossenem Request wieder frisch', async () => {
    settingsQuery.maybeSingle.mockResolvedValue({ data: { theme: 'light' }, error: null });

    await getCachedUserSettings('user-1');
    await invalidateAllCaches();
    await AsyncStorage.clear();
    await getCachedUserSettings('user-1');

    expect(settingsQuery.maybeSingle).toHaveBeenCalledTimes(2);
  });
});
