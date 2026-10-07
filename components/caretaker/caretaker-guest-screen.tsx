import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, TextInput, View } from 'react-native';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '@/components/Header';
import { ThemedBackground } from '@/components/ThemedBackground';
import { ThemedText } from '@/components/ThemedText';
import { AccountLinkingQrModal } from '@/components/account-linking-qr-modal';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { LiquidGlassCard, LAYOUT_PAD, GLASS_OVERLAY, GLASS_OVERLAY_DARK } from '@/constants/DesignGuide';
import { CareSession, useCaretakerUi } from '@/components/caretaker/caretaker-screen';
import {
  acceptCaretakerGuestInvitation, createCaretakerGuestRequest, forgetCaretakerGuestSession,
  loadCaretakerGuestSession, type CaretakerGuestSession,
} from '@/lib/caretaker-guest';
import { buildCaretakerInvitationLink, parseCaretakerQr } from '@/lib/caretaker-qr';
import { normalizeCaretakerCode } from '@/lib/caretaker-access';
import { translateSleepTrackerText } from '@/lib/sleepTrackerTranslations';
import { translateDailyText } from '@/lib/dailyTranslations';

type Step = 'scan' | 'manual' | 'session';
export default function CaretakerGuestScreen() {
  const params = useLocalSearchParams<{ code?: string }>();
  // Key the flow by incoming code, so a second invitation never reuses stale input.
  return <GuestFlow key={typeof params.code === 'string' ? params.code : ''} initialCode={typeof params.code === 'string' ? params.code : ''} />;
}
function GuestFlow({ initialCode }: { initialCode: string }) {
  const s = useCaretakerUi();
  const { t } = s;
  const [trackingTab, setTrackingTab] = useState<'sleep' | 'daily'>('sleep');
  const [step, setStep] = useState<Step>(initialCode ? 'manual' : 'scan');
  const [code, setCode] = useState(initialCode);
  const [session, setSession] = useState<CaretakerGuestSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const alive = useRef(false);
  const joining = useRef(false);
  const request = useMemo(() => session ? createCaretakerGuestRequest(session.token) : null, [session]);
  useFocusEffect(useCallback(() => {
    alive.current = true;
    void loadCaretakerGuestSession().then(saved => {
      if (!alive.current) return;
      setSession(saved);
      if (saved && !initialCode) setStep('session');
    }).catch(() => { if (alive.current) setError(t.error); })
      .finally(() => { if (alive.current) setLoading(false); });
    return () => { alive.current = false; };
  }, [initialCode, t.error]));

  const join = async (value: string) => {
    if (joining.current) return;
    const normalized = normalizeCaretakerCode(value);
    setStep('manual'); setError('');
    if (!normalized) { setError(t.invalidCode); return; }
    joining.current = true; setBusy(true);
    try {
      const saved = await acceptCaretakerGuestInvitation(normalized);
      if (!alive.current) return;
      setSession(saved); setCode(''); setStep('session');
      router.setParams({ code: '' });
    } catch (e) {
      if (!alive.current) return;
      const problem = e as { message?: string; code?: string };
      setError(problem.message === 'invalid_invitation' ? t.invalidCode : problem.code === 'PGRST202' ? t.unavailable : t.error);
    } finally { joining.current = false; if (alive.current) setBusy(false); }
  };
  const leave = () => Alert.alert(t.leaveGuestTitle, t.leaveGuestBody, [
    { text: t.cancel, style: 'cancel' },
    { text: t.leaveGuest, style: 'destructive', onPress: () => {
      void forgetCaretakerGuestSession().then(() => {
        setSession(null); setCode(''); setStep('manual'); router.replace('/(auth)/login');
      }).catch(() => setError(t.error));
    } },
  ]);

  return <ThemedBackground style={{ flex: 1 }}>
    <Stack.Screen options={{ headerShown: false, gestureEnabled: step !== 'session' }} />
    <SafeAreaView style={{ flex: 1 }}>
      <Header topSafeAreaHandled title={step === 'session' ? (trackingTab === 'sleep' ? translateSleepTrackerText(s.locale, 'screen.title') : translateDailyText(s.locale, 'screen.title')) : step === 'scan' ? t.scanCode : t.guestEntry} subtitle={step === 'session' ? t.subtitle : t.guestHint}
        showBabySwitcher={false} showBackButton onBackPress={() => {
          if (busy) return;
          if (step !== 'manual') setStep('manual');
          else if (router.canGoBack()) router.back(); else router.replace('/(auth)/login');
        }} />
      {loading ? <ActivityIndicator color={s.accent} /> : step === 'session' && session && request ? (
        <CareSession key={session.grantId} {...s} grantId={session.grantId} request={request} onTabChange={setTrackingTab} />
      ) : step === 'scan' ? <AccountLinkingQrModal code={null} invitationLink={buildCaretakerInvitationLink('')}
        locale={s.locale} isDark={s.dark} parseCode={parseCaretakerQr} scanHint={t.qrScanHint}
        onClose={() => setStep('manual')} onScanned={value => { setCode(value); void join(value); }} /> : (
        <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: LAYOUT_PAD, gap: 20 }}>
          <LiquidGlassCard intensity={26} overlayColor={s.dark ? GLASS_OVERLAY_DARK : GLASS_OVERLAY}>
            <View style={s.cardStyle}>
              <IconSymbol name="qrcode" color={s.accent} size={30} />
              {s.text(t.manualCode, true)}
              {s.text(t.guestManualHint)}
              <TextInput accessibilityLabel={t.code} value={code} onChangeText={setCode} autoCapitalize="characters" autoCorrect={false}
                placeholder={t.code} placeholderTextColor={s.dark ? '#BCAEBF' : '#817583'} style={s.inputStyle} editable={!busy}
                onSubmitEditing={() => void join(code)} />
              {error && <ThemedText accessibilityRole="alert" style={{ color: s.foreground }}>{error}</ThemedText>}
              {busy && <ActivityIndicator color={s.accent} />}
              {s.button(t.guestStart, () => void join(code), busy || !normalizeCaretakerCode(code))}
              {s.button(t.scanCode, () => { setError(''); setStep('scan'); }, busy)}
            </View>
          </LiquidGlassCard>
          {session && <>
            {s.button(t.resumeGuest, () => setStep('session'), busy)}
            {s.button(t.leaveGuest, leave, busy)}
          </>}
        </ScrollView>
      )}
    </SafeAreaView>
  </ThemedBackground>;
}
