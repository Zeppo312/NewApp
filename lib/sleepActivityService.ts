import { LiveActivitiesModule } from 'expo-live-activities';
import { Platform } from 'react-native';
import {
  SLEEP_ACTIVITY_ID,
  SleepActivityAttributes,
  SleepActivityStatus,
  ActivityState
} from './sleepActivityAttributes';

class SleepActivityService {
  private liveActivity: LiveActivitiesModule | null = null;
  private currentActivityId: string | null = null;
  private isSupported: boolean = false;

  constructor() {
    // Dynamic Island ist nur auf iOS-Geräten mit iOS 16.1+ verfügbar
    this.isSupported = Platform.OS === 'ios';

    if (this.isSupported) {
      this.initializeLiveActivity();
    } else {
      console.log('Live Activities nicht unterstützt auf dieser Plattform');
    }
  }

  private async initializeLiveActivity() {
    try {
      // Initialisiere das LiveActivities-Modul
      this.liveActivity = new LiveActivitiesModule();
      
      // Registriere den Activity-Typ
      await this.liveActivity.registerActivityType(SLEEP_ACTIVITY_ID);
      
      console.log('Live Activity erfolgreich initialisiert');
    } catch (error) {
      console.error('Fehler bei der Initialisierung von Live Activities:', error);
      this.isSupported = false;
    }
  }

  /**
   * Startet eine neue Live Activity für die Schlafaufzeichnung
   * @param startTime Die Startzeit der Schlafaufzeichnung
   * @returns ID der gestarteten Activity oder null
   */
  public async startSleepActivity(startTime: Date): Promise<string | null> {
    if (!this.isSupported || !this.liveActivity) {
      return null;
    }

    try {
      // Erstelle die initialen Attribute
      const attributes: SleepActivityAttributes = {
        startTime: startTime.toISOString(),
        elapsedTimeText: '00:00:00',
      };

      // Initialer Status
      const initialStatus: SleepActivityStatus = {
        isTracking: true,
        elapsedTimeText: '00:00:00'
      };

      // Starte die Activity
      const activityId = await this.liveActivity.startActivity(
        SLEEP_ACTIVITY_ID,
        attributes,
        initialStatus
      );

      if (activityId) {
        this.currentActivityId = activityId;
        console.log('Sleep Activity gestartet mit ID:', activityId);
        return activityId;
      }
      
      return null;
    } catch (error) {
      console.error('Fehler beim Starten der Sleep Activity:', error);
      return null;
    }
  }

  /**
   * Aktualisiert den Status einer laufenden Schlafaufzeichnung
   * @param elapsedTimeText Formatierter Text der verstrichenen Zeit
   * @param quality Optionale Schlafqualität
   */
  public async updateSleepActivity(elapsedTimeText: string, quality?: string): Promise<void> {
    if (!this.isSupported || !this.liveActivity || !this.currentActivityId) {
      return;
    }

    try {
      // Aktualisierter Status
      const newStatus: SleepActivityStatus = {
        isTracking: true,
        elapsedTimeText,
        quality
      };

      // Aktualisiere die Activity
      await this.liveActivity.updateActivity(
        this.currentActivityId,
        newStatus
      );
      
      console.log('Sleep Activity aktualisiert:', elapsedTimeText);
    } catch (error) {
      console.error('Fehler beim Aktualisieren der Sleep Activity:', error);
    }
  }

  /**
   * Beendet die laufende Schlafaufzeichnung
   * @param quality Finale Schlafqualität
   * @param totalDuration Gesamtdauer des Schlafs
   */
  public async endSleepActivity(quality: string, totalDuration: string): Promise<void> {
    if (!this.isSupported || !this.liveActivity || !this.currentActivityId) {
      return;
    }

    try {
      // Finaler Status
      const finalStatus: SleepActivityStatus = {
        isTracking: false,
        elapsedTimeText: totalDuration,
        quality
      };

      // Beende die Activity
      await this.liveActivity.endActivity(
        this.currentActivityId,
        finalStatus
      );
      
      console.log('Sleep Activity beendet');
      this.currentActivityId = null;
    } catch (error) {
      console.error('Fehler beim Beenden der Sleep Activity:', error);
    }
  }

  /**
   * Ruft den aktuellen Status der Schlafaufzeichnung ab
   */
  public async getSleepActivityState(): Promise<ActivityState | null> {
    if (!this.isSupported || !this.liveActivity || !this.currentActivityId) {
      return null;
    }

    try {
      const state = await this.liveActivity.getActivityState(this.currentActivityId);
      return state as ActivityState;
    } catch (error) {
      console.error('Fehler beim Abrufen des Activity-Status:', error);
      return null;
    }
  }

  /**
   * Prüft, ob die Funktionalität unterstützt wird
   */
  public isLiveActivitySupported(): boolean {
    return this.isSupported;
  }
}

// Exportiere eine Singleton-Instanz
export const sleepActivityService = new SleepActivityService();
