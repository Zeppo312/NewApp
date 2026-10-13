import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { supabaseUrl, supabaseAnonKey } from '@/lib/supabase';
import { normalizeCaretakerCode } from '@/lib/caretaker-access';

export type CaretakerGuestSession = { token: string; grantId: string };
export type CaretakerRequester = <T>(action: string, payload?: Record<string, unknown>) => Promise<T>;
const SESSION_KEY = 'caretaker-guest-session:v1';
const PENDING_KEY = 'caretaker-guest-invitation:v1';
const TOKEN_PATTERN = /^[a-f0-9]{64}$/;
const UUID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

/** Dedicated guest endpoint: never sends or changes the parent's auth session. */
export function createCaretakerGuestRequest(token: string): CaretakerRequester {
  return async <T>(action: string, payload: Record<string, unknown> = {}): Promise<T> => {
    if (!TOKEN_PATTERN.test(token)) throw new Error('invalid_guest_session');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);
    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/caretaker_guest`, {
        method: 'POST',
        headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_action: action, p_payload: payload, p_session_token: token }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) throw { code: data?.code, message: data?.message || 'guest_request_failed' };
      return data as T;
    } finally { clearTimeout(timeout); }
  };
}

export async function loadCaretakerGuestSession(): Promise<CaretakerGuestSession | null> {
  const value = await AsyncStorage.getItem(SESSION_KEY);
  if (!value) return null;
  try {
    const session = JSON.parse(value) as CaretakerGuestSession;
    return TOKEN_PATTERN.test(session.token) && UUID_PATTERN.test(session.grantId) ? session : null;
  } catch { return null; }
}

let accepting: Promise<CaretakerGuestSession> | null = null;
export async function acceptCaretakerGuestInvitation(input: string): Promise<CaretakerGuestSession> {
  if (accepting) throw new Error('guest_request_in_progress');
  const code = normalizeCaretakerCode(input);
  if (!code) throw new Error('invalid_invitation');
  accepting = (async () => {
    let token: string | undefined;
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    if (raw) {
      try {
        const pending = JSON.parse(raw);
        if (pending.code === code && TOKEN_PATTERN.test(pending.token)) token = pending.token;
      } catch { /* A damaged pending record is replaced before the request. */ }
    }
    if (!token) {
      const bytes = await Crypto.getRandomBytesAsync(32);
      token = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
      // Persist before claiming the code: retries can recover a lost response.
      await AsyncStorage.setItem(PENDING_KEY, JSON.stringify({ code, token }));
    }
    const result = await createCaretakerGuestRequest(token)<{ id: string }>('accept', { code });
    if (!UUID_PATTERN.test(result?.id)) throw new Error('invalid_guest_response');
    const session = { token, grantId: result.id };
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
    await AsyncStorage.removeItem(PENDING_KEY);
    return session;
  })();
  try { return await accepting; } finally { accepting = null; }
}

/** Only forget this device's guest access; never signs out an existing parent. */
export async function forgetCaretakerGuestSession() {
  await AsyncStorage.multiRemove([SESSION_KEY, PENDING_KEY]);
}
