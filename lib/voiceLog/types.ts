// Sprach-Logging — gemeinsame Typen zwischen Edge Function und App.
// Muss zum Output von supabase/functions/voice-log-parse passen.

export type VoiceLogEntryType = 'sleep' | 'feeding' | 'diaper';

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
}

export interface VoiceLogParseResult {
  transcript: string;
  entries: VoiceLogParsedEntry[];
}
