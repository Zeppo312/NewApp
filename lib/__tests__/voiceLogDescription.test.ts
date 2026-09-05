import { describeVoiceLogEntry, formatShoppingQuantity, localTimeToDate } from '../voiceLog/api';
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
  custom_activity_type_id: null,
  custom_name: null,
  custom_emoji: null,
  custom_color: null,
  custom_tracking_mode: null,
  custom_quantity: null,
  custom_unit: null,
  custom_create_type: false,
  custom_log_entry: false,
  shopping_title: null,
  shopping_quantity_value: null,
  shopping_quantity_unit: null,
  shopping_category: null,
  planner_kind: null,
  planner_title: null,
  planner_location: null,
  planner_all_day: false,
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

describe('describeVoiceLogEntry shopping', () => {
  it('shows the product with quantity and no time', () => {
    const entry = makeEntry({
      type: 'shopping',
      feeding_type: null,
      shopping_title: 'Windeln Größe 3',
      shopping_quantity_value: 2,
      shopping_quantity_unit: 'Packungen',
      shopping_category: 'diapers',
    });
    expect(getVoiceLogEntryEmoji(entry)).toBe('🛒');
    expect(describeVoiceLogEntry(entry, 'de')).toEqual({
      emoji: '🛒',
      title: 'Einkaufsliste · Windeln Größe 3 (2 Packungen)',
      timeText: '',
    });
  });

  it('formats decimal quantities with a comma and omits missing ones', () => {
    expect(formatShoppingQuantity({ shopping_quantity_value: 1.5, shopping_quantity_unit: 'kg' })).toBe('1,5 kg');
    expect(formatShoppingQuantity({ shopping_quantity_value: null, shopping_quantity_unit: null })).toBe('');
  });
});

describe('describeVoiceLogEntry custom activities', () => {
  it('shows an existing custom quantity entry with its own name and emoji', () => {
    const entry = makeEntry({
      type: 'custom',
      feeding_type: null,
      custom_activity_type_id: 'activity-1',
      custom_name: 'Medikament',
      custom_emoji: '💊',
      custom_color: '#E25555',
      custom_tracking_mode: 'quantity',
      custom_quantity: 3,
      custom_unit: 'Tropfen',
      custom_log_entry: true,
    });

    expect(getVoiceLogEntryEmoji(entry)).toBe('💊');
    expect(describeVoiceLogEntry(entry, 'de').title).toBe('Medikament · 3 Tropfen');
  });

  it('marks a definition-only proposal as a new activity', () => {
    const entry = makeEntry({
      type: 'custom',
      feeding_type: null,
      custom_name: 'Bauchlage',
      custom_emoji: '⭐️',
      custom_color: '#5E3DB3',
      custom_tracking_mode: 'duration',
      custom_create_type: true,
      custom_log_entry: false,
    });

    expect(describeVoiceLogEntry(entry, 'de')).toEqual({
      emoji: '⭐️',
      title: 'Eigene Aktivität · Bauchlage',
      timeText: '',
    });
  });
});

describe('localTimeToDate', () => {
  it('accepts a real local calendar time', () => {
    const parsed = localTimeToDate('2026-09-03T14:30');
    expect(parsed).not.toBeNull();
    expect(parsed?.getFullYear()).toBe(2026);
    expect(parsed?.getMonth()).toBe(8);
    expect(parsed?.getDate()).toBe(3);
  });

  it.each([
    '2026-02-30T14:30',
    '2026-13-03T14:30',
    '2026-09-03T24:00',
    '2026-09-03T14:60',
  ])('rejects invalid calendar time %s', (value) => {
    expect(localTimeToDate(value)).toBeNull();
  });
});
