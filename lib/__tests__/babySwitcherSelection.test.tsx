import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Alert, Modal, StyleSheet, TouchableOpacity } from 'react-native';
import BabySwitcherButton from '@/components/BabySwitcherButton';
import { LavenderColors } from '@/constants/Colors';
import { AvatarModalMaterial } from '@/components/ui/avatar-modal-material';
import { ActionButton } from '@/components/ui/action-button';
import { GlassCloseButton } from '@/components/ui/glass-close-button';

let mockUser = { id: 'first' };
let mockBorn = true;
let mockEffectiveScheme: 'light' | 'dark' = 'light';
const mockSetActive = jest.fn();
const mockRunSwitch = jest.fn();
const mockViewMode = jest.fn();
const mockRouter = { replace: jest.fn(), push: jest.fn() };
const mockInfo = jest.fn();
const mockExit = jest.fn();
const mockBabies = [
  { id: 'levi', name: 'Levi', birth_date: '2024-01-01' },
  { id: 'pregnancy', name: 'Schwangerschaft', birth_date: null as string | null | undefined },
];
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock('@/contexts/ActiveBabyContext', () => ({ useActiveBaby: () => ({ babies: mockBabies, activeBaby: mockBabies[0], activeBabyId: 'levi', setActiveBabyId: mockSetActive, refreshBabies: jest.fn(), isLoading: false, loadError: null }) }));
jest.mock('@/contexts/BabyStatusContext', () => ({ useBabyStatus: () => ({ isBabyBorn: mockBorn, temporaryViewMode: null, setTemporaryViewMode: mockViewMode }) }));
jest.mock('@/contexts/BabySwitchTransitionContext', () => ({ useBabySwitchTransition: () => ({ isSwitching: false, runSwitch: mockRunSwitch }) }));
jest.mock('@/contexts/LocaleContext', () => ({ useLocale: () => ({ locale: 'de' }) }));
jest.mock('@/hooks/useColorScheme', () => ({ useColorScheme: () => 'light' }));
jest.mock('@/hooks/useAdaptiveColors', () => ({ useAdaptiveColors: () => ({ effectiveScheme: mockEffectiveScheme }) }));
jest.mock('@/components/CachedImage', () => ({ CachedImage: () => null }));
jest.mock('@/components/ui/IconSymbol', () => ({ IconSymbol: () => null }));
jest.mock('@/components/ThemedText', () => ({ ThemedText: jest.requireActual('react-native').Text }));
jest.mock('expo-image-picker', () => ({}));
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }) }));
jest.mock('react-native-reanimated', () => ({ __esModule: true, default: { View: jest.requireActual('react-native').View, createAnimatedComponent: (component: unknown) => component }, useReducedMotion: () => false }));
jest.mock('@/hooks/useAvatarModalMotion', () => ({ useAvatarModalMotion: ({ open, onClosed }: { open: boolean; onClosed: () => void }) => {
  const closed = jest.requireActual('react').useRef(false);
  return { presented: open, isClosing: false, triggerRef: { current: null }, panelRef: { current: null }, panelStyle: {}, contentStyle: {}, materialStyle: {}, shapeProps: {}, backdropStyle: {}, onPanelLayout: () => {}, onShow: () => {}, dismiss: async () => {
    if (!closed.current) { await mockExit(); closed.current = true; onClosed(); }
    return true;
  } };
} }));
jest.mock('expo-blur', () => ({ BlurView: jest.requireActual('react-native').View }));
jest.mock('@/lib/baby', () => ({ getBabyInfo: (...args: unknown[]) => mockInfo(...args) }));

function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((done) => { resolve = done; }); return { promise, resolve }; }
let tree: ReactTestRenderer;
const close = jest.fn();
const screen = (navigate = true) => <BabySwitcherButton isOpen showTrigger={false} navigateOnSelect={navigate} onOpenChange={close} />;
const row = (label: string) => tree.root.findAllByType(TouchableOpacity).find((node) => node.props.accessibilityRole === 'radio' && node.props.accessibilityLabel === label)!;
const tap = async (label: string) => { await act(async () => { row(label).props.onPress(); }); };

