import { AppState } from 'react-native';
import { supabase } from '@/lib/supabase';
import { requireDataConsent } from '@/lib/dataConsents';

/** No new analysis while inactive; cancel the client request on backgrounding.
 * Cancellation cannot retract data already received by the server/provider. */
export async function invokeForegroundAdvisor(body: Record<string, unknown>) {
  if (AppState.currentState !== 'active') return null;
  const controller = new AbortController();
  const subscription = AppState.addEventListener('change', (state) => {
    if (state !== 'active') controller.abort();
  });
  try {
    await requireDataConsent('health');
    if (AppState.currentState !== 'active') return null;
    const { data, error } = await supabase.functions.invoke('advisor-generate', {
      body,
      signal: controller.signal,
    });
    if (controller.signal.aborted || AppState.currentState !== 'active' || error) return null;
    return data;
  } catch {
    return null;
  } finally {
    subscription.remove();
  }
}
