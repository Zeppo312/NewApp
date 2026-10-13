import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Text, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BabySwitcherButton from '../../components/BabySwitcherButton';
import { ActiveBabyProvider, useActiveBaby } from '../../contexts/ActiveBabyContext';
import { listBabies, createBaby, readSavedBabies, syncBabiesForLinkedUsers } from '../baby';
import { supabase } from '../supabase';

let mockUser: { id: string } | null = { id: 'user' };
const mockRouter = { push: jest.fn(), replace: jest.fn() };
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock('@/contexts/LocaleContext', () => ({ useLocale: () => ({ locale: 'de' }) }));
jest.mock('@/contexts/BabyStatusContext', () => ({ useBabyStatus: () => ({ isBabyBorn: false, temporaryViewMode: null, setTemporaryViewMode: jest.fn() }) }));
jest.mock('@/hooks/useColorScheme', () => ({ useColorScheme: () => 'light' }));
jest.mock('@/hooks/useAdaptiveColors', () => ({ useAdaptiveColors: () => ({ effectiveScheme: 'light' }) }));
jest.mock('@/components/CachedImage', () => ({ CachedImage: () => null }));
jest.mock('@/components/ui/IconSymbol', () => ({ IconSymbol: () => null }));
jest.mock('@/components/ThemedText', () => ({ ThemedText: jest.requireActual('react-native').Text }));
jest.mock('expo-image-picker', () => ({}));
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }) }));
jest.mock('react-native-reanimated', () => ({ __esModule: true, default: { View: jest.requireActual('react-native').View, createAnimatedComponent: (component: unknown) => component }, useReducedMotion: () => false }));
jest.mock('@/hooks/useAvatarModalMotion', () => ({ useAvatarModalMotion: ({ open, onClosed }: { open: boolean; onClosed: () => void }) => ({ presented: open, isClosing: false, triggerRef: { current: null }, panelRef: { current: null }, panelStyle: {}, contentStyle: {}, materialStyle: {}, shapeProps: {}, backdropStyle: {}, dismiss: async () => { onClosed(); return true; }, onPanelLayout: () => {}, onShow: () => {} }) }));
jest.mock('@/contexts/BabySwitchTransitionContext', () => ({ useBabySwitchTransition: () => ({ isSwitching: false, runSwitch: async (change: () => Promise<void>) => { await change(); return true; } }) }));
jest.mock('expo-blur', () => ({ BlurView: jest.requireActual('react-native').View }));
jest.mock('../baby', () => ({
  readSavedBabies: jest.fn(async () => null), listBabies: jest.fn(), createBaby: jest.fn(), syncBabiesForLinkedUsers: jest.fn() }));
jest.mock('../supabase', () => ({ supabase: { from: jest.fn() } }));

