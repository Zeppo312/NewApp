import { useCallback, type EffectCallback } from 'react';
import { useFocusEffect as useRouterFocusEffect } from 'expo-router';
import { whenTransitionIdle } from '@/lib/navigation/zoomTransition';

/**
 * Drop-in for expo-router's `useFocusEffect`. Focus work (data reloads and the
 * re-render they cause) waits until a running open/back transition has
 * finished, so it never blocks the UI thread mid-animation. Without a
 * transition it runs exactly like the original.
 */
export function useFocusEffect(effect: EffectCallback) {
  useRouterFocusEffect(
    useCallback(() => {
      let active = true;
      let cleanup: ReturnType<EffectCallback>;
      const cancel = whenTransitionIdle(() => {
        if (active) cleanup = effect();
      });
      return () => {
        active = false;
        cancel();
        if (typeof cleanup === 'function') cleanup();
      };
    }, [effect]),
  );
}
