import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Linking, Pressable, Text, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useLocale } from "@/contexts/LocaleContext";
import {
  ConsentCard,
  ConsentPage,
  ConsentScopeIcon,
  DataConsentPanel,
  consentStyles as s,
  useConsentColors,
} from "@/components/privacy/DataConsentPanel";
import { activeDataConsentCopy, dataConsentCopy } from "@/lib/dataConsentCopy";
import type { DataConsentScope } from "@/lib/dataConsentTypes";
import { useDataConsents } from "@/contexts/DataConsentContext";
import { useAuth } from "@/contexts/AuthContext";
import { useConsentGate } from "@/components/privacy/DataConsentBoundary";
import { IconSymbol } from "@/components/ui/IconSymbol";
export default function DataConsentsScreen() {
  const consent = useDataConsents();
  return consent.mode === 'preview' ? <ConsentPreview /> : <EffectiveConsents />;
}
function ConsentPreview() {
  const { locale } = useLocale();
  const c = useConsentColors();
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
  const close = () => router.canGoBack() ? router.back() : router.replace("/");
  return (
    <ConsentPage title={copy.settingsTitle} onBack={close} backLabel={copy.close}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={s.header}>
        <Text style={[s.intro, { color: c.secondary }]}>{copy.settingsIntro}</Text>
      </View>
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
            <ConsentCard key={scope}>
              <View style={s.headerRow}>
                <ConsentScopeIcon scope={scope} />
                <Text style={[s.cardTitle, { flex: 1, color: c.text }]}>
                  {scope === "health" ? copy.healthLabel : copy.aiLabel}
                </Text>
              </View>
              <Text style={[s.body, { color: c.text }]}>
                {choices[scope] === null
                  ? copy.undecided
                  : choices[scope]
                    ? copy.granted
                    : copy.disabled}
              </Text>
              <Pressable
                accessibilityRole="button"
                style={[s.secondary, { borderColor: c.tintBorder, backgroundColor: c.inner }]}
                onPress={() => setReview(scope)}
              >
                <Text style={[s.secondaryText, { color: c.accent }]}>{copy.review}</Text>
              </Pressable>
              {choices[scope] !== null && (
                <Pressable
                  accessibilityRole="button"
                  style={[s.secondary, { borderColor: c.tintBorder, backgroundColor: c.inner }]}
                  onPress={() =>
                    setChoices((current) => ({ ...current, [scope]: null }))
                  }
                >
                  <Text style={[s.secondaryText, { color: c.accent }]}>{copy.revoke}</Text>
                </Pressable>
              )}
            </ConsentCard>
          ))}
          <View style={s.header}><Text style={[s.small, { color: c.secondary }]}>{copy.withdrawal}</Text></View>
        </>
      )}
      <Pressable
        accessibilityRole="button"
        onPress={close}
        style={s.link}
      >
        <Text style={[s.linkText, { color: c.accent }]}>{copy.close}</Text>
      </Pressable>
    </ConsentPage>
  );
}

