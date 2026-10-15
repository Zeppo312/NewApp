import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useAuth } from '@/contexts/AuthContext';
import { useLocale } from '@/contexts/LocaleContext';
import { useDataConsents } from '@/contexts/DataConsentContext';
import { DATA_CONSENTS_ENABLED } from '@/lib/dataConsentRuntime';
import { activeDataConsentCopy } from '@/lib/dataConsentCopy';
import { NavigationProvider } from '@/contexts/NavigationContext';
import { ConsentCard, ConsentPage, ConsentScopeIcon, consentStyles as s, useConsentColors } from './DataConsentPanel';

// Explicit protected root routes prevent an undeclared route being auto-added
// by Expo Router to the reduced navigator. The route inventory is tested.
export const protectedConsentRoutes = ['index','(tabs)','(auth)','auth/callback','auth/google-callback','auth/reset-password',
  'admin-dashboard','baby-names','baby-size','caregiver','caregiver-join','debug-notifications',
  'doctor-questions','dsgvo','feature-requests','frag-lotti','invite','lottis-empfehlungen','lottis-fuersorge',
  'loyalty-cards','milestones','moderation-admin','my-recipes','paywall','paywall-access-admin','paywall-content-admin',
  'planner/index','pregnancy-briefing','pregnancy-setup','pregnancy-stats','prints-shop','profil','recipe-generator',
  'startup-message-admin','subscription-features-admin','tooth-tracker','wochenmoment'];
type ConsentGate = { gated: boolean; release: () => void };
const ConsentGateContext = createContext<ConsentGate>({ gated: false, release: () => {} });
/** Inside the blocking consent flow; `release` hands over to the full app. */
export const useConsentGate = () => useContext(ConsentGateContext);
export function DataConsentBoundary({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const consent = useDataConsents();
  const checking = DATA_CONSENTS_ENABLED && (loading || (!!user && consent.mode === 'checking'));
  const blocked = DATA_CONSENTS_ENABLED && (loading || (!!user && !consent.healthAllowed));
  // Once the gate was shown, granting health must not swap the navigator away
  // mid-flow: the separate AI choice still follows. The user leaves explicitly.
  const [heldFor, setHeldFor] = useState<string | null>(null);
  const userId = user?.id ?? null;
  useEffect(() => { if (blocked && !checking && userId) setHeldFor(userId); }, [blocked, checking, userId]);
  const held = !!userId && heldFor === userId;
  const gate = useMemo<ConsentGate>(() => ({ gated: true, release: () => setHeldFor(null) }), []);
  useEffect(() => { if (blocked && !checking) void SplashScreen.hideAsync(); }, [blocked, checking]);
  // Do not navigate into Settings while the saved decision is being restored.
  if (checking) return <ConsentPage><ActivityIndicator /></ConsentPage>;
  if (!blocked && !held) return <>{children}</>;
  // The shared Header needs navigation history before the full app mounts.
  return <ConsentGateContext.Provider value={gate}><NavigationProvider><Stack screenOptions={{ headerShown: false }} initialRouteName="data-consents">
    <Stack.Screen name="data-consents" />
    <Stack.Screen name="app-settings" />
    <Stack.Screen name="subscription" />
    <Stack.Screen name="account-deletion" />
    <Stack.Screen name="datenschutz" />
    <Stack.Screen name="nutzungsbedingungen" />
    <Stack.Screen name="impressum" />
    <Stack.Screen name="support" />
    <Stack.Screen name="+not-found" />
    <Stack.Protected guard={false}>{protectedConsentRoutes.map(name => <Stack.Screen key={name} name={name} />)}</Stack.Protected>
  </Stack></NavigationProvider></ConsentGateContext.Provider>;
}
export function AiConsentGate({ children }: { children: React.ReactNode }) {
  const consent = useDataConsents();
  const c = useConsentColors();
  const { locale } = useLocale(); const router = useRouter(); const copy = activeDataConsentCopy[locale];
  if (consent.aiAllowed) return <>{children}</>;
  const leave = () => router.canGoBack() ? router.back() : router.replace('/');
  return <ConsentPage title={copy.aiTitle} onBack={leave} backLabel={copy.cancel}><ConsentCard>
    <View style={s.headerRow}><ConsentScopeIcon scope="ai" /><Text accessibilityRole="header" style={[s.cardTitle, { flex: 1, color: c.text }]}>{copy.aiTitle}</Text></View>
    <Text style={[s.body, { color: c.text }]}>{copy.aiRequired}</Text>
    <Pressable accessibilityRole="button" style={s.button} onPress={() => router.push({ pathname: '/data-consents', params: { scope: 'ai' } })}><Text style={s.buttonText}>{copy.viewConsent}</Text></Pressable>
    <Pressable accessibilityRole="button" style={s.link} onPress={leave}><Text style={[s.linkText, { color: c.accent }]}>{copy.cancel}</Text></Pressable>
  </ConsentCard></ConsentPage>;
}
