import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Pressable, ScrollView, Share, Switch, TextInput, View } from 'react-native';
import Header from '@/components/Header';
import BabySwitcherButton from '@/components/BabySwitcherButton';
import AnimatedButton from '@/components/animations/AnimatedButton';
import { TimePickerField } from '@/components/SleepQuickAddModal';
import { CaretakerTrackingView } from '@/components/caretaker/caretaker-tracking-view';
import { Colors } from '@/constants/Colors';
import { LiquidGlassCard, PRIMARY, LAYOUT_PAD, GLASS_OVERLAY, GLASS_OVERLAY_DARK } from '@/constants/DesignGuide';
import { router, Redirect, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { AccountLinkingQrModal } from '@/components/account-linking-qr-modal';
import { buildCaretakerInvitationLink, formatCaretakerCode } from '@/lib/caretaker-qr';
import type { CaretakerRequester } from '@/lib/caretaker-guest';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSubscriptionTier } from '@/lib/entitlements';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveBaby } from '@/contexts/ActiveBabyContext';
import { useLocale } from '@/contexts/LocaleContext';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import { ThemedText } from '@/components/ThemedText';
import { ThemedBackground } from '@/components/ThemedBackground';
import { caretakerCopy } from '@/lib/caretaker-copy';
import {
  caretakerGrantState, caretakerRequest, caretakerSnapshotLease, validateCaretakerPeriod,
  type CaretakerCommand, type CaretakerGrant, type CaretakerSnapshot,
} from '@/lib/caretaker-access';

export function useCaretakerUi() {
  const { locale } = useLocale();
  const t = caretakerCopy(locale);
  const colors = useAdaptiveColors();
  const dark = colors.effectiveScheme === 'dark' || colors.isDarkBackground;
  const foreground = dark ? Colors.dark.textPrimary : '#5C4033';
  const accent = dark ? '#A26BFF' : PRIMARY;
  const formatDate = (value: string) => new Date(value).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
  const text = (value: string, large = false) => <ThemedText style={{ color: foreground, fontSize: large ? 22 : 16, lineHeight: large ? 29 : 24, fontWeight: large ? '600' : '400' }}>{value}</ThemedText>;
  const button = (label: string, onPress: () => void, disabled = false) => (
    <AnimatedButton accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
      style={{ minHeight: 48, padding: 14, borderRadius: 14, backgroundColor: accent, opacity: disabled ? 0.45 : 1, alignItems: 'center', justifyContent: 'center' }}>
      <ThemedText style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700', textAlign: 'center' }}>{label}</ThemedText>
    </AnimatedButton>
  );
  const inputStyle = { minHeight: 48, borderWidth: 1, borderColor: dark ? '#6B5F70' : '#D6C9D2', borderRadius: 14, padding: 13, color: foreground, fontSize: 16 };
  const cardStyle = { gap: 14, padding: LAYOUT_PAD };
  return { t, locale, dark, foreground, accent, formatDate, text, button, inputStyle, cardStyle };

}

export default function CaretakerScreen() {
  const { user, loading } = useAuth();
  const s = useCaretakerUi();
  const params = useLocalSearchParams<{ code?: string }>();
  const [qrGrant, setQrGrant] = useState<CaretakerGrant | null>(null);
  useFocusEffect(useCallback(() => () => setQrGrant(null), []));
  if (loading) return <ActivityIndicator color={s.accent} />;
  if (params.code || !user) return <Redirect href={{ pathname: '/caregiver-join', params: { code: params.code ?? '' } }} />;
  return <ThemedBackground style={{ flex: 1 }}>
    <Stack.Screen options={{ headerShown: false }} />
    <SafeAreaView style={{ flex: 1 }}>
      <Header topSafeAreaHandled title={qrGrant ? s.t.showCode : s.t.title} subtitle={qrGrant ? qrGrant.label : s.t.subtitle}
        showBackButton showBabySwitcher={false}
        onBackPress={() => { if (qrGrant) setQrGrant(null); else if (router.canGoBack()) router.back(); else router.replace('/'); }}
        rightContent={!qrGrant ? <BabySwitcherButton navigateOnSelect={false} showSwitchHint /> : undefined} />
      {qrGrant?.invitation_code ? <AccountLinkingQrModal code={qrGrant.invitation_code}
        invitationLink={buildCaretakerInvitationLink(qrGrant.invitation_code)} displayCode={formatCaretakerCode(qrGrant.invitation_code)}
        locale={s.locale} isDark={s.dark} showHint={s.t.qrShowHint} codeHint={s.t.qrCodeHint}
        onClose={() => setQrGrant(null)} onScanned={() => {}} /> : <CareOverview key={user.id} {...s} onShowCode={setQrGrant} />}
    </SafeAreaView>
  </ThemedBackground>;
}

