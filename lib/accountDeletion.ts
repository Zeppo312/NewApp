import { supabase } from './supabase';

export const ACCOUNT_DELETION_URL = 'https://lottibaby.de/datenschutz#konto-loeschen';
export const ACCOUNT_DELETION_POLICY_VERSION = '2026-09-11';
export type DeletionScope = 'account' | 'data';
export type DeletionReceipt = { requestId: string; status: string; scope: DeletionScope };
export type DeletionAvailability = 'available' | 'support' | 'unavailable';
export async function getDeletionAvailability(): Promise<DeletionAvailability> {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async (): Promise<DeletionAvailability> => {
        const { data, error } = await supabase.functions.invoke('request-account-deletion', { method: 'GET', signal: controller.signal });
        if (error) return error.context?.status === 404 ? 'support' : 'unavailable';
        return data?.available === true ? 'available' : data?.available === false ? 'support' : 'unavailable';
      })(),
      new Promise<DeletionAvailability>(resolve => {
        timeout = setTimeout(() => { controller.abort(); resolve('unavailable'); }, 8_000);
      }),
    ]);
  } catch { return 'unavailable'; }
  finally { clearTimeout(timeout); }
}
const statuses = new Set(['queued','processing','retry_wait','needs_attention','retention_pending','completed']);
export function parseDeletionReceipt(value: unknown): DeletionReceipt {
  const data = value as Partial<DeletionReceipt> | null;
  if (!data || typeof data.requestId !== 'string' || !/^[a-f0-9]{8}-([a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(data.requestId) ||
    !statuses.has(data.status ?? '') || !['account','data'].includes(data.scope ?? '')) {
    throw new Error('invalid_deletion_response');
  }
  return data as DeletionReceipt;
}
export async function requestAccountDeletion(scope: DeletionScope = 'account', verifiedToken?: string): Promise<DeletionReceipt> {
  const { data, error } = await supabase.functions.invoke('request-account-deletion', {
    body: { confirm: true, scope, source: 'app', policyVersion: ACCOUNT_DELETION_POLICY_VERSION },
    ...(verifiedToken ? { headers: { Authorization: `Bearer ${verifiedToken}` } } : {}),
  });
  if (error) throw new Error('deletion_request_failed');
  return parseDeletionReceipt(data);
}

export async function sendDeletionVerification(): Promise<string> {
  if (await getDeletionAvailability() !== 'available') throw new Error('deletion_unavailable');
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.email) throw new Error('deletion_email_required');
  // Existing accounts only. An unknown address must never create a new user.
  const sent = await supabase.auth.signInWithOtp({ email: data.user.email, options: { shouldCreateUser: false } });
  if (sent.error) throw new Error('deletion_verification_failed');
  return data.user.email;
}
export async function verifyDeletionCode(email: string, token: string, expectedUserId: string): Promise<string> {
  const { data, error } = await supabase.auth.verifyOtp({ email, token: token.trim(), type: 'email' });
  if (error || !data.user || data.user.id !== expectedUserId || !data.session?.access_token) throw new Error('deletion_verification_failed');
  return data.session.access_token;
}

// Direct self-service deletion for standalone accounts (delete-own-account).
// Shared accounts report a reason and keep the reviewed request path above.
export type DirectDeletionStatus = { available: true; pending: DeletionScope | null } | { available: false; reason: string | null } | 'unavailable';
export async function getDirectDeletionStatus(): Promise<DirectDeletionStatus> {
  try {
    const { data, error } = await supabase.functions.invoke('delete-own-account', { method: 'GET' });
    if (error || typeof data?.available !== 'boolean') return 'unavailable';
    // pending: a started deletion that has to be resumed (the account is locked meanwhile).
    if (data.available) return { available: true, pending: data.pending === 'account' || data.pending === 'data' ? data.pending : null };
    return { available: false, reason: typeof data.reason === 'string' ? data.reason : null };
  } catch { return 'unavailable'; }
}
export async function deleteOwnAccount(scope: DeletionScope): Promise<void> {
  const { data, error } = await supabase.functions.invoke('delete-own-account', { body: { confirm: true, scope } });
  if (error || data?.deleted !== true) throw new Error('direct_deletion_failed');
}

type AppleLinkedUser = { app_metadata?: { provider?: string; providers?: string[] }; identities?: { provider?: string }[] } | null | undefined;
export function isAppleLinkedUser(user: AppleLinkedUser): boolean {
  if (!user) return false;
  return user.app_metadata?.provider === 'apple' || !!user.app_metadata?.providers?.includes('apple') ||
    !!user.identities?.some(identity => identity.provider === 'apple');
}
/** Apple requires revoking Sign in with Apple tokens when an account is deleted.
 * 'cancelled' means the user dismissed the Apple sheet and deletion must stop. */
export async function revokeAppleSignIn(): Promise<'revoked' | 'cancelled' | 'failed'> {
  let credential: { authorizationCode?: string | null; user?: string } | null = null;
  try {
    const AppleAuthentication = require('expo-apple-authentication');
    if (!(await AppleAuthentication.isAvailableAsync())) return 'failed';
    credential = await AppleAuthentication.signInAsync({ requestedScopes: [] });
  } catch (error: any) {
    return error?.code === 'ERR_REQUEST_CANCELED' ? 'cancelled' : 'failed';
  }
  if (!credential?.authorizationCode) return 'failed';
  try {
    const { data, error } = await supabase.functions.invoke('revoke-apple-sign-in', {
      body: { authorizationCode: credential.authorizationCode, appleUser: credential.user ?? null },
    });
    return !error && data?.success === true ? 'revoked' : 'failed';
  } catch { return 'failed'; }
}
