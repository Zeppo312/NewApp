import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { LavenderColors } from '@/constants/Colors';
import { BabySwitchTransitionProvider, useBabySwitchTransition } from '@/contexts/BabySwitchTransitionContext';

let mockUser = { id: 'first' };
let mockReduced = false;
let mockEffectiveScheme: 'light' | 'dark' = 'light';
const mockAnimations: { to: number; finish: (finished: boolean) => void }[] = [];
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock('@/hooks/useColorScheme', () => ({ useColorScheme: () => 'light' }));
jest.mock('@/hooks/useAdaptiveColors', () => ({ useAdaptiveColors: () => ({ effectiveScheme: mockEffectiveScheme }) }));
jest.mock('react-native-worklets', () => ({ scheduleOnRN: (fn: (...args: any[]) => void, ...args: any[]) => fn(...args) }));
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: jest.requireActual('react-native').View },
  useSharedValue: (initial: number) => jest.requireActual('react').useMemo(() => {
    let value = initial;
    return { get: () => value, set: (next: number) => { value = next; } };
  }, []),
  useAnimatedStyle: (style: () => unknown) => style(),
  useReducedMotion: () => mockReduced,
  ReduceMotion: { System: 'system' },
  Easing: { bezier: () => undefined },
  cancelAnimation: jest.fn(),
  withTiming: (to: number, _config: unknown, finish: (finished: boolean) => void) => {
    mockAnimations.push({ to, finish });
    return to;
  },
}));

let current!: ReturnType<typeof useBabySwitchTransition>;
function Probe() { const value = useBabySwitchTransition(); React.useLayoutEffect(() => { current = value; }); return null; }
const screen = () => <BabySwitchTransitionProvider><Probe /></BabySwitchTransitionProvider>;
const finish = async () => { await act(async () => { mockAnimations.shift()!.finish(true); }); };
let tree: ReactTestRenderer;

beforeEach(() => {
  jest.useFakeTimers();
  mockAnimations.length = 0;
  mockUser = { id: 'first' };
  mockReduced = false;
  mockEffectiveScheme = 'light';
  act(() => { tree = create(screen()); });
});
afterEach(() => { act(() => tree.unmount()); jest.useRealTimers(); });

it('uses the same effective dark theme as the popup and app background', () => {
  act(() => { mockEffectiveScheme = 'dark'; tree.update(screen()); });
  expect(tree.root.findByType(LinearGradient).props.colors).toEqual(LavenderColors.dark.transition);
  act(() => { mockEffectiveScheme = 'light'; tree.update(screen()); });
  expect(tree.root.findByType(LinearGradient).props.colors).toEqual(LavenderColors.light.transition);
});

it('covers before changing the area and keeps the interaction locked through the reveal', async () => {
  const change = jest.fn(), secondChange = jest.fn();
  let switching!: Promise<boolean>;
  act(() => { switching = current.runSwitch(change); });
  expect(current.isSwitching).toBe(true);
  expect(change).not.toHaveBeenCalled();
  expect(mockAnimations[0].to).toBe(1);
  await expect(current.runSwitch(secondChange)).resolves.toBe(false);
  expect(secondChange).not.toHaveBeenCalled();
  await finish();
  expect(change).toHaveBeenCalledTimes(1);
  await act(async () => { await jest.advanceTimersByTimeAsync(50); });
  expect(mockAnimations[0].to).toBe(0);
  expect(current.isSwitching).toBe(true);
  await finish();
  await expect(switching).resolves.toBe(true);
  expect(current.isSwitching).toBe(false);
  expect(tree.root.findByProps({ testID: 'baby-switch-veil' }).props.pointerEvents).toBe('none');
});

it('reveals and unlocks the original area after an error, allowing a retry', async () => {
  let switching!: Promise<boolean>;
  const failure = new Error('Storage failed');
  act(() => { switching = current.runSwitch(() => { throw failure; }); });
  const rejected = switching.catch((error) => error);
  await finish();
  expect(mockAnimations[0].to).toBe(0);
  await finish();
  expect(await rejected).toBe(failure);
  expect(current.isSwitching).toBe(false);
  const retry = jest.fn();
  act(() => { void current.runSwitch(retry); });
  await finish();
  expect(retry).toHaveBeenCalledTimes(1);
});

it('cancels an old account before its queued selection can commit', async () => {
  const change = jest.fn();
  let switching!: Promise<boolean>;
  act(() => { switching = current.runSwitch(change); });
  await act(async () => { mockUser = { id: 'second' }; tree.update(screen()); });
  await expect(switching).resolves.toBe(false);
  expect(change).not.toHaveBeenCalled();
  expect(current.isSwitching).toBe(false);
  expect(tree.root.findByProps({ testID: 'baby-switch-veil' }).props.pointerEvents).toBe('none');
});

it('settles a pending animation when its navigator unmounts', async () => {
  const change = jest.fn();
  let switching!: Promise<boolean>;
  act(() => { switching = current.runSwitch(change); });
  await act(async () => { tree.unmount(); });
  await expect(switching).resolves.toBe(false);
  expect(change).not.toHaveBeenCalled();
});

it('keeps the veil stationary with reduced motion', () => {
  act(() => { mockReduced = true; tree.update(screen()); });
  const style = StyleSheet.flatten(tree.root.findByProps({ testID: 'baby-switch-veil' }).props.style);
  expect(style.transform).toEqual([{ scale: 1 }]);
});
