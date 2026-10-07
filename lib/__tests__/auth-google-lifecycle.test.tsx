import React, { useEffect } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { supabase, signInWithGoogle, signOut } from '@/lib/supabase';
import { completeGoogleSignIn, clearGoogleSignIn } from '@/lib/google-auth';
import { clearPersonalDeviceData, waitForPersonalDeviceCleanup } from '@/lib/accountDeletionCleanup';
import { setRevenueCatSessionUser } from '@/lib/revenuecat';

jest.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: jest.fn(), onAuthStateChange: jest.fn() } },
  signInWithGoogle: jest.fn(), signOut: jest.fn(), isSupabaseReady: () => true, invalidateUserCache: jest.fn(),
}));
jest.mock('@/lib/google-auth', () => ({ completeGoogleSignIn: jest.fn(), clearGoogleSignIn: jest.fn() }));
jest.mock('@/lib/appCache', () => ({ invalidateAllCaches: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/lib/accountDeletionCleanup', () => ({
  clearPersonalDeviceData: jest.fn(), waitForPersonalDeviceCleanup: jest.fn(),
}));
jest.mock('@/lib/revenuecat', () => ({ setRevenueCatSessionUser: jest.fn() }));

let current: ReturnType<typeof useAuth>;
let tree: ReactTestRenderer;
let listener: (event: string, next: any) => void;
function Probe() { const auth = useAuth(); useEffect(() => { current = auth; }, [auth]); return null; }
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
const options = { source: 'login' as const, termsVersion: 'current' };
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { user: { id: 'previous-user' } } }, error: null } as any);
  jest.mocked(supabase.auth.onAuthStateChange).mockImplementation((cb: any) => {
    listener = cb; return { data: { subscription: { unsubscribe: jest.fn() } } } as any;
  });
  jest.mocked(clearGoogleSignIn).mockResolvedValue(undefined);
  jest.mocked(waitForPersonalDeviceCleanup).mockResolvedValue(undefined);
  jest.mocked(clearPersonalDeviceData).mockResolvedValue([]);
  jest.mocked(signOut).mockResolvedValue({ error: null });
  jest.mocked(signInWithGoogle).mockResolvedValue({ status: 'cancelled' });
});
afterEach(() => act(() => tree?.unmount()));
async function mount() { await act(async () => { tree = create(<AuthProvider><Probe /></AuthProvider>); }); }

it('waits for logout and personal-device cleanup before starting a new Google login', async () => {
  await mount();
  const remote = deferred<any>();
  const cleanup = deferred<string[]>();
  jest.mocked(signOut).mockReturnValue(remote.promise);
  jest.mocked(clearPersonalDeviceData).mockReturnValue(cleanup.promise);
  let logout!: Promise<unknown>;
  let login!: Promise<unknown>;
  await act(async () => { logout = current.signOut(); login = current.signInWithGoogle(options); });
  expect(signInWithGoogle).not.toHaveBeenCalled();
  await act(async () => { remote.resolve({ error: null }); });
  expect(signInWithGoogle).not.toHaveBeenCalled();
  await act(async () => { cleanup.resolve([]); await logout; await login; });
  expect(waitForPersonalDeviceCleanup).toHaveBeenCalled();
  expect(signInWithGoogle).toHaveBeenCalledWith(options);
});

it('applies the completed Google session to the normal auth and RevenueCat lifecycle', async () => {
  await mount();
  const result = { session: { user: { id: 'google-user' } }, attempt: { ...options, id: 'own-attempt' } } as any;
  jest.mocked(completeGoogleSignIn).mockResolvedValue(result);
  await act(async () => { await current.completeGoogleSignIn('callback'); });
  expect(waitForPersonalDeviceCleanup).toHaveBeenCalled();
  expect(current.user?.id).toBe('google-user');
  expect(setRevenueCatSessionUser).toHaveBeenLastCalledWith('google-user');
});

it('invalidates a remembered Google completion on remote session revocation', async () => {
  await mount();
  act(() => listener('SIGNED_OUT', null));
  expect(clearGoogleSignIn).toHaveBeenCalled();
  expect(current.user).toBeNull();
});
