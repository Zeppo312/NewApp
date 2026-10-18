import { router, type Href } from 'expo-router';
import { animateBack } from '@/lib/navigation/zoomTransition';

/**
 * A real back step (native pop or tab history) so every "Zurück" animates as a
 * swipe back. Only without history the fallback route is pushed instead.
 */
export function navigateBack(fallback: Href) {
  if (router.canGoBack()) {
    void animateBack(() => router.back());
    return;
  }
  router.push(fallback);
}
