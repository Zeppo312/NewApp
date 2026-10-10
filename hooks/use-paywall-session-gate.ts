import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { supabaseUrl } from '@/lib/supabase';
import { verifyStartupAccess } from '@/lib/startupAccessVerification';
import { createStartupAccessSnapshot, persistStartupAccess, readStartupAccess, revokeStartupAccess, startupAccessRevision } from '@/lib/startupAccess';
import { onServerContact } from '@/lib/serverContact';

export const PAYWALL_CHECK_TIMEOUT_MS = 15_000;
export const STARTUP_ACCESS_RETRY_MS = 30_000;
type Check = { userId: string | null; allowed: boolean; accessRevision?: string; validUntil?: number; verifiedAt?: number; needsRecovery?: boolean; status: 'checking' | 'unavailable' | 'denied' | 'allowed' };
export type PaywallSessionGateOptions = {
  userId: string | null;
  pathname: string;
  revision: number;
  ready: boolean;
  excluded: boolean;
  onDenied: (pathname: string) => void;
};

/** Bounded local display continuity; never grants a tier or unlocks an API. */
export function usePaywallSessionGate({ userId, pathname, revision, ready, excluded, onDenied }: PaywallSessionGateOptions) {
  const [check, setCheck] = useState<Check>({ userId, allowed: false, status: 'checking' });
  const [retryRevision, setRetryRevision] = useState(0);
  const [recoveryRevision, setRecoveryRevision] = useState(0);
  const backendHost = new URL(supabaseUrl).host;
  const currentAccessRevision = userId ? startupAccessRevision({ backendHost, userId }) : undefined;
  const previousUser = useRef(userId);
  const lastStartedAt = useRef(0);
  // Reset during render so A -> B -> A (including logout/login with the same ID)
  // cannot briefly render A's old permission while the next effect starts.
  if (check.userId !== userId || (check.allowed && check.accessRevision !== currentAccessRevision)) {
    setCheck({ userId, allowed: false, status: 'checking' });
    setRecoveryRevision(value => value + 1);
  }
  useEffect(() => {
    const previous = previousUser.current;
    previousUser.current = userId;
    if (previous && previous !== userId) void revokeStartupAccess({ backendHost, userId: previous }).catch(() => {
      console.warn('Startup access could not be cleared');
    });
  }, [backendHost, userId]);
  const retry = useCallback(() => {
    setCheck(previous => ({ ...previous, status: 'checking' }));
    setRetryRevision(value => value + 1);
  }, []);
  const blocking = Boolean(userId) && !excluded && (check.userId !== userId || !check.allowed || check.accessRevision !== currentAccessRevision);

  useEffect(() => {
    if (!ready || !userId) return;
    let cancelled = false;
    void readStartupAccess({ backendHost, userId }).then(snapshot => {
      if (!cancelled && snapshot) setCheck(previous => previous.userId !== userId || previous.status === 'denied'
        || (previous.verifiedAt ?? 0) > snapshot.verifiedAt ? previous
        : { userId, allowed: true, accessRevision: startupAccessRevision({ backendHost, userId }), status: 'allowed', needsRecovery: true,
          validUntil: snapshot.validUntil, verifiedAt: snapshot.verifiedAt });
    });
    return () => { cancelled = true; };
  }, [backendHost, ready, userId]);

  useEffect(() => {
    if (!check.allowed || !check.validUntil) return;
    const timeout = setTimeout(() => {
      setCheck(previous => ({ ...previous, allowed: false, status: 'unavailable', needsRecovery: true }));
      setRecoveryRevision(value => value + 1);
    }, Math.max(0, check.validUntil - Date.now()));
    return () => clearTimeout(timeout);
  }, [check.allowed, check.validUntil]);

  useEffect(() => {
    if (!ready || !userId || excluded) return;
    const recover = () => {
      if (AppState.currentState !== 'active') return;
      const now = Date.now();
      const expired = check.allowed && Boolean(check.validUntil && (check.validUntil <= now || (check.verifiedAt ?? 0) > now));
      if (expired) setCheck(previous => ({ ...previous, allowed: false, status: 'unavailable', needsRecovery: true }));
      if (expired || now - lastStartedAt.current >= STARTUP_ACCESS_RETRY_MS) {
        setRecoveryRevision(value => value + 1);
      }
    };
    const unsubscribe = onServerContact(recover);
    const appState = AppState.addEventListener('change', state => { if (state === 'active') recover(); });
    const timer = check.needsRecovery ? setInterval(recover, STARTUP_ACCESS_RETRY_MS) : undefined;
    return () => { unsubscribe(); appState.remove(); clearInterval(timer); };
  }, [ready, userId, excluded, check.needsRecovery, check.allowed, check.validUntil, check.verifiedAt]);

  // Family/foreground updates may replace the request, but must not extend
  // the user's initial wait indefinitely. Only an explicit retry starts a
  // new visible waiting period; background recovery keeps retry available.
  useEffect(() => {
    if (!ready || !blocking) return;
    const timeout = setTimeout(() => {
      setCheck(previous => previous.userId === userId && !previous.allowed && previous.status === 'checking'
        ? { ...previous, status: 'unavailable', needsRecovery: true }
        : previous);
    }, PAYWALL_CHECK_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [userId, ready, blocking, retryRevision]);

  useEffect(() => {
    if (!ready || !userId || excluded) return;
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    const scope = { backendHost, userId };
    const accessRevision = startupAccessRevision(scope);
    lastStartedAt.current = Date.now();
    setCheck(previous => previous.status === 'unavailable' ? previous : { ...previous, status: 'checking' });
    const run = async () => {
      try {
        const result = await Promise.race([
          verifyStartupAccess(userId, controller.signal),
          new Promise<never>((_, reject) => {
            timeout = setTimeout(() => { controller.abort(); reject(new Error('paywall_check_timeout')); }, PAYWALL_CHECK_TIMEOUT_MS);
          }),
        ]);
        if (cancelled || accessRevision !== startupAccessRevision(scope)) return;
        if (result.status === 'denied') {
          setCheck({ userId, allowed: false, status: 'denied' });
          void revokeStartupAccess(scope).catch(() => { console.warn('Startup access revocation could not be saved'); });
          onDenied(pathname);
        } else if (result.status === 'allowed') {
          const snapshot = createStartupAccessSnapshot(scope, result.evidence);
          if (!snapshot) {
            setCheck(previous => ({ ...previous, status: 'unavailable', needsRecovery: true }));
            return;
          }
          // Open immediately on verified access; disk errors cannot block an
          // online session, but they also cannot claim a durable offline grant.
          setCheck({ userId, allowed: true, accessRevision, status: 'allowed', validUntil: snapshot.validUntil, verifiedAt: snapshot.verifiedAt });
          void persistStartupAccess(scope, result.evidence, accessRevision).catch(() => {
            console.warn('Startup access could not be saved');
          });
        } else {
          setCheck(previous => ({ ...previous, status: 'unavailable', needsRecovery: true }));
        }
      } catch {
        if (!cancelled) setCheck(previous => ({ ...previous, status: 'unavailable', needsRecovery: true }));
      } finally {
        clearTimeout(timeout);
      }
    };
    void run();
    return () => { cancelled = true; controller.abort(); clearTimeout(timeout); };
  }, [backendHost, userId, pathname, revision, retryRevision, recoveryRevision, ready, excluded, onDenied]);

  return { blocking, unavailable: blocking && check.userId === userId && check.status === 'unavailable', retry };
}
