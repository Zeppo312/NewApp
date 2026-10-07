import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { RootPaywallGate } from '../../components/paywall/root-paywall-gate';
import { PAYWALL_CHECK_TIMEOUT_MS } from '../../hooks/use-paywall-session-gate';
import { getCachedUser } from '../supabase';
import { getCachedPremiumStatusResult, getCachedUserProfile } from '../appCache';
import { refreshFamilyAccess, getCachedFamilyAccess, resetFamilyAccessForTests } from '../familySubscriptionAccess';
import { supabase } from '../supabase';

jest.mock('@expo/ui', () => {
  const React = require('react'); const { View, Text, Pressable } = require('react-native');
  return { Host: View, Column: View, Button: ({ label, ...props }: any) => React.createElement(Pressable, props, React.createElement(Text, null, label)) };
});
jest.mock('../supabase', () => ({ getCachedUser: jest.fn(), supabase: { auth: { getSession: jest.fn() }, rpc: jest.fn() } }));
jest.mock('../appCache', () => ({ getCachedPremiumStatusResult: jest.fn(), getCachedUserProfile: jest.fn(), getCachedUserSettings: jest.fn().mockResolvedValue(null) }));
jest.mock('../paywallContent', () => ({ getCachedPaywallContent: jest.fn().mockResolvedValue({ content: {} }), getPaywallTrialDays: () => 7 }));

const premium = jest.mocked(getCachedPremiumStatusResult);
const user = (id = 'A') => jest.mocked(getCachedUser).mockResolvedValue({ data: { user: { id } }, error: null } as any);
const active = { status: 'active', isPro: true, source: 'family' } as const;
const unavailable = { status: 'unavailable', isPro: null, source: 'family' } as const;
const inactive = { status: 'inactive', isPro: false, source: 'family' } as const;
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
let mounts = 0;
function Navigator() { const [value] = useState('unsaved input'); useEffect(() => { mounts++; }, []); return <Text>{value}</Text>; }

describe('mounted RootLayout paywall boundary with real paywall decisions', () => {
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
  beforeEach(() => {
    jest.useFakeTimers(); jest.clearAllMocks(); mounts = 0; tree = undefined as any;
    options = { userId: 'A', pathname: '/home', revision: 0, ready: true, excluded: false, locale: 'de' };
    user(); premium.mockResolvedValue(active); jest.mocked(getCachedUserProfile).mockResolvedValue({ id: 'A' } as any);
  });
  afterEach(() => { act(() => tree?.unmount()); resetFamilyAccessForTests(); jest.useRealTimers(); });

  it('protects cold starts and retains the mounted navigator without granting access on first failure', async () => {
    premium.mockResolvedValue(unavailable); await render();
    expect(blocked()).toBe(true); expect(denied).not.toHaveBeenCalled();
    expect(tree.root.findByProps({ testID: 'root-paywall-retry' })).toBeTruthy();
    premium.mockResolvedValue(active);
    await act(async () => tree.root.findByProps({ testID: 'root-paywall-retry' }).props.onPress());
    expect(blocked()).toBe(false); expect(mounts).toBe(1);
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
    expect(StyleSheet.flatten(tree.root.findByProps({ testID: 'root-paywall-overlay' }).props.style).backgroundColor).toBe('#FFFFFF');
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
  it('preserves the screen beyond five minutes without preserving the family entitlement', async () => {
    jest.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { user: { id: 'A' } } }, error: null } as any);
    jest.mocked(supabase.rpc).mockReturnValue({ abortSignal: () => Promise.resolve({ data: { schemaVersion: 1, userId: 'A', status: 'active', tier: 'premium', expiresAt: new Date(Date.now() + 3_600_000).toISOString(), validUntil: new Date(Date.now() + 300_000).toISOString() }, error: null }) } as any);
    await refreshFamilyAccess('A');
    premium.mockImplementation(async () => getCachedFamilyAccess('A').status === 'active' ? active : unavailable);
    await render(); await act(async () => { jest.advanceTimersByTime(301_000); });
    await render({ revision: 1 });
    expect(blocked()).toBe(false); expect(getCachedFamilyAccess('A').status).toBe('unavailable'); expect(denied).not.toHaveBeenCalled();
  });
});