const levi = { id: 'levi', name: 'Levi', birth_date: '2024-01-01' };
const pregnancy = { id: 'pregnancy', name: 'Schwangerschaft', birth_date: null };
const full = { data: [levi, pregnancy], error: null };
const saved = { schemaVersion: 1 as const, scope: { backendHost: 'fixture.supabase.co', userId: 'user' }, dataset: 'baby-list', data: full.data, verifiedAt: '2026-10-12T08:00:00Z' };
const transient = { data: null, error: new Error('Network request failed'), retryable: true };
const permanent = { data: null, error: { code: '42501', message: 'permission denied' }, retryable: false };
let current!: ReturnType<typeof useActiveBaby>;
function Probe() { const value = useActiveBaby(); React.useLayoutEffect(() => { current = value; }); return null; }
function Screen({ open = false }: { open?: boolean }) {
  return <ActiveBabyProvider><Probe /><BabySwitcherButton isOpen={open} showTrigger={false} /></ActiveBabyProvider>;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe('child selector refresh', () => {
  let tree: ReactTestRenderer;
  const list = jest.mocked(listBabies);
  const labels = () => tree.root.findAllByType(Text).filter((node) => !node.props.accessibilityElementsHidden).map((node) => node.props.children);
  const mount = async () => { await act(async () => { tree = create(<Screen />); }); };
  const open = async () => { await act(async () => { tree.update(<Screen open />); }); };

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    list.mockReset();
    list.mockResolvedValue(full);
    jest.mocked(readSavedBabies).mockReset().mockResolvedValue(null);
    mockUser = { id: 'user' };
    await AsyncStorage.clear();
    await AsyncStorage.setItem('active_baby_id:user', 'pregnancy');
  });
  afterEach(() => {
    act(() => tree?.unmount());
    jest.useRealTimers();
  });

  it('keeps the displayed list unchanged while a saved snapshot is refreshed', async () => {
    await mount();
    await open();
    const before = labels();
    await act(async () => { tree.update(<Screen />); });
    const pending = deferred<typeof full>();
    jest.mocked(readSavedBabies).mockResolvedValueOnce(saved);
    list.mockReturnValueOnce(pending.promise);
    await open();
    expect(current.savedListAt).toBe(saved.verifiedAt);
    expect(labels()).toEqual(before);
    await act(async () => { await jest.advanceTimersByTimeAsync(1000); });
    expect(labels()).toEqual(before);
    await act(async () => { pending.resolve(full); });
    expect(labels()).toEqual(before);
  });

  it('reveals a slow initial load without mounting another text row and resets on reopening', async () => {
    const pending = deferred<typeof full>();
    list.mockReturnValueOnce(pending.promise);
    await act(async () => { tree = create(<Screen open />); });
    const textCount = tree.root.findAllByType(Text).length;
    expect(labels()).not.toContain('Kinder werden aktualisiert …');
    expect(labels()).not.toContain('Keine Kinder gefunden.');
    await act(async () => { await jest.advanceTimersByTimeAsync(499); });
    expect(labels()).not.toContain('Kinder werden aktualisiert …');
    await act(async () => { await jest.advanceTimersByTimeAsync(1); });
    expect(labels()).toContain('Kinder werden aktualisiert …');
    expect(tree.root.findAllByType(Text)).toHaveLength(textCount);
    await act(async () => { tree.update(<Screen />); });
    await open();
    expect(labels()).not.toContain('Kinder werden aktualisiert …');
    await act(async () => { await jest.advanceTimersByTimeAsync(499); });
    expect(labels()).not.toContain('Kinder werden aktualisiert …');
    await act(async () => { pending.resolve(full); });
    await act(async () => { await jest.advanceTimersByTimeAsync(1); });
    expect(labels()).toContain('Levi');
    expect(labels()).not.toContain('Kinder werden aktualisiert …');
  });

  it('loads freshly on opening and adds a missing pregnancy without losing existing Levi', async () => {
    list.mockResolvedValueOnce({ data: [levi], error: null });
    await mount();
    const pending = deferred<typeof full>();
    list.mockReturnValueOnce(pending.promise);
    await open();
    expect(list.mock.calls.map(([force]) => force)).toEqual([false, true]);
    expect(labels()).toContain('Levi');
    expect(labels()).not.toContain('Kinder werden aktualisiert …');
    await act(async () => { await jest.advanceTimersByTimeAsync(499); });
    expect(labels()).not.toContain('Kinder werden aktualisiert …');
    await act(async () => { await jest.advanceTimersByTimeAsync(1); });
    expect(labels()).not.toContain('Kinder werden aktualisiert …');
    expect(current.isReady).toBe(true);
    await act(async () => { pending.resolve(full); });
    expect(labels()).toContain('Schwangerschaft');
    expect(labels()).not.toContain('Kinder werden aktualisiert …');
    expect(current.activeBabyId).toBe('levi');
  });

  it('keeps the pregnancy selected and hides errors while an automatic retry recovers', async () => {
    await mount();
    list.mockResolvedValueOnce(transient).mockResolvedValueOnce(full);
    await open();
    expect(current.activeBabyId).toBe('pregnancy');
    expect(current.isReady).toBe(true);
    expect(labels()).toContain('Schwangerschaft');
    expect(labels()).not.toContain('Kinder konnten nicht aktualisiert werden.');
    await act(async () => { await jest.advanceTimersByTimeAsync(500); });
    expect(list).toHaveBeenCalledTimes(3);
    expect(current.loadError).toBeNull();
    expect(labels()).not.toContain('Kinder werden aktualisiert …');
    expect(labels()).not.toContain('Erneut versuchen');
    expect(await AsyncStorage.getItem('active_baby_id:user')).toBe('pregnancy');
  });

  it('offers manual retry beside the retained list only after both retries fail', async () => {
    await mount();
    jest.mocked(readSavedBabies).mockResolvedValueOnce(saved);
    list.mockResolvedValue(transient);
    await open();
    await act(async () => { await jest.advanceTimersByTimeAsync(500); });
    expect(labels()).not.toContain('Erneut versuchen');
    await act(async () => { await jest.advanceTimersByTimeAsync(1500); });
    expect(list).toHaveBeenCalledTimes(4);
    expect(labels()).toContain('Levi');
    expect(labels()).toContain('Schwangerschaft');
    expect(labels()).toContain('Kinder konnten nicht aktualisiert werden.');
    expect(labels().some((label) => typeof label === 'string' && label.startsWith('Gespeicherter Stand:'))).toBe(true);
    expect(labels()).not.toContain('Keine Kinder gefunden.');
    expect(current.activeBabyId).toBe('pregnancy');
    expect(createBaby).not.toHaveBeenCalled();
    expect(syncBabiesForLinkedUsers).not.toHaveBeenCalled();
    const retry = tree.root.findAllByType(TouchableOpacity).find((button) =>
      button.findAllByType(Text).some((node) => node.props.children === 'Erneut versuchen'))!;
    list.mockResolvedValue(full);
    await act(async () => { retry.props.onPress(); });
    expect(current.loadError).toBeNull();
    expect(labels()).not.toContain('Erneut versuchen');
  });

  it('shares an in-flight refresh across repeated calls and reopening', async () => {
    await mount();
    const pending = deferred<typeof full>();
    list.mockReturnValueOnce(pending.promise);
    await open();
    await act(async () => { await jest.advanceTimersByTimeAsync(500); });
    expect(labels()).not.toContain('Kinder werden aktualisiert …');
    let a!: Promise<void>;
    let b!: Promise<void>;
    await act(async () => { a = current.refreshBabies(); b = current.refreshBabies(); tree.update(<Screen />); });
    await open();
    expect(labels()).not.toContain('Kinder werden aktualisiert …');
    await act(async () => { await jest.advanceTimersByTimeAsync(499); });
    expect(labels()).not.toContain('Kinder werden aktualisiert …');
    expect(list).toHaveBeenCalledTimes(2);
    await act(async () => { pending.resolve(full); await Promise.all([a, b]); });
    expect(current.isLoading).toBe(false);
    await act(async () => { await jest.advanceTimersByTimeAsync(1); });
    expect(labels()).not.toContain('Kinder werden aktualisiert …');
  });

  it('preserves a deliberate child switch during refresh', async () => {
    await mount();
    const pending = deferred<typeof full>();
    list.mockReturnValueOnce(pending.promise);
    await open();
    await act(async () => { await current.setActiveBabyId('levi'); });
    await act(async () => { pending.resolve(full); });
    expect(current.activeBabyId).toBe('levi');
    expect(await AsyncStorage.getItem('active_baby_id:user')).toBe('levi');
  });

  it('keeps the previous list usable until the replacement selection is resolved', async () => {
    await mount();
    const stored = deferred<string | null>();
    jest.mocked(AsyncStorage.getItem).mockReturnValueOnce(stored.promise);
    const replacement = { id: 'replacement', name: 'New child' };
    list.mockResolvedValueOnce({ data: [replacement], error: null });
    await open();
    expect(current.babies).toEqual(full.data);
    expect(current.activeBaby?.id).toBe('pregnancy');
    expect(current.isReady).toBe(true);
    await act(async () => { stored.resolve('pregnancy'); });
    expect(current.babies).toEqual([replacement]);
    expect(current.activeBaby?.id).toBe('replacement');
    expect(current.isReady).toBe(true);
  });

  it('does not publish an old account response after switching accounts', async () => {
    await mount();
    const pending = deferred<typeof full>();
    list.mockReturnValueOnce(pending.promise);
    await open();
    mockUser = { id: 'other' };
    const other = { id: 'other-child', name: 'Other child' };
    list.mockResolvedValue({ data: [other], error: null });
    await act(async () => { tree.update(<Screen open />); });
    await act(async () => { pending.resolve(full); });
    expect(current.babies).toEqual([other]);
    expect(current.activeBabyId).toBe('other-child');
    expect(await AsyncStorage.getItem('active_baby_id:other')).toBe('other-child');
  });

  it('does not expose the previous account list while the new account is loading', async () => {
    await mount();
    const pending = deferred<typeof full>();
    mockUser = { id: 'other' };
    list.mockReturnValueOnce(pending.promise);
    await act(async () => { tree.update(<Screen />); });
    expect(current.babies).toEqual([]);
    expect(current.activeBabyId).toBeNull();
    expect(current.isReady).toBe(false);
    await act(async () => { pending.resolve(full); });
  });

  it('restarts the initial load after development StrictMode cancels the first effect', async () => {
    await act(async () => { tree = create(<React.StrictMode><Screen /></React.StrictMode>); });
    expect(current.isReady).toBe(true);
    expect(current.babies).toEqual(full.data);
    expect(current.activeBabyId).toBe('pregnancy');
  });

  it('clears unavailable data on a permission failure and does not retry it', async () => {
    await mount();
    list.mockResolvedValueOnce(permanent);
    await open();
    expect(list).toHaveBeenCalledTimes(2);
    expect(current.babies).toEqual([]);
    expect(current.activeBabyId).toBeNull();
    expect(labels()).toContain('Erneut versuchen');
    expect(labels()).not.toContain('Keine Kinder gefunden.');
  });

  it('does not create a placeholder when a reload after partner sync fails', async () => {
    jest.mocked(syncBabiesForLinkedUsers).mockResolvedValueOnce({ success: true, data: null });
    list.mockResolvedValueOnce({ data: [], error: null }).mockResolvedValueOnce(permanent);
    await mount();
    expect(current.loadError).toContain('permission denied');
    expect(createBaby).not.toHaveBeenCalled();
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
