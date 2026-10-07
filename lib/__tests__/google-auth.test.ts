import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';
import {
  assertGoogleProviderEnabled, clearGoogleSignIn, completeGoogleSignIn, finishGoogleSignIn,
  GoogleAuthError, googleAuthErrorKey, startGoogleSignIn,
} from '../google-auth';

jest.mock('expo-crypto', () => ({ randomUUID: () => 'test-attempt' }));
jest.mock('expo-linking', () => ({
  createURL: (path: string, options: { queryParams: Record<string, string> }) =>
    `com.lottibaby.app://${path}?${new URLSearchParams(options.queryParams)}`,
}));
jest.mock('expo-web-browser', () => ({ openAuthSessionAsync: jest.fn() }));

const callback = 'com.lottibaby.app://auth/google-callback?attempt=test-attempt&code=auth-code';
const intent = { source: 'signup' as const, termsVersion: 'current', invitationCode: 'ABCD2345' };
const session = { user: { id: 'existing-user' }, access_token: 'test-session' };
const signInWithOAuth = jest.fn();
const exchangeCodeForSession = jest.fn();
const client = { auth: { signInWithOAuth, exchangeCodeForSession } } as unknown as SupabaseClient;
const browser = jest.mocked(WebBrowser.openAuthSessionAsync);
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}

beforeEach(async () => {
  await clearGoogleSignIn();
  jest.clearAllMocks();
  signInWithOAuth.mockResolvedValue({ data: { url: 'https://example.com/authorize' }, error: null });
  exchangeCodeForSession.mockResolvedValue({ data: { session }, error: null });
  browser.mockResolvedValue({ type: 'success', url: callback });
});

it('starts PKCE through the system browser and persists consent/invitation intent', async () => {
  expect(await startGoogleSignIn(client, intent)).toEqual({ status: 'callback', url: callback });
  expect(signInWithOAuth).toHaveBeenCalledWith({ provider: 'google', options: {
    redirectTo: 'com.lottibaby.app://auth/google-callback?attempt=test-attempt',
    skipBrowserRedirect: true, scopes: 'openid email profile', queryParams: { prompt: 'select_account' },
  } });
  const result = await completeGoogleSignIn(client, callback);
  expect(result.session.user.id).toBe('existing-user');
  expect(result.attempt).toMatchObject(intent);
});

it('deduplicates concurrent code exchanges and keeps the outcome after consuming intent', async () => {
  await startGoogleSignIn(client, intent);
  const pending = deferred<any>();
  exchangeCodeForSession.mockReturnValueOnce(pending.promise);
  const a = completeGoogleSignIn(client, callback);
  const b = completeGoogleSignIn(client, callback);
  expect(a).toBe(b);
  pending.resolve({ data: { session }, error: null });
  await a;
  await finishGoogleSignIn('test-attempt');
  await completeGoogleSignIn(client, callback);
  expect(exchangeCodeForSession).toHaveBeenCalledTimes(1);
});

it('rejects a second auth code for the same attempt', async () => {
  await startGoogleSignIn(client, intent);
  await completeGoogleSignIn(client, callback);
  await expect(completeGoogleSignIn(client, callback.replace('auth-code', 'other-code')))
    .rejects.toMatchObject({ code: 'invalid_callback' });
  expect(exchangeCodeForSession).toHaveBeenCalledTimes(1);
});

it('treats a closed browser as cancellation and allows a fresh attempt', async () => {
  browser.mockResolvedValueOnce({ type: 'cancel' as WebBrowser.WebBrowserResultType });
  expect(await startGoogleSignIn(client, intent)).toEqual({ status: 'cancelled' });
  await expect(completeGoogleSignIn(client, callback)).rejects.toMatchObject({ code: 'invalid_callback' });
  expect(await startGoogleSignIn(client, intent)).toMatchObject({ status: 'callback' });
  expect(exchangeCodeForSession).not.toHaveBeenCalled();
});

it('does not cancel a callback already delivered by Android when the browser dismisses', async () => {
  const pending = deferred<any>();
  const opened = deferred<void>();
  browser.mockImplementationOnce(() => { opened.resolve(); return pending.promise; });
  const start = startGoogleSignIn(client, intent);
  await opened.promise;
  await completeGoogleSignIn(client, callback);
  pending.resolve({ type: 'dismiss' });
  expect(await start).toEqual({ status: 'redirected' });
  expect(exchangeCodeForSession).toHaveBeenCalledTimes(1);
});

it('reports a disabled provider without exposing provider error details', async () => {
  signInWithOAuth.mockResolvedValueOnce({ data: { url: null }, error: { message: 'Unsupported provider: provider is not enabled' } });
  await expect(startGoogleSignIn(client, intent)).rejects.toMatchObject({ code: 'not_configured' });
  expect(browser).not.toHaveBeenCalled();
  expect(googleAuthErrorKey(new GoogleAuthError('not_configured'))).toBe('login.googleUnavailable');
});

it.each([
  callback.replace('test-attempt', 'wrong-attempt'),
  callback.replace('com.lottibaby.app://', 'https://'),
  callback.replace('google-callback', 'callback'),
])('rejects an unexpected returned browser URL: %s', async (url) => {
  browser.mockResolvedValueOnce({ type: 'success', url });
  await expect(startGoogleSignIn(client, intent)).rejects.toMatchObject({ code: 'invalid_callback' });
  expect(exchangeCodeForSession).not.toHaveBeenCalled();
});

