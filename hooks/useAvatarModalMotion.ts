import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { LayoutChangeEvent, View } from 'react-native';
import { cancelAnimation, Easing, ReduceMotion, useAnimatedProps, useAnimatedStyle, useDerivedValue, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

type Bounds = { x: number; y: number; width: number; height: number };
const measure = (view: View | null): Promise<Bounds | null> => new Promise((resolve) => {
  if (!view) { resolve(null); return; }
  let done = false;
  const finish = (bounds: Bounds | null) => {
    if (done) return;
    done = true;
    clearTimeout(timeout);
    resolve(bounds);
  };
  // A disappearing/offscreen trigger must never leave an invisible Modal open.
  const timeout = setTimeout(() => finish(null), 80);
  view.measureInWindow((x, y, width, height) => {
    finish(width > 0 && height > 0 ? { x, y, width, height } : null);
  });
});

const smooth = (start: number, end: number, value: number) => {
  'worklet';
  const t = Math.min(1, Math.max(0, (value - start) / (end - start)));
  return t * t * (3 - 2 * t);
};

/** A circle becomes a tapered glass sheet. No per-frame layout of its contents. */
const sheetPath = (width: number, height: number, w: number, h: number, radius: number, pinch: number, direction: number, vertical: number) => {
  'worklet';
  const cx = width / 2;
  const top = height / 2 - h / 2 * vertical;
  const bottom = height / 2 + h / 2 * vertical;
  const head = w * (1 - pinch);
  const offset = direction * w * pinch * 0.4;
  const tl = cx + offset - head / 2;
  const tr = cx + offset + head / 2;
  const bl = cx - w / 2;
  const br = cx + w / 2;
  const r = Math.min(radius, head / 2, h / 2);
  const k = r * 0.5522847498;
  const ry = r * vertical;
  const ky = k * vertical;
  const side = (h - 2 * r) * vertical;
  return `M ${tl + r} ${top} L ${tr - r} ${top}
    C ${tr - r + k} ${top} ${tr} ${top + ry - ky} ${tr} ${top + ry}
    C ${tr} ${top + ry + side * 0.5} ${br} ${bottom - ry - side * 0.15} ${br} ${bottom - ry}
    C ${br} ${bottom - ry + ky} ${br - r + k} ${bottom} ${br - r} ${bottom}
    L ${bl + r} ${bottom}
    C ${bl + r - k} ${bottom} ${bl} ${bottom - ry + ky} ${bl} ${bottom - ry}
    C ${bl} ${bottom - ry - side * 0.15} ${tl} ${top + ry + side * 0.5} ${tl} ${top + ry}
    C ${tl} ${top + ry - ky} ${tl + r - k} ${top} ${tl + r} ${top} Z`;
};

/** Keep the panel mounted through its return; panelRef measures an unanimated frame. */
export function useAvatarModalMotion({ open, scope, onClosed }: {
  open: boolean;
  scope?: string;
  onClosed: () => void;
}) {
  const reduced = useReducedMotion();
  const triggerRef = useRef<View>(null);
  const panelRef = useRef<View>(null);
  const onClosedRef = useRef(onClosed);
  useLayoutEffect(() => { onClosedRef.current = onClosed; }, [onClosed]);
  const [presented, setPresented] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const progress = useSharedValue(0);
  const anchor = useSharedValue({ x: 0, y: 0, width: 0, height: 0, diameter: 0 });
  const phase = useRef<'closed' | 'opening' | 'open' | 'closing'>('closed');
  const naturalSize = useRef({ width: 0, height: 0 });
  const revision = useRef(0);
  const closeWaiter = useRef<{ resolve: (finished: boolean) => void; notify: boolean } | null>(null);
  const closePromise = useRef<Promise<boolean> | null>(null);
  const openingMeasured = useRef(false);
  const modalShown = useRef(false);
  const openingReady = useRef(false);
  const openingTrigger = useRef<Bounds | null>(null);
  const activeScope = useRef(scope);

  const finish = useCallback((token: number, closing: boolean, finished: boolean) => {
    if (revision.current !== token || !finished) return;
    if (!closing) { phase.current = 'open'; return; }
    phase.current = 'closed';
    modalShown.current = false;
    openingReady.current = false;
    setPresented(false);
    setIsClosing(false);
    const waiter = closeWaiter.current;
    closeWaiter.current = null;
    closePromise.current = null;
    if (waiter?.notify) onClosedRef.current();
    waiter?.resolve(true);
  }, []);

  const animate = useCallback((closing: boolean, token: number) => {
    const complete = (finished?: boolean) => {
      'worklet';
      scheduleOnRN(finish, token, closing, finished === true);
    };
    if (reduced) {
      progress.set(withTiming(closing ? 0 : 1, {
        duration: closing ? 100 : 120, reduceMotion: ReduceMotion.Never,
      }, complete));
    } else {
      // One reversible timeline: no spring hard-stop or separate fading tail.
      progress.set(withTiming(closing ? 0 : 1, {
        duration: closing ? 340 : 380,
        easing: Easing.linear,
        reduceMotion: ReduceMotion.System,
      }, complete));
    }
  }, [finish, progress, reduced]);

  const updateAnchor = useCallback(async (token: number, capturedTrigger?: Bounds | null) => {
    const [trigger, panel] = await Promise.all([
      capturedTrigger === undefined ? measure(triggerRef.current) : Promise.resolve(capturedTrigger),
      measure(panelRef.current),
    ]);
    if (revision.current !== token) return false;
    // The shown, unanimated frame is authoritative on every presentation.
    // A reused native window may not dispatch another onLayout event.
    const width = panel?.width ?? naturalSize.current.width;
    const height = panel?.height ?? naturalSize.current.height;
    naturalSize.current = { width, height };
    anchor.set(trigger && panel && width > 0 && height > 0 ? {
      x: trigger.x + trigger.width / 2 - (panel.x + panel.width / 2),
      y: trigger.y + trigger.height / 2 - (panel.y + panel.height / 2),
      width, height,
      diameter: Math.min(trigger.width, trigger.height, width, height),
    } : { x: 0, y: 0, width, height, diameter: 0 });
    return true;
  }, [anchor]);

  const startOpening = useCallback(async () => {
    if (phase.current !== 'opening' || !modalShown.current || openingMeasured.current || naturalSize.current.width <= 0) return;
    openingMeasured.current = true;
    const token = revision.current;
    // onLayout can run before the native Modal has its final window position.
    // Let presentation/layout commit before measuring the unanimated frame.
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    if (revision.current !== token || phase.current !== 'opening') return;
    if (await updateAnchor(token, openingTrigger.current) && phase.current === 'opening') {
      openingReady.current = true;
      animate(false, token);
    }
  }, [animate, updateAnchor]);

  const onShow = useCallback(() => {
    if (phase.current !== 'opening') return;
    modalShown.current = true;
    void startOpening();
  }, [startOpening]);

  const dismiss = useCallback((notify = true): Promise<boolean> => {
    if (closePromise.current) return closePromise.current;
    if (phase.current === 'closed') return Promise.resolve(true);
    const token = ++revision.current;
    cancelAnimation(progress);
    const wasOpen = phase.current === 'open';
    phase.current = 'closing';
    setIsClosing(true);
    const promise = new Promise<boolean>((resolve) => { closeWaiter.current = { resolve, notify }; });
    closePromise.current = promise;
    if (!openingReady.current) {
      finish(token, true, true);
      return promise;
    }
    void (async () => {
      // Re-measure after rotation/layout changes. During an interrupted opening,
      // retain the same anchor so reversing never teleports the panel.
      if (wasOpen && !await updateAnchor(token)) return;
      if (revision.current === token) animate(true, token);
    })();
    return promise;
  }, [animate, finish, progress, updateAnchor]);

  useEffect(() => {
    if (!open) { void dismiss(false); return; }
    const reversing = phase.current === 'closing';
    revision.current += 1;
    cancelAnimation(progress);
    closeWaiter.current?.resolve(false);
    closeWaiter.current = null;
    closePromise.current = null;
    phase.current = 'opening';
    openingMeasured.current = reversing;
    // The requested Modal visibility is external state; retain its host for the exit.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsClosing(false);
    if (reversing) {
      setPresented(true);
      animate(false, revision.current);
    } else {
      modalShown.current = false;
      openingReady.current = false;
      openingTrigger.current = null;
      // Retain layout readiness until the fresh window measurement replaces it.
      // Clearing it would make a later onShow depend on a second onLayout event.
      progress.set(0);
      anchor.set({ x: 0, y: 0, width: 0, height: 0, diameter: 0 });
      const token = revision.current;
      void (async () => {
        // Capture the avatar in the app window before presenting another window.
        const trigger = await measure(triggerRef.current);
        if (revision.current !== token || phase.current !== 'opening') return;
        openingTrigger.current = trigger;
        setPresented(true);
      })();
    }
  }, [open, animate, anchor, dismiss, progress]);

  useEffect(() => {
    if (activeScope.current !== scope) {
      activeScope.current = scope;
      // Authentication is an external boundary; dismiss its previous native host.
      setPresented(false);
      setIsClosing(false);
      onClosedRef.current();
    }
    return () => {
      revision.current += 1;
      phase.current = 'closed';
      modalShown.current = false;
      openingReady.current = false;
      naturalSize.current = { width: 0, height: 0 };
      cancelAnimation(progress);
      closeWaiter.current?.resolve(false);
      closeWaiter.current = null;
      closePromise.current = null;
    };
  }, [progress, scope]);

  const onPanelLayout = useCallback((event: LayoutChangeEvent) => {
    naturalSize.current = event.nativeEvent.layout;
    const { width, height } = naturalSize.current;
    // Late list data and Dynamic Type may change the natural dialog height.
    anchor.set((from) => ({ ...from, width, height }));
    void startOpening();
  }, [anchor, startOpening]);
  const frame = useDerivedValue(() => {
    const t = Math.min(1, Math.max(0, progress.get()));
    // Quintic interpolation has zero velocity AND acceleration at both ends.
    // Unlike a steep bezier, it leaves enough frames to see the glass flowing.
    const p = reduced ? t : t * t * t * (t * (t * 6 - 15) + 10);
    const from = anchor.get();
    const morph = !reduced && from.diameter > 0;
    const width = morph ? from.diameter + (from.width - from.diameter) * p : from.width;
    // The glass stretches before its sides widen, then narrows first on return.
    const height = morph ? from.diameter + (from.height - from.diameter) * Math.pow(p, 0.8) : from.height;
    const pinch = morph ? 0.28 * Math.pow(Math.sin(Math.PI * p), 2) : 0;
    return {
      x: morph ? from.x * (1 - p) : 0,
      y: morph ? from.y * (1 - p) : 0,
      opacity: morph ? smooth(0, 0.06, p) : p,
      contentOpacity: morph ? smooth(0.18, 0.75, p) : p,
      contentScale: morph ? Math.max(0.01, width * (1 - pinch) / Math.max(1, from.width)) : reduced ? 1 : 0.96 + 0.04 * p,
      materialOpacity: morph ? smooth(0.96, 1, p) : 1,
      path: sheetPath(from.width, from.height, Math.max(0, width - 1), Math.max(0, height - 1),
        morph ? from.diameter / 2 * (1 - p) + 32 * p : 32, pinch, from.x >= 0 ? 1 : -1, from.y <= 0 ? 1 : -1),
    };
  }, [progress, anchor, reduced]);
  const panelStyle = useAnimatedStyle(() => {
    const f = frame.get();
    return {
      opacity: f.opacity,
      transform: [{ translateX: f.x }, { translateY: f.y }],
    };
  }, [frame]);
  const contentStyle = useAnimatedStyle(() => ({
    opacity: frame.get().contentOpacity,
    transform: [{ scale: frame.get().contentScale }],
  }), [frame]);
  const materialStyle = useAnimatedStyle(() => ({ opacity: frame.get().materialOpacity }), [frame]);
  const shapeProps = useAnimatedProps(() => ({ d: frame.get().path }), [frame]);
  const backdropStyle = useAnimatedStyle(() => ({ opacity: smooth(0, 1, progress.get()) }), [progress]);
  return { presented, isClosing, triggerRef, panelRef, panelStyle, contentStyle, materialStyle, shapeProps, backdropStyle, dismiss, onPanelLayout, onShow };
}
