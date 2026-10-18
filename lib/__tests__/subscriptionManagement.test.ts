import { Alert, Linking, Platform } from 'react-native';
import Purchases from 'react-native-purchases';
import { getSubscriptionManagementStoreLabel, getSubscriptionManagementUrl, openSubscriptionManagement } from '../subscriptionManagement';

jest.mock('react-native-purchases', () => ({ __esModule: true, default: { showManageSubscriptions: jest.fn() } }));

describe('subscription origin store management', () => {
  const originalOS = Platform.OS;
  beforeEach(() => jest.clearAllMocks());
  afterEach(() => { Platform.OS = originalOS; jest.restoreAllMocks(); });
  it.each(['ios', 'android'] as const)('manages subscriptions by origin on %s', async (platform) => {
    Platform.OS = platform;
    jest.mocked(Purchases.showManageSubscriptions).mockResolvedValue(undefined);
    jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(true);
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    expect(getSubscriptionManagementStoreLabel('APP_STORE')).toBe('App Store');
    expect(getSubscriptionManagementStoreLabel('PLAY_STORE')).toBe('Google Play');
    await openSubscriptionManagement({ store: 'APP_STORE' });
    if (platform === 'ios') {
      expect(Purchases.showManageSubscriptions).toHaveBeenCalledTimes(1);
      expect(open).not.toHaveBeenCalled();
    } else {
      expect(open).toHaveBeenLastCalledWith('https://apps.apple.com/account/subscriptions');
    }
    await openSubscriptionManagement({ store: 'PLAY_STORE' });
    expect(open).toHaveBeenLastCalledWith('https://play.google.com/store/account/subscriptions');
  });
  it('does not send an iPhone TestFlight user to the regular App Store page if the native sheet fails', async () => {
    Platform.OS = 'ios';
    jest.mocked(Purchases.showManageSubscriptions).mockRejectedValue(new Error('Unavailable'));
    const open = jest.spyOn(Linking, 'openURL');
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await openSubscriptionManagement({ store: 'APP_STORE' });
    expect(open).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalled();
  });
  it('never guesses a store for an unknown origin', async () => {
    const open = jest.spyOn(Linking, 'openURL');
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(getSubscriptionManagementUrl(null)).toBeNull();
    expect(getSubscriptionManagementUrl('STRIPE')).toBeNull();
    await openSubscriptionManagement({ store: 'UNKNOWN_STORE' });
    expect(open).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalled();
  });
  it('reports native link failures', async () => {
    jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(false);
    const open = jest.spyOn(Linking, 'openURL');
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await openSubscriptionManagement({ store: 'PLAY_STORE', failureTitle: 'Try later', failureMessage: 'Unavailable' });
    expect(open).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith('Try later', 'Unavailable');
  });
});
