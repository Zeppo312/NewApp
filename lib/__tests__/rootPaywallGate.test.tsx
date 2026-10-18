import React, { useEffect, useState } from 'react';
import { AppState, Modal, StyleSheet, Text, View } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { RootPaywallGate } from '../../components/paywall/root-paywall-gate';
import { PAYWALL_CHECK_TIMEOUT_MS } from '../../hooks/use-paywall-session-gate';
import { getCachedUser, supabase } from '../supabase';
import { getCachedPremiumStatusResult, getCachedUserProfile } from '../appCache';
import { refreshFamilyAccess, getCachedFamilyAccess, resetFamilyAccessForTests } from '../familySubscriptionAccess';
import { Colors } from '../../constants/Colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getRevenueCatEntitlementStatus } from '../revenuecat';
import { persistStartupAccess, readStartupAccess, revokeStartupAccess, STARTUP_ACCESS_MAX_AGE_MS } from '../startupAccess';
import { notifyServerContact } from '../serverContact';
import { isPaywallExcludedPath } from '../paywallRoutes';

jest.mock('../../hooks/useAdaptiveColors', () => ({ useAdaptiveColors: () => ({ effectiveScheme: 'light', textPrimary: '#5C4033', textSecondary: '#7D5A50' }) }));
jest.mock('../../components/ui/IconSymbol', () => ({ IconSymbol: () => null }));
jest.mock('../../components/ThemedBackground', () => {
  const { View } = jest.requireActual('react-native'); return { ThemedBackground: View };
});
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../supabase', () => ({ supabaseUrl: 'https://fixture.supabase.co', getCachedUser: jest.fn(), supabase: { auth: { getSession: jest.fn(), getUser: jest.fn() }, rpc: jest.fn(), from: jest.fn() } }));
jest.mock('../revenuecat', () => ({ getRevenueCatEntitlementStatus: jest.fn(), getRevenueCatStartupEvidence: (info: any) => info.evidence }));
jest.mock('../appCache', () => ({ getCachedPremiumStatusResult: jest.fn(), getCachedUserProfile: jest.fn(), getCachedUserSettings: jest.fn().mockResolvedValue(null) }));
jest.mock('../paywallContent', () => ({ getCachedPaywallContent: jest.fn().mockResolvedValue({ content: {} }), getPaywallTrialDays: () => 7 }));

const premium = jest.mocked(getCachedPremiumStatusResult);
const user = (id = 'A') => jest.mocked(getCachedUser).mockResolvedValue({ data: { user: { id } }, error: null } as any);
const active = { status: 'active', isPro: true, source: 'revenuecat' } as const;
const unavailable = { status: 'unavailable', isPro: null, source: 'family' } as const;
const inactive = { status: 'inactive', isPro: false, source: 'family' } as const;
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
let mounts = 0;
function Navigator() { const [value] = useState('unsaved input'); useEffect(() => { mounts++; }, []); return <Text>{value}</Text>; }

