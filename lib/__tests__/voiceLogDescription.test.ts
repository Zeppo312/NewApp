import { getVoiceLogEntryEmoji } from '../voiceLog/presentation';
import type { VoiceLogParsedEntry } from '../voiceLog/types';

const makeEntry = (
  changes: Partial<VoiceLogParsedEntry>,
): VoiceLogParsedEntry => ({
  type: 'feeding',
  start_local: '2026-07-21T12:00',
  end_local: null,
  feeding_type: 'BOTTLE',
  feeding_type_needs_confirmation: false,
  timer_requested: false,
  feeding_volume_ml: null,
  feeding_side: null,
  diaper_type: null,
  note: null,
  ...changes,
});

describe('describeVoiceLogEntry icons', () => {
  it.each([
    ['BREAST', '🤱'],
    ['BOTTLE', '🍼'],
    ['SOLIDS', '🥄'],
    ['PUMP', '🥛'],
    ['WATER', '🚰'],
  ] as const)('uses the Unser Tag icon for %s', (feedingType, emoji) => {
    expect(
      getVoiceLogEntryEmoji(makeEntry({ feeding_type: feedingType })),
    ).toBe(emoji);
  });

  it.each([
    ['WET', '💧'],
    ['DIRTY', '💩'],
    ['BOTH', '💧💩'],
  ] as const)('uses the Unser Tag diaper icon for %s', (diaperType, emoji) => {
    expect(
      getVoiceLogEntryEmoji(
        makeEntry({
          type: 'diaper',
          feeding_type: null,
          diaper_type: diaperType,
        }),
      ),
    ).toBe(emoji);
  });
});
