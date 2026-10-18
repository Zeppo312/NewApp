import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useAuth } from './AuthContext';
import { DATA_CONSENTS_ENABLED, getRuntimeDataConsents, invalidateConsentChecks, runtimeConsentAllowed, setConsentIdentity, subscribeDataConsents } from '@/lib/dataConsentRuntime';
import { hydrateDataConsents, recordDataConsent, refreshAndSyncDataConsents } from '@/lib/dataConsents';
import { clearConsentDeviceData } from '@/lib/dataConsentCleanup';
import { getDeviceAppLocale, type AppLocale } from '@/lib/localization';
import type { DataConsentDecision, DataConsentScope, DataConsentSnapshot } from '@/lib/dataConsentTypes';

type ConsentContext = {
  mode: 'preview' | 'active' | 'checking' | 'unavailable';
  snapshot: DataConsentSnapshot | null;
  healthAllowed: boolean;
  aiAllowed: boolean;
  pending: boolean;
  busy: boolean;
  cleanupFailed: boolean;
  refresh: () => Promise<void>;
  decide: (scope: DataConsentScope, decision: DataConsentDecision, locale: AppLocale) => Promise<void>;
};
const preview: ConsentContext = { mode: 'preview', snapshot: null, healthAllowed: true, aiAllowed: true, pending: false, busy: false, cleanupFailed: false,
  refresh: async () => {}, decide: async () => { throw new Error('consent_provider_missing'); } };
const Context = createContext<ConsentContext>(preview);
export const useDataConsents = () => useContext(Context);

export function DataConsentProvider({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const id = user?.id ?? null;
  const [runtime, setRuntime] = useState(getRuntimeDataConsents);
  const [failed, setFailed] = useState(false);
  const [hydratedUser, setHydratedUser] = useState<string | null>(null);
  const hydratedIdentity = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cleanupFailed, setCleanupFailed] = useState(false);
  const [clearing, setClearing] = useState<DataConsentScope | null>(null);
  const cleanupScope = useRef<DataConsentScope | null>(null);
  const cleanupRunning = useRef<Promise<void> | null>(null);
  const identity = useRef(id); identity.current = id;
  const refreshing = useRef<Promise<void> | null>(null);
  const mutation = useRef(false);
  const lastDeniedCleanup = useRef<string | null>(null);
  const cleanup = useCallback(async (scope: DataConsentScope) => {
    if (cleanupRunning.current) { await cleanupRunning.current; if (scope === 'ai') return; }
    cleanupScope.current = scope;
    setClearing(scope);
    const request = (async () => {
    // Allow React to unmount private feature trees before cache writers settle.
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    try { await clearConsentDeviceData(scope); cleanupScope.current = null; setCleanupFailed(false); }
    catch { setCleanupFailed(true); }
    finally { setClearing(null); }
    })();
    cleanupRunning.current = request;
    try { await request; } finally { if (cleanupRunning.current === request) cleanupRunning.current = null; }
  }, []);
  const refresh = useCallback(async () => {
    if (!DATA_CONSENTS_ENABLED || !id || loading || mutation.current) return;
    if (refreshing.current) return refreshing.current;
    const target = id;
    const generation = getRuntimeDataConsents().generation;
    const request = (async () => {
      try {
        if (hydratedIdentity.current !== target) {
          await hydrateDataConsents(target);
          if (identity.current !== target || getRuntimeDataConsents().generation !== generation) return;
          hydratedIdentity.current = target; setHydratedUser(target);
        }
        await refreshAndSyncDataConsents(target, getDeviceAppLocale());
        if (identity.current === target && getRuntimeDataConsents().generation === generation) { setFailed(false); if (cleanupScope.current) await cleanup(cleanupScope.current); }
      } catch {
        if (identity.current === target && getRuntimeDataConsents().generation === generation) setFailed(true);
      }
    })();
    refreshing.current = request;
    try { await request; } finally { if (refreshing.current === request) refreshing.current = null; }
  }, [id, loading, cleanup]);
  useEffect(() => subscribeDataConsents(() => setRuntime(getRuntimeDataConsents())), []);
  useEffect(() => {
    if (!DATA_CONSENTS_ENABLED) return;
    setConsentIdentity(id); setRuntime(getRuntimeDataConsents()); setFailed(false);
    refreshing.current = null; hydratedIdentity.current = null; setHydratedUser(null);
    lastDeniedCleanup.current = null;
  }, [id]);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!DATA_CONSENTS_ENABLED || !id) return;
    const listener = AppState.addEventListener('change', state => {
      // Retain the local decision while checking other-device changes.
      if (state !== 'active') { invalidateConsentChecks(); refreshing.current = null; }
      else void refresh();
    });
    const timer = setInterval(() => { if (AppState.currentState === 'active') void refresh(); }, 30_000);
    return () => { listener.remove(); clearInterval(timer); };
  }, [id, refresh]);
  const healthAllowed = !DATA_CONSENTS_ENABLED || (hydratedUser === id && clearing !== 'health' && !(cleanupFailed && cleanupScope.current === 'health') && runtime.userId === id && runtimeConsentAllowed('health'));
  const aiAllowed = !DATA_CONSENTS_ENABLED || (hydratedUser === id && !clearing && !cleanupFailed && runtime.userId === id && runtimeConsentAllowed('ai'));
  useEffect(() => {
    if (!DATA_CONSENTS_ENABLED) return;
    // Also clear data retained from an older app at the first active check.
    if (hydratedUser === id && runtime.snapshot?.enabled && runtime.userId === id) {
      const scope = !runtimeConsentAllowed('health') ? 'health' : !runtimeConsentAllowed('ai') ? 'ai' : null;
      const key = scope ? `${id}:${scope}:${runtime.snapshot.revision}:${runtime.snapshot.healthAllowed}:${runtime.snapshot.aiAllowed}` : null;
      if (scope && key !== lastDeniedCleanup.current) { lastDeniedCleanup.current = key; void cleanup(scope); }
    }
  }, [runtime, id, hydratedUser, healthAllowed, aiAllowed, cleanup]);
  const decide = useCallback(async (scope: DataConsentScope, decision: DataConsentDecision, locale: AppLocale) => {
    if (mutation.current) throw new Error('consent_mutation_pending');
    mutation.current = true; setBusy(true);
    const target = id;
    try {
      await recordDataConsent(scope, decision, locale);
      if (identity.current === target) setFailed(false);
    } finally {
      mutation.current = false; setBusy(false);
    }
  }, [id]);
  const mode = !DATA_CONSENTS_ENABLED || !id ? 'preview' :
    hydratedUser === id && runtime.snapshot && runtime.userId === id ? (runtime.snapshot.enabled ? 'active' : 'unavailable') :
    failed ? 'unavailable' : 'checking';
  return <Context.Provider value={{ mode, snapshot: runtime.snapshot?.userId === id ? runtime.snapshot : null, healthAllowed, aiAllowed,
    pending: runtime.pending.length > 0, busy: busy || clearing !== null, cleanupFailed, refresh, decide }}>{children}</Context.Provider>;
}
