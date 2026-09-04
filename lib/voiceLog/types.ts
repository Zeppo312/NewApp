// Sprach-Logging — gemeinsame Typen zwischen Edge Function und App.
// Muss zum Output von supabase/functions/voice-log-parse passen.

export type VoiceLogEntryType =
  | 'sleep'
  | 'feeding'
  | 'diaper'
  | 'custom'
  | 'shopping'
  | 'planner';

/** 'baby': Schlaf/Füttern/Windel/eigene Aktivitäten + Einkauf + Planer; 'pregnancy': Einkauf + Planer. */
export type VoiceLogMode = 'baby' | 'pregnancy';

export type VoiceLogPlannerKind = 'event' | 'todo';

export type VoiceLogShoppingCategory = 'diapers' | 'formula' | 'care' | 'food' | 'other';

export type VoiceLogCustomTrackingMode = 'event' | 'quantity' | 'duration';

export interface VoiceLogParsedEntry {
  type: VoiceLogEntryType;
  /** Lokale Zeit 'YYYY-MM-DDTHH:mm' (ohne Zeitzone, Gerätezeit). */
  start_local: string;
  end_local: string | null;
  feeding_type: 'BREAST' | 'BOTTLE' | 'SOLIDS' | 'PUMP' | 'WATER' | null;
  /** Muss die Person bei uneindeutigem Stillen/Fläschchen aktiv bestätigen? */
  feeding_type_needs_confirmation: boolean;
  /** Nur true, wenn ein laufender Timer ausdrücklich erwähnt wurde. */
  timer_requested: boolean;
  feeding_volume_ml: number | null;
  feeding_side: 'LEFT' | 'RIGHT' | 'BOTH' | null;
  diaper_type: 'WET' | 'DIRTY' | 'BOTH' | null;
  note: string | null;
  /** Benutzerdefinierte Daily-Aktivitaet; Werte sind ein Snapshot der Vorlage. */
  custom_activity_type_id: string | null;
  custom_name: string | null;
  custom_emoji: string | null;
  custom_color: string | null;
  custom_tracking_mode: VoiceLogCustomTrackingMode | null;
  custom_quantity: number | null;
  custom_unit: string | null;
  /** Legt beim Speichern zuerst eine neue Aktivitaetsvorlage an. */
  custom_create_type: boolean;
  /** False erlaubt das reine Anlegen einer neuen Vorlage ohne Aktivitaetseintrag. */
  custom_log_entry: boolean;
  /** Nur für type 'shopping': ein Posten pro Eintrag. */
  shopping_title: string | null;
  shopping_quantity_value: number | null;
  shopping_quantity_unit: string | null;
  shopping_category: VoiceLogShoppingCategory | null;
  /** Nur für type 'planner': Termin (start/end_local) oder Aufgabe (start_local = fällig). */
  planner_kind: VoiceLogPlannerKind | null;
  planner_title: string | null;
  planner_location: string | null;
  /** Termin ohne Uhrzeit bzw. Aufgabe ohne Fälligkeitszeit. */
  planner_all_day: boolean;
}

export interface VoiceLogParseResult {
  transcript: string;
  entries: VoiceLogParsedEntry[];
}
