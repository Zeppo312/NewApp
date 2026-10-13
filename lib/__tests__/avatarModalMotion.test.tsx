import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { View, type LayoutChangeEvent, type ViewStyle } from 'react-native';
import { useAvatarModalMotion } from '@/hooks/useAvatarModalMotion';

type Animation = { to: number; finish: (finished: boolean) => void; config: { duration: number }; cell?: { value: unknown } };
const mockAnimations: Animation[] = [];
let mockReduced = false;
jest.mock('react-native-worklets', () => ({ scheduleOnRN: (fn: (...args: any[]) => void, ...args: any[]) => fn(...args) }));
jest.mock('react-native-reanimated', () => ({
  useReducedMotion: () => mockReduced,
  ReduceMotion: { System: 'system', Never: 'never' },
  Easing: { bezier: () => undefined },
  cancelAnimation: jest.fn(),
  useSharedValue: (initial: unknown) => jest.requireActual('react').useMemo(() => {
    const cell = { value: initial, get: () => cell.value, set: (next: any) => {
      if (next?.finish) { next.cell = cell; mockAnimations.push(next); }
      else cell.value = typeof next === 'function' ? next(cell.value) : next;
    } };
    return cell;
  }, []),
  useDerivedValue: (fn: () => unknown) => ({ get: fn }),
  useAnimatedStyle: (fn: () => any) => ({ get opacity() { return fn().opacity; }, get transform() { return fn().transform; } }),
  useAnimatedProps: (fn: () => any) => ({ get d() { return fn().d; } }),
  withTiming: (to: number, config: Animation['config'], finish: Animation['finish']) => ({ to, config, finish }),
  withSpring: (to: number, config: Animation['config'], finish: Animation['finish']) => ({ to, config, finish }),
}));

let current!: ReturnType<typeof useAvatarModalMotion>;
let trigger = { x: 300, y: 92, width: 68, height: 68 };
const panel = { x: 12, y: 62, width: 366, height: 720 };
let panelInWindow = { ...panel };
let delayTriggerMeasurement = false;
let pendingTriggerMeasurement: ((...args: number[]) => void) | undefined;
const panelMeasurement = jest.fn((callback: (...args: number[]) => void) => callback(panelInWindow.x, panelInWindow.y, panelInWindow.width, panelInWindow.height));
const closed = jest.fn();
function Screen({ open = true, scope = 'user' }: { open?: boolean; scope?: string }) {
  const motion = useAvatarModalMotion({ open, scope, onClosed: closed });
  const { triggerRef, panelRef, panelStyle, onPanelLayout } = motion;
  React.useLayoutEffect(() => {
    // React Native's Jest View supplies inert measurement methods; supply the
    // coordinates the native windows would report, independently of the hook.
    triggerRef.current = { measureInWindow: (callback: (...args: number[]) => void) => {
      if (delayTriggerMeasurement) pendingTriggerMeasurement = callback;
      else callback(trigger.x, trigger.y, trigger.width, trigger.height);
    } } as unknown as View;
    panelRef.current = { measureInWindow: panelMeasurement } as unknown as View;
    current = motion;
  });
  return <><View testID="trigger" ref={triggerRef} /><View testID="panel-layout" ref={panelRef} onLayout={onPanelLayout}><View testID="panel" style={panelStyle as unknown as ViewStyle} /></View></>;
}
let tree: ReactTestRenderer;
const layoutOnly = async () => { await act(async () => { current.onPanelLayout({ nativeEvent: { layout: panel } } as LayoutChangeEvent); }); };
const layout = async () => {
  await layoutOnly();
  await act(async () => { current.onShow(); await jest.advanceTimersByTimeAsync(40); });
};
const reopen = async () => {
  await act(async () => { tree.update(<Screen open={false} />); });
  await act(async () => { tree.update(<Screen />); });
};
const finishNext = async () => { const animation = mockAnimations.shift()!; await act(async () => { animation.cell!.value = animation.to; animation.finish(true); }); return animation; };
const style = () => tree.root.findByProps({ testID: 'panel' }).props.style;
// The local Reanimated mock exposes sampled values as getters rather than native style handles.
const contentStyle = () => current.contentStyle as unknown as { opacity: number; transform: { scale: number }[] };
const materialStyle = () => current.materialStyle as unknown as { opacity: number };

