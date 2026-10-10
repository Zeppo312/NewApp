import React, { useEffect, useState } from 'react';
import { AppState, Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthProvider, useAuth } from '../../contexts/AuthContext';
import { DataConsentProvider, useDataConsents } from '../../contexts/DataConsentContext';
import { ActiveBabyProvider, useActiveBaby } from '../../contexts/ActiveBabyContext';
import { BabyStatusProvider, useBabyStatus } from '../../contexts/BabyStatusContext';
import { OnboardingStatusProvider, useOnboardingStatus } from '../../contexts/OnboardingStatusContext';
import { RootPaywallGate } from '../../components/paywall/root-paywall-gate';
import { persistStartupAccess, readStartupAccess, STARTUP_ACCESS_MAX_AGE_MS } from '../startupAccess';
import { setConsentIdentity, setRuntimeDataConsents } from '../dataConsentRuntime';
import { writeSnapshot, readSnapshot, localDateKey, validRows } from '../localReadSnapshots';
import { persistActivityDraft, readActivityDraft, type ActivityDraftValues } from '../activityDrafts';
import { supabase } from '../supabase';
import { getCachedUserProfile, getCachedUserSettings } from '../appCache';
import type { DataConsentSnapshot } from '../dataConsentTypes';

jest.mock('../dataConsentRuntime', () => {
  const previous = process.env.EXPO_PUBLIC_DATA_CONSENTS_ENABLED;
  process.env.EXPO_PUBLIC_DATA_CONSENTS_ENABLED = 'true';
  const runtime = jest.requireActual('../dataConsentRuntime');
  process.env.EXPO_PUBLIC_DATA_CONSENTS_ENABLED = previous; return runtime;
});
jest.mock('../supabase', () => ({ supabaseUrl: 'https://fixture.supabase.co', supabaseAuthStorageKey: 'sb-fixture-auth-token',
  supabase: { auth: { getSession: jest.fn(), getUser: jest.fn(), onAuthStateChange: jest.fn() }, rpc: jest.fn(), from: jest.fn() },
  getCachedUser: jest.fn(() => new Promise(() => {})), getBabyBornStatus: jest.fn(() => new Promise(() => {})),
  isSupabaseReady: () => true, invalidateUserCache: jest.fn(),
}));
jest.mock('../appCache', () => ({ invalidateAllCaches: jest.fn().mockResolvedValue(undefined), getCachedUserProfile: jest.fn(), getCachedUserSettings: jest.fn() }));
jest.mock('../accountDeletionCleanup', () => ({ clearPersonalDeviceData: jest.fn().mockResolvedValue([]), waitForPersonalDeviceCleanup: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../revenuecat', () => ({ setRevenueCatSessionUser: jest.fn(), getRevenueCatEntitlementStatus: jest.fn() }));
jest.mock('../localization', () => ({ getDeviceAppLocale: () => 'de' }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'synthetic-draft' }));
jest.mock('../../hooks/useAdaptiveColors', () => ({ useAdaptiveColors: () => ({ effectiveScheme: 'light', textPrimary: '#5C4033', textSecondary: '#7D5A50' }) }));
jest.mock('../../components/ui/IconSymbol', () => ({ IconSymbol: () => null }));
jest.mock('../../components/ThemedBackground', () => ({ ThemedBackground: jest.requireActual('react-native').View }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const consent: DataConsentSnapshot = { enabled: true, userId: 'A', revision: 1, documentVersion: '2026-10-01.1', healthAllowed: true, aiAllowed: false,
  health: { decision: 'granted', documentVersion: '2026-10-01.1', decidedAt: '2026-10-08T07:00:00Z' }, ai: null };
const scope = { backendHost: 'fixture.supabase.co', userId: 'A', babyId: 'baby' };
const values: ActivityDraftValues = { startTime: '2026-10-08T08:00:00Z', endTime: null, isEndTimeVisible: false, notes: 'unfinished', volumeMl: 135,
  diaperType: 'both', selectedDiaperItemId: null, selectedFormulaItemId: null, diaperFeverMeasured: false, diaperTemperatureC: '', diaperSuppositoryGiven: false, diaperSuppositoryDoseMg: '' };
const denied = jest.fn();
let restored: any;
function Content() {
  const { user, loading, signOut } = useAuth(); const baby = useActiveBaby(); const status = useBabyStatus(); const onboarding = useOnboardingStatus();
  const [local, setLocal] = useState<any>(null);
  useEffect(() => {
    if (!user || !baby.activeBabyId) return;
    const selected = { ...scope, userId: user.id, babyId: baby.activeBabyId };
    void Promise.all([readSnapshot({ ...selected, localDateKey: localDateKey() }, 'home-care', validRows), readActivityDraft(selected, 'bottle')])
      .then(([care, draft]) => setLocal({ care: care?.data, draft: draft.draft?.values }));
  }, [user, baby.activeBabyId]);
  const view = { userId: user?.id, babyId: baby.activeBabyId, ready: !loading && baby.isReady && status.isResolved && onboarding.isResolved,
    born: status.isBabyBorn, onboarding: onboarding.isComplete, local };
  React.useLayoutEffect(() => { restored = view; });
  return <RootPaywallGate userId={user?.id ?? null} pathname="/home" revision={0} ready={view.ready} excluded={false} locale="de"
    onDenied={denied} onSignOut={signOut}>{() => <Text>{JSON.stringify(view)}</Text>}</RootPaywallGate>;
}
function ConsentBoundary() {
  const state = useDataConsents();
  return state.healthAllowed ? <ActiveBabyProvider><BabyStatusProvider><OnboardingStatusProvider><Content /></OnboardingStatusProvider></BabyStatusProvider></ActiveBabyProvider>
    : <Text testID="consent-wait">{state.mode}</Text>;
}
const App = () => <AuthProvider><DataConsentProvider><ConsentBoundary /></DataConsentProvider></AuthProvider>;
let tree: ReactTestRenderer;
beforeEach(async () => {
  jest.useFakeTimers(); AppState.currentState = 'active'; jest.clearAllMocks(); await AsyncStorage.clear(); restored = null;
  jest.mocked(supabase.auth.onAuthStateChange).mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } } as any);
  jest.mocked(supabase.auth.getSession).mockReturnValue(new Promise(() => {}));
  jest.mocked(supabase.auth.getUser).mockReturnValue(new Promise(() => {}));
  jest.mocked(supabase.rpc).mockReturnValue({ abortSignal: () => new Promise(() => {}) } as any);
  jest.mocked(supabase.from).mockReturnValue({ select: () => ({ eq: () => ({ single: () => new Promise(() => {}) }) }) } as any);
  jest.mocked(getCachedUserProfile).mockReturnValue(new Promise(() => {}));
  jest.mocked(getCachedUserSettings).mockReturnValue(new Promise(() => {}));
  setConsentIdentity('A'); setRuntimeDataConsents(consent);
  await writeSnapshot({ backendHost: scope.backendHost, userId: 'A' }, 'baby-list', [{ id: 'baby', name: 'Synthetic', birth_date: '2025-01-01' }]);
  await writeSnapshot({ ...scope, localDateKey: localDateKey() }, 'home-care', [{ id: 'confirmed-care', volume_ml: 100 }]);
  await persistActivityDraft(scope, 'bottle', values, null);
  await AsyncStorage.setItem('active_baby_id:A', 'baby');
  await AsyncStorage.setItem('baby_status_v1:A:baby', JSON.stringify({ isBabyBorn: true, birthDate: '2025-01-01', source: 'baby_info', updatedAt: new Date().toISOString() }));
  await AsyncStorage.setItem('onboarding_complete_v1:A', '1');
  await AsyncStorage.setItem('data_consent_snapshot_v1:fixture.supabase.co:A', JSON.stringify(consent));
  await AsyncStorage.setItem('sb-fixture-auth-token', JSON.stringify({ user: { id: 'A' }, access_token: 'synthetic-expired', refresh_token: 'synthetic-refresh', expires_at: 1 }));
  await persistStartupAccess(scope, { accessReason: 'tester', verifiedAt: Date.now(), subscriptionExpiresAt: null });
  setConsentIdentity(null); // Discard runtime identity/consent like a new process.
});
afterEach(() => { act(() => tree?.unmount()); jest.useRealTimers(); });
const mount = async () => { await act(async () => { tree = create(<App />); }); };
it('opens a fresh provider tree from persisted auth, consent, child, onboarding, confirmed data and a raw draft while all network checks hang', async () => {
  await mount();
  expect(restored).toMatchObject({ userId: 'A', babyId: 'baby', ready: true, born: true, onboarding: true,
    local: { care: [{ id: 'confirmed-care', volume_ml: 100 }], draft: values } });
  expect(tree.root.findByProps({ testID: 'root-paywall-content' }).props.pointerEvents).toBe('auto');
  const proof = await readStartupAccess(scope);
  await act(async () => { await jest.advanceTimersByTimeAsync(15_001); });
  expect(tree.root.findByProps({ testID: 'root-paywall-content' }).props.pointerEvents).toBe('auto');
  expect(await readStartupAccess(scope)).toEqual(proof); expect(denied).not.toHaveBeenCalled();
  act(() => tree.unmount()); setConsentIdentity(null); restored = null;
  await mount(); expect(restored.ready).toBe(true); expect(restored.local.draft).toEqual(values);
  expect(tree.root.findByProps({ testID: 'root-paywall-content' }).props.pointerEvents).toBe('auto');
});
it('does not open an offline cold start after the grant expires', async () => {
  jest.setSystemTime(Date.now() + STARTUP_ACCESS_MAX_AGE_MS + 1);
  await mount(); expect(restored).toBeNull(); expect(tree.root.findByProps({ testID: 'consent-wait' })).toBeTruthy();
});
it('does not let an access grant override a locally withdrawn health consent', async () => {
  await AsyncStorage.setItem('data_consent_pending_withdrawal_v1:A', '["health"]');
  await mount(); expect(restored).toBeNull(); expect(tree.root.findByProps({ testID: 'consent-wait' })).toBeTruthy();
});