it('disposes the closed native popup and mounts a fresh one on each reopening', async () => {
  let previous = tree.root.findByType(Modal);
  for (let cycle = 0; cycle < 3; cycle += 1) {
    await act(async () => { tree.update(<BabySwitcherButton isOpen={false} showTrigger={false} onOpenChange={close} />); });
    expect(tree.root.findAllByType(Modal)).toHaveLength(0);
    await act(async () => { tree.update(screen()); });
    const next = tree.root.findByType(Modal);
    expect(next).not.toBe(previous);
    expect(next.props.animationType).toBe('none');
    previous = next;
  }
});

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockUser = { id: 'first' };
  mockBorn = true;
  mockEffectiveScheme = 'light';
  mockBabies[1].birth_date = null;
  mockSetActive.mockReset().mockResolvedValue(undefined);
  mockRunSwitch.mockReset().mockImplementation(async (change) => { await change(); return true; });
  mockInfo.mockReset().mockResolvedValue({ data: { birth_date: null }, error: null });
  mockExit.mockReset().mockResolvedValue(undefined);
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  act(() => { tree = create(screen()); });
});
afterEach(() => { act(() => tree.unmount()); jest.restoreAllMocks(); jest.useRealTimers(); });

it('matches the app background theme and updates the open popup without changing its layout', () => {
  const layout = StyleSheet.flatten(tree.root.findByProps({ testID: 'baby-switcher-layout' }).props.style);
  act(() => { mockEffectiveScheme = 'dark'; tree.update(screen()); });
  expect(tree.root.findByType(AvatarModalMaterial).props.isDark).toBe(true);
  expect(tree.root.findByType(GlassCloseButton).props.isDark).toBe(true);
  expect(tree.root.findAllByType(ActionButton).every(node => node.props.isDark)).toBe(true);
  expect(StyleSheet.flatten(tree.root.findByProps({ testID: 'baby-switcher-row-pregnancy' }).props.style).backgroundColor).toBe(LavenderColors.dark.field);
  expect(StyleSheet.flatten(tree.root.findByProps({ testID: 'baby-switcher-layout' }).props.style)).toEqual(layout);
  act(() => { mockEffectiveScheme = 'light'; tree.update(screen()); });
  expect(tree.root.findByType(AvatarModalMaterial).props.isDark).toBe(false);
});

it('does not change the active baby or navigate before the background is covered', async () => {
  let covered!: () => Promise<void>;
  mockRunSwitch.mockImplementation((change) => new Promise((resolve) => {
    covered = async () => { await change(); resolve(true); };
  }));
  await tap('Schwangerschaft');
  expect(mockSetActive).not.toHaveBeenCalled();
  expect(mockRouter.replace).not.toHaveBeenCalled();
  await act(async () => { await covered(); await jest.advanceTimersByTimeAsync(1); });
  expect(mockSetActive).toHaveBeenCalledWith('pregnancy');
  expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)/pregnancy-home');
  expect(mockViewMode).toHaveBeenCalledWith('pregnancy');
  expect(mockInfo).toHaveBeenCalledWith('pregnancy');
});

it('blocks rapid competing taps and only changes child after the reverse animation settles', async () => {
  const exit = deferred<void>();
  mockExit.mockReturnValue(exit.promise);
  await act(async () => { row('Schwangerschaft').props.onPress(); row('Levi').props.onPress(); });
  await act(async () => { tree.root.findByType(Modal).props.onRequestClose(); });
  expect(mockSetActive).not.toHaveBeenCalled();
  expect(mockRunSwitch).not.toHaveBeenCalled();
  expect(close).not.toHaveBeenCalled();
  await act(async () => { exit.resolve(); await jest.advanceTimersByTimeAsync(1); });
  expect(mockRunSwitch).toHaveBeenCalledTimes(1);
  expect(mockSetActive).toHaveBeenCalledTimes(1);
  expect(mockRouter.replace).toHaveBeenCalledTimes(1);
  expect(close).toHaveBeenCalledWith(false);
});