describe('mounted RootLayout boundary with the real startup access verifier', () => {
  let tree: ReactTestRenderer;
  const denied = jest.fn(); const logout = jest.fn();
  let options: any;
  const render = async (changes = {}) => {
    options = { ...options, ...changes };
    await act(async () => {
      const node = <RootPaywallGate {...options} onDenied={denied} onSignOut={logout}>{() => <Navigator />}</RootPaywallGate>;
      if (tree) tree.update(node); else tree = create(node);
    });
  };
  const blocked = () => tree.root.findByProps({ testID: 'root-paywall-content' }).props.pointerEvents === 'none';
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.useFakeTimers(); jest.clearAllMocks(); mounts = 0; tree = undefined as any;
    AppState.currentState = 'active';
    options = { userId: 'A', pathname: '/home', revision: 0, ready: true, excluded: false, locale: 'de' };
    user(); premium.mockResolvedValue(active); jest.mocked(getCachedUserProfile).mockResolvedValue({ id: 'A' } as any);
    jest.mocked(supabase.auth.getUser).mockImplementation(() => getCachedUser() as any);
    jest.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { user: { id: 'A' } } }, error: null } as any);
    jest.mocked(supabase.from).mockImplementation(() => ({ select: () => ({ eq: () => ({ abortSignal: () => ({ maybeSingle: async () => {
      const data = await getCachedUserProfile(); return { data, error: data ? null : new Error('offline_profile') };
    } }) }) }) }) as any);
    jest.mocked(supabase.rpc).mockReturnValue({ abortSignal: async () => ({ data: { schemaVersion: 1, userId: 'A', status: 'none' }, error: null }) } as any);
    jest.mocked(getRevenueCatEntitlementStatus).mockImplementation(async () => {
      const result = await premium();
      if (result.status === 'unavailable') return { status: 'unavailable', error: new Error('offline') };
      return { status: result.status === 'active' && result.source !== 'family' ? 'active' : 'inactive', customerInfo: {
        requestDate: new Date().toISOString(), evidence: { verifiedAt: Date.now(), subscriptionExpiresAt: null },
      } };
    });
  });
  afterEach(() => { act(() => tree?.unmount()); resetFamilyAccessForTests(); jest.useRealTimers(); });

  it('protects cold starts without a stored grant and retains the mounted navigator on first failure', async () => {
    premium.mockResolvedValue(unavailable); await render();
    expect(blocked()).toBe(true); expect(denied).not.toHaveBeenCalled();
    expect(tree.root.findByProps({ testID: 'root-paywall-retry' })).toBeTruthy();
    premium.mockResolvedValue(active);
    await act(async () => tree.root.findByProps({ testID: 'root-paywall-retry' }).props.onPress());
    expect(blocked()).toBe(false); expect(mounts).toBe(1);
  });
  it('opens a restarted offline session from disk before a hung network check finishes', async () => {
    await render();
    const proof = await readStartupAccess({ backendHost: 'fixture.supabase.co', userId: 'A' });
    expect(proof).not.toBeNull();
    act(() => tree.unmount()); tree = undefined as any;
    jest.mocked(supabase.auth.getUser).mockReturnValue(new Promise(() => {}));
    await render();
    expect(blocked()).toBe(false);
    await act(async () => { jest.advanceTimersByTime(PAYWALL_CHECK_TIMEOUT_MS); });
    expect(blocked()).toBe(false);
    expect(await readStartupAccess({ backendHost: 'fixture.supabase.co', userId: 'A' })).toEqual(proof);
    expect(denied).not.toHaveBeenCalled();
  });
  it('expires an offline grant while the app remains open and does not renew it on network errors', async () => {
    await persistStartupAccess({ backendHost: 'fixture.supabase.co', userId: 'A' }, {
      accessReason: 'tester', verifiedAt: Date.now() - STARTUP_ACCESS_MAX_AGE_MS + 1_000, subscriptionExpiresAt: null,
    });
    premium.mockResolvedValue(unavailable); await render();
    expect(blocked()).toBe(false);
    await act(async () => { await jest.advanceTimersByTimeAsync(1_001); });
    expect(blocked()).toBe(true);
    expect(await readStartupAccess({ backendHost: 'fixture.supabase.co', userId: 'A' })).toBeNull();
  });
  it('rechecks after server connectivity returns and removes a revoked grant from the next cold start', async () => {
    await render();
    premium.mockResolvedValue(inactive);
    await act(async () => { jest.setSystemTime(Date.now() + 31_000); notifyServerContact(); });
    expect(blocked()).toBe(true); expect(denied).toHaveBeenCalled();
    expect(await readStartupAccess({ backendHost: 'fixture.supabase.co', userId: 'A' })).toBeNull();
    act(() => tree.unmount()); tree = undefined as any; premium.mockResolvedValue(unavailable);
    await render(); expect(blocked()).toBe(true);
  });
  it('isolates first-check input in a native modal and cannot dismiss protection with Back', async () => {
    premium.mockResolvedValue(unavailable); await render();
    const content = () => tree.root.findByProps({ testID: 'root-paywall-content' });
    expect(StyleSheet.flatten(content().props.style)).toMatchObject({ flex: 1, opacity: 0 });
    expect(StyleSheet.flatten(content().props.style).display).not.toBe('none');
    expect(content().props.accessibilityElementsHidden).toBe(true);
    expect(content().props.importantForAccessibility).toBe('no-hide-descendants');
    expect(tree.root.findByType(Modal).props.visible).toBe(true);
    expect(tree.root.findByType(Modal).props.presentationStyle).toBe('overFullScreen');
    expect(tree.root.findByType(Modal).props.transparent).toBe(true);
    const overlay = tree.root.findAllByProps({ testID: 'root-paywall-overlay' }).find(node => node.type === View)!;
    expect(StyleSheet.flatten(overlay.props.style).backgroundColor).toBe(Colors.light.background);
    act(() => tree.root.findByType(Modal).props.onRequestClose());
    expect(blocked()).toBe(true); expect(logout).not.toHaveBeenCalled();
    premium.mockResolvedValue(active);
    await act(async () => tree.root.findByProps({ testID: 'root-paywall-retry' }).props.onPress());
    expect(tree.root.findAllByType(Modal)).toHaveLength(0);
    expect(StyleSheet.flatten(content().props.style).opacity).toBe(1);
    expect(mounts).toBe(1);
    premium.mockResolvedValue(unavailable); await render({ revision: 1 });
    expect(tree.root.findAllByType(Modal)).toHaveLength(0);
    expect(blocked()).toBe(false);
  });
  it.each(['route', 'foreground'])('keeps a verified session visible while %s verification is pending or unavailable', async kind => {
    await render(); const pending = deferred<any>(); premium.mockReturnValue(pending.promise);
    await render(kind === 'route' ? { pathname: '/baby' } : { revision: 1 });
    expect(blocked()).toBe(false);
    await act(async () => pending.resolve(unavailable));
    expect(blocked()).toBe(false); expect(denied).not.toHaveBeenCalled(); expect(mounts).toBe(1);
  });
  it.each(['auth', 'profile', 'provider'])('does not interrupt the screen on %s failure', async failure => {
    await render();
    if (failure === 'auth') jest.mocked(getCachedUser).mockResolvedValue({ data: { user: null }, error: new Error('offline') } as any);
    if (failure === 'profile') { premium.mockResolvedValue(inactive); jest.mocked(getCachedUserProfile).mockResolvedValue(null); }
    if (failure === 'provider') premium.mockResolvedValue(unavailable);
    await render({ revision: 1 }); expect(blocked()).toBe(false); expect(denied).not.toHaveBeenCalled();
  });
  it('keeps a verified session and its unsaved input through repeated errors, a timeout and recovery', async () => {
    await render();
    premium.mockRejectedValue(new Error('offline'));await render({ revision: 1 });
    expect(blocked()).toBe(false);expect(denied).not.toHaveBeenCalled();
    premium.mockReturnValue(new Promise(() => {}));await render({ revision: 2 });
    await act(async () => { await jest.advanceTimersByTimeAsync(PAYWALL_CHECK_TIMEOUT_MS); });
    expect(blocked()).toBe(false);expect(tree.root.findAllByType(Modal)).toHaveLength(0);
    premium.mockResolvedValue(unavailable);await render({ pathname: '/baby', revision: 3 });
    premium.mockResolvedValue(active);await render({ revision: 4 });
    expect(blocked()).toBe(false);expect(denied).not.toHaveBeenCalled();expect(mounts).toBe(1);
    expect(tree.root.findByType(Text).props.children).toBe('unsaved input');
  });
  it('bounds a hung first request, supports sign-out and ignores the late successful answer', async () => {
    const pending = deferred<any>(); premium.mockReturnValueOnce(pending.promise); await render();
    await act(async () => { jest.advanceTimersByTime(PAYWALL_CHECK_TIMEOUT_MS); });
    expect(blocked()).toBe(true);
    act(() => tree.root.findByProps({ testID: 'root-paywall-signout' }).props.onPress());
    expect(logout).toHaveBeenCalledTimes(1);
    await act(async () => pending.resolve(active)); expect(blocked()).toBe(true);
  });
  it('keeps retry available during automatic refreshes after an offline failure', async () => {
    premium.mockResolvedValue(unavailable); await render();
    premium.mockReturnValue(new Promise(() => {}));
    await render({ revision: 1 });
    expect(tree.root.findByProps({ testID: 'root-paywall-retry' })).toBeTruthy();
    expect(blocked()).toBe(true);
    await act(async () => tree.root.findByProps({ testID: 'root-paywall-retry' }).props.onPress());
    expect(tree.root.findAllByProps({ testID: 'root-paywall-retry' })).toHaveLength(0);
    await act(async () => { jest.advanceTimersByTime(PAYWALL_CHECK_TIMEOUT_MS); });
    expect(tree.root.findByProps({ testID: 'root-paywall-retry' })).toBeTruthy();
  });
  it('does not restart the first-check timeout on repeated family updates', async () => {
    premium.mockReturnValue(new Promise(() => {})); await render();
    for (const revision of [1, 2]) {
      await act(async () => { jest.advanceTimersByTime(5_000); });
      await render({ revision });
    }
    await act(async () => { jest.advanceTimersByTime(5_000); });
    expect(tree.root.findByProps({ testID: 'root-paywall-retry' })).toBeTruthy();
    await render({ revision: 3 });
    expect(tree.root.findByProps({ testID: 'root-paywall-retry' })).toBeTruthy();
    expect(blocked()).toBe(true); expect(denied).not.toHaveBeenCalled();
  });
  it('revokes continuity on confirmed absence and does not resurrect it after another error', async () => {
    await render(); premium.mockResolvedValue(inactive); await render({ revision: 1 });
    expect(blocked()).toBe(true); expect(denied).toHaveBeenCalledWith('/home');
    premium.mockResolvedValue(unavailable); await render({ revision: 2 }); expect(blocked()).toBe(true);
  });
  it('ignores out-of-order route responses', async () => {
    await render(); const pending = deferred<any>(); premium.mockReturnValueOnce(pending.promise);
    await render({ pathname: '/baby' }); premium.mockResolvedValue(active); await render({ pathname: '/home' });
    await act(async () => pending.resolve(inactive)); expect(blocked()).toBe(false); expect(denied).not.toHaveBeenCalled();
  });
  it('rejects a previous authorization when sign-out/login is batched into the same account ID', async () => {
    await render(); const pending = deferred<any>(); premium.mockReturnValueOnce(pending.promise);
    await render({ revision: 1 });
    await revokeStartupAccess({ backendHost: 'fixture.supabase.co', userId: 'A' });
    premium.mockResolvedValue(unavailable); await render();
    expect(blocked()).toBe(true);
    await act(async () => pending.resolve(active)); expect(blocked()).toBe(true);
    expect(await readStartupAccess({ backendHost: 'fixture.supabase.co', userId: 'A' })).toBeNull();
  });
  it('resets A -> B -> A and logout -> same account, rejecting a previous account response', async () => {
    await render(); const pending = deferred<any>(); premium.mockReturnValueOnce(pending.promise);
    await render({ revision: 1 }); user('B'); premium.mockResolvedValue(unavailable); await render({ userId: 'B' });
    await act(async () => pending.resolve(active)); expect(blocked()).toBe(true);
    user(); await render({ userId: 'A' }); expect(blocked()).toBe(true);
    premium.mockResolvedValue(active); await render({ revision: 2 }); expect(blocked()).toBe(false);
    await render({ userId: null }); premium.mockResolvedValue(unavailable); await render({ userId: 'A' }); expect(blocked()).toBe(true);
  });
  it('rejects a mismatched Auth cache and leaves excluded recovery routes reachable', async () => {
    user('B'); await render(); expect(blocked()).toBe(true);
    expect(premium).not.toHaveBeenCalled(); await render({ pathname: '/account-deletion', excluded: true }); expect(blocked()).toBe(false);
  });
  it.each(['/app-settings', '/account-deletion', '/data-consents', '/support', '/subscription'])('keeps %s open without a paid entitlement', async (pathname) => {
    premium.mockResolvedValue(inactive);
    await render({ pathname, excluded: isPaywallExcludedPath(pathname) });
    expect(blocked()).toBe(false); expect(denied).not.toHaveBeenCalled();
    expect(premium).not.toHaveBeenCalled();
  });
  it.each(['/support', '/subscription'])('keeps %s open when access is denied', async (pathname) => {
    premium.mockResolvedValue(inactive);
    await render({ pathname, excluded: isPaywallExcludedPath(pathname) });
    expect(blocked()).toBe(false);
    expect(denied).not.toHaveBeenCalled();
    expect(premium).not.toHaveBeenCalled();
  });
  it('preserves the screen beyond five minutes without preserving the family entitlement', async () => {
    jest.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { user: { id: 'A' } } }, error: null } as any);
    jest.mocked(supabase.rpc).mockReturnValue({ abortSignal: () => Promise.resolve({ data: { schemaVersion: 1, userId: 'A', status: 'active', tier: 'premium', expiresAt: new Date(Date.now() + 3_600_000).toISOString(), validUntil: new Date(Date.now() + 300_000).toISOString() }, error: null }) } as any);
    await refreshFamilyAccess('A');
    jest.mocked(supabase.rpc).mockReturnValue({ abortSignal: async () => ({ data: null, error: { code: 'NETWORK' } }) } as any);
    premium.mockImplementation(async () => getCachedFamilyAccess('A').status === 'active' ? { ...active, source: 'family' } : unavailable);
    await render(); await act(async () => { jest.advanceTimersByTime(301_000); });
    await render({ revision: 1 });
    expect(blocked()).toBe(false); expect(getCachedFamilyAccess('A').status).toBe('unavailable'); expect(denied).not.toHaveBeenCalled();
  });
});