type Shared = {
  t: ReturnType<typeof caretakerCopy>; locale: string; dark: boolean; foreground: string; accent: string;
  formatDate: (value: string) => string;
  text: (value: string, large?: boolean) => React.ReactNode;
  button: (label: string, onPress: () => void, disabled?: boolean) => React.ReactNode;
  inputStyle: object; cardStyle: object;
};
function errorMessage(error: unknown, t: Shared['t']) {
  const e = error as { message?: string; code?: string };
  if (e?.code === 'PGRST202' || e?.message?.includes('caretaker_access')) return t.unavailable;
  if (e?.message === 'premium_required') return t.premiumRequired;
  if (e?.message === 'activity_not_available') return t.activityUnavailable;
  if (e?.message === 'invalid_invitation' || e?.message === 'invalid_period') return t.invalid;
  return t.error;
}

function CareOverview({ onShowCode, ...s }: Shared & { onShowCode: (grant: CaretakerGrant) => void }) {
  const { user } = useAuth();
  const tier = useSubscriptionTier();
  const canInvite = tier === 'premium';
  const { babies, activeBabyId, activeBaby } = useActiveBaby();
  const { t, text, button } = s;
  const [grants, setGrants] = useState<CaretakerGrant[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);
  const createLock = useRef(false);
  const babyId = activeBabyId ?? '';
  const [label, setLabel] = useState('');
  const [start, setStart] = useState(() => new Date());
  const [end, setEnd] = useState(() => new Date(Date.now() + 4 * 60 * 60 * 1000));
  const [history, setHistory] = useState(0);
  const [allowEntries, setAllowEntries] = useState(true);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++generation.current;
    try {
      const items = await caretakerRequest<CaretakerGrant[]>('list');
      if (request === generation.current) { setGrants(items); setError(''); }
    } catch (e) { if (request === generation.current) { setGrants([]); setError(errorMessage(e, t)); } }
  }, [t]);
  useFocusEffect(useCallback(() => { void refresh(); return () => { generation.current++; }; }, [refresh]));
  const run = async (work: () => Promise<void>) => {
    if (busy) return;
    setBusy(true); setError('');
    try { await work(); } catch (e) { setError(errorMessage(e, t)); } finally { setBusy(false); }
  };
  const createInvitation = async () => {
    if (createLock.current || busy) return;
    if (!canInvite) { router.push('/paywall?origin=lock_caretaker'); return; }
    const showError = (message: string) => {
      setCreateError(message);
      Alert.alert(t.create, message);
    };
    setCreateError('');
    if (!label.trim()) { showError(t.requiredName); return; }
    if (!babyId) { showError(t.noBaby); return; }
    if (!validateCaretakerPeriod(start, end, history)) { showError(t.invalidPeriod); return; }
    createLock.current = true;
    setCreating(true);
    try {
      const grant = await caretakerRequest<CaretakerGrant>('create', {
        baby_id: babyId, label: label.trim(), starts_at: start.toISOString(),
        ends_at: end.toISOString(), history_days: history, allow_entries: allowEntries,
      });
      if (!grant?.id || !grant.invitation_code) throw new Error('invalid_create_response');
      // Display the newly created invitation immediately. Refresh on returning to the overview.
      onShowCode(grant);
    } catch (e) { showError(errorMessage(e, t)); }
    finally { createLock.current = false; setCreating(false); }
  };
  const share = async (grant: CaretakerGrant) => {
    if (!grant.invitation_code) return;
    const url = buildCaretakerInvitationLink(grant.invitation_code);
    await Share.share({ message: `${t.title} · ${grant.label}\n${s.formatDate(grant.starts_at)} – ${s.formatDate(grant.ends_at)}\n${t.code}: ${grant.invitation_code}\n${url}` });
  };
  const grantCard = (grant: CaretakerGrant) => (
    <CaretakerCard key={grant.id} style={s.cardStyle}>
      {text(`${grant.baby_name || t.baby} · ${grant.label}`, true)}
      {text(t[caretakerGrantState(grant)])}
      {text(`${s.formatDate(grant.starts_at)} – ${s.formatDate(grant.ends_at)}`)}
      {text(`${t.days[grant.history_days]} · ${grant.allow_entries ? t.write : t.readOnly}`)}
      {grant.owner_id === user?.id ? (
        <>
          {grant.invitation_code && !grant.accepted_at && !grant.caregiver_id && !grant.revoked_at && Date.parse(grant.ends_at) > Date.now() && button(t.showCode, () => onShowCode(grant), busy)}
          {grant.invitation_code && !grant.caregiver_id && !grant.accepted_at && !grant.revoked_at && Date.parse(grant.ends_at) > Date.now() && button(t.share, () => void run(() => share(grant)), busy)}
          {!grant.revoked_at && Date.parse(grant.ends_at) > Date.now() && button(t.revoke, () => Alert.alert(t.revokeTitle, t.revokeBody, [
            { text: t.cancel, style: 'cancel' },
            { text: t.revoke, style: 'destructive', onPress: () => void run(async () => { await caretakerRequest('revoke', { grant_id: grant.id }); await refresh(); }) },
          ]), busy)}
        </>
      ) : null}
    </CaretakerCard>
  );
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: LAYOUT_PAD, gap: 18 }}>
      {error ? text(error) : null}
      <CaretakerCard style={s.cardStyle}>
        {text(t.create, true)}
        {text(t.intro)}
        {tier === null ? <ActivityIndicator color={s.accent} /> : !canInvite ? <>
          {text(t.premiumRequired)}
          {button(t.viewPremium, () => router.push('/paywall?origin=lock_caretaker'))}
        </> : babies.length ? <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <BabySwitcherButton navigateOnSelect={false} showSwitchHint size={42} />
            <View style={{ flex: 1 }}>{text(`${t.baby} · ${activeBaby?.name || t.baby}`)}</View>
          </View>
          <TextInput accessibilityLabel={t.label} value={label} onChangeText={setLabel} placeholder={t.label} placeholderTextColor={s.dark ? '#BCAEBF' : '#817583'} maxLength={80} style={s.inputStyle} />
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {(['start', 'end'] as const).map(field => <View key={field} style={{ flex: 1 }}>
              <TimePickerField label={t[field]} time={field === 'start' ? start : end}
                onConfirm={field === 'start' ? setStart : setEnd} accentColor={s.accent} isDark={s.dark}
                textPrimary={s.foreground} textSecondary={s.dark ? Colors.dark.textSecondary : '#7D5A50'}
                localeTag={s.locale} cancelLabel={t.cancel} doneLabel={t.done} tapLabel={t.chooseTime} />
            </View>)}
          </View>
          {text(t.history)}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {t.days.map((day, i) => <AnimatedButton key={day} accessibilityRole="radio" accessibilityState={{ checked: history === i }}
              onPress={() => setHistory(i)} style={{ flexGrow: 1, minHeight: 44, padding: 12, borderRadius: 16, backgroundColor: history === i ? s.accent : s.dark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.6)' }}>
              <ThemedText style={{ color: history === i ? '#FFFFFF' : s.foreground, textAlign: 'center', fontSize: 13, fontWeight: '600' }}>{day}</ThemedText>
            </AnimatedButton>)}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1 }}>{text(t.write)}</View>
            <Switch accessibilityLabel={t.write} value={allowEntries} onValueChange={setAllowEntries} trackColor={{ true: s.accent }} />
          </View>
          {text(t.rules)}
          {createError ? <ThemedText accessibilityRole="alert" style={{ color: s.foreground }}>{createError}</ThemedText> : null}
          {creating && <ActivityIndicator accessibilityLabel={t.creating} color={s.accent} />}
          {button(creating ? t.creating : t.create, () => void createInvitation(), busy || creating)}
        </> : text(t.noBaby)}
      </CaretakerCard>
      {text(t.invites, true)}
      {grants.filter(g => g.owner_id === user?.id).map(grantCard)}
      {!grants.length && text(t.noGrants)}
      {button(t.refresh, () => void run(refresh), busy)}

    </ScrollView>
  );
}

