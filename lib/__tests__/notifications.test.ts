const mockLoadPushModule = jest.fn();
const mockGetPushToken = jest.fn();
const mockScheduleNotification = jest.fn();

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
