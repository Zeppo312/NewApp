import { Alert } from 'react-native';
import { listPendingSleepStops } from './sleepOfflineActions';
import { localHealthAllowed, localHealthGeneration } from './localHealthStorage';
import { getPersistedAppLocale } from './localization';
import { offlineText } from './offlineTranslations';
import { readTrackingOutbox } from './trackingOutbox';
/** Only deliberate sign-out asks; consent withdrawal and account deletion never wait. */
export async function confirmPendingSleepLogout(userId: string): Promise<boolean> {
  const generation = localHealthGeneration();
  if (!localHealthAllowed(userId, generation)) return true;
  const actions = await listPendingSleepStops(userId);
  const tracking = await readTrackingOutbox(userId);
  const trackingCount = new Set(tracking.filter(op => op.state !== 'confirmed').map(op => `${op.kind}:${op.scope.babyId}:${op.entryId}`)).size;
  const count = actions.filter(a => !['confirmed', 'discarded'].includes(a.state)).length + trackingCount;
  if (!count || !localHealthAllowed(userId, generation)) return true;
  const locale = await getPersistedAppLocale();
  if (!localHealthAllowed(userId, generation)) return true;
  return new Promise(resolve => Alert.alert(offlineText(locale, trackingCount ? 'trackingLogoutTitle' : 'inspect'), offlineText(locale, trackingCount ? 'trackingLogout' : 'logout', { count }), [
    { text: offlineText(locale, 'back'), style: 'cancel', onPress: () => resolve(false) },
    { text: offlineText(locale, 'logoutDiscard'), style: 'destructive', onPress: () => resolve(true) },
  ], { cancelable: true, onDismiss: () => resolve(false) }));
}
