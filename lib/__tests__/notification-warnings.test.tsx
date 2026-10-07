import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import * as Notifications from '../notifications';
import { setupNotifications, startContractionTimer, stopContractionTimer } from '../background-tasks';
import { setupNotificationListeners } from '../notificationService';
import { useNotifications } from '../../hooks/useNotifications';

jest.mock('../notifications', () => ({
  setNotificationHandler: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  setNotificationCategoryAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  dismissAllNotificationsAsync: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
}));
jest.mock('expo-task-manager', () => ({ defineTask: jest.fn() }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('../supabase', () => ({ getAppSettings: jest.fn(), getCachedUser: jest.fn(), supabase: {} }));
jest.mock('../localization', () => ({ getPersistedAppLocale: jest.fn() }));

let tree: ReactTestRenderer | undefined;

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  // Simulate the native debug console enumerating the objects it receives.
  jest.spyOn(console, 'log').mockImplementation((...args) => { JSON.stringify(args); });
});

afterEach(() => {
  if (tree) act(() => tree?.unmount());
  tree = undefined;
  jest.restoreAllMocks();
});

function notificationFixture(data: Record<string, string>) {
  const readDeprecatedData = jest.fn(() => JSON.stringify(data));
  const content = { title: 'Timer', body: 'Timer: 0:00', data };
  Object.defineProperty(content, 'dataString', { enumerable: true, get: readDeprecatedData });
  const notification = {
    date: Date.now(),
    request: { identifier: 'contraction-timer', content, trigger: null },
  } as unknown as Notifications.Notification;
  return { notification, readDeprecatedData };
}

it('starts and stops the contraction notification with supported display settings', async () => {
  (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
  expect(await setupNotifications()).toBe(true);
  const handler = (Notifications.setNotificationHandler as jest.Mock).mock.calls[0][0];
  expect(await handler.handleNotification()).toEqual({
    shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false,
  });

  const started = await startContractionTimer();
  expect(started.isRunning).toBe(true);
  expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(expect.objectContaining({
    identifier: 'contraction-timer',
    content: expect.objectContaining({ categoryIdentifier: 'timer', data: { screen: 'index' } }),
  }));
  const stopped = await stopContractionTimer();
  expect(stopped.isRunning).toBe(false);
  expect(stopped.startTime).toBe(started.startTime);
  expect(Notifications.dismissAllNotificationsAsync).toHaveBeenCalledTimes(1);
});

it('receives timer events and navigates from notification.data without reading deprecated getters', () => {
  function Harness() { useNotifications(); return null; }
  act(() => { tree = create(<Harness />); });
  const received = (Notifications.addNotificationReceivedListener as jest.Mock).mock.calls[0][0];
  const responded = (Notifications.addNotificationResponseReceivedListener as jest.Mock).mock.calls[0][0];
  const timer = notificationFixture({ screen: 'index' });
  received(timer.notification);
  responded({ notification: timer.notification, actionIdentifier: 'stop' });
  expect(timer.readDeprecatedData).not.toHaveBeenCalled();
  expect(router.push).not.toHaveBeenCalled();

  const partner = notificationFixture({ type: 'partner_diaper', referenceId: 'entry-1' });
  responded({ notification: partner.notification, actionIdentifier: 'default' });
  expect(partner.readDeprecatedData).not.toHaveBeenCalled();
  expect(router.push).toHaveBeenCalledWith({
    pathname: '/(tabs)/daily_old', params: { entryId: 'entry-1' },
  });
});

it('keeps service listeners and their debug logging away from deprecated notification getters', () => {
  const onNotification = jest.fn();
  const cleanup = setupNotificationListeners(onNotification);
  const received = (Notifications.addNotificationReceivedListener as jest.Mock).mock.calls[0][0];
  const responded = (Notifications.addNotificationResponseReceivedListener as jest.Mock).mock.calls[0][0];
  const { notification, readDeprecatedData } = notificationFixture({ screen: 'index' });
  received(notification);
  responded({ notification, actionIdentifier: 'stop' });
  expect(onNotification).toHaveBeenCalledWith(notification);
  expect(readDeprecatedData).not.toHaveBeenCalled();
  cleanup();
  expect((Notifications.addNotificationReceivedListener as jest.Mock).mock.results[0].value.remove).toHaveBeenCalled();
  expect((Notifications.addNotificationResponseReceivedListener as jest.Mock).mock.results[0].value.remove).toHaveBeenCalled();
});
