
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getPersistedAppLocale } from '@/lib/localization';

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
    const locale = await getPersistedAppLocale();
    const copy = {
      de: { baby: 'Dein Baby', title: (age: string) => `${age} Meilenstein! 🎉`, body: (name: string, age: string) => `${name} ist heute ${age} alt! Schau dir die Statistiken an.` },
      en: { baby: 'Your baby', title: (age: string) => `${age} milestone! 🎉`, body: (name: string, age: string) => `${name} is ${age} old today! Take a look at the statistics.` },
      es: { baby: 'Tu bebé', title: (age: string) => `¡Hito de ${age}! 🎉`, body: (name: string, age: string) => `¡Hoy ${name} cumple ${age}! Consulta las estadísticas.` },
    }[locale];
    const babyName = babyInfo.name || copy.baby;

    if (!birthDate) {
      console.log('[BackgroundFetch] Kein Geburtsdatum für Task gefunden.');
      return "noData";
    }

    // Meilenstein-Definitionen
    const milestoneAges = {
      de: ['1 Woche', '1 Monat', '2 Monate', '3 Monate', '100 Tage', '6 Monate', '1 Jahr', '500 Tage', '1000 Tage', '1111 Tage'],
      en: ['1 week', '1 month', '2 months', '3 months', '100 days', '6 months', '1 year', '500 days', '1,000 days', '1,111 days'],
      es: ['1 semana', '1 mes', '2 meses', '3 meses', '100 días', '6 meses', '1 año', '500 días', '1000 días', '1111 días'],
    }[locale];
    const milestones = [
      { id: '1_week', days: 7 },
      { id: '1_month', days: 30 },
      { id: '2_months', days: 60 },
      { id: '3_months', days: 90 },
      { id: '100_days', days: 100 },
      { id: '6_months', days: 182 },
      { id: '1_year', days: 365 },
      { id: '500_days', days: 500 },
      { id: '1000_days', days: 1000 },
      { id: '1111_days', days: 1111 },
    ].map((milestone, index) => ({ ...milestone, name: milestoneAges[index] }));

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
            title: copy.title(milestone.name),
            body: copy.body(babyName, milestone.name),
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
    return await TaskManager.isTaskRegisteredAsync(BACKGROUND_FETCH_TASK);
  } catch (error) {
    console.error("Fehler beim Abrufen des BackgroundFetchStatus:", error);
    return false;
  }
}
