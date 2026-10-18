import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

const ATTEMPT_KEY = 'lotti_google_auth_attempt_v1';
const ATTEMPT_MAX_AGE_MS = 15 * 60 * 1000;
export const GOOGLE_CALLBACK_PATH = 'auth/google-callback';

export type GoogleAuthOptions = {
  source: 'login' | 'signup';
  termsVersion: string;
  invitationCode?: string;
};
export type GoogleAuthAttempt = GoogleAuthOptions & {
  id: string;
  createdAt: number;
  redirectTo: string;
};
export type GoogleStartResult =
  | { status: 'callback'; url: string }
  | { status: 'cancelled' | 'redirected' };
export type GoogleAuthResult = { session: Session; attempt: GoogleAuthAttempt };
export type GoogleAuthErrorCode = 'cancelled' | 'not_configured' | 'invalid_callback' | 'expired' | 'failed';

export class GoogleAuthError extends Error {
  constructor(public readonly code: GoogleAuthErrorCode) {
    // Never include provider descriptions, URLs, auth codes or tokens in logs.
    super(`google_auth_${code}`);
    this.name = 'GoogleAuthError';
  }
}

export function googleAuthErrorKey(error: unknown) {
  if (error instanceof GoogleAuthError) {
    if (error.code === 'not_configured') return 'login.googleUnavailable' as const;
    if (error.code === 'expired' || error.code === 'invalid_callback') return 'login.googleExpired' as const;
  }
  return 'login.googleFailed' as const;
}

/** signInWithOAuth only builds a URL; check availability before opening a disabled provider. */
export async function assertGoogleProviderEnabled(backendUrl: string, publicKey: string): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(`${backendUrl}/auth/v1/settings`, {
      headers: { apikey: publicKey }, signal: controller.signal,
    });
    if (!response.ok) throw new GoogleAuthError('failed');
    const settings = await response.json();
    if (settings?.external?.google !== true) throw new GoogleAuthError('not_configured');
  } catch (error) {
    throw normalizeProviderError(error);
  } finally { clearTimeout(timeout); }
}

let startPromise: Promise<GoogleStartResult> | null = null;
const completions = new Map<string, { code: string; baseUrl: string; promise: Promise<GoogleAuthResult> }>();
let generation = 0;

function normalizeProviderError(error: unknown): GoogleAuthError {
  if (error instanceof GoogleAuthError) return error;
  const message = String((error as { message?: string } | null)?.message ?? '').toLowerCase();
  if (message.includes('provider') && (message.includes('not enabled') || message.includes('disabled'))) {
    return new GoogleAuthError('not_configured');
  }
  return new GoogleAuthError('failed');
}

async function readAttempt(): Promise<GoogleAuthAttempt | null> {
  const raw = await AsyncStorage.getItem(ATTEMPT_KEY);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<GoogleAuthAttempt>;
    if (typeof value.id !== 'string' || typeof value.createdAt !== 'number' ||
        typeof value.redirectTo !== 'string' || typeof value.termsVersion !== 'string' ||
        !['login', 'signup'].includes(value.source ?? '') ||
        (value.invitationCode !== undefined && typeof value.invitationCode !== 'string')) return null;
    return value as GoogleAuthAttempt;
  } catch { return null; }
}

export async function clearGoogleSignIn(attemptId?: string): Promise<void> {
  if (attemptId && (await readAttempt())?.id !== attemptId) return;
  generation++;
  completions.clear();
  startPromise = null;
  await AsyncStorage.removeItem(ATTEMPT_KEY);
}

