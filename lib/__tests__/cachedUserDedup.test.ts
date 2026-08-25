const mockAuthGetUser = jest.fn();
const mockOnAuthStateChange = jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } }));

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { getUser: mockAuthGetUser, onAuthStateChange: mockOnAuthStateChange },
    from: jest.fn(),
  }),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

const createDeferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const userResult = (id: string) => ({ data: { user: { id } }, error: null });

let supabaseLib: typeof import('../supabase');

beforeEach(() => {
  jest.resetModules();
  mockAuthGetUser.mockReset();
  supabaseLib = require('../supabase');
});

describe('getCachedUser in-flight deduplication', () => {
  it('buendelt sieben parallele Aufrufe zu genau einem auth.getUser()', async () => {
    const deferred = createDeferred<ReturnType<typeof userResult>>();
    mockAuthGetUser.mockReturnValue(deferred.promise);

    const calls = Array.from({ length: 7 }, () => supabaseLib.getCachedUser());
    deferred.resolve(userResult('user-1'));
    const results = await Promise.all(calls);

    expect(mockAuthGetUser).toHaveBeenCalledTimes(1);
    for (const result of results) {
      expect(result.data.user).toEqual({ id: 'user-1' });
    }
  });

  it('bedient Folgeaufrufe aus dem Cache, ohne erneut zu fragen', async () => {
    mockAuthGetUser.mockResolvedValue(userResult('user-1'));

    await supabaseLib.getCachedUser();
    await supabaseLib.getCachedUser();

    expect(mockAuthGetUser).toHaveBeenCalledTimes(1);
  });

  it('versucht es nach einem Fehler erneut', async () => {
    mockAuthGetUser
      .mockResolvedValueOnce({ data: { user: null }, error: { message: 'offline' } })
      .mockResolvedValueOnce(userResult('user-1'));

    const first = await supabaseLib.getCachedUser();
    expect(first.error).toBeTruthy();

    const second = await supabaseLib.getCachedUser();

    expect(mockAuthGetUser).toHaveBeenCalledTimes(2);
    expect(second.data.user).toEqual({ id: 'user-1' });
  });

  it('versucht es nach einer abgelehnten Anfrage erneut', async () => {
    mockAuthGetUser
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(userResult('user-1'));

    await expect(supabaseLib.getCachedUser()).rejects.toThrow('network down');
    const second = await supabaseLib.getCachedUser();

    expect(mockAuthGetUser).toHaveBeenCalledTimes(2);
    expect(second.data.user).toEqual({ id: 'user-1' });
  });
});

describe('generation guard', () => {
  it('cacht das Ergebnis nicht, wenn waehrend des Requests invalidiert wurde', async () => {
    const deferred = createDeferred<ReturnType<typeof userResult>>();
    mockAuthGetUser.mockReturnValueOnce(deferred.promise);

    const pending = supabaseLib.getCachedUser();
    supabaseLib.invalidateUserCache();
    deferred.resolve(userResult('user-1'));
    await pending;

    // Der naechste Aufruf darf nicht aus dem Cache bedient werden.
    mockAuthGetUser.mockResolvedValueOnce(userResult('user-2'));
    const next = await supabaseLib.getCachedUser();

    expect(mockAuthGetUser).toHaveBeenCalledTimes(2);
    expect(next.data.user).toEqual({ id: 'user-2' });
  });

  it('teilt nach einem Nutzerwechsel den alten Request nicht weiter', async () => {
    const first = createDeferred<ReturnType<typeof userResult>>();
    const second = createDeferred<ReturnType<typeof userResult>>();
    mockAuthGetUser.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    const oldCall = supabaseLib.getCachedUser();

    // Logout/Login: Generation wechselt, waehrend der alte Request laeuft.
    supabaseLib.invalidateUserCache();

    const newCall = supabaseLib.getCachedUser();

    first.resolve(userResult('user-1'));
    second.resolve(userResult('user-2'));

    const [oldResult, newResult] = await Promise.all([oldCall, newCall]);

    expect(mockAuthGetUser).toHaveBeenCalledTimes(2);
    expect(oldResult.data.user).toEqual({ id: 'user-1' });
    expect(newResult.data.user).toEqual({ id: 'user-2' });
  });

  it('laesst den alten Nutzer nach dem Wechsel nicht in den Cache zurueckschreiben', async () => {
    const slowOld = createDeferred<ReturnType<typeof userResult>>();
    mockAuthGetUser.mockReturnValueOnce(slowOld.promise);

    const oldCall = supabaseLib.getCachedUser();

    supabaseLib.invalidateUserCache();
    mockAuthGetUser.mockResolvedValueOnce(userResult('user-2'));
    await supabaseLib.getCachedUser();

    // Der alte Request antwortet erst jetzt - er darf user-1 nicht mehr setzen.
    slowOld.resolve(userResult('user-1'));
    await oldCall;

    const afterwards = await supabaseLib.getCachedUser();
    expect(afterwards.data.user).toEqual({ id: 'user-2' });
  });
});
