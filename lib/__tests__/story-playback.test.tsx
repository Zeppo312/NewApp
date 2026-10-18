import React from 'react';
import { AccessibilityInfo, AppState, Platform } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useStoryPlayback } from '@/hooks/use-story-playback';

jest.mock('react-native-reanimated', () => ({
  useSharedValue: (initial: number) => {
    const { useRef } = jest.requireActual('react');
    const ref = useRef(null);
    if (!ref.current) {
      let value = initial;
      ref.current = { get: () => value, set: (next: number) => { value = next; } };
    }
    return ref.current;
  },
  useReducedMotion: () => false,
  cancelAnimation: jest.fn(),
  withTiming: (value: number) => value,
  Easing: { linear: (value: number) => value },
  ReduceMotion: { Never: 'never' },
}));

let tree: ReactTestRenderer;
let readerEnabled = false;
let motionReduced = false;
const appListeners = new Map<string, (state: any) => void>();
const accessibilityListeners = new Map<string, (enabled: boolean) => void>();
const originalState = AppState.currentState;
const originalPlatform = Platform.OS;
const ended = jest.fn();
let result: ReturnType<typeof useStoryPlayback>;

function Probe({ pageKey = 'baby:0', enabled = true }: { pageKey?: string; enabled?: boolean }) {
  const playback = useStoryPlayback({ pageKey, enabled, duration: 5000, onEnd: () => ended(pageKey) });
  React.useEffect(() => { result = playback; }, [playback]);
  return null;
}
async function mount(props: React.ComponentProps<typeof Probe> = {}) {
  await act(async () => { tree = create(<Probe {...props} />); });
}
function update(props: React.ComponentProps<typeof Probe>) { act(() => tree.update(<Probe {...props} />)); }
function advance(ms: number) { act(() => jest.advanceTimersByTime(ms)); }
function app(event: 'change' | 'blur' | 'focus', state = 'active') {
  if (event === 'change') Object.defineProperty(AppState, 'currentState', { configurable: true, value: state });
  act(() => appListeners.get(event)?.(state));
}

beforeEach(() => {
  jest.useFakeTimers(); jest.setSystemTime(0); jest.clearAllMocks();
  readerEnabled = false; motionReduced = false;
  appListeners.clear(); accessibilityListeners.clear();
  Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' });
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
  jest.spyOn(AppState, 'addEventListener').mockImplementation((event, callback) => {
    appListeners.set(event, callback);
    return { remove: () => { appListeners.delete(event); } };
  });
  jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockImplementation(async () => readerEnabled);
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockImplementation(async () => motionReduced);
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((event: string, callback: (enabled: boolean) => void) => {
    accessibilityListeners.set(event, callback);
    return { remove: () => { accessibilityListeners.delete(event); } };
  }) as unknown as typeof AccessibilityInfo.addEventListener);
});
afterEach(() => {
  act(() => tree?.unmount());
  jest.restoreAllMocks(); jest.useRealTimers();
  Object.defineProperty(AppState, 'currentState', { configurable: true, value: originalState });
  Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
});

it('waits for image readiness without consuming the page, then advances exactly once', async () => {
  await mount({ enabled: false }); advance(60000); expect(ended).not.toHaveBeenCalled();
  update({ enabled: true }); advance(4999); expect(ended).not.toHaveBeenCalled();
  advance(1); expect(ended).toHaveBeenCalledTimes(1);
  update({ enabled: false }); update({ enabled: true }); advance(10000);
  expect(ended).toHaveBeenCalledTimes(1);
});

it('preserves the remaining time across a long hold or explicit pause', async () => {
  await mount(); advance(2000); update({ enabled: false }); advance(120000);
  expect(ended).not.toHaveBeenCalled();
  update({ enabled: true }); advance(2999); expect(ended).not.toHaveBeenCalled();
  advance(1); expect(ended).toHaveBeenCalledWith('baby:0');
});

it('does not spend reading time while an article covers the story', async () => {
  await mount(); advance(4900); update({ enabled: false }); advance(30000);
  expect(ended).not.toHaveBeenCalled();
  update({ enabled: true }); advance(99); expect(ended).not.toHaveBeenCalled();
  advance(1); expect(ended).toHaveBeenCalledTimes(1);
});

it('pauses during inactive/background state and Android notification blur', async () => {
  await mount(); advance(1000); app('change', 'inactive'); advance(20000);
  app('change', 'background'); advance(20000); expect(ended).not.toHaveBeenCalled();
  app('change', 'active'); advance(1000); app('blur'); advance(20000);
  expect(ended).not.toHaveBeenCalled();
  app('focus'); advance(2999); expect(ended).not.toHaveBeenCalled();
  advance(1); expect(ended).toHaveBeenCalledTimes(1);
});

it('uses only supported AppState subscriptions on iOS and still pauses in the background', async () => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
  await mount(); expect([...appListeners.keys()]).toEqual(['change']);
  advance(1000); app('change', 'background'); advance(60000);
  expect(ended).not.toHaveBeenCalled();
  app('change', 'active'); advance(4000); expect(ended).toHaveBeenCalledTimes(1);
});

it('cancels an almost-finished page before a manual page or topic switch', async () => {
  await mount(); advance(4999); update({ pageKey: 'body:0' }); advance(1);
  expect(ended).not.toHaveBeenCalled();
  advance(4999); expect(ended.mock.calls).toEqual([['body:0']]);
});

it('leaves screen-reader navigation manual and resumes only after it is disabled', async () => {
  readerEnabled = true; await mount(); advance(60000);
  expect(result.autoplayAllowed).toBe(false); expect(ended).not.toHaveBeenCalled();
  act(() => accessibilityListeners.get('screenReaderChanged')?.(false));
  advance(4999); expect(ended).not.toHaveBeenCalled(); advance(1);
  expect(ended).toHaveBeenCalledTimes(1);
});

it('never collapses reduced-motion playback into immediate page completion', async () => {
  motionReduced = true; await mount(); advance(60000);
  expect(result.reducedMotion).toBe(true); expect(ended).not.toHaveBeenCalled();
  act(() => accessibilityListeners.get('reduceMotionChanged')?.(false)); advance(1000);
  act(() => accessibilityListeners.get('reduceMotionChanged')?.(true)); advance(60000);
  expect(ended).not.toHaveBeenCalled();
  act(() => accessibilityListeners.get('reduceMotionChanged')?.(false)); advance(4000);
  expect(ended).toHaveBeenCalledTimes(1);
});

it('removes clocks and listeners when dismissed', async () => {
  await mount(); advance(4999); act(() => tree.unmount()); advance(60000);
  expect(ended).not.toHaveBeenCalled(); expect(appListeners.size).toBe(0);
  expect(accessibilityListeners.size).toBe(0);
});
