import type { VoiceLogParsedEntry } from './types';

const FEEDING_EMOJIS: Record<string, string> = {
  BREAST: '🤱',
  BOTTLE: '🍼',
  SOLIDS: '🥄',
  PUMP: '🥛',
  WATER: '🚰',
};

const DIAPER_EMOJIS: Record<string, string> = {
  WET: '💧',
  DIRTY: '💩',
  BOTH: '💧💩',
};

type VoiceLogIconEntry = Pick<
  VoiceLogParsedEntry,
  'type' | 'feeding_type' | 'diaper_type'
>;

/** Gleiche Emoji-Zuordnung wie die Eintragskarten in „Unser Tag“. */
export const getVoiceLogEntryEmoji = (entry: VoiceLogIconEntry): string => {
  if (entry.type === 'sleep') return '😴';
  if (entry.type === 'diaper') {
    return DIAPER_EMOJIS[entry.diaper_type ?? 'WET'] ?? '💧';
  }
  return FEEDING_EMOJIS[entry.feeding_type ?? ''] ?? '🍼';
};
