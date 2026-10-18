import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { supabase, supabaseUrl } from './supabase';
import type { AppLocale } from './localization';
import { DATA_CONSENT_VERSION, type DataConsentDecision, type DataConsentScope, type DataConsentSnapshot } from './dataConsentTypes';
import { DATA_CONSENTS_ENABLED, DataConsentRequiredError, getRuntimeDataConsents, runtimeConsentAllowed, setPendingConsentWithdrawal, setRuntimeDataConsents } from './dataConsentRuntime';

const pendingKey = (userId: string) => `data_consent_pending_withdrawal_v1:${userId}`;
const snapshotKey = (userId: string) => `data_consent_snapshot_v1:${new URL(supabaseUrl).host}:${userId}`;
const snapshotWrites = new Map<string, Promise<DataConsentSnapshot>>();
const CONSENT_REQUEST_TIMEOUT_MS = 10_000;

async function consentRpc(name: string, args?: Record<string, unknown>) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { controller.abort(); reject(new Error('consent_request_timeout')); }, CONSENT_REQUEST_TIMEOUT_MS);
  });
  try {
    return await Promise.race([supabase.rpc(name, args).abortSignal(controller.signal), timeout]);
  } finally { clearTimeout(timer); }
}
function parseSnapshot(value: unknown, expectedUser: string): DataConsentSnapshot {
  const s = value as DataConsentSnapshot;
  if (!s || s.userId !== expectedUser || typeof s.enabled !== 'boolean' || typeof s.healthAllowed !== 'boolean' || typeof s.aiAllowed !== 'boolean' || !Number.isSafeInteger(s.revision) || s.revision < 0 || s.documentVersion !== DATA_CONSENT_VERSION) throw new Error('invalid_consent_snapshot');
  for (const scope of ['health', 'ai'] as const) {
    const record = s[scope];
    if (record !== null && (!record || !['granted', 'declined', 'revoked'].includes(record.decision) || typeof record.documentVersion !== 'string' || typeof record.decidedAt !== 'string')) throw new Error('invalid_consent_record');
  }
  return s;
}
function assertIdentity(userId: string, generation = getRuntimeDataConsents().generation) {
  const current = getRuntimeDataConsents();
  if (current.userId !== userId || current.generation !== generation) throw new Error('consent_identity_changed');
}
async function persistSnapshot(next: DataConsentSnapshot, generation: number): Promise<DataConsentSnapshot> {
  const key = snapshotKey(next.userId);
  // Serialize writes so an older fetch cannot overwrite a newer decision.
  const previous = snapshotWrites.get(key);
  const write = (previous ?? Promise.resolve()).catch(() => {}).then(async () => {
    assertIdentity(next.userId, generation);
    const current = getRuntimeDataConsents().snapshot;
    const latest = current && current.revision > next.revision ? current : next;
    await AsyncStorage.setItem(key, JSON.stringify(latest));
    assertIdentity(next.userId, generation);
    setRuntimeDataConsents(latest);
    return latest;
  });
  snapshotWrites.set(key, write);
  try { return await write; } finally { if (snapshotWrites.get(key) === write) snapshotWrites.delete(key); }
}

/** Restore withdrawals before grants, without waiting for the network. */
export async function hydrateDataConsents(userId: string): Promise<void> {
  const generation = getRuntimeDataConsents().generation;
  await readPendingConsentWithdrawals(userId);
  const raw = await AsyncStorage.getItem(snapshotKey(userId));
  assertIdentity(userId, generation);
  if (!raw) return;
  let cached: DataConsentSnapshot;
  try { cached = parseSnapshot(JSON.parse(raw), userId); }
  catch { return; } // Invalid/obsolete caches require a fresh server decision.
  setRuntimeDataConsents(cached);
}
export async function fetchDataConsents(userId: string): Promise<DataConsentSnapshot> {
  const generation = getRuntimeDataConsents().generation;
  const { data, error } = await consentRpc('get_data_consents');
  if (error) throw error;
  assertIdentity(userId, generation);
  const next = parseSnapshot(data, userId);
  return persistSnapshot(next, generation);
}
export async function readPendingConsentWithdrawals(userId: string): Promise<DataConsentScope[]> {
  const generation = getRuntimeDataConsents().generation;
  const raw = await AsyncStorage.getItem(pendingKey(userId));
  assertIdentity(userId, generation);
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.some(s => s !== 'health' && s !== 'ai')) throw new Error('invalid_pending_withdrawal');
  setPendingConsentWithdrawal([...new Set([...getRuntimeDataConsents().pending, ...parsed])]);
  return parsed;
}
export async function recordDataConsent(scope: DataConsentScope, decision: DataConsentDecision, locale: AppLocale): Promise<DataConsentSnapshot> {
  const { userId, snapshot, generation } = getRuntimeDataConsents();
  if (!DATA_CONSENTS_ENABLED || !userId || !snapshot) throw new Error('consent_unavailable');
  if (decision === 'revoked') {
    const scopes = [...new Set([...getRuntimeDataConsents().pending, scope])];
    // Fail closed immediately, even when persistence or the network fails.
    setPendingConsentWithdrawal(scopes);
    await AsyncStorage.setItem(pendingKey(userId), JSON.stringify(scopes));
  }
  if (decision === 'granted' && getRuntimeDataConsents().pending.length) throw new Error('withdrawal_pending');
  const operationId = Crypto.randomUUID();
  let revision = snapshot.revision;
  for (let attempt = 0; attempt < 2; attempt++) {
    assertIdentity(userId, generation);
    const { data, error } = await consentRpc('record_data_consent', {
      p_scope: scope, p_decision: decision, p_document_version: DATA_CONSENT_VERSION,
      p_locale: locale, p_operation_id: operationId, p_expected_revision: revision,
    });
    assertIdentity(userId, generation);
    if (error) {
      // Only withdrawal may safely follow a concurrently changed decision.
      if (decision === 'revoked' && error.code === '40001' && attempt === 0) {
        revision = (await fetchDataConsents(userId)).revision; continue;
      }
      throw error;
    }
    const next = await persistSnapshot(parseSnapshot(data, userId), generation);
    if (decision === 'revoked') {
      const remaining = getRuntimeDataConsents().pending.filter(s => s !== scope);
      await AsyncStorage.setItem(pendingKey(userId), JSON.stringify(remaining));
      assertIdentity(userId, generation); setPendingConsentWithdrawal(remaining);
    }
    return next;
  }
  throw new Error('consent_revision_changed');
}
export async function refreshAndSyncDataConsents(userId: string, locale: AppLocale): Promise<DataConsentSnapshot> {
  await readPendingConsentWithdrawals(userId);
  let next = await fetchDataConsents(userId);
  for (const scope of getRuntimeDataConsents().pending) next = await recordDataConsent(scope, 'revoked', locale);
  return next;
}
export async function requireDataConsent(scope: DataConsentScope): Promise<void> {
  if (!DATA_CONSENTS_ENABLED) return;
  const { userId } = getRuntimeDataConsents();
  if (!userId) throw new DataConsentRequiredError(scope);
  if (!getRuntimeDataConsents().snapshot) await fetchDataConsents(userId);
  if (!runtimeConsentAllowed(scope)) throw new DataConsentRequiredError(scope);
}
