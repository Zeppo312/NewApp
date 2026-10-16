const mockPush = jest.fn();
const mockBack = jest.fn();
const mockCanGoBack = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
    back: () => mockBack(),
    canGoBack: () => mockCanGoBack(),
  },
}));

import { navigateBack } from '@/lib/navigation/backNavigation';
import {
  animateBack,
  openWithZoom,
  registerBackRunner,
  registerZoomRunner,
  runAfterTransition,
  withoutPushAnimation,
} from '@/lib/navigation/zoomTransition';

const NO_ANIMATION = '__internal_expo_router_no_animation';

beforeEach(() => {
  mockPush.mockReset();
  mockBack.mockReset();
  mockCanGoBack.mockReset();
});

describe('withoutPushAnimation', () => {
  it('keeps query params of string hrefs', () => {
    expect(withoutPushAnimation('/paywall?origin=lock_premium')).toEqual({
      pathname: '/paywall',
      params: { origin: 'lock_premium', [NO_ANIMATION]: '1' },
    });
  });

  it('merges into object hrefs', () => {
    expect(withoutPushAnimation({ pathname: '/(tabs)/daily_old', params: { quickAction: 'diaper' } })).toEqual({
      pathname: '/(tabs)/daily_old',
      params: { quickAction: 'diaper', [NO_ANIMATION]: '1' },
    });
  });
});

describe('openWithZoom', () => {
  it('grows from the measured button and pushes without the slide', async () => {
    const runner = jest.fn(async (_rect, _radius, navigate: (animated: boolean) => void) => navigate(false));
    const unregister = registerZoomRunner(runner);
    const button = { measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => cb(10, 20, 100, 80) };

    await openWithZoom('/milestones', button, { radius: 14 });

    expect(runner).toHaveBeenCalledWith({ x: 10, y: 20, width: 100, height: 80 }, 14, expect.any(Function));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/milestones', params: { [NO_ANIMATION]: '1' } });
    unregister();
  });

  it('falls back to a plain push without a source', async () => {
    const runner = jest.fn();
    const unregister = registerZoomRunner(runner);

    await openWithZoom('/milestones');

    expect(runner).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith('/milestones');
    unregister();
  });
});

describe('navigateBack', () => {
  it('uses a real back step when history exists', () => {
    mockCanGoBack.mockReturnValue(true);
    navigateBack('/more');
    expect(mockBack).toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('pushes the fallback without history', () => {
    mockCanGoBack.mockReturnValue(false);
    navigateBack('/more');
    expect(mockPush).toHaveBeenCalledWith('/more');
  });
});

describe('animateBack', () => {
  it('hands the back step to the registered runner', async () => {
    const runner = jest.fn(async (navigate: () => void) => navigate());
    const unregister = registerBackRunner(runner);
    const navigate = jest.fn();

    await animateBack(navigate);

    expect(runner).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledTimes(1);
    unregister();
  });

  it('ignores a second back step while one is running', async () => {
    let finish: () => void = () => {};
    const unregister = registerBackRunner(() => new Promise<void>((resolve) => { finish = resolve; }));
    const second = jest.fn();

    const first = animateBack(jest.fn());
    await animateBack(second);
    finish();
    await first;

    expect(second).not.toHaveBeenCalled();
    unregister();
  });
});

describe('runAfterTransition', () => {
  it('waits for a running transition to finish', async () => {
    let finish: () => void = () => {};
    const unregister = registerBackRunner(() => new Promise<void>((resolve) => { finish = resolve; }));
    const deferred = jest.fn();

    const transition = animateBack(jest.fn());
    runAfterTransition(deferred);
    expect(deferred).not.toHaveBeenCalled();
    finish();
    await transition;

    expect(deferred).toHaveBeenCalledTimes(1);
    unregister();
  });

  it('can be cancelled before the transition ends', async () => {
    let finish: () => void = () => {};
    const unregister = registerBackRunner(() => new Promise<void>((resolve) => { finish = resolve; }));
    const deferred = jest.fn();

    const transition = animateBack(jest.fn());
    const cancel = runAfterTransition(deferred);
    cancel();
    finish();
    await transition;

    expect(deferred).not.toHaveBeenCalled();
    unregister();
  });
});
