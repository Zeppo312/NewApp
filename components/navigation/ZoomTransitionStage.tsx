import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, PixelRatio, Platform, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useNavigationContainerRef } from 'expo-router';
import Animated, {
  Easing,
  interpolate,
  ReduceMotion,
  useAnimatedStyle,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { captureRef, releaseCapture } from 'react-native-view-shot';
import { LinearGradient } from 'expo-linear-gradient';
import {
  registerBackRunner,
  registerZoomRunner,
  type BackRunner,
  type ZoomRect,
  type ZoomRunner,
} from '@/lib/navigation/zoomTransition';

const EXPAND_MS = 460;
// Gentle start so the page is seen leaving the button, soft landing at full size.
const EXPAND_EASING = Easing.bezier(0.33, 0, 0.15, 1);
const BACK_MS = 340;
const BACK_EASING = Easing.bezier(0.25, 0.8, 0.25, 1);
// The page underneath follows from the left like the native iOS pop.
const BACK_PARALLAX = 0.3;
const BACK_DIM = 0.12;
const ZOOM_BACKDROP_DIM = 0.14;
const LEAVING_EDGE_WIDTH = 14;
const NAVIGATION_TIMEOUT_MS = 700;
const SNAPSHOT_LOAD_TIMEOUT_MS = 400;
// The new route mounts behind the snapshot and stalls the UI thread, which no
// animation can bridge, so motion starts after a few smooth frames in a row
// (capped). Focus work of the pages waits for the transition to end
// (lib/navigation/useFocusEffect), which keeps this window short.
const SMOOTH_FRAME_MS = 24;
const SETTLE = {
  zoom: { frames: 5, maxMs: 400 },
  back: { frames: 3, maxMs: 250 },
} as const;
const ARM = -1;
// Progress values: -1 the new route mounts behind the snapshot, 0 → 1 the
// animation runs, 1 idle.
const COVERED = -1;
const IDLE = 1;
type Kind = 'zoom' | 'back';

const nextPaint = () => new Promise<void>((resolve) => {
  requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
});

// Half the screen resolution is plenty for a page that is visible for well
// under a second. iOS sizes the capture in points (rendered at device scale),
// Android in pixels.
const snapshotSize = (width: number, height: number) => {
  const factor = Platform.OS === 'ios' ? 0.5 : PixelRatio.get() * 0.5;
  return { width: Math.round(width * factor), height: Math.round(height * factor) };
};

/**
 * Wraps the root navigator. Both transitions freeze the current screen as a
 * small snapshot and switch the route underneath it:
 * - zoom: the real new page grows out of the pressed button over the snapshot,
 * - back: the snapshot slides out to the right over the previous page.
 * Native stack pops keep their own animation and never come through here.
 */
export function ZoomTransitionStage({ children }: { children: React.ReactNode }) {
  const navigationRef = useNavigationContainerRef();
  const reducedMotion = useReducedMotion();
  const stageRef = useRef<View>(null);
  const zoom = useSharedValue(IDLE);
  const back = useSharedValue(IDLE);
  const origin = useSharedValue<ZoomRect & { radius: number }>({ x: 0, y: 0, width: 0, height: 0, radius: 0 });
  const size = useSharedValue({ width: 0, height: 0 });
  const [snapshot, setSnapshot] = useState<{ uri: string; kind: Kind } | null>(null);
  const snapshotLoaded = useRef<(() => void) | null>(null);
  const animationDone = useRef<(() => void) | null>(null);
  // 0: idle, ARM: start on the next frame, > 0: frame timestamp when armed.
  const armedAt = useSharedValue(0);
  const armedKind = useSharedValue<Kind>('zoom');
  const smoothFrames = useSharedValue(0);

  const finishAnimation = useCallback(() => {
    const done = animationDone.current;
    animationDone.current = null;
    done?.();
  }, []);

  const clock = useFrameCallback((frame) => {
    const armed = armedAt.get();
    if (armed === 0) return;
    if (armed === ARM) {
      armedAt.set(frame.timestamp);
      smoothFrames.set(0);
      return;
    }
    const delta = frame.timeSincePreviousFrame ?? Number.POSITIVE_INFINITY;
    smoothFrames.set(delta < SMOOTH_FRAME_MS ? smoothFrames.get() + 1 : 0);
    const isZoom = armedKind.get() === 'zoom';
    const settle = isZoom ? SETTLE.zoom : SETTLE.back;
    if (smoothFrames.get() < settle.frames && frame.timestamp - armed < settle.maxMs) return;
    armedAt.set(0);
    // One shared value per transition: leaving COVERED and starting the motion
    // happen in the same frame, so the switched page never flashes.
    (isZoom ? zoom : back).set(withSequence(
      withTiming(0, { duration: 0 }),
      withTiming(IDLE, {
        duration: isZoom ? EXPAND_MS : BACK_MS,
        easing: isZoom ? EXPAND_EASING : BACK_EASING,
        reduceMotion: ReduceMotion.Never,
      }, () => {
        scheduleOnRN(finishAnimation);
      }),
    ));
  }, false);

  // Calls `onCommitted` synchronously from the container's state event: after
  // that commit JS is often busy with the screen's focus work, so anything
  // awaited here would start the animation too late.
  const afterNavigation = useCallback((onCommitted: () => void) => {
    let settled = false;
    let unsubscribe: (() => void) | undefined;
    const settle = () => {
      if (settled) return;
      settled = true;
      unsubscribe?.();
      clearTimeout(timeout);
      onCommitted();
    };
    const timeout = setTimeout(settle, NAVIGATION_TIMEOUT_MS);
    unsubscribe = navigationRef.addListener('state', settle);
  }, [navigationRef]);

  const showSnapshot = useCallback((uri: string, kind: Kind) => new Promise<void>((resolve) => {
    const timeout = setTimeout(() => snapshotLoaded.current?.(), SNAPSHOT_LOAD_TIMEOUT_MS);
    snapshotLoaded.current = () => {
      snapshotLoaded.current = null;
      clearTimeout(timeout);
      resolve();
    };
    setSnapshot({ uri, kind });
  }), []);

  /** Snapshot → switch the route underneath → animate once frames are smooth. */
  const transition = useCallback(async (kind: Kind, navigate: () => void, prepare: () => void) => {
    const { width, height } = size.get();
    if (reducedMotion || width === 0 || height === 0 || !stageRef.current) return false;

    let uri: string;
    try {
      uri = await captureRef(stageRef, { format: 'jpg', quality: 0.85, result: 'tmpfile', ...snapshotSize(width, height) });
    } catch {
      return false;
    }

    const progress = kind === 'zoom' ? zoom : back;
    try {
      // The leaving page must cover the screen from its first frame on; the
      // zoom stage may only hide once the snapshot behind it is painted.
      if (kind === 'back') progress.set(COVERED);
      await showSnapshot(uri, kind);
      await nextPaint();
      prepare();
      progress.set(COVERED);
      armedKind.set(kind);
      clock.setActive(true);
      await new Promise<void>((resolve, reject) => {
        animationDone.current = resolve;
        afterNavigation(() => armedAt.set(ARM));
        try {
          navigate();
        } catch (error) {
          reject(error);
        }
      });
    } finally {
      animationDone.current = null;
      armedAt.set(0);
      clock.setActive(false);
      progress.set(IDLE);
      setSnapshot(null);
      releaseCapture(uri);
    }
    return true;
  }, [afterNavigation, armedAt, armedKind, back, clock, reducedMotion, showSnapshot, size, zoom]);

  const runZoom = useCallback<ZoomRunner>(async (rect, radius, navigate) => {
    const animated = await transition('zoom', () => navigate(false), () => origin.set({ ...rect, radius }));
    if (!animated) navigate(true);
  }, [origin, transition]);

  const runBack = useCallback<BackRunner>(async (navigate) => {
    // Only a back step inside the tabs needs us; a pop of the root stack keeps
    // the native swipe animation.
    const root = navigationRef.getRootState();
    const stack = root?.routes[root.index ?? 0]?.state;
    const handledByTabs = stack?.index === 0 && stack.routes[0]?.name === '(tabs)';
    if (!handledByTabs || !(await transition('back', navigate, () => {}))) navigate();
  }, [navigationRef, transition]);

  useEffect(() => registerZoomRunner(runZoom), [runZoom]);
  useEffect(() => registerBackRunner(runBack), [runBack]);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    size.set({ width, height });
  }, [size]);

  // The frame clips the page. It never casts a shadow: an iOS shadow without
  // a fixed path is re-rendered offscreen from the whole app every frame.
  // Position runs on transforms; only the clip size is a layout prop.
  const frameStyle = useAnimatedStyle(() => {
    const p = zoom.get();
    const b = back.get();
    const screen = size.get();
    // During a back step the previous page follows from the left (hidden
    // under the leaving page until the motion starts).
    const shift = b >= IDLE || b < 0 ? 0 : interpolate(b, [0, 1], [-BACK_PARALLAX * screen.width, 0]);
    if (p >= IDLE) {
      return {
        opacity: 1, width: '100%', height: '100%', borderRadius: 0,
        transform: [{ translateX: shift }, { translateY: 0 }],
      };
    }
    const g = Math.max(p, 0);
    const from = origin.get();
    return {
      opacity: p < 0 ? 0 : 1,
      width: interpolate(g, [0, 1], [from.width, screen.width]),
      height: interpolate(g, [0, 1], [from.height, screen.height]),
      borderRadius: interpolate(g, [0, 0.8, 1], [from.radius, from.radius, 0]),
      transform: [
        { translateX: interpolate(g, [0, 1], [from.x, 0]) },
        { translateY: interpolate(g, [0, 1], [from.y, 0]) },
      ],
    };
  });

  // Depth without a shadow: the page left behind dims while the new one grows.
  const backdropDimStyle = useAnimatedStyle(() => {
    const p = zoom.get();
    return { opacity: p >= IDLE || p < 0 ? 0 : interpolate(p, [0, 1], [0, ZOOM_BACKDROP_DIM]) };
  });

  // The page keeps its full layout size and is only scaled down from its top
  // left corner, so nothing reflows while it grows.
  const pageStyle = useAnimatedStyle(() => {
    const p = zoom.get();
    if (p >= IDLE) return { width: '100%', height: '100%', transform: [{ scale: 1 }] };
    const screen = size.get();
    const from = origin.get();
    const startScale = screen.width > 0 ? from.width / screen.width : 1;
    return {
      width: screen.width,
      height: screen.height,
      transform: [{ scale: interpolate(Math.max(p, 0), [0, 1], [startScale, 1]) }],
    };
  });

  const dimStyle = useAnimatedStyle(() => {
    const b = back.get();
    return { opacity: b >= IDLE || b < 0 ? 0 : interpolate(b, [0, 1], [BACK_DIM, 0]) };
  });

  const leavingPageStyle = useAnimatedStyle(() => {
    const b = back.get();
    // Idle means "already gone": the image may outlive the animation by a
    // few frames until React unmounts it.
    const width = size.get().width;
    const x = b >= IDLE ? width : interpolate(Math.max(b, 0), [0, 1], [0, width]);
    return { transform: [{ translateX: x }] };
  });

  const snapshotImage = snapshot && (
    <Image
      source={{ uri: snapshot.uri }}
      style={StyleSheet.absoluteFill}
      resizeMode="cover"
      fadeDuration={0}
      onLoad={() => snapshotLoaded.current?.()}
      onError={() => snapshotLoaded.current?.()}
    />
  );

  return (
    <View style={styles.root} onLayout={handleLayout}>
      {snapshot?.kind === 'zoom' && (
        <View style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {snapshotImage}
          <Animated.View style={[StyleSheet.absoluteFill, styles.dim, backdropDimStyle]} />
        </View>
      )}
      <Animated.View style={[styles.frame, frameStyle]}>
        <Animated.View ref={stageRef} collapsable={false} style={[styles.page, pageStyle]}>
          {children}
        </Animated.View>
      </Animated.View>
      {snapshot?.kind === 'back' && (
        <>
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.dim, dimStyle]} />
          <Animated.View
            style={[StyleSheet.absoluteFill, leavingPageStyle]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            {/* A gradient edge instead of a layer shadow, like the native pop. */}
            <LinearGradient
              colors={['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0.12)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.leavingEdge}
            />
            {snapshotImage}
          </Animated.View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  frame: {
    position: 'absolute',
    left: 0,
    top: 0,
    overflow: 'hidden',
  },
  page: {
    transformOrigin: 'left top',
  },
  dim: { backgroundColor: '#000' },
  leavingEdge: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: -LEAVING_EDGE_WIDTH,
    width: LEAVING_EDGE_WIDTH,
  },
});
