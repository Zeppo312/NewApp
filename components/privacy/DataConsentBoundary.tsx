import React, { useEffect } from 'react';
import { ActivityIndicator, Pressable, Text } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useAuth } from '@/contexts/AuthContext';
import { useLocale } from '@/contexts/LocaleContext';
import { useDataConsents } from '@/contexts/DataConsentContext';
import { DATA_CONSENTS_ENABLED } from '@/lib/dataConsentRuntime';
import { activeDataConsentCopy } from '@/lib/dataConsentCopy';
import { ConsentPage, consentStyles as s } from './DataConsentPanel';

// Explicit protected root routes prevent an undeclared route being auto-added
// by Expo Router to the reduced navigator. The route inventory is tested.
export const protectedConsentRoutes = ['index','(tabs)','(auth)','auth/callback','auth/google-callback','auth/reset-password',
  'admin-dashboard','baby-names','baby-size','caregiver','caregiver-join','debug-notifications',
  'doctor-questions','dsgvo','feature-requests','frag-lotti','invite','lottis-empfehlungen','lottis-fuersorge',
  'loyalty-cards','milestones','moderation-admin','my-recipes','paywall','paywall-access-admin','paywall-content-admin',
  'planner/index','pregnancy-briefing','pregnancy-setup','pregnancy-stats','prints-shop','profil','recipe-generator',
  'startup-message-admin','subscription-features-admin','tooth-tracker','wochenmoment'];
export function DataConsentBoundary({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const consent = useDataConsents();
  const checking = DATA_CONSENTS_ENABLED && (loading || (!!user && consent.mode === 'checking'));
  const blocked = DATA_CONSENTS_ENABLED && (loading || (!!user && !consent.healthAllowed));
  useEffect(() => { if (blocked && !checking) void SplashScreen.hideAsync(); }, [blocked, checking]);
  // Do not navigate into Settings while the saved decision is being restored.
  if (checking) return <ConsentPage><ActivityIndicator /></ConsentPage>;
  if (!blocked) return <>{children}</>;
  return <Stack screenOptions={{ headerShown: false }} initialRouteName="data-consents">
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
  </Stack>;
}
export function AiConsentGate({ children }: { children: React.ReactNode }) {
  const consent = useDataConsents();
  const { locale } = useLocale(); const router = useRouter(); const copy = activeDataConsentCopy[locale];
  if (consent.aiAllowed) return <>{children}</>;
  return <ConsentPage><Text style={s.title}>{copy.aiTitle}</Text><Text style={s.body}>{copy.aiRequired}</Text>
    <Pressable accessibilityRole="button" style={s.button} onPress={() => router.push({ pathname: '/data-consents', params: { scope: 'ai' } })}><Text style={s.buttonText}>{copy.viewConsent}</Text></Pressable>
    <Pressable accessibilityRole="button" style={s.link} onPress={() => router.canGoBack() ? router.back() : router.replace('/')}><Text style={s.linkText}>{copy.cancel}</Text></Pressable>
  </ConsentPage>;
}