export function CareSession({ grantId, request, onTabChange, ...s }: Shared & { grantId: string; request: CaretakerRequester; onTabChange?: (tab: 'sleep' | 'daily') => void }) {
  const { t, text, button } = s;
  const [tab, setTab] = useState<'sleep' | 'daily'>('sleep');
  const [snapshot, setSnapshot] = useState<CaretakerSnapshot | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const active = useRef(false);
  const lease = useRef(0);
  const writeLock = useRef(false);
  const refresh = useCallback(async () => {
    const requestId = ++generation.current;
    const startedAt = performance.now();
    try {
      const data = await request<CaretakerSnapshot>('read', { grant_id: grantId });
      if (!active.current || generation.current !== requestId) return;
      const deadline = caretakerSnapshotLease(data, startedAt);
      if (performance.now() >= deadline) { setSnapshot(null); setError(t.offline); return; }
      lease.current = deadline;
      setSnapshot(data); setError('');
    } catch (e) {
      if (!active.current || generation.current !== requestId) return;
      setSnapshot(null);
      setError((e as { message?: string })?.message === 'access_inactive' ? t.inactive : t.offline);
    }
  }, [grantId, request, t]);
  useFocusEffect(useCallback(() => {
    active.current = true;
    void refresh();
    const poll = setInterval(() => { if (active.current) void refresh(); }, 15_000);
    const expiry = setInterval(() => {
      if (lease.current > 0 && performance.now() >= lease.current) { lease.current = 0; setSnapshot(null); setError(t.offline); }
    }, 250);
    const sub = AppState.addEventListener('change', state => {
      generation.current++;
      active.current = state === 'active';
      setSnapshot(null);
      if (active.current) void refresh();
    });
    return () => { active.current = false; generation.current++; setSnapshot(null); clearInterval(poll); clearInterval(expiry); sub.remove(); };
  }, [refresh]));
  const write = async (command: CaretakerCommand, payload: Record<string, unknown> = {}) => {
    if (writeLock.current || !active.current || !snapshot?.allow_entries || performance.now() >= lease.current) throw new Error('access_inactive');
    writeLock.current = true; setBusy(true); setError('');
    try {
      await request('write', { ...payload, grant_id: grantId, command });
      await refresh();
    } catch (e) {
      await refresh();
      const message = (e as { message?: string }).message;
      const explanation = message === 'invalid_entry_period' ? t.entryPeriod
        : message === 'sleep_already_running' ? t.existingSleep : errorMessage(e, t);
      setError(explanation);
      if (active.current) Alert.alert(t.save, explanation);
      throw e;
    } finally { writeLock.current = false; setBusy(false); }
  };
  return <>
    <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: LAYOUT_PAD, gap: 16 }}>
      {error ? text(error) : null}
      {!snapshot ? <CaretakerCard style={s.cardStyle}>{!error && <ActivityIndicator color={s.accent} />}{button(t.refresh, () => void refresh())}</CaretakerCard> : <>
        <CaretakerCard style={s.cardStyle}>
          {text(snapshot.baby_name || t.baby, true)}
          {text(`${t.until} ${s.formatDate(snapshot.ends_at)}`)}
          {text(`${t.visible} ${s.formatDate(snapshot.visible_from)}`)}
          {!snapshot.allow_entries && text(t.readOnly)}
        </CaretakerCard>
        <CaretakerTrackingView snapshot={snapshot} tab={tab} locale={s.locale} dark={s.dark}
          foreground={s.foreground} busy={busy} onWrite={write} />
      </>}
    </ScrollView>
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: 12, padding: 16 }}>
      {(['sleep', 'daily'] as const).map(key => <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: tab === key }}
        onPress={() => { setTab(key); onTabChange?.(key); }} style={{ flex: 1, minHeight: 58, justifyContent: 'center', alignItems: 'center', borderRadius: 20, backgroundColor: tab === key ? s.accent : s.dark ? '#302A37' : '#FFFDFB' }}>
        <ThemedText style={{ fontSize: 18, fontWeight: '600', color: tab === key ? s.dark ? '#251A30' : '#FFFFFF' : s.foreground }}>{key === 'sleep' ? '☾ ' : '☀ '}{t[key]}</ThemedText>
      </Pressable>)}
    </View>
  </>;
}

function CaretakerCard({ children, style }: { children: React.ReactNode; style?: object }) {
  const adaptive = useAdaptiveColors();
  const dark = adaptive.effectiveScheme === 'dark' || adaptive.isDarkBackground;
  return <LiquidGlassCard intensity={26} overlayColor={dark ? GLASS_OVERLAY_DARK : GLASS_OVERLAY}>
    <View style={style}>{children}</View>
  </LiquidGlassCard>;
}
