import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { ConnectionRecoveryScreen } from '@/components/ui/connection-recovery-screen';

export const STARTUP_RECOVERY_DELAY_MS = 15_000;

/** Remains outside the navigator. A slow startup never implies authenticated access. */
export function StartupRecovery({ locale, onRetry }: { locale: string; onRetry: () => Promise<unknown> }) {
  const [unavailable, setUnavailable] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const copy = locale === 'en'
    ? { loading: 'One moment …', checking: 'Lotti Baby is getting ready for you.', title: 'Let’s reconnect', detail: 'Lotti Baby couldn’t finish loading. Check your internet connection and try again.', retry: 'Try again' }
    : locale === 'es'
      ? { loading: 'Un momento …', checking: 'Lotti Baby se está preparando para ti.', title: 'Vamos a reconectar', detail: 'Lotti Baby no ha podido terminar de cargar. Comprueba tu conexión a internet e inténtalo de nuevo.', retry: 'Reintentar' }
      : { loading: 'Einen Moment …', checking: 'Lotti Baby macht sich für dich bereit.', title: 'Kurz verbinden', detail: 'Lotti Baby konnte noch nicht fertig laden. Prüfe deine Internetverbindung und versuche es erneut.', retry: 'Erneut versuchen' };
  useEffect(() => {
    mounted.current = true;
    const timer = setTimeout(() => {
      setUnavailable(true);
      void SplashScreen.hideAsync().catch(() => {});
    }, STARTUP_RECOVERY_DELAY_MS);
    return () => { mounted.current = false; clearTimeout(timer); };
  }, []);
  const retry = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setRetrying(true);
    try { await onRetry(); }
    catch { /* Keep the recovery UI; a failed request cannot resolve startup. */ }
    finally {
      inFlight.current = false;
      if (mounted.current) setRetrying(false);
    }
  }, [onRetry]);
  useEffect(() => {
    if (!unavailable) return;
    const listener = AppState.addEventListener('change', state => {
      if (state === 'active') void retry();
    });
    // A failed offline request should recover without an app restart when online.
    const timer = setInterval(() => { if (AppState.currentState === 'active') void retry(); }, STARTUP_RECOVERY_DELAY_MS);
    return () => { listener.remove(); clearInterval(timer); };
  }, [unavailable, retry]);
  return (
    <ConnectionRecoveryScreen testID="startup-recovery" unavailable={unavailable} retrying={retrying}
      title={unavailable ? copy.title : copy.loading} message={unavailable ? copy.detail : copy.checking}
      retryLabel={copy.retry} retryTestID="startup-retry" onRetry={() => void retry()} />
  );
}
