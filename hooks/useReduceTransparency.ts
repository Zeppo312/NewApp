import { useSyncExternalStore } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

let reduced = false;
let revision = 0;
let subscription: ReturnType<typeof AccessibilityInfo.addEventListener> | undefined;
const listeners = new Set<() => void>();
function publish(value: boolean) {
  if (value === reduced) return;
  reduced = value;
  listeners.forEach(listener => listener());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1 && Platform.OS === 'ios') {
    const readRevision = ++revision;
    subscription = AccessibilityInfo.addEventListener('reduceTransparencyChanged', value => {
      revision++;
      publish(value);
    });
    void AccessibilityInfo.isReduceTransparencyEnabled().then(value => {
      if (revision === readRevision && listeners.size) publish(value);
    }).catch(() => {});
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      revision++;
      subscription?.remove();
      subscription = undefined;
    }
  };
}
/** One system preference read/listener, shared by all mounted glass surfaces. */
export function useReduceTransparency() {
  return useSyncExternalStore(subscribe, () => reduced, () => false);
}
