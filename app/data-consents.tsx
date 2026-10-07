import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Linking, Pressable, Text, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useLocale } from "@/contexts/LocaleContext";
import {
  ConsentPage,
  DataConsentPanel,
  consentStyles as s,
} from "@/components/privacy/DataConsentPanel";
import { activeDataConsentCopy, dataConsentCopy } from "@/lib/dataConsentCopy";
import type { DataConsentScope } from "@/lib/dataConsentTypes";
import { useDataConsents } from "@/contexts/DataConsentContext";
import { useAuth } from "@/contexts/AuthContext";
export default function DataConsentsScreen() {
  const consent = useDataConsents();
  return consent.mode === 'preview' ? <ConsentPreview /> : <EffectiveConsents />;
}
function ConsentPreview() {
  const { locale } = useLocale();
  const [choices, setChoices] = useState<
    Record<DataConsentScope, boolean | null>
  >({ health: null, ai: null });
  const router = useRouter();
  const copy = dataConsentCopy[locale];
  const [review, setReview] = useState<DataConsentScope | null>(null);
  // UI preview only. No persistence, network calls, access checks or effects.
  const decide = (scope: DataConsentScope, granted: boolean) => {
    setChoices((current) => ({ ...current, [scope]: granted }));
    setReview(null);
  };
  return (
    <ConsentPage>
      <Stack.Screen options={{ headerShown: false }} />
      <Text style={s.title}>{copy.settingsTitle}</Text>
      <Text style={s.body}>{copy.settingsIntro}</Text>
      {review ? (
        <DataConsentPanel
          key={`${review}:${locale}`}
          scope={review}
          locale={locale}
          onDecide={(value) => void decide(review, value)}
          onCancel={() => setReview(null)}
        />
      ) : (
        <>
          {(["health", "ai"] as const).map((scope) => (
            <View key={scope} style={s.card}>
              <Text style={s.title}>
                {scope === "health" ? copy.healthLabel : copy.aiLabel}
              </Text>
              <Text style={s.body}>
                {choices[scope] === null
                  ? copy.undecided
                  : choices[scope]
                    ? copy.granted
                    : copy.disabled}
              </Text>
              <Pressable
                accessibilityRole="button"
                style={s.secondary}
                onPress={() => setReview(scope)}
              >
                <Text style={s.linkText}>{copy.review}</Text>
              </Pressable>
              {choices[scope] !== null && (
                <Pressable
                  accessibilityRole="button"
                  style={s.secondary}
                  onPress={() =>
                    setChoices((current) => ({ ...current, [scope]: null }))
                  }
                >
                  <Text style={s.linkText}>{copy.revoke}</Text>
                </Pressable>
              )}
            </View>
          ))}
          <Text style={s.body}>{copy.withdrawal}</Text>
        </>
      )}
      <Pressable
        accessibilityRole="button"
        onPress={() =>
          router.canGoBack() ? router.back() : router.replace("/")
        }
        style={s.link}
      >
        <Text style={s.linkText}>{copy.close}</Text>
      </Pressable>
    </ConsentPage>
  );
}