beforeEach(async () => {
  jest.useFakeTimers();
  mockAnimations.length = 0;
  mockReduced = false;
  trigger = { x: 300, y: 92, width: 68, height: 68 };
  panelInWindow = { ...panel };
  delayTriggerMeasurement = false;
  pendingTriggerMeasurement = undefined;
  panelMeasurement.mockClear();
  closed.mockClear();
  await act(async () => { tree = create(<Screen />); });
});
afterEach(() => { act(() => tree.unmount()); jest.useRealTimers(); });

it('opens from the measured avatar center and settles at the untransformed dialog', async () => {
  await layout();
  expect(style().transform).toEqual([{ translateX: 139 }, { translateY: -296 }]);
  expect(contentStyle().transform).toEqual([{ scale: 68 / 366 }]);
  // The outline is an actual avatar-sized circle, not a scaled tall rectangle.
  const numbers = current.shapeProps.d!.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
  const xs = numbers.filter((_, index) => index % 2 === 0);
  const ys = numbers.filter((_, index) => index % 2 === 1);
  expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(67);
  expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(67);
  expect((Math.max(...xs) + Math.min(...xs)) / 2).toBe(183);
  expect((Math.max(...ys) + Math.min(...ys)) / 2).toBe(360);
  expect(style().opacity).toBe(0);
  expect(mockAnimations[0].config.duration).toBe(380);
  await finishNext();
  expect(style().transform[0].translateX).toBeCloseTo(0);
  expect(style().transform[1].translateY).toBeCloseTo(0);
  expect(contentStyle().transform).toEqual([{ scale: 1 }]);
  expect(style().opacity).toBe(1);
  expect(contentStyle().opacity).toBe(1);
});

it('keeps the Modal mounted and delays its close callback until the return finishes', async () => {
  await layout(); await finishNext();
  let exiting!: Promise<boolean>;
  await act(async () => { exiting = current.dismiss(); });
  expect(current.presented).toBe(true);
  expect(current.isClosing).toBe(true);
  expect(mockAnimations[0].config.duration).toBe(340);
  expect(closed).not.toHaveBeenCalled();
  await finishNext();
  await expect(exiting).resolves.toBe(true);
  expect(current.presented).toBe(false);
  expect(closed).toHaveBeenCalledTimes(1);
});

it('returns to the avatar’s updated position after a layout change', async () => {
  await layout(); await finishNext();
  trigger = { ...trigger, x: 20, y: 20 };
  await act(async () => { void current.dismiss(); });
  const exit = mockAnimations[0]; exit.cell!.value = 0;
  expect(style().transform).toEqual([{ translateX: -141 }, { translateY: -368 }]);
  await finishNext();
});

it('reverses an interrupted dismissal from its current progress and ignores its stale completion', async () => {
  await layout(); await finishNext();
  let exiting!: Promise<boolean>;
  await act(async () => { exiting = current.dismiss(); });
  const interrupted = mockAnimations.shift()!; interrupted.cell!.value = 0.5;
  await act(async () => { tree.update(<Screen open={false} />); });
  await act(async () => { tree.update(<Screen />); });
  await expect(exiting).resolves.toBe(false);
  expect(style().opacity).toBe(1);
  expect(contentStyle().opacity).toBeGreaterThan(0);
  expect(contentStyle().opacity).toBeLessThan(1);
  await act(async () => { interrupted.finish(true); });
  expect(closed).not.toHaveBeenCalled();
  expect(current.presented).toBe(true);
  await finishNext();
});