it.each([
  callback.replace('test-attempt', 'wrong-attempt'),
  callback.replace('com.lottibaby.app://', 'https://'),
  callback.replace('google-callback', 'callback'),
  callback.replace('&code=auth-code', ''),
])('rejects an unsolicited/malformed callback without using an existing session: %s', async (url) => {
  await startGoogleSignIn(client, intent);
  await expect(completeGoogleSignIn(client, url)).rejects.toMatchObject({ code: 'invalid_callback' });
  expect(exchangeCodeForSession).not.toHaveBeenCalled();
});

it('does not read consent or invitation flags from the callback URL', async () => {
  await startGoogleSignIn(client, intent);
  const result = await completeGoogleSignIn(client, callback + '&termsVersion=forged&source=login&invitationCode=FORGED');
  expect(result.attempt).toMatchObject(intent);
});

it('rejects expired attempts before exchanging a code', async () => {
  await startGoogleSignIn(client, intent);
  const now = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 16 * 60 * 1000);
  try {
    await expect(completeGoogleSignIn(client, callback)).rejects.toMatchObject({ code: 'expired' });
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  } finally { now.mockRestore(); }
});

it('restores consent and invitation intent from storage after the in-memory attempt has been lost', async () => {
  await startGoogleSignIn(client, intent);
  const saved = jest.mocked(AsyncStorage.setItem).mock.calls.find(([key]) => key === 'lotti_google_auth_attempt_v1')![1];
  await clearGoogleSignIn();
  await AsyncStorage.setItem('lotti_google_auth_attempt_v1', saved);
  const result = await completeGoogleSignIn(client, callback);
  expect(result.attempt).toMatchObject(intent);
  expect(result.session.user.id).toBe('existing-user');
});

it('handles provider denial without treating it as a successful session', async () => {
  await startGoogleSignIn(client, intent);
  await expect(completeGoogleSignIn(client, callback.replace('code=auth-code', 'error=access_denied')))
    .rejects.toMatchObject({ code: 'cancelled' });
  expect(exchangeCodeForSession).not.toHaveBeenCalled();
});

it('does not accept a missing session or a failed code exchange', async () => {
  await startGoogleSignIn(client, intent);
  exchangeCodeForSession.mockResolvedValueOnce({ data: { session: null }, error: { message: 'expired code' } });
  await expect(completeGoogleSignIn(client, callback)).rejects.toMatchObject({ code: 'failed' });
});

it('invalidates the completion on logout and rejects a late browser result', async () => {
  await startGoogleSignIn(client, intent);
  await completeGoogleSignIn(client, callback);
  await clearGoogleSignIn();
  await expect(completeGoogleSignIn(client, callback)).rejects.toMatchObject({ code: 'invalid_callback' });
  expect(exchangeCodeForSession).toHaveBeenCalledTimes(1);
});

it('rejects a changed origin even after the same code was successfully processed', async () => {
  await startGoogleSignIn(client, intent);
  await completeGoogleSignIn(client, callback);
  await expect(completeGoogleSignIn(client, callback.replace('com.lottibaby.app://', 'https://')))
    .rejects.toMatchObject({ code: 'invalid_callback' });
  expect(exchangeCodeForSession).toHaveBeenCalledTimes(1);
});

it('keeps a pending exchange deduplicated if an unrelated callback arrives', async () => {
  await startGoogleSignIn(client, intent);
  const pending = deferred<any>();
  exchangeCodeForSession.mockReturnValueOnce(pending.promise);
  const a = completeGoogleSignIn(client, callback);
  await expect(completeGoogleSignIn(client, callback.replace('test-attempt', 'wrong-attempt')))
    .rejects.toMatchObject({ code: 'invalid_callback' });
  expect(completeGoogleSignIn(client, callback)).toBe(a);
  pending.resolve({ data: { session }, error: null });
  await a;
  expect(exchangeCodeForSession).toHaveBeenCalledTimes(1);
});

it('fails closed when local login intent cannot be saved', async () => {
  jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('storage unavailable'));
  await expect(startGoogleSignIn(client, intent)).rejects.toMatchObject({ code: 'failed' });
  expect(signInWithOAuth).not.toHaveBeenCalled();
});

describe('Google provider availability', () => {
  const originalFetch = global.fetch;
  const mockFetch = jest.fn();
  beforeEach(() => { global.fetch = mockFetch; mockFetch.mockReset(); });
  afterEach(() => { global.fetch = originalFetch; });
  it('reads settings with only the public API key', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ external: { google: true } }) });
    await expect(assertGoogleProviderEnabled('https://test.supabase.co', 'public-key')).resolves.toBeUndefined();
    expect(mockFetch).toHaveBeenCalledWith('https://test.supabase.co/auth/v1/settings', expect.objectContaining({ headers: { apikey: 'public-key' } }));
  });
  it('reports a disabled backend before the browser is opened', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ external: { google: false } }) });
    await expect(assertGoogleProviderEnabled('https://test.supabase.co', 'public-key')).rejects.toMatchObject({ code: 'not_configured' });
    expect(browser).not.toHaveBeenCalled();
  });
  it('does not treat a settings/network error as an enabled provider', async () => {
    mockFetch.mockRejectedValue(new Error('offline'));
    await expect(assertGoogleProviderEnabled('https://test.supabase.co', 'public-key')).rejects.toMatchObject({ code: 'failed' });
    expect(browser).not.toHaveBeenCalled();
  });
});
