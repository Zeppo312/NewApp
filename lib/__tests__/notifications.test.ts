const mockLoadPushModule = jest.fn();
const mockGetPushToken = jest.fn();
const mockScheduleNotification = jest.fn();
const mockSetNotificationChannel = jest.fn();

jest.mock('expo-notifications/build/setNotificationChannelAsync', () => ({
  setNotificationChannelAsync: (...args: unknown[]) => mockSetNotificationChannel(...args),
}));

jest.mock('expo-notifications', () => {
  mockLoadPushModule();
  return { getExpoPushTokenAsync: mockGetPushToken };
});

// Keep the SDK's local JS implementations real; mock only the native scheduler.
jest.mock('expo-notifications/build/NotificationScheduler', () => ({
  __esModule: true,
  default: { scheduleNotificationAsync: mockScheduleNotification },
}));

function loadNotifications(platform: 'android' | 'ios' | 'web', expoGo: boolean) {
  jest.doMock('expo', () => ({ isRunningInExpoGo: () => expoGo }));
  jest.doMock('react-native', () => {
    const actual = jest.requireActual('react-native');
    return Object.defineProperty(Object.create(actual), 'Platform', {
      value: { ...actual.Platform, OS: platform },
    });
  });
  // Load after resetting modules and selecting the runtime for this test.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('../notifications') as typeof import('../notifications');
}

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  mockLoadPushModule.mockReset();
  mockGetPushToken.mockReset();
  mockScheduleNotification.mockReset();
  mockSetNotificationChannel.mockReset();
});

const missingChannelProvider = new Error(
  "Call to function 'ExpoNotificationChannelManager.setNotificationChannelAsync' has been rejected. " +
  'Caused by: java.lang.NullPointerException: null cannot be cast to non-null type ' +
  'expo.modules.notifications.notifications.channels.NotificationsChannelsProvider',
);

it('allows permission setup to continue for the missing channel provider in Android Expo Go', async () => {
  const info = jest.spyOn(console, 'info').mockImplementation(() => undefined);
  mockSetNotificationChannel.mockRejectedValue(missingChannelProvider);
  const notifications = loadNotifications('android', true);
  const channel = { name: 'default', importance: notifications.AndroidImportance.MAX };

  await expect(notifications.setNotificationChannelAsync('default', channel)).resolves.toBeNull();
  await expect(notifications.setNotificationChannelAsync('sleep-tracking', channel)).resolves.toBeNull();
  expect(info).toHaveBeenCalledTimes(1);
  expect(mockLoadPushModule).not.toHaveBeenCalled();
  info.mockRestore();
});

it.each([
  ['android', false, missingChannelProvider],
  ['ios', true, missingChannelProvider],
  ['android', true, new Error('Invalid channel configuration')],
] as const)('preserves channel errors outside the specific Android Expo Go defect (%s, %s)', async (platform, expoGo, error) => {
  mockSetNotificationChannel.mockRejectedValue(error);
  const notifications = loadNotifications(platform, expoGo);
  await expect(notifications.setNotificationChannelAsync('default', {
    name: 'default', importance: notifications.AndroidImportance.MAX,
  })).rejects.toBe(error);
});

it.each([true, false])('creates native Android channels when supported (Expo Go: %s)', async (expoGo) => {
  const notifications = loadNotifications('android', expoGo);
  const channel = { name: 'default', importance: notifications.AndroidImportance.MAX };
  const result = { id: 'default', ...channel };
  mockSetNotificationChannel.mockResolvedValue(result);
  await expect(notifications.setNotificationChannelAsync('default', channel)).resolves.toBe(result);
  expect(mockSetNotificationChannel).toHaveBeenCalledWith('default', channel);
});

it('can load and schedule local reminders in Android Expo Go without loading push registration', async () => {
  mockLoadPushModule.mockImplementation(() => {
    throw new Error('Push registration is unavailable in Android Expo Go');
  });
  mockScheduleNotification.mockResolvedValue('feeding-reminder');
  const notifications = loadNotifications('android', true);

  notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  const subscription = notifications.addNotificationReceivedListener(() => {});
  const responseSubscription = notifications.addNotificationResponseReceivedListener(() => {});
  await expect(notifications.scheduleNotificationAsync({
    identifier: 'feeding-reminder',
    content: { title: 'Fütterung', data: { type: 'feeding_reminder' } },
    trigger: null,
  })).resolves.toBe('feeding-reminder');
  expect(mockScheduleNotification).toHaveBeenCalledWith(
    'feeding-reminder',
    { title: 'Fütterung', data: { type: 'feeding_reminder' } },
    null,
  );
  await expect(notifications.getExpoPushTokenAsync()).resolves.toBeNull();
  expect(mockLoadPushModule).not.toHaveBeenCalled();
  subscription.remove();
  responseSubscription.remove();
  notifications.setNotificationHandler(null);
});

it.each(['android', 'ios'] as const)('loads push registration on demand in a %s development build', async (platform) => {
  const token = { type: 'expo', data: 'ExponentPushToken[test]' };
  mockGetPushToken.mockResolvedValue(token);
  const notifications = loadNotifications(platform, false);
  expect(mockLoadPushModule).not.toHaveBeenCalled();
  expect(notifications.supportsRemoteNotifications()).toBe(true);
  await expect(notifications.getExpoPushTokenAsync({ projectId: 'test-project' })).resolves.toEqual(token);
  expect(mockGetPushToken).toHaveBeenCalledWith({ projectId: 'test-project' });
});

it('skips native push registration on web', async () => {
  const notifications = loadNotifications('web', false);
  expect(notifications.supportsRemoteNotifications()).toBe(false);
  await expect(notifications.getExpoPushTokenAsync()).resolves.toBeNull();
  expect(mockLoadPushModule).not.toHaveBeenCalled();
});