function EffectiveConsents() {
  const { locale } = useLocale();
  const { signOut } = useAuth();
  const consent = useDataConsents();
  const gate = useConsentGate();
  const router = useRouter();
  const c = useConsentColors();
  const params = useLocalSearchParams<{ scope?: string | string[] }>();
  const requestedScope = params.scope === 'health' || params.scope === 'ai' ? params.scope : null;
  const copy = activeDataConsentCopy[locale];
  const [review, setReview] = useState<DataConsentScope | null>(null);
  const [error, setError] = useState(false);
  const reviewedRequests = useRef(new Set<DataConsentScope>());
  const requestedAllowed = requestedScope === 'health' ? consent.healthAllowed : requestedScope === 'ai' ? consent.aiAllowed : false;
  const decided = (scope: DataConsentScope) => {
    const record = consent.snapshot?.[scope];
    return !!record && record.documentVersion === consent.snapshot?.documentVersion;
  };
  const ready = consent.mode === 'active' && !consent.busy && !consent.pending;
  useEffect(() => {
    if (!requestedScope || requestedAllowed || !ready) return;
    // A function hint opens the relevant unchecked dialog once. If health is
    // missing, ask for that prerequisite first. Closing/refusing never nags.
    const scope = requestedScope === 'ai' && !consent.healthAllowed ? 'health' : requestedScope;
    if (reviewedRequests.current.has(scope)) return;
    reviewedRequests.current.add(scope); setError(false); setReview(scope);
  }, [requestedScope, requestedAllowed, ready, consent.healthAllowed]);
  useEffect(() => {
    // First run: lead straight into the open health decision, once.
    if (!gate.gated || requestedScope || !ready || decided('health') || reviewedRequests.current.has('health')) return;
    reviewedRequests.current.add('health'); setReview('health');
  });
  const decide = async (scope: DataConsentScope, decision: 'granted' | 'declined' | 'revoked') => {
    if (consent.busy) return;
    setError(false);
    try {
      await consent.decide(scope, decision, locale);
      // The optional AI choice is asked where an AI feature is opened, not here.
      setReview(null);
    }
    catch { setError(true); }
  };
  const status = (scope: DataConsentScope) => {
    const record = consent.snapshot?.[scope];
    if (!record || !decided(scope)) return { label: copy.undecided, icon: 'circle', color: c.accent, bg: c.tint } as const;
    if (record.decision === 'granted') return { label: copy.granted, icon: 'checkmark.circle.fill', color: c.dark ? '#8FD9B0' : '#2F7D5B', bg: c.dark ? 'rgba(143,217,176,0.16)' : 'rgba(47,125,91,0.12)' } as const;
    return { label: record.decision === 'revoked' ? copy.revoked : copy.disabled, icon: 'xmark.circle', color: c.secondary, bg: c.inner } as const;
  };
  // Opened from Settings or a feature: the header back button returns there
  // instead of a jump to Home. The blocking first-run flow only leaves via "Weiter".
  const canGoBack = !gate.gated && router.canGoBack();
  const leave = requestedAllowed && router.canGoBack() ? { label: copy.returnToFunction, go: () => router.back() }
    : !consent.healthAllowed || canGoBack ? null
    : { label: gate.gated ? copy.proceed : copy.continue, go: () => gate.gated ? gate.release() : router.replace('/') };
  const links = [
    { label: copy.privacy, icon: 'lock.shield', role: 'link', go: () => void Linking.openURL(`https://lottibaby.de/datenschutz?lang=${locale}`) },
    { label: copy.account, icon: 'trash', role: 'button', go: () => router.push('/account-deletion') },
    { label: copy.support, icon: 'questionmark.circle', role: 'button', go: () => router.push('/support') },
    { label: copy.signOut, icon: 'person.crop.circle', role: 'button', go: () => void signOut() },
  ] as const;
  const secondary = [s.secondary, { borderColor: c.tintBorder, backgroundColor: c.inner }];
  const alert = (message: string) => <ConsentCard><Text accessibilityRole="alert" style={[s.error, { color: c.error }]}>{message}</Text></ConsentCard>;
  return <ConsentPage title={copy.settingsTitle} backLabel={copy.cancel}
    onBack={canGoBack && !consent.busy ? () => { if (review) { setReview(null); setError(false); } else router.back(); } : undefined}>
    <Stack.Screen options={{ headerShown: false }} />
    {!review && <View style={s.header}><Text style={[s.intro, { color: c.secondary }]}>{copy.settingsIntro}</Text></View>}
    {consent.mode === 'checking' && <ConsentCard style={{ alignItems: 'center' }}><ActivityIndicator /><Text style={[s.body, { color: c.text }]}>{copy.loading}</Text></ConsentCard>}
    {consent.mode === 'unavailable' && alert(consent.snapshot?.enabled === false ? copy.releasePending : copy.unavailable)}
    {consent.pending && alert(copy.pending)}
    {consent.cleanupFailed && alert(copy.cleanupError)}
    {(consent.mode === 'unavailable' || consent.pending || consent.cleanupFailed) && <View style={s.header}><Pressable accessibilityRole="button" disabled={consent.busy} onPress={() => void consent.refresh()} style={secondary}><Text style={[s.secondaryText, { color: c.accent }]}>{copy.retry}</Text></Pressable></View>}
    {review && consent.mode === 'active' ? <DataConsentPanel key={`${review}:${locale}`} active scope={review} locale={locale} busy={consent.busy} error={error}
      onDecide={granted => void decide(review, granted ? 'granted' : consent.snapshot?.[review]?.decision === 'granted' ? 'revoked' : 'declined')} onCancel={() => { setReview(null); setError(false); }} /> :
      consent.mode === 'active' && <>
        {!consent.healthAllowed && <ConsentCard><View style={[s.notice, { backgroundColor: c.tint, borderColor: c.tintBorder }]}><IconSymbol name="info.circle.fill" size={18} color={c.accent} /><Text style={[s.noticeText, { color: c.text }]}>{copy.healthConsequence}</Text></View></ConsentCard>}
        {(gate.gated ? ['health'] as const : ['health', 'ai'] as const).map(scope => {
          const record = consent.snapshot?.[scope];
          const state = status(scope);
          const locked = scope === 'ai' && !consent.healthAllowed;
          const disabled = consent.busy || consent.pending || locked;
          // Only the open health decision is the main action; AI stays optional.
          const primary = scope === 'health' && !record;
          return <ConsentCard key={scope}>
            <View style={s.headerRow}>
              <ConsentScopeIcon scope={scope} />
              <Text style={[s.cardTitle, { flex: 1, color: c.text }]}>{scope === 'health' ? copy.healthLabel : copy.aiLabel}</Text>
            </View>
            <View style={s.statusRow}>
              <View style={[s.status, { backgroundColor: state.bg }]}><IconSymbol name={state.icon} size={16} color={state.color} /><Text style={[s.statusText, { color: state.color }]}>{state.label}</Text></View>
              <View style={[s.badge, { backgroundColor: scope === 'health' ? c.tint : c.neutral }]}><Text style={[s.badgeText, { color: scope === 'health' ? c.accent : c.secondary }]}>{scope === 'health' ? copy.healthBadge : copy.aiBadge}</Text></View>
            </View>
            {locked && <Text style={[s.small, { color: c.secondary }]}>{copy.aiNeedsHealth}</Text>}
            <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} style={[primary ? s.button : secondary, disabled && s.buttonDisabled]} onPress={() => { setError(false); setReview(scope); }}><Text style={primary ? s.buttonText : [s.secondaryText, { color: c.accent }]}>{record ? copy.review : copy.viewConsent}</Text></Pressable>
            {record?.decision === 'granted' && <Pressable accessibilityRole="button" disabled={consent.busy} style={[s.link, s.linkTight]} onPress={() => void decide(scope,'revoked')}><Text style={[s.linkText, { color: c.accent }]}>{copy.revoke}</Text></Pressable>}
          </ConsentCard>;
        })}
      </>}
    {error && !review && alert(copy.error)}
    {leave && !review && <View style={s.header}><Pressable accessibilityRole="button" disabled={consent.busy} style={[s.button, consent.busy && s.buttonDisabled]} onPress={leave.go}><Text style={s.buttonText}>{leave.label}</Text></Pressable></View>}
    <>
      {!review && <View style={s.header}><Text style={[s.small, { color: c.secondary }]}>{copy.withdrawal}</Text></View>}
      <ConsentCard style={{ padding: 0, paddingVertical: 4, gap: 0 }}>{links.map((link, index) => <React.Fragment key={link.label}>
        {index > 0 && <View style={[s.menuDivider, { backgroundColor: c.divider }]} />}
        <Pressable accessibilityRole={link.role} disabled={consent.busy && link.role === 'button'} style={s.menuRow} onPress={link.go}>
          <IconSymbol name={link.icon} size={20} color={c.accent} />
          <Text style={[s.menuText, { color: c.text }]}>{link.label}</Text>
          <IconSymbol name={link.role === 'link' ? 'arrow.up.right' : 'chevron.right'} size={14} color={c.muted} />
        </Pressable>
      </React.Fragment>)}</ConsentCard>
    </>
  </ConsentPage>;
}
