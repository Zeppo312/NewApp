import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Schlüssel für AsyncStorage
const SLEEP_START_TIME_KEY = 'sleep-tracker-start-time';
const NOTIFICATION_ID = 'sleep-tracking-notification';

// Interner Timer-Verweis
let updateTimerId: any = null;

// Konfiguriere Benachrichtigungen
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Formatiert die verstrichene Zeit für die Anzeige
 */
export function formatElapsedTime(startTime: Date): string {
  const elapsedMs = new Date().getTime() - startTime.getTime();
  const seconds = Math.floor((elapsedMs / 1000) % 60);
  const minutes = Math.floor((elapsedMs / (1000 * 60)) % 60);
  const hours = Math.floor(elapsedMs / (1000 * 60 * 60));

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Initialisiert die Benachrichtigungseinstellungen
 */
export async function initNotifications() {
  try {
    // Für Android: Erstelle einen Kanal
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('sleep-tracking', {
        name: 'Schlaftracker',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#1E88E5',
      });
    }

    // Für iOS: Fordere Berechtigungen an
    if (Platform.OS === 'ios') {
      await Notifications.requestPermissionsAsync();
    }
    
    console.log('Benachrichtigungen erfolgreich initialisiert');
  } catch (error) {
    console.error('Fehler beim Initialisieren der Benachrichtigungen:', error);
  }
}

/**
 * Startet eine Benachrichtigung für den Schlaftracker
 */
export async function startSleepTracking(startTime: Date): Promise<void> {
  try {
    // Initialisiere Benachrichtigungen
    await initNotifications();

    // Speichere Startzeit
    await AsyncStorage.setItem(SLEEP_START_TIME_KEY, startTime.toISOString());

    // Zeige initiale Benachrichtigung
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Schlafaufzeichnung läuft',
        body: 'Laufzeit: 00:00:00',
        data: { startTime: startTime.toISOString() },
      },
      trigger: null,
      identifier: NOTIFICATION_ID,
    });

    // Stoppe vorherigen Timer, falls vorhanden
    if (updateTimerId !== null) {
      clearInterval(updateTimerId);
    }
    
    // Plane regelmäßige Updates (iOS unterstützt besser häufigere Updates)
    const updateInterval = Platform.OS === 'ios' ? 30 : 60; // Sekunden
    
    // Verwende die Platform-Benachrichtigungen, um Updates alle 30-60 Sekunden anzuzeigen
    updateTimerId = setInterval(async () => {
      await updateSleepTracking();
    }, updateInterval * 1000);
    
    console.log('Schlaftracker-Benachrichtigung gestartet');
  } catch (error) {
    console.error('Fehler beim Starten der Schlaftracker-Benachrichtigung:', error);
  }
}

/**
 * Aktualisiert die Benachrichtigung mit der aktuellen Zeit
 */
export async function updateSleepTracking() {
  try {
    // Hole Startzeit aus AsyncStorage
    const startTimeStr = await AsyncStorage.getItem(SLEEP_START_TIME_KEY);
    if (!startTimeStr) return;

    const startTime = new Date(startTimeStr);
    const elapsedTime = formatElapsedTime(startTime);

    // Aktualisiere Benachrichtigung
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Schlafaufzeichnung läuft',
        body: `Laufzeit: ${elapsedTime}`,
        data: { startTime: startTimeStr },
      },
      trigger: null,
      identifier: NOTIFICATION_ID,
    });
  } catch (error) {
    console.error('Fehler beim Aktualisieren der Schlafbenachrichtigung:', error);
  }
}

/**
 * Beendet die Schlaftracker-Benachrichtigung
 */
export async function stopSleepTracking() {
  try {
    // Stoppe den Timer, falls vorhanden
    if (updateTimerId !== null) {
      clearInterval(updateTimerId);
      updateTimerId = null;
    }
    
    // Lösche die Startzeit
    await AsyncStorage.removeItem(SLEEP_START_TIME_KEY);

    // Entferne die Benachrichtigung
    await Notifications.dismissNotificationAsync(NOTIFICATION_ID);
    
    console.log('Schlaftracker-Benachrichtigung beendet');
  } catch (error) {
    console.error('Fehler beim Beenden der Schlaftracker-Benachrichtigung:', error);
  }
}

/**
 * Prüft, ob eine Schlaftracker-Benachrichtigung aktiv ist
 */
export async function isTrackingActive(): Promise<boolean> {
  const startTime = await AsyncStorage.getItem(SLEEP_START_TIME_KEY);
  return !!startTime;
}

/**
 * Gibt die Startzeit zurück, falls eine Aufzeichnung läuft
 */
export async function getStartTime(): Promise<Date | null> {
  const startTimeStr = await AsyncStorage.getItem(SLEEP_START_TIME_KEY);
  return startTimeStr ? new Date(startTimeStr) : null;
}
