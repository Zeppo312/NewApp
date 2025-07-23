import * as Notifications from 'expo-notifications';
import BackgroundTimer from 'react-native-background-timer';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Kanal-ID für die Benachrichtigung
const SLEEP_NOTIFICATION_CHANNEL = 'sleep-tracking-channel';
const SLEEP_NOTIFICATION_ID = 'sleep-tracking';
const SLEEP_START_TIME_KEY = 'sleep-tracking-start-time';
const SLEEP_TIMER_INTERVAL = 5000; // Aktualisierung alle 5 Sekunden

// Richte die Standard-Benachrichtigungseinstellungen ein
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

class SleepNotificationService {
  private timerId: number | null = null;
  private startTime: Date | null = null;
  private isInitialized = false;

  constructor() {
    this.init();
  }

  /**
   * Initialisiert den Notification-Service
   */
  async init() {
    if (this.isInitialized) return;
    
    try {
      // Erstelle den Kanal für Android
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync(SLEEP_NOTIFICATION_CHANNEL, {
          name: 'Schlaftracker',
          importance: Notifications.AndroidImportance.HIGH,
          sound: 'default',
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#1E88E5',
        });
      }

      // Fordere Benachrichtigungsberechtigungen an (für iOS)
      if (Platform.OS === 'ios') {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted') {
          console.log('Benachrichtigungsberechtigungen nicht gewährt');
          return;
        }
      }

      // Prüfe, ob eine vorherige Sitzung aktiv war
      const storedStartTime = await AsyncStorage.getItem(SLEEP_START_TIME_KEY);
      if (storedStartTime) {
        this.startTime = new Date(storedStartTime);
        this.startBackgroundTimer();
      }

      this.isInitialized = true;
    } catch (error) {
      console.error('Fehler beim Initialisieren des SleepNotificationService:', error);
    }
  }

  /**
   * Formatiert die verstrichene Zeit in Stunden, Minuten und Sekunden
   */
  private formatElapsedTime(startTime: Date): string {
    const elapsedMs = new Date().getTime() - startTime.getTime();
    const seconds = Math.floor((elapsedMs / 1000) % 60);
    const minutes = Math.floor((elapsedMs / (1000 * 60)) % 60);
    const hours = Math.floor(elapsedMs / (1000 * 60 * 60));

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  /**
   * Startet den Hintergrund-Timer für die Benachrichtigungsaktualisierung
   */
  private startBackgroundTimer() {
    if (this.timerId) {
      BackgroundTimer.clearInterval(this.timerId);
    }

    this.timerId = BackgroundTimer.setInterval(async () => {
      if (!this.startTime) return;
      
      // Aktualisiere die Benachrichtigung mit der neuen verstrichenen Zeit
      await this.updateNotification();
    }, SLEEP_TIMER_INTERVAL);
  }

  /**
   * Aktualisiert die Benachrichtigung mit der aktuellen verstrichenen Zeit
   */
  private async updateNotification() {
    if (!this.startTime) return;

    const elapsedTime = this.formatElapsedTime(this.startTime);
    
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Schlafaufzeichnung läuft',
        body: `Laufzeit: ${elapsedTime}`,
        data: { startTime: this.startTime.toISOString() },
        sticky: true, // Bleibt bestehen, bis explizit entfernt (iOS)
        autoDismiss: false, // Bleibt bestehen (Android)
      },
      trigger: null, // Sofort anzeigen
      identifier: SLEEP_NOTIFICATION_ID, // Überschreibt vorherige mit gleicher ID
    });
  }

  /**
   * Startet die Schlafaufzeichnungs-Benachrichtigung
   * @param startTime Startzeitpunkt der Schlafaufzeichnung
   */
  async startSleepTracking(startTime: Date) {
    await this.init();
    
    this.startTime = startTime;
    
    // Speichere die Startzeit im AsyncStorage
    await AsyncStorage.setItem(SLEEP_START_TIME_KEY, startTime.toISOString());
    
    // Stelle die initiale Benachrichtigung
    await Notifications.dismissAllNotificationsAsync(); // Lösche vorherige Benachrichtigungen
    
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Schlafaufzeichnung läuft',
        body: 'Laufzeit: 00:00:00',
        data: { startTime: startTime.toISOString() },
        sticky: true,
        autoDismiss: false,
      },
      trigger: null,
      identifier: SLEEP_NOTIFICATION_ID,
    });
    
    // Starte den Timer für regelmäßige Aktualisierungen
    this.startBackgroundTimer();
    
    console.log('Schlafaufzeichnungs-Benachrichtigung gestartet');
  }

  /**
   * Beendet die Schlafaufzeichnungs-Benachrichtigung
   */
  async stopSleepTracking() {
    if (this.timerId) {
      BackgroundTimer.clearInterval(this.timerId);
      this.timerId = null;
    }
    
    this.startTime = null;
    
    // Entferne die gespeicherte Startzeit
    await AsyncStorage.removeItem(SLEEP_START_TIME_KEY);
    
    // Entferne die Benachrichtigung
    await Notifications.dismissNotificationAsync(SLEEP_NOTIFICATION_ID);
    
    console.log('Schlafaufzeichnungs-Benachrichtigung beendet');
  }

  /**
   * Prüft, ob derzeit eine Schlafaufzeichnungs-Benachrichtigung aktiv ist
   */
  async isTrackingActive(): Promise<boolean> {
    return this.startTime !== null;
  }

  /**
   * Gibt die aktuelle Startzeit zurück, falls eine Aufzeichnung läuft
   */
  getStartTime(): Date | null {
    return this.startTime;
  }
}

// Singleton-Instanz exportieren
export const sleepNotificationService = new SleepNotificationService();
