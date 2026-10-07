import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, Text, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

export const STARTUP_RECOVERY_DELAY_MS = 15_000;

/** Remains outside the navigator. A slow startup never implies authenticated access. */
export function StartupRecovery({ locale, onRetry }: { locale: string; onRetry: () => Promise<unknown> }) {
  const [unavailable, setUnavailable] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const copy = locale === 'en'
    ? { loading: 'Loading …', title: 'The app could not finish loading.', detail: 'Check your connection and try again. Your saved data is retained.', retry: 'Try again' }
    : locale === 'es'
      ? { loading: 'Cargando …', title: 'La app no ha podido terminar de cargar.', detail: 'Comprueba tu conexión e inténtalo de nuevo. Tus datos guardados se conservan.', retry: 'Reintentar' }
      : { loading: 'Lade …', title: 'Die App konnte noch nicht vollständig laden.', detail: 'Prüfe deine Verbindung und versuche es erneut. Deine gespeicherten Daten bleiben erhalten.', retry: 'Erneut versuchen' };
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
    <View testID="startup-recovery" style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 28 }}>
      {(!unavailable || retrying) && <ActivityIndicator size="large" color="#7D5A50" />}
      <Text accessibilityRole="header" style={{ marginTop: 20, color: '#7D5A50', fontSize: 18, textAlign: 'center' }}>{unavailable ? copy.title : copy.loading}</Text>
      {unavailable && <>
        <Text style={{ marginTop: 12, color: '#5A4A42', textAlign: 'center' }}>{copy.detail}</Text>
        <Pressable testID="startup-retry" accessibilityRole="button" accessibilityState={{ disabled: retrying }} disabled={retrying} onPress={() => void retry()} style={{ marginTop: 24, minHeight: 48, justifyContent: 'center', paddingHorizontal: 24, borderRadius: 14, backgroundColor: '#E9C9B6', opacity: retrying ? 0.6 : 1 }}>
          <Text style={{ color: '#332822', fontWeight: '600' }}>{copy.retry}</Text>
        </Pressable>
      </>}
    </View>
  );
}