function EffectiveConsents() {
  const { locale } = useLocale();
  const { signOut } = useAuth();
  const consent = useDataConsents();
  const router = useRouter();
  const params = useLocalSearchParams<{ scope?: string | string[] }>();
  const requestedScope = params.scope === 'health' || params.scope === 'ai' ? params.scope : null;
  const copy = activeDataConsentCopy[locale];
  const [review, setReview] = useState<DataConsentScope | null>(null);
  const [error, setError] = useState(false);
  const reviewedRequests = useRef(new Set<DataConsentScope>());
  const requestedAllowed = requestedScope === 'health' ? consent.healthAllowed : requestedScope === 'ai' ? consent.aiAllowed : false;
  useEffect(() => {
    if (!requestedScope || requestedAllowed || consent.mode !== 'active' || consent.busy || consent.pending) return;
    // A function hint opens the relevant unchecked dialog once. If health is
    // missing, ask for that prerequisite first. Closing/refusing never nags.
    const scope = requestedScope === 'ai' && !consent.healthAllowed ? 'health' : requestedScope;
    if (reviewedRequests.current.has(scope)) return;
    reviewedRequests.current.add(scope); setError(false); setReview(scope);
  }, [requestedScope, requestedAllowed, consent.mode, consent.busy, consent.pending, consent.healthAllowed]);
  const decide = async (scope: DataConsentScope, decision: 'granted' | 'declined' | 'revoked') => {
    if (consent.busy) return;
    setError(false);
    try { await consent.decide(scope, decision, locale); setReview(null); }
    catch { setError(true); }
  };
  return <ConsentPage>
    <Stack.Screen options={{ headerShown: false }} />
    <Text style={s.title}>{copy.settingsTitle}</Text><Text style={s.body}>{copy.settingsIntro}</Text>
    {consent.mode === 'checking' && <><ActivityIndicator /><Text style={s.body}>{copy.loading}</Text></>}
    {consent.mode === 'unavailable' && <Text accessibilityRole="alert" style={s.error}>{consent.snapshot?.enabled === false ? copy.releasePending : copy.unavailable}</Text>}
    {consent.pending && <Text accessibilityRole="alert" style={s.error}>{copy.pending}</Text>}
    {consent.cleanupFailed && <Text accessibilityRole="alert" style={s.error}>{copy.cleanupError}</Text>}
    {consent.mode === 'active' && !consent.healthAllowed && !review && <Text style={s.body}>{copy.healthConsequence}</Text>}
    {(consent.mode === 'unavailable' || consent.pending || consent.cleanupFailed) && <Pressable accessibilityRole="button" disabled={consent.busy} onPress={() => void consent.refresh()} style={s.secondary}><Text style={s.linkText}>{copy.retry}</Text></Pressable>}
    {review && consent.mode === 'active' ? <DataConsentPanel key={`${review}:${locale}`} active scope={review} locale={locale} busy={consent.busy} error={error}
      onDecide={granted => void decide(review, granted ? 'granted' : consent.snapshot?.[review]?.decision === 'granted' ? 'revoked' : 'declined')} onCancel={() => { setReview(null); setError(false); }} /> :
      consent.mode === 'active' && <>{(['health','ai'] as const).map(scope => {
        const record = consent.snapshot?.[scope];
        const validVersion = record?.documentVersion === consent.snapshot?.documentVersion;
        const label = !record || !validVersion ? copy.undecided : record.decision === 'granted' ? copy.granted : record.decision === 'revoked' ? copy.revoked : copy.disabled;
        return <View key={scope} style={s.card}><Text style={s.title}>{scope === 'health' ? copy.healthLabel : copy.aiLabel}</Text><Text style={s.body}>{label}</Text>
          <Pressable accessibilityRole="button" disabled={consent.busy || consent.pending || (scope === 'ai' && !consent.healthAllowed)} style={s.secondary} onPress={() => { setError(false); setReview(scope); }}><Text style={s.linkText}>{record ? copy.review : copy.viewConsent}</Text></Pressable>
          {record?.decision === 'granted' && <Pressable accessibilityRole="button" disabled={consent.busy} style={s.secondary} onPress={() => void decide(scope,'revoked')}><Text style={s.linkText}>{copy.revoke}</Text></Pressable>}
        </View>;
      })}</>}
    {error && !review && <Text accessibilityRole="alert" style={s.error}>{copy.error}</Text>}
    <Text style={s.body}>{copy.withdrawal}</Text>
    <Pressable accessibilityRole="link" style={s.link} onPress={() => void Linking.openURL(`https://lottibaby.de/datenschutz?lang=${locale}`)}><Text style={s.linkText}>{copy.privacy}</Text></Pressable>
    <Pressable accessibilityRole="button" disabled={consent.busy} style={s.link} onPress={() => router.push('/account-deletion')}><Text style={s.linkText}>{copy.account}</Text></Pressable>
    <Pressable accessibilityRole="button" style={s.link} onPress={() => router.push('/support')}><Text style={s.linkText}>{copy.support}</Text></Pressable>
    {requestedAllowed && router.canGoBack() ?
      <Pressable accessibilityRole="button" disabled={consent.busy} style={s.secondary} onPress={() => router.back()}><Text style={s.linkText}>{copy.returnToFunction}</Text></Pressable> :
      consent.healthAllowed && <Pressable accessibilityRole="button" disabled={consent.busy} style={s.secondary} onPress={() => router.replace('/')}><Text style={s.linkText}>{copy.continue}</Text></Pressable>}
    <Pressable accessibilityRole="button" disabled={consent.busy} style={s.link} onPress={() => void signOut()}><Text style={s.linkText}>{copy.signOut}</Text></Pressable>
  </ConsentPage>;
}
