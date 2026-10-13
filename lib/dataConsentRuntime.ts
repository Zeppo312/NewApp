import { notifyServerContact } from './serverContact';
import { DATA_CONSENT_VERSION, hasDataConsent, type DataConsentSnapshot, type DataConsentScope } from './dataConsentTypes';

// New app versions include the effective flow by default. Only an explicit
// local preview/test opt-out preserves the old inert screen.
export const DATA_CONSENTS_ENABLED = process.env.EXPO_PUBLIC_DATA_CONSENTS_ENABLED !== 'false';
let snapshot: DataConsentSnapshot | null = null;
let userId: string | null = null;
let generation = 0;
let pending = new Set<DataConsentScope>();
const requests = new Map<AbortController, DataConsentScope>();
const listeners = new Set<() => void>();
export const subscribeDataConsents = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const getRuntimeDataConsents = () => ({ snapshot, userId, generation, pending: [...pending] });
function notify() { for (const listener of listeners) listener(); }
export function setConsentIdentity(id: string | null) {
  if (id === userId) return;
  for (const controller of requests.keys()) controller.abort();
  generation += 1; snapshot = null; userId = id; pending = new Set(); notify();
}
export function invalidateConsentChecks() {
  // Cancel work from the previous foreground session without forgetting the
  // confirmed decision. A background refresh must not replace the app UI.
  generation += 1;
  for (const controller of requests.keys()) controller.abort();
  notify();
}
export function setRuntimeDataConsents(next: DataConsentSnapshot | null) {
  if (next && next.userId !== userId) return;
  if (next && snapshot && next.revision < snapshot.revision) return;
  snapshot = next;
  for (const [controller, scope] of requests) if (!runtimeConsentAllowed(scope)) controller.abort();
  notify();
}
export function setPendingConsentWithdrawal(scopes: DataConsentScope[]) {
  pending = new Set(scopes);
  for (const [controller, scope] of requests) if (!runtimeConsentAllowed(scope)) controller.abort();
  notify();
}
export function runtimeConsentAllowed(scope: DataConsentScope): boolean {
  if (!DATA_CONSENTS_ENABLED) return true;
  if (pending.has('health') || (scope === 'ai' && pending.has('ai'))) return false;
  if (!snapshot || snapshot.userId !== userId || snapshot.documentVersion !== DATA_CONSENT_VERSION) return false;
  return snapshot.enabled && hasDataConsent(snapshot, scope);
}
export function trackConsentRequest(controller: AbortController, scope: DataConsentScope) {
  requests.set(controller, scope);
  return () => { requests.delete(controller); };
}
export class DataConsentRequiredError extends Error {
  constructor(public scope: DataConsentScope) { super(`${scope}_consent_required`); }
}

// These routes use a separate purpose and stay available during withdrawal.
const neutralRestPaths = new Set(['rpc/get_data_consents', 'rpc/record_data_consent', 'rpc/record_terms_consent',
  'terms_consents', 'profiles', 'subscription_plans', 'subscription_plan_features', 'subscription_features',
  'rpc/get_family_subscription_access', 'rpc/get_subscription_feature_policy',
  'rpc/delete_user_data', 'rpc/account_deletion_availability']);
const aiFunctions = new Set(['ask-lotti', 'voice-log-parse']);
export function dataConsentRequestScope(url: string): DataConsentScope | null {
  const path = new URL(url).pathname;
  if (path.startsWith('/rest/v1/')) return neutralRestPaths.has(path.slice('/rest/v1/'.length)) ? null : 'health';
  if (path.startsWith('/storage/v1/')) return 'health';
  if (path.startsWith('/functions/v1/')) {
    const slug = path.slice('/functions/v1/'.length);
    if (aiFunctions.has(slug)) return 'ai';
    if (slug === 'advisor-generate') return 'health';
  }
  return null;
}

/** Off means the existing fetch path, with no added RPC or access decision. */
export async function consentAwareFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (!DATA_CONSENTS_ENABLED) { const result = await fetch(input, init); if (result.ok) notifyServerContact(); return result; }
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const scope = dataConsentRequestScope(url);
  if (!scope) { const result = await fetch(input, init); if (result.ok) notifyServerContact(); return result; }
  if (!runtimeConsentAllowed(scope)) throw new DataConsentRequiredError(scope);
  const controller = new AbortController();
  const release = trackConsentRequest(controller, scope);
  const originalSignal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
  const abort = () => controller.abort();
  if (originalSignal?.aborted) abort();
  originalSignal?.addEventListener('abort', abort);
  try {
    const result = await fetch(input, { ...init, signal: controller.signal });
    if (!runtimeConsentAllowed(scope) || controller.signal.aborted) throw new DataConsentRequiredError(scope);
    if (result.ok) notifyServerContact();
    return result;
  } finally { originalSignal?.removeEventListener('abort', abort); release(); }
}
