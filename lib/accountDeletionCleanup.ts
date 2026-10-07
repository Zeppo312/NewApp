import * as FileSystem from 'expo-file-system/legacy';
import { cancelAllScheduledNotificationsAsync, dismissAllNotificationsAsync } from 'expo-notifications';
import { invalidateAllCaches } from './appCache';
import { clearImageCache } from './imageCache';
import { clearSleepWidget } from './sleepWidget';
import { clearPlannerWidget } from './plannerWidget';
import { clearShoppingWidget } from './shoppingWidget';
import { sleepActivityService } from './sleepActivityService';
import { clearConversations } from './askLotti/chatStore';
import { clearDeviceStoragePreservingWithdrawals } from './dataConsentCleanup';

let cleanup: Promise<string[]> | null = null;
export async function waitForPersonalDeviceCleanup(): Promise<void> {
 await cleanup;
}

export function clearPersonalDeviceData(): Promise<string[]> {
 if (!cleanup) {
  cleanup = performCleanup().finally(() => { cleanup = null; });
 }
 return cleanup;
}

/** Call after Auth state is cleared and private screens have unmounted.
 * A local failure cannot undo an accepted server request. Report only failed
 * component names; never log paths, tokens or cached contents.
 */
async function performCleanup(): Promise<string[]> {
 const tasks: [string, () => Promise<unknown>][] = [
  ['app-cache', invalidateAllCaches], ['conversations', clearConversations],
  ['notifications', cancelAllScheduledNotificationsAsync], ['delivered-notifications', dismissAllNotificationsAsync],
  ['sleep-widget', clearSleepWidget], ['planner-widget', clearPlannerWidget], ['shopping-widget', clearShoppingWidget],
  ['images', clearImageCache],
  ['sleep-activity', () => sleepActivityService.endAllSleepActivities()],
  ['feeding-activity', () => sleepActivityService.endAllFeedingActivities()],
  ['temporary-files', async () => {
   if (!FileSystem.cacheDirectory) return;
   const children = await FileSystem.readDirectoryAsync(FileSystem.cacheDirectory);
   await Promise.all(children.map((name) => FileSystem.deleteAsync(`${FileSystem.cacheDirectory}${name}`, { idempotent: true })));
  }],
 ];
 const results = await Promise.allSettled(tasks.map(([, run]) => run()));
 const failures = results.flatMap((result, index) => result.status === 'rejected' ? [tasks[index][0]] : []);
 // Clear only after cache/widget writers have settled. New sign-ins wait for
 // this promise, so they cannot lose their freshly persisted session here.
 try { await clearDeviceStoragePreservingWithdrawals(); } catch { failures.push('device-storage'); }
 return failures;
}
