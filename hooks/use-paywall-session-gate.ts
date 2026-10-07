import { useCallback, useEffect, useState } from 'react';
import { shouldRedirectToPaywallForState, shouldShowPaywall } from '@/lib/paywall';

export const PAYWALL_CHECK_TIMEOUT_MS = 15_000;
type Check = { userId: string | null; allowed: boolean; status: 'checking' | 'unavailable' | 'denied' | 'allowed' };
export type PaywallSessionGateOptions = {
  userId: string | null;
  pathname: string;
  revision: number;
  ready: boolean;
  excluded: boolean;
  onDenied: (pathname: string) => void;
};

/** UI continuity only. This never grants a tier, renews a lease or unlocks an API. */
export function usePaywallSessionGate({ userId, pathname, revision, ready, excluded, onDenied }: PaywallSessionGateOptions) {
  const [check, setCheck] = useState<Check>({ userId, allowed: false, status: 'checking' });
  const [retryRevision, setRetryRevision] = useState(0);
  // Reset during render so A -> B -> A (including logout/login with the same ID)
  // cannot briefly render A's old permission while the next effect starts.
  if (check.userId !== userId) setCheck({ userId, allowed: false, status: 'checking' });
  const retry = useCallback(() => {
    setCheck(previous => ({ ...previous, status: 'checking' }));
    setRetryRevision(value => value + 1);
  }, []);
  const blocking = Boolean(userId) && !excluded && (check.userId !== userId || !check.allowed);

  // Family/foreground updates may replace the request, but must not extend
  // the user's initial wait indefinitely. Only an explicit retry starts a
  // new visible waiting period; background recovery keeps retry available.
  useEffect(() => {
    if (!ready || !blocking) return;
    const timeout = setTimeout(() => {
      setCheck(previous => previous.userId === userId && !previous.allowed && previous.status === 'checking'
        ? { ...previous, status: 'unavailable' }
        : previous);
    }, PAYWALL_CHECK_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [userId, ready, blocking, retryRevision]);

  useEffect(() => {
    if (!ready || !userId || excluded) return;
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout>;
    setCheck(previous => previous.status === 'unavailable' ? previous : { ...previous, status: 'checking' });
    const run = async () => {
      try {
        const result = await Promise.race([
          shouldShowPaywall(undefined, userId),
          new Promise<never>((_, reject) => {
            timeout = setTimeout(() => reject(new Error('paywall_check_timeout')), PAYWALL_CHECK_TIMEOUT_MS);
          }),
        ]);
        if (cancelled) return;
        if (shouldRedirectToPaywallForState(result.state)) {
          setCheck({ userId, allowed: false, status: 'denied' });
          onDenied(pathname);
        } else if (!result.shouldShow) {
          setCheck({ userId, allowed: true, status: 'allowed' });
        } else {
          setCheck(previous => ({ ...previous, status: 'unavailable' }));
        }
      } catch {
        if (!cancelled) setCheck(previous => ({ ...previous, status: 'unavailable' }));
      } finally {
        clearTimeout(timeout);
      }
    };
    void run();
    return () => { cancelled = true; clearTimeout(timeout); };
  }, [userId, pathname, revision, retryRevision, ready, excluded, onDenied]);

  return { blocking, unavailable: blocking && check.userId === userId && check.status === 'unavailable', retry };
}
