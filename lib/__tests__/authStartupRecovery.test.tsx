import React, { useEffect } from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { AuthProvider, useAuth } from '../../contexts/AuthContext';
import { supabase } from '../supabase';
import { clearPersonalDeviceData } from '../accountDeletionCleanup';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { persistStartupAccess, readStartupAccess, STARTUP_ACCESS_MAX_AGE_MS } from '../startupAccess';
import { getRuntimeDataConsents } from '../dataConsentRuntime';

jest.mock('../supabase', () => ({ supabaseUrl: 'https://fixture.supabase.co', supabaseAuthStorageKey: 'sb-fixture-auth-token', supabase: { auth: { getSession: jest.fn(), onAuthStateChange: jest.fn() } }, isSupabaseReady: () => true, invalidateUserCache: jest.fn() }));
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
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
    jest.mocked(supabase.auth.onAuthStateChange).mockImplementation((cb: any) => { listener = cb; return { data: { subscription: { unsubscribe: jest.fn() } } } as any; });
  });
  afterEach(() => act(() => tree?.unmount()));
  const mount = async () => { await act(async () => { tree = create(<AuthProvider><Probe /></AuthProvider>); }); };
  const save = async () => {
    await AsyncStorage.setItem('sb-fixture-auth-token', JSON.stringify({ user: { id: 'A' }, access_token: 'synthetic-expired', refresh_token: 'synthetic-refresh', expires_at: Date.now()/1000 - 600 }));
    await persistStartupAccess({ backendHost: 'fixture.supabase.co', userId: 'A' }, { accessReason: 'tester', verifiedAt: Date.now(), subscriptionExpiresAt: null });
  };
  it('restores a bounded display session even when the expired-token SDK refresh hangs; fresh auth can still replace it', async () => {
    await save(); const pending = deferred(); getSession.mockReturnValueOnce(pending.promise);
    await mount(); expect(current.loading).toBe(false); expect(current.user?.id).toBe('A');
    expect(getRuntimeDataConsents().userId).toBe('A');
    await act(async () => pending.resolve({ data: { session: session('A') }, error: null }));
    expect(current.session).toEqual(session('A'));
  });
  it('retains the saved session and data after an offline token-refresh error and clears its grant on confirmed revocation', async () => {
    await save(); getSession.mockResolvedValueOnce({ data: { session: null }, error: new Error('offline') } as any);
    await mount(); expect(current.user?.id).toBe('A'); expect(current.loading).toBe(false);
    act(() => listener('INITIAL_SESSION', null)); expect(current.user?.id).toBe('A');
    expect(clearPersonalDeviceData).not.toHaveBeenCalled();
    await act(async () => listener('SIGNED_OUT', null));
    expect(current.user).toBeNull();
    expect(await readStartupAccess({ backendHost: 'fixture.supabase.co', userId: 'A' })).toBeNull();
  });
  it('refuses display recovery after the stored grant expires', async () => {
    await save(); const now = Date.now(); jest.useFakeTimers(); jest.setSystemTime(now + STARTUP_ACCESS_MAX_AGE_MS);
    getSession.mockResolvedValueOnce({ data: { session: null }, error: new Error('offline') } as any);
    await mount(); expect(current.user).toBeNull(); expect(current.loading).toBe(true); jest.useRealTimers();
  });
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