it('keeps an embedded form open on its route without an area transition', async () => {
  act(() => { tree.update(screen(false)); });
  await tap('Schwangerschaft');
  expect(mockSetActive).toHaveBeenCalledWith('pregnancy');
  expect(mockRunSwitch).not.toHaveBeenCalled();
  expect(mockRouter.replace).not.toHaveBeenCalled();
  expect(close).toHaveBeenCalledWith(false);
});

it('returns to the current baby home without replaying the switch animation or saving again', async () => {
  await tap('Levi');
  await act(async () => { await jest.advanceTimersByTimeAsync(1); });
  expect(mockRunSwitch).not.toHaveBeenCalled();
  expect(mockSetActive).not.toHaveBeenCalled();
  expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)/home');
});

it('animates the return from a temporary pregnancy view for the same born baby', async () => {
  act(() => { mockBorn = false; tree.update(screen()); });
  await tap('Levi');
  await act(async () => { await jest.advanceTimersByTimeAsync(1); });
  expect(mockRunSwitch).toHaveBeenCalledTimes(1);
  expect(mockSetActive).not.toHaveBeenCalled();
  expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)/home');
});

it('does not mistake a failed destination lookup for a pregnancy, and allows retrying', async () => {
  mockBabies[1].birth_date = undefined;
  mockInfo.mockResolvedValue({ data: null, error: new Error('Offline') });
  await tap('Schwangerschaft');
  expect(mockSetActive).not.toHaveBeenCalled();
  expect(mockRouter.replace).not.toHaveBeenCalled();
  expect(close).not.toHaveBeenCalled();
  expect(Alert.alert).toHaveBeenCalled();
  expect(row('Schwangerschaft').props.disabled).toBe(false);
});

it('honors a newly recorded birth even if the displayed list still contains a pregnancy', async () => {
  mockInfo.mockResolvedValue({ data: { birth_date: '2026-10-12' }, error: null });
  await tap('Schwangerschaft');
  await act(async () => { await jest.advanceTimersByTimeAsync(1); });
  expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)/home');
  expect(mockViewMode).toHaveBeenCalledWith('baby');
});

it('keeps a known pregnancy selectable when the fresh lookup is unavailable offline', async () => {
  mockInfo.mockResolvedValue({ data: null, error: new Error('Offline') });
  await tap('Schwangerschaft');
  await act(async () => { await jest.advanceTimersByTimeAsync(1); });
  expect(mockSetActive).toHaveBeenCalledWith('pregnancy');
  expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)/pregnancy-home');
  expect(Alert.alert).not.toHaveBeenCalled();
});

it('discards a destination result from the previous account', async () => {
  mockBabies[1].birth_date = undefined;
  const lookup = deferred<{ data: { birth_date: null }; error: null }>();
  mockInfo.mockReturnValue(lookup.promise);
  await tap('Schwangerschaft');
  await act(async () => { mockUser = { id: 'second' }; tree.update(screen()); });
  await act(async () => { lookup.resolve({ data: { birth_date: null }, error: null }); await jest.advanceTimersByTimeAsync(1); });
  expect(mockSetActive).not.toHaveBeenCalled();
  expect(mockRouter.replace).not.toHaveBeenCalled();
});

it('uses the same covered transition for the temporary pregnancy area', async () => {
  let covered!: () => Promise<void>;
  mockRunSwitch.mockImplementation((change) => new Promise((resolve) => {
    covered = async () => { await change(); resolve(true); };
  }));
  const button = tree.root.findByProps({ label: 'Schwangerschaftsmodus anschauen' });
  await act(async () => { button.props.onPress(); });
  expect(mockViewMode).not.toHaveBeenCalled();
  await act(async () => { await covered(); await jest.advanceTimersByTimeAsync(1); });
  expect(mockViewMode).toHaveBeenCalledWith('pregnancy');
  expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)/pregnancy-home');
});
