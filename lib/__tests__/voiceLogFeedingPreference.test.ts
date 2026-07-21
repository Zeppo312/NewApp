import { inferRecentMilkPreference } from '../voiceLog/feedingPreference';

describe('inferRecentMilkPreference', () => {
  it('uses the majority of the latest five milk feedings', () => {
    expect(
      inferRecentMilkPreference(['BOTTLE', 'BREAST', 'BREAST', 'BREAST', 'BOTTLE']),
    ).toBe('BREAST');
  });

  it('uses the newest feeding when the recent history is tied', () => {
    expect(inferRecentMilkPreference(['BOTTLE', 'BREAST', 'BREAST', 'BOTTLE'])).toBe(
      'BOTTLE',
    );
  });

  it('ignores other feeding types and entries older than the latest five', () => {
    expect(
      inferRecentMilkPreference([
        'SOLIDS',
        'BOTTLE',
        'BREAST',
        'BOTTLE',
        'BREAST',
        'BOTTLE',
        'BREAST',
        'BREAST',
      ]),
    ).toBe('BOTTLE');
  });

  it('returns null without a usable milk-feeding history', () => {
    expect(inferRecentMilkPreference(['SOLIDS', 'PUMP', null])).toBeNull();
  });
});
