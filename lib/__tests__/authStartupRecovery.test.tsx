import React, { useEffect } from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { AuthProvider, useAuth } from '../../contexts/AuthContext';
import { supabase } from '../supabase';
import { clearPersonalDeviceData } from '../accountDeletionCleanup';

jest.mock('../supabase', () => ({ supabase: { auth: { getSession: jest.fn(), onAuthStateChange: jest.fn() } }, isSupabaseReady: () => true, invalidateUserCache: jest.fn() }));
jest.mock('../appCache', () => ({ invalidateAllCaches: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../accountDeletionCleanup', () => ({ clearPersonalDeviceData: jest.fn().mockResolvedValue([]), waitForPersonalDeviceCleanup: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../revenuecat', () => ({ setRevenueCatSessionUser: jest.fn() }));
let current: ReturnType<typeof useAuth>;
function Probe() { const auth = useAuth(); useEffect(() => { current = auth; }, [auth]); return null; }
const session = (id: string) => ({ user: { id } }) as any;
function deferred() { let resolve!: (x: any) => void; const promise = new Promise<any>(r => { resolve = r; }); return { promise, resolve }; }

describe('auth cold-start recovery', () => {
  let tree: ReactTestRenderer;
  let listener: (event: string, next: any) => void;
  const getSession = jest.mocked(supabase.auth.getSession);
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(supabase.auth.onAuthStateChange).mockImplementation((cb: any) => { listener = cb; return { data: { subscription: { unsubscribe: jest.fn() } } } as any; });
  });
  afterEach(() => act(() => tree?.unmount()));
  const mount = async () => { await act(async () => { tree = create(<AuthProvider><Probe /></AuthProvider>); }); };
  it('does not route an offline cold start to login or delete persisted data; retry recovers', async () => {
    getSession.mockResolvedValueOnce({ data: { session: null }, error: new Error('offline') } as any);
    await mount();
    act(() => listener('INITIAL_SESSION', null));
    expect(current.loading).toBe(true);
    expect(clearPersonalDeviceData).not.toHaveBeenCalled();
    getSession.mockResolvedValueOnce({ data: { session: session('A') }, error: null });
    await act(async () => { await current.refreshSession(); });
    expect(current.loading).toBe(false); expect(current.user?.id).toBe('A');
  });
  it('accepts a confirmed anonymous session', async () => {
    getSession.mockResolvedValueOnce({ data: { session: null }, error: null });
    await mount(); expect(current.loading).toBe(false); expect(current.user).toBeNull();
  });
  it('deduplicates pending retries and accepts auth recovery without awaiting a hung getSession', async () => {
    const pending = deferred(); getSession.mockReturnValueOnce(pending.promise);
    await mount();
    const a=current.refreshSession(); const b=current.refreshSession(); expect(a).toBe(b);
    expect(getSession).toHaveBeenCalledTimes(1);
    act(() => listener('SIGNED_IN', session('B')));
    expect(current.loading).toBe(false); expect(current.user?.id).toBe('B');
    await act(async () => pending.resolve({ data: { session: session('A') }, error: null }));
    expect(current.user?.id).toBe('B');
  });
  it('does not resurrect a session after explicit revocation', async () => {
    const pending = deferred(); getSession.mockReturnValueOnce(pending.promise); await mount();
    act(() => listener('SIGNED_OUT', null));
    await act(async () => pending.resolve({ data: { session: session('A') }, error: null }));
    expect(current.loading).toBe(false); expect(current.user).toBeNull();
  });
});
