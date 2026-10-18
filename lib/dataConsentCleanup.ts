import { clearLocalHealthData } from './localHealthStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DataConsentScope } from './dataConsentTypes';
import { DATA_CONSENTS_ENABLED } from './dataConsentRuntime';
import { clearStartupAccess, STARTUP_ACCESS_PREFIX } from './startupAccess';

/** Ordinary logout must not silently discard an unconfirmed withdrawal. */
export async function clearDeviceStoragePreservingWithdrawals(): Promise<void> {
  await clearStartupAccess();
  await clearLocalHealthData();
  if (!DATA_CONSENTS_ENABLED) { await AsyncStorage.clear(); return; }
  const keys = await AsyncStorage.getAllKeys();
  const withdrawalKeys = keys.filter(key => key.startsWith('data_consent_pending_withdrawal_v1:'));
  const values = await AsyncStorage.multiGet(withdrawalKeys);
  const keep = new Set(values.filter(([, value]) => value !== null && value !== '[]').map(([key]) => key));
  await AsyncStorage.multiRemove(keys.filter(key => !keep.has(key)));
}

/** Remove health caches while retaining auth, consent decisions and withdrawals. */
export async function clearHealthConsentDeviceStorage(): Promise<void> {
  await clearLocalHealthData();
  const keys = await AsyncStorage.getAllKeys();
  const removable = keys.filter(key => !/^sb-[a-z]{20}-auth-token(?:$|-code-verifier$|-user$)/.test(key)
    && !key.startsWith('data_consent_pending_withdrawal_v1:') && !key.startsWith('data_consent_snapshot_v1:')
    && !key.startsWith(STARTUP_ACCESS_PREFIX)
    && !key.startsWith('@lottibaby:language-preference'));
  await AsyncStorage.multiRemove(removable);
}

/** Runs after private components unmount. Keeps auth and consent state. */
export async function clearConsentDeviceData(scope: DataConsentScope): Promise<void> {
  const { clearConversations } = await import('./askLotti/chatStore');
  if (scope === 'ai') { await clearConversations(); return; }
  const { invalidateAllCaches } = await import('./appCache');
  const { clearImageCache } = await import('./imageCache');
  const { clearSleepWidget } = await import('./sleepWidget');
  const { clearPlannerWidget } = await import('./plannerWidget');
  const { clearShoppingWidget } = await import('./shoppingWidget');
  const { sleepActivityService } = await import('./sleepActivityService');
  const notifications = await import('expo-notifications');
  const fileSystem = await import('expo-file-system/legacy');
  const work = await Promise.allSettled([
    invalidateAllCaches(), clearConversations(), clearImageCache(), clearSleepWidget(), clearPlannerWidget(), clearShoppingWidget(),
    sleepActivityService.endAllSleepActivities(), sleepActivityService.endAllFeedingActivities(),
    notifications.cancelAllScheduledNotificationsAsync(), notifications.dismissAllNotificationsAsync(),
    (async () => {
      if (!fileSystem.cacheDirectory) return;
      const files = await fileSystem.readDirectoryAsync(fileSystem.cacheDirectory);
      await Promise.all(files.map(name => fileSystem.deleteAsync(`${fileSystem.cacheDirectory}${name}`, { idempotent: true })));
    })(),
  ]);
  await clearHealthConsentDeviceStorage();
  if (work.some(r => r.status === 'rejected')) throw new Error('consent_device_cleanup_incomplete');
}
