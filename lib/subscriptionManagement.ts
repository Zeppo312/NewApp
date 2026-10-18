import { Alert, Linking, Platform } from 'react-native';
import Purchases from 'react-native-purchases';

// undefined preserves device defaults for callers without subscription context.
// Explicit null/unknown must never send an existing subscriber to the wrong store.
export const getSubscriptionManagementUrl = (store?: string | null) => {
  const origin = store === undefined ? (Platform.OS === 'ios' ? 'APP_STORE' : 'PLAY_STORE') : store;
  if (origin === 'APP_STORE' || origin === 'MAC_APP_STORE') return 'https://apps.apple.com/account/subscriptions';
  if (origin === 'PLAY_STORE') return 'https://play.google.com/store/account/subscriptions';
  return null;
};

export const getSubscriptionManagementStoreLabel = (store?: string | null) => {
  const url = getSubscriptionManagementUrl(store);
  return url?.includes('apple.com') ? 'App Store' : url ? 'Google Play' : 'Store';
};

type OpenSubscriptionManagementOptions = {
  store?: string | null;
  failureTitle?: string;
  failureMessage?: string;
};

export const openSubscriptionManagement = async (
  options: OpenSubscriptionManagementOptions = {},
) => {
  const subscriptionsUrl = getSubscriptionManagementUrl(options.store);
  const failureTitle = options.failureTitle ?? 'Abo verwalten';
  const failureMessage =
    options.failureMessage ??
    'Die Abo-Verwaltung konnte gerade nicht geöffnet werden. Bitte öffne sie direkt in deinen Store-Einstellungen.';

  try {
    if (!subscriptionsUrl) throw new Error('Herkunftsstore nicht verfügbar.');
    // The regular App Store account URL does not show TestFlight purchases made
    // with a production Apple Account. StoreKit's in-app sheet does.
    if (Platform.OS === 'ios' && (options.store === undefined || options.store === 'APP_STORE' || options.store === 'MAC_APP_STORE')) {
      await Purchases.showManageSubscriptions();
      return;
    }
    const canOpen = await Linking.canOpenURL(subscriptionsUrl);
    if (!canOpen) {
      throw new Error('Abo-Verwaltung konnte nicht geöffnet werden.');
    }

    await Linking.openURL(subscriptionsUrl);
  } catch (error) {
    console.error('Failed to open subscription management:', error);
    Alert.alert(failureTitle, failureMessage);
  }
};
