import { router, type Href } from 'expo-router';
import type { GestureResponderEvent } from 'react-native';

export type ZoomRect = { x: number; y: number; width: number; height: number };

type Measurable = {
  measureInWindow?: (callback: (x: number, y: number, width: number, height: number) => void) => void;
};

/** The press event of the button (preferred) or a ref'd view to grow the page out of. */
export type ZoomSource = GestureResponderEvent | Measurable | null | undefined;

export type ZoomOpenOptions = {
  /** Corner radius of the source button, so the growing page starts with its shape. */
  radius?: number;
};

/** Grows from `rect`, calls `navigate(false)` once covered and reveals the new page. */
export type ZoomRunner = (
  rect: ZoomRect,
  radius: number,
  navigate: (animated: boolean) => void,
) => Promise<void>;

// Expo Router's own Stack skips the push animation for routes carrying this
// param and strips it after the push, so the way back keeps its swipe.
const NO_PUSH_ANIMATION_PARAM = '__internal_expo_router_no_animation';
const DEFAULT_RADIUS = 22;
const TAP_RECT_SIZE = 56;

/** Slides the current page out to the right once `navigate` stepped back. */
export type BackRunner = (navigate: () => void) => Promise<void>;

let runner: ZoomRunner | null = null;
let backRunner: BackRunner | null = null;
let isTransitioning = false;
const afterTransition = new Set<() => void>();

function finishTransition() {
  isTransitioning = false;
  const callbacks = [...afterTransition];
  afterTransition.clear();
  callbacks.forEach((callback) => callback());
}

/**
 * Runs `callback` right away when no transition is running, otherwise once it
 * has finished. Returns a cancel function.
 */
export function whenTransitionIdle(callback: () => void) {
  if (!isTransitioning) {
    callback();
    return () => {};
  }
  afterTransition.add(callback);
  return () => {
    afterTransition.delete(callback);
  };
}

/**
 * Defers work a freshly opened page would otherwise do mid-animation (opening a
 * sheet, a heavy re-render) until the transition has finished. Returns a cancel
 * function for effect cleanups.
 */
export function runAfterTransition(callback: () => void) {
  if (!isTransitioning) {
    const timeout = setTimeout(callback, 0);
    return () => clearTimeout(timeout);
  }
  afterTransition.add(callback);
  return () => {
    afterTransition.delete(callback);
  };
}

export function registerZoomRunner(next: ZoomRunner) {
  runner = next;
  return () => {
    if (runner === next) runner = null;
  };
}

export function registerBackRunner(next: BackRunner) {
  backRunner = next;
  return () => {
    if (backRunner === next) backRunner = null;
  };
}

const parseQuery = (query: string) => {
  const params: Record<string, string> = {};
  for (const pair of query.split('&')) {
    if (!pair) continue;
    const [key, value = ''] = pair.split('=');
    params[decodeURIComponent(key)] = decodeURIComponent(value);
  }
  return params;
};

export function withoutPushAnimation(href: Href): Href {
  if (typeof href === 'string') {
    const [pathname, query = ''] = href.split('?');
    return { pathname, params: { ...parseQuery(query), [NO_PUSH_ANIMATION_PARAM]: '1' } } as Href;
  }
  return { ...href, params: { ...(href.params ?? {}), [NO_PUSH_ANIMATION_PARAM]: '1' } } as Href;
}

const isPressEvent = (source: ZoomSource): source is GestureResponderEvent =>
  !!source && typeof source === 'object' && 'nativeEvent' in source;

// Must run synchronously inside the press handler: React clears
// `currentTarget` once the event has been dispatched.
function measureSource(source: ZoomSource): Promise<ZoomRect | null> {
  const target = (isPressEvent(source) ? source.currentTarget : source) as Measurable | null | undefined;
  const tapRect = isPressEvent(source) && Number.isFinite(source.nativeEvent?.pageX)
    ? {
        x: source.nativeEvent.pageX - TAP_RECT_SIZE / 2,
        y: source.nativeEvent.pageY - TAP_RECT_SIZE / 2,
        width: TAP_RECT_SIZE,
        height: TAP_RECT_SIZE,
      }
    : null;

  return new Promise((resolve) => {
    if (!target || typeof target.measureInWindow !== 'function') {
      resolve(tapRect);
      return;
    }
    try {
      target.measureInWindow((x, y, width, height) => {
        resolve(width > 0 && height > 0 ? { x, y, width, height } : tapRect);
      });
    } catch {
      resolve(tapRect);
    }
  });
}

/**
 * Opens `href` so the new page grows out of the pressed button. Going back
 * stays the regular swipe. Falls back to a normal push when no source or
 * overlay is available.
 */
export async function openWithZoom(href: Href, source?: ZoomSource, options?: ZoomOpenOptions) {
  if (isTransitioning) return;
  const rectPromise = measureSource(source);
  const run = runner;
  if (!run) {
    router.push(href);
    return;
  }

  isTransitioning = true;
  try {
    const rect = await rectPromise;
    if (!rect) {
      router.push(href);
      return;
    }
    await run(rect, options?.radius ?? DEFAULT_RADIUS, (animated) => {
      router.push(animated ? href : withoutPushAnimation(href));
    });
  } finally {
    finishTransition();
  }
}

/**
 * Runs a back step (`navigate` calls `router.back()`) with the swipe-back
 * animation where the native stack does not provide one, e.g. between tabs.
 */
export async function animateBack(navigate: () => void) {
  if (isTransitioning) return;
  const run = backRunner;
  if (!run) {
    navigate();
    return;
  }
  isTransitioning = true;
  try {
    await run(navigate);
  } finally {
    finishTransition();
  }
}
