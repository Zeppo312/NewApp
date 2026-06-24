import { Alert, Linking, Platform } from 'react-native';

export const getSubscriptionManagementUrl = () =>
  Platform.OS === 'ios'
    ? 'https://apps.apple.com/account/subscriptions'
    : 'https://play.google.com/store/account/subscriptions';

export const getSubscriptionManagementStoreLabel = () =>
  Platform.OS === 'ios' ? 'App Store' : 'Google Play';

type OpenSubscriptionManagementOptions = {
  failureTitle?: string;
  failureMessage?: string;
};

export const openSubscriptionManagement = async (
  options: OpenSubscriptionManagementOptions = {},
) => {
  const subscriptionsUrl = getSubscriptionManagementUrl();
  const failureTitle = options.failureTitle ?? 'Abo verwalten';
  const failureMessage =
    options.failureMessage ??
    'Die Abo-Verwaltung konnte gerade nicht geöffnet werden. Bitte öffne sie direkt in deinen Store-Einstellungen.';

  try {
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
