jest.mock('../supabase', () => ({
  supabase: {},
  getBabyCareEntriesForDate: jest.fn(),
  getBabyCareEntriesForDateRange: jest.fn(),
  getBabyCareEntriesForMonth: jest.fn(),
}));

import { mapCareToDaily } from '../dailyCache';

describe('mapCareToDaily custom activities', () => {
  it('keeps the custom definition snapshot and quantity for the timeline', () => {
    const [entry] = mapCareToDaily([
      {
        id: 'entry-1',
        baby_id: 'baby-1',
        entry_type: 'custom',
        start_time: '2026-09-01T08:30:00.000Z',
        end_time: '2026-09-01T08:30:00.000Z',
        custom_activity_type_id: 'custom-1',
        custom_name: 'Medikament',
        custom_emoji: '💊',
        custom_color: '#E25555',
        custom_tracking_mode: 'quantity',
        custom_quantity: 3,
        custom_unit: 'Tropfen',
      },
    ]);

    expect(entry).toMatchObject({
      entry_type: 'custom',
      custom_activity_type_id: 'custom-1',
      custom_name: 'Medikament',
      custom_emoji: '💊',
      custom_color: '#E25555',
      custom_tracking_mode: 'quantity',
      custom_quantity: 3,
      custom_unit: 'Tropfen',
    });
  });
});
