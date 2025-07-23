import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKGROUND_FETCH_TASK = 'milestone-background-fetch';
const BABY_INFO_KEY = '@baby_info_for_background_task'; // Eigener Key für Infos für den Task
const SENT_MILESTONES_KEY_BG = '@sent_baby_milestones_bg'; // Eigener Key für den Task

// Die checkMilestones Logik (angepasst für den Hintergrund)
async function checkMilestonesInBackground() {
  try {
    const babyInfoString = await AsyncStorage.getItem(BABY_INFO_KEY);
    if (!babyInfoString) {
      console.log('[BackgroundFetch] Keine Baby-Infos für Task gefunden.');
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }
    const babyInfo = JSON.parse(babyInfoString);
    const birthDate = babyInfo.birth_date ? new Date(babyInfo.birth_date) : null;
    const babyName = babyInfo.name || 'Dein Baby';

    if (!birthDate) {
      console.log('[BackgroundFetch] Kein Geburtsdatum für Task gefunden.');
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    // Meilenstein-Definitionen
    const milestones = [
      { id: '1_week', name: '1 Woche', days: 7 },
      { id: '1_month', name: '1 Monat', days: 30 },
      { id: '2_months', name: '2 Monate', days: 60 },
      { id: '3_months', name: '3 Monate', days: 90 },
      { id: '100_days', name: '100 Tage', days: 100 },
      { id: '6_months', name: '6 Monate', days: 182 },
      { id: '1_year', name: '1 Jahr', days: 365 },
      { id: '500_days', name: '500 Tage', days: 500 },
      { id: '1000_days', name: '1000 Tage', days: 1000 },
      { id: '1111_days', name: '1111 Tage', days: 1111 }
    ];

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const birthD = new Date(birthDate);
    birthD.setHours(0, 0, 0, 0);

    const diffTime = Math.abs(today.getTime() - birthD.getTime());
    const daysOld = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    const sentMilestonesString = await AsyncStorage.getItem(SENT_MILESTONES_KEY_BG);
    const sentMilestones: string[] = sentMilestonesString ? JSON.parse(sentMilestonesString) : [];

    let newNotificationSent = false;
    for (const milestone of milestones) {
      if (daysOld === milestone.days && !sentMilestones.includes(milestone.id)) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `${milestone.name} Meilenstein! 🎉`,
            body: `${babyName} ist heute ${milestone.name} alt! Schau dir die Statistiken an.`,
            data: { screen: 'baby-stats' },
          },
          trigger: null, // Sofort senden
        });
        sentMilestones.push(milestone.id);
        newNotificationSent = true;
        console.log(`[BackgroundFetch] Benachrichtigung für ${milestone.name} gesendet.`);
      }
    }

    if (newNotificationSent) {
      await AsyncStorage.setItem(SENT_MILESTONES_KEY_BG, JSON.stringify(sentMilestones));
      return BackgroundFetch.BackgroundFetchResult.NewData;
    } else {
      console.log('[BackgroundFetch] Keine neuen Meilensteine heute oder bereits gesendet.');
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }
  } catch (error) {
    console.error('[BackgroundFetch] Fehler im Task:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
}

// Die eigentliche Task-Definition wird exportiert, damit sie in App.tsx oder _layout.tsx aufgerufen werden kann
export function defineMilestoneCheckerTask() {
  TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
    console.log('[BackgroundFetch] Task gestartet:', new Date());
    const result = await checkMilestonesInBackground();
    console.log('[BackgroundFetch] Task beendet mit Result:', result);
    return result;
  });
  
  console.log('[BackgroundFetch] Task definiert:', BACKGROUND_FETCH_TASK);
}

// Hilfsfunktion zum Registrieren des Tasks
export async function registerBackgroundFetchAsync() {
  console.log('[BackgroundFetch] Versuche Task zu registrieren...');
  return BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
    minimumInterval: 15 * 60, // Minimum 15 Minuten (iOS wird es wahrscheinlich seltener ausführen)
    stopOnTerminate: false, // Android
    startOnBoot: true, // Android
  });
}

// Hilfsfunktion zum Deregistrieren (für Tests oder wenn nicht mehr benötigt)
export async function unregisterBackgroundFetchAsync() {
  return BackgroundFetch.unregisterTaskAsync(BACKGROUND_FETCH_TASK);
}

// Funktion zum Speichern der Baby-Infos für den Hintergrund-Task
export async function saveBabyInfoForBackgroundTask(babyInfo: any) {
  if (babyInfo?.birth_date) {
    const relevantInfo = {
      birth_date: babyInfo.birth_date,
      name: babyInfo.name || '',
    };
    await AsyncStorage.setItem(BABY_INFO_KEY, JSON.stringify(relevantInfo));
    console.log('[BackgroundFetch] Baby-Infos für Hintergrund-Task gespeichert.');
    return true;
  }
  return false;
}

// Funktion, die den Task Status überprüft und zurückgibt
export async function getBackgroundFetchStatus() {
  try {
    const status = await BackgroundFetch.getStatusAsync();
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_FETCH_TASK);
    
    // Sicherstellen, dass BackgroundFetchStatus[status] existiert, bevor darauf zugegriffen wird
    const statusText = (status !== null && status !== undefined && BackgroundFetch.BackgroundFetchStatus[status])
      ? BackgroundFetch.BackgroundFetchStatus[status]
      : 'UNKNOWN_OR_NOT_AVAILABLE';
    
    return {
      status: statusText,
      isRegistered,
    };
  } catch (error) {
    console.error("Fehler beim Abrufen des BackgroundFetchStatus:", error);
    return {
      status: 'ERROR_FETCHING_STATUS',
      isRegistered: await TaskManager.isTaskRegisteredAsync(BACKGROUND_FETCH_TASK).catch(() => false),
    };
  }
}