it('settles pending work without a late close callback when the screen unmounts', async () => {
  await layout(); await finishNext();
  let exiting!: Promise<boolean>;
  await act(async () => { exiting = current.dismiss(); });
  await act(async () => { tree.unmount(); });
  await expect(exiting).resolves.toBe(false);
  expect(closed).not.toHaveBeenCalled();
});

it('cancels the previous account’s pending dismissal', async () => {
  await layout(); await finishNext();
  let exiting!: Promise<boolean>;
  await act(async () => { exiting = current.dismiss(); });
  await act(async () => { tree.update(<Screen scope="other" />); });
  await expect(exiting).resolves.toBe(false);
  expect(current.presented).toBe(false);
  expect(closed).toHaveBeenCalledTimes(1);
  await act(async () => { mockAnimations.shift()!.finish(true); });
  expect(closed).toHaveBeenCalledTimes(1);
});

it('uses a stationary fade with reduced motion', async () => {
  mockReduced = true;
  await act(async () => { tree.update(<Screen />); });
  await layout();
  expect(style().transform).toEqual([{ translateX: 0 }, { translateY: 0 }]);
  expect(contentStyle().transform).toEqual([{ scale: 1 }]);
  expect(mockAnimations[0].config.duration).toBe(120);
  await finishNext();
});

it('falls back to a centered fade when there is no measurable avatar', async () => {
  trigger = { x: 0, y: 0, width: 0, height: 0 };
  await reopen();
  await layout();
  expect(style().transform).toEqual([{ translateX: 0 }, { translateY: 0 }]);
  expect(contentStyle().transform).toEqual([{ scale: 0.96 }]);
  await finishNext();
});

it('keeps the glass visible at the avatar after the contents have disappeared', async () => {
  await layout();
  const animation = mockAnimations[0];
  animation.cell!.value = 0.25;
  expect(style().opacity).toBe(1);
  expect(contentStyle().opacity).toBe(0);
  expect(materialStyle().opacity).toBe(0);
  animation.cell!.value = 0.5;
  expect(contentStyle().opacity).toBeGreaterThan(0);
  expect(contentStyle().opacity).toBeLessThan(1);
  const halfway = current.shapeProps.d;
  animation.cell!.value = 1;
  expect(current.shapeProps.d).not.toBe(halfway);
  expect(materialStyle().opacity).toBe(1);
});

it('fits the glass to late list data without replaying the entrance', async () => {
  await layout(); await finishNext();
  await act(async () => { current.onPanelLayout({ nativeEvent: { layout: { ...panel, height: 820 } } } as LayoutChangeEvent); });
  const numbers = current.shapeProps.d!.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
  const ys = numbers.filter((_, index) => index % 2 === 1);
  expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(819);
  expect(mockAnimations).toHaveLength(0);
  expect(contentStyle().opacity).toBe(1);
});

it('points the narrow end toward a trigger below the dialog', async () => {
  trigger = { ...trigger, y: 790 };
  await reopen();
  await layout();
  mockAnimations[0].cell!.value = 0.5;
  const numbers = current.shapeProps.d!.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
  expect(numbers[1]).toBeGreaterThan(panel.height / 2);
  expect(style().transform[1].translateY).toBeGreaterThan(0);
});

