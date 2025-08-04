
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
      return "noData";
    }
    const babyInfo = JSON.parse(babyInfoString);
    const birthDate = babyInfo.birth_date ? new Date(babyInfo.birth_date) : null;
    const babyName = babyInfo.name || 'Dein Baby';

    if (!birthDate) {
      console.log('[BackgroundFetch] Kein Geburtsdatum für Task gefunden.');
      return "noData";
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
      return "newData";
    } else {
      console.log('[BackgroundFetch] Keine neuen Meilensteine heute oder bereits gesendet.');
      return "noData";
    }
  } catch (error) {
    console.error('[BackgroundFetch] Fehler im Task:', error);
    return "failed";
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

export async function isTaskRegistered() {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_FETCH_TASK);
    return isRegistered;
    
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
