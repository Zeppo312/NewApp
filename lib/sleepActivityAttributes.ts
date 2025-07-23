// Attribute für die Sleep-Activity in der Dynamic Island

// Definiere die Struktur für Sleep-Activity
export interface SleepActivityAttributes {
  startTime: string;   // ISO-String der Startzeit
  elapsedTimeText?: string;  // Text für die verstrichene Zeit, z.B. "3:42:15"
  quality?: string;   // Schlafqualität (falls eingestellt)
}

// Statusattribute für die Activity
export interface SleepActivityStatus {
  isTracking: boolean;
  elapsedTimeText: string;
  quality?: string;
}

// Wir verwenden eine eindeutige Activity-ID
export const SLEEP_ACTIVITY_ID = "SleepTracking";

// Zeigt den aktuellen ActivityState an
export enum ActivityState {
  STARTED = "started",
  UPDATED = "updated",
  ENDED = "ended",
  DISABLED = "disabled",
}
