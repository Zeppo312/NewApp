import React from 'react';
import { Image, View } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ZoomTransitionStage } from '@/components/navigation/ZoomTransitionStage';
import { openWithZoom, whenTransitionIdle } from '@/lib/navigation/zoomTransition';

const mockPush = jest.fn();
let mockNavigationListener: (() => void) | undefined;
const mockNavigation = {
  addListener: jest.fn((_event: string, listener: () => void) => {
    mockNavigationListener = listener;
    return jest.fn();
  }),
};
let mockFrame: (frame: { timestamp: number; timeSincePreviousFrame: number }) => void;
const mockClock = { setActive: jest.fn() };
const mockReleaseCapture = jest.fn();

jest.mock('expo-router', () => ({
  useNavigationContainerRef: () => mockNavigation,
  router: { push: (...args: unknown[]) => mockPush(...args) },
}));
jest.mock('react-native-view-shot', () => ({
  captureRef: jest.fn(async () => 'file:///tmp/zoom-regression.jpg'),
  releaseCapture: (uri: string) => mockReleaseCapture(uri),
}));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: jest.requireActual('react-native').View }));
jest.mock('react-native-worklets', () => ({ scheduleOnRN: (callback: () => void) => callback() }));
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: jest.requireActual('react-native').View },
  Easing: { bezier: () => (value: number) => value },
  ReduceMotion: { Never: 'never' },
  interpolate: (value: number) => value,
  useReducedMotion: () => false,
  useAnimatedStyle: () => ({}),
  useSharedValue: (initial: unknown) => {
    const { useRef } = jest.requireActual('react');
    const ref = useRef(initial);
    const shared = useRef({ get: () => ref.current, set: (value: unknown) => { ref.current = value; } });
    return shared.current;
  },
  useFrameCallback: (callback: typeof mockFrame) => { mockFrame = callback; return mockClock; },
  withSequence: (...values: unknown[]) => values[values.length - 1],
  withTiming: (value: number, _options: unknown, completed?: () => void) => {
    completed?.();
    return value;
  },
}));

let tree: ReactTestRenderer;
afterEach(() => {
  act(() => tree?.unmount());
  jest.restoreAllMocks();
});

it('finishes a real stage transition after navigation and releases deferred focus work', async () => {
  jest.spyOn(global, 'requestAnimationFrame').mockImplementation((callback) => {
    callback(0);
    return 0;
  });
  act(() => {
    tree = create(<ZoomTransitionStage><View /></ZoomTransitionStage>, { createNodeMock: () => ({}) });
  });
  act(() => {
    tree.root.findByType(ZoomTransitionStage).findAllByType(View)[0].props.onLayout({
      nativeEvent: { layout: { width: 390, height: 844 } },
    });
  });

  let transition: Promise<void>;
  await act(async () => {
    transition = openWithZoom('/milestones', {
      measureInWindow: (callback) => callback(20, 80, 100, 60),
    });
  });
  await act(async () => { tree.root.findByType(Image).props.onLoad(); });
  expect(mockPush).toHaveBeenCalledTimes(1);
  expect(mockNavigation.addListener).toHaveBeenCalledWith('state', expect.any(Function));

  const focusWork = jest.fn();
  whenTransitionIdle(focusWork);
  expect(focusWork).not.toHaveBeenCalled();
  await act(async () => {
    mockNavigationListener?.();
    for (let index = 0; index < 8; index += 1) {
      mockFrame({ timestamp: 16 + index * 16, timeSincePreviousFrame: 16 });
    }
    await transition!;
  });

  expect(mockReleaseCapture).toHaveBeenCalledWith('file:///tmp/zoom-regression.jpg');
  expect(focusWork).toHaveBeenCalledTimes(1);
  expect(tree.root.findAllByType(Image)).toHaveLength(0);
  await act(async () => { await openWithZoom('/support'); });
  expect(mockPush).toHaveBeenCalledTimes(2);
});