/** Persist only the local login intent; Supabase owns state and the PKCE verifier. */
export function startGoogleSignIn(client: SupabaseClient, options: GoogleAuthOptions): Promise<GoogleStartResult> {
  if (startPromise) return startPromise;
  const operation = (async (): Promise<GoogleStartResult> => {
    const revision = ++generation;
    completions.clear();
    const id = Crypto.randomUUID();
    const redirectTo = Linking.createURL(GOOGLE_CALLBACK_PATH, {
      scheme: 'com.lottibaby.app', queryParams: { attempt: id },
    });
    const attempt: GoogleAuthAttempt = { ...options, id, redirectTo, createdAt: Date.now() };
    try {
      await AsyncStorage.setItem(ATTEMPT_KEY, JSON.stringify(attempt));
      const { data, error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
          scopes: 'openid email profile',
          queryParams: { prompt: 'select_account' },
        },
      });
      if (error) throw normalizeProviderError(error);
      if (!data.url) throw new GoogleAuthError('failed');
      if (revision !== generation) return { status: 'cancelled' };
      if (Platform.OS === 'web') {
        // Same-tab redirect preserves the PKCE verifier across the web callback.
        window.location.assign(data.url);
        return { status: 'redirected' };
      }
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (revision !== generation) return { status: 'cancelled' };
      if (result.type === 'success') {
        const received = new URL(result.url);
        const expected = new URL(redirectTo);
        if (received.protocol !== expected.protocol || received.host !== expected.host ||
            received.pathname !== expected.pathname || received.searchParams.get('attempt') !== id) {
          throw new GoogleAuthError('invalid_callback');
        }
        return { status: 'callback', url: result.url };
      }
      // Android may already have delivered the callback to the router.
      if (hasCompletion(id)) return { status: 'redirected' };
      await clearGoogleSignIn(id);
      return { status: 'cancelled' };
    } catch (error) {
      await clearGoogleSignIn(id);
      throw normalizeProviderError(error);
    }
  })();
  startPromise = operation;
  void operation.then(
    () => { if (startPromise === operation) startPromise = null; },
    () => { if (startPromise === operation) startPromise = null; },
  );
  return operation;
}

function hasCompletion(id: string) { return completions.has(id); }

/** The router and browser result share one exchange, including its outcome. */
export function completeGoogleSignIn(client: SupabaseClient, callbackUrl: string): Promise<GoogleAuthResult> {
  let url: URL;
  try { url = new URL(callbackUrl); }
  catch { return Promise.reject(new GoogleAuthError('invalid_callback')); }
  const id = url.searchParams.get('attempt');
  const code = url.searchParams.get('code') ?? '';
  if (!id) return Promise.reject(new GoogleAuthError('invalid_callback'));
  const baseUrl = `${url.protocol}//${url.host}${url.pathname}`;
  const existing = completions.get(id);
  if (existing) {
    if (existing.code === code && existing.baseUrl === baseUrl) return existing.promise;
    return Promise.reject(new GoogleAuthError('invalid_callback'));
  }
  const revision = generation;
  const operation = (async (): Promise<GoogleAuthResult> => {
    const attempt = await readAttempt();
    if (!attempt || attempt.id !== id) throw new GoogleAuthError('invalid_callback');
    const expected = new URL(attempt.redirectTo);
    if (url.protocol !== expected.protocol || url.host !== expected.host || url.pathname !== expected.pathname) {
      throw new GoogleAuthError('invalid_callback');
    }
    const age = Date.now() - attempt.createdAt;
    if (age < 0 || age > ATTEMPT_MAX_AGE_MS) throw new GoogleAuthError('expired');
    const providerError = url.searchParams.get('error');
    if (providerError) throw new GoogleAuthError(providerError === 'access_denied' ? 'cancelled' : 'failed');
    if (!code || revision !== generation) throw new GoogleAuthError('invalid_callback');
    const { data, error } = await client.auth.exchangeCodeForSession(code);
    if (error || !data.session?.user || revision !== generation) throw new GoogleAuthError('failed');
    return { session: data.session, attempt };
  })();
  completions.set(id, { code, baseUrl, promise: operation });
  return operation;
}

/** Remove intent after consent/navigation; keep the successful exchange deduplicated. */
export async function finishGoogleSignIn(attemptId: string): Promise<void> {
  if ((await readAttempt())?.id === attemptId) await AsyncStorage.removeItem(ATTEMPT_KEY);
}