it('waits for the native popup to be shown before measuring its opening origin', async () => {
  // Native layout can precede the modal's window presentation. Its temporary
  // window coordinates must never become the avatar animation's origin.
  panelInWindow = { ...panel, x: 0, y: 0 };
  await layoutOnly();
  expect(panelMeasurement).not.toHaveBeenCalled();
  expect(mockAnimations).toHaveLength(0);
  panelInWindow = { ...panel };
  await act(async () => { current.onShow(); await jest.advanceTimersByTimeAsync(40); });
  expect(style().transform).toEqual([{ translateX: 139 }, { translateY: -296 }]);
  const entrance = mockAnimations[0];
  const openingFrames = [0.1, 0.25, 0.5, 0.75].map((progress) => {
    entrance.cell!.value = progress;
    return { progress, transform: style().transform, path: current.shapeProps.d };
  });
  await finishNext();
  await act(async () => { void current.dismiss(); });
  for (const frame of openingFrames) {
    mockAnimations[0].cell!.value = frame.progress;
    expect(style().transform).toEqual(frame.transform);
    expect(current.shapeProps.d).toBe(frame.path);
  }
  mockAnimations[0].cell!.value = 0;
  expect(style().transform).toEqual([{ translateX: 139 }, { translateY: -296 }]);
});

it('also waits for layout when native onShow arrives first', async () => {
  await act(async () => { current.onShow(); await jest.advanceTimersByTimeAsync(40); });
  expect(panelMeasurement).not.toHaveBeenCalled();
  expect(mockAnimations).toHaveLength(0);
  await layoutOnly();
  await act(async () => { await jest.advanceTimersByTimeAsync(40); });
  expect(style().transform).toEqual([{ translateX: 139 }, { translateY: -296 }]);
  expect(mockAnimations).toHaveLength(1);
});

it('captures the avatar before the Modal changes the app window', async () => {
  await act(async () => { await Promise.resolve(); });
  expect(current.presented).toBe(true);
  trigger = { ...trigger, x: 0, y: 0 };
  await layout();
  expect(style().transform).toEqual([{ translateX: 139 }, { translateY: -296 }]);
});

it('does not present a closed request when an earlier avatar measurement returns late', async () => {
  await act(async () => { tree.update(<Screen open={false} />); });
  delayTriggerMeasurement = true;
  await act(async () => { tree.update(<Screen />); });
  expect(current.presented).toBe(false);
  expect(pendingTriggerMeasurement).toBeDefined();
  await act(async () => { tree.update(<Screen open={false} />); });
  await act(async () => { pendingTriggerMeasurement!(trigger.x, trigger.y, trigger.width, trigger.height); });
  expect(current.presented).toBe(false);
  expect(mockAnimations).toHaveLength(0);
});

it('ignores a late native onShow after closing before the first animated frame', async () => {
  await layoutOnly();
  await act(async () => { await current.dismiss(); });
  await act(async () => { current.onShow(); await jest.advanceTimersByTimeAsync(40); });
  expect(current.presented).toBe(false);
  expect(panelMeasurement).not.toHaveBeenCalled();
  expect(mockAnimations).toHaveLength(0);
  expect(closed).toHaveBeenCalledTimes(1);
});

it('remeasures the current avatar and dialog on every full reopening, even without another layout event', async () => {
  await layout(); await finishNext();
  for (let cycle = 1; cycle <= 4; cycle += 1) {
    await act(async () => { void current.dismiss(); });
    await finishNext();
    await act(async () => { tree.update(<Screen open={false} />); });
    trigger = { ...trigger, x: 300 - cycle * 10, y: 92 + cycle * 6 };
    panelInWindow = { ...panel, height: 720 - cycle * 20, y: 62 + cycle * 10 };
    await act(async () => { tree.update(<Screen />); });
    // Unchanged native layouts need not emit onLayout on a later presentation.
    await act(async () => { current.onShow(); await jest.advanceTimersByTimeAsync(40); });
    expect(mockAnimations).toHaveLength(1);
    expect(style().transform).toEqual([
      { translateX: trigger.x + trigger.width / 2 - (panelInWindow.x + panelInWindow.width / 2) },
      { translateY: trigger.y + trigger.height / 2 - (panelInWindow.y + panelInWindow.height / 2) },
    ]);
    await finishNext();
    const numbers = current.shapeProps.d!.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
    const ys = numbers.filter((_, index) => index % 2 === 1);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(panelInWindow.height - 1);
  }
  expect(closed).toHaveBeenCalledTimes(4);
});
