import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, Platform } from 'react-native';
import { cancelAnimation, Easing, ReduceMotion, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

/** One clock per page. Pauses preserve reading time; background time never advances a story. */
export function useStoryPlayback({ pageKey, duration, enabled, onEnd }: {
  pageKey: string; duration: number; enabled: boolean; onEnd: () => void;
}) {
  const progress = useSharedValue(0);
  const systemReducedMotion = useReducedMotion();
  const [reducedMotion, setReducedMotion] = useState(systemReducedMotion);
  const [screenReader, setScreenReader] = useState(false);
  const [accessibilityReady, setAccessibilityReady] = useState(false);
  const [active, setActive] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const clock = useRef({ key: '', remaining: duration, startedAt: null as number | null, completed: false });
  const end = useRef(onEnd);
  useEffect(() => { end.current = onEnd; }, [onEnd]);

  useEffect(() => {
    let mounted = true;
    const change = AppState.addEventListener('change', state => setActive(state === 'active'));
    const blur = Platform.OS === 'android' ? AppState.addEventListener('blur', () => setActive(false)) : null;
    const focus = Platform.OS === 'android' ? AppState.addEventListener('focus', () => setActive(AppState.currentState === 'active')) : null;
    const reader = AccessibilityInfo.addEventListener('screenReaderChanged', setScreenReader);
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    Promise.all([AccessibilityInfo.isScreenReaderEnabled(), AccessibilityInfo.isReduceMotionEnabled()])
      .then(([readerEnabled, motionReduced]) => {
        if (mounted) { setScreenReader(readerEnabled); setReducedMotion(motionReduced); setAccessibilityReady(true); }
      }).catch(() => { /* Keep automatic advancement off if accessibility state is unavailable. */ });
    return () => { mounted = false; change.remove(); blur?.remove(); focus?.remove(); reader.remove(); motion.remove(); };
  }, []);

  const autoplayAllowed = accessibilityReady && !screenReader && !reducedMotion;
  const playing = enabled && active && autoplayAllowed;
  useEffect(() => {
    if (clock.current.key !== pageKey) {
      clock.current = { key: pageKey, remaining: duration, startedAt: null, completed: false };
      progress.set(0);
    }
    const current = clock.current;
    if (!playing || current.completed) return;
    current.startedAt = Date.now();
    // This is elapsed-time feedback. Reduced motion disables playback above, rather than
    // collapsing withTiming to its end and inadvertently skipping every page.
    progress.set(withTiming(1, { duration: current.remaining, easing: Easing.linear, reduceMotion: ReduceMotion.Never }));
    const timer = setTimeout(() => {
      if (clock.current !== current || current.completed) return;
      current.completed = true;
      current.startedAt = null;
      progress.set(1);
      end.current();
    }, current.remaining);
    return () => {
      clearTimeout(timer);
      if (current.startedAt !== null) current.remaining = Math.max(0, current.remaining - (Date.now() - current.startedAt));
      current.startedAt = null;
      cancelAnimation(progress);
    };
  }, [duration, pageKey, playing, progress]);
  return { progress, playing, autoplayAllowed, reducedMotion };
}
