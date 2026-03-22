import { buildFeedingOverview } from '../feedingOverview';

describe('buildFeedingOverview', () => {
  it('sums multiple bottle volumes', () => {
    const overview = buildFeedingOverview([
      { entry_type: 'feeding', feeding_type: 'BOTTLE', feeding_volume_ml: 120 },
      { entry_type: 'feeding', feeding_type: 'BOTTLE', feeding_volume_ml: 180 },
    ]);

    expect(overview.totalBottleMl).toBe(300);
    expect(overview.bottleCount).toBe(2);
    expect(overview.totalFeedingCount).toBe(2);
  });

  it('ignores non-feeding entries', () => {
    const overview = buildFeedingOverview([
      { entry_type: 'diaper', diaper_type: 'WET' } as any,
      { entry_type: 'sleep', sleep_type: 'nacht' } as any,
      { entry_type: 'feeding', feeding_type: 'BOTTLE', feeding_volume_ml: 90 },
    ]);

    expect(overview.totalBottleMl).toBe(90);
    expect(overview.totalFeedingCount).toBe(1);
    expect(overview.bottleCount).toBe(1);
  });

  it('handles null and invalid bottle volume safely', () => {
    const overview = buildFeedingOverview([
      { entry_type: 'feeding', feeding_type: 'BOTTLE', feeding_volume_ml: null },
      { entry_type: 'feeding', feeding_type: 'BOTTLE', feeding_volume_ml: NaN as any },
      { entry_type: 'feeding', feeding_type: 'BOTTLE', feeding_volume_ml: undefined },
    ]);

    expect(overview.totalBottleMl).toBe(0);
    expect(overview.bottleCount).toBe(3);
    expect(overview.totalFeedingCount).toBe(3);
  });

  it('uses sub_type fallback when feeding_type is missing', () => {
    const overview = buildFeedingOverview([
      { entry_type: 'feeding', sub_type: 'feeding_bottle', feeding_volume_ml: 150 },
      { entry_type: 'feeding', sub_type: 'feeding_breast' },
      { entry_type: 'feeding', sub_type: 'feeding_solids' },
    ]);

    expect(overview.totalBottleMl).toBe(150);
    expect(overview.bottleCount).toBe(1);
    expect(overview.breastCount).toBe(1);
    expect(overview.solidsCount).toBe(1);
  });

  it('keeps detail items in fixed order bottle -> breast -> solids', () => {
    const overview = buildFeedingOverview([
      { entry_type: 'feeding', feeding_type: 'SOLIDS' },
      { entry_type: 'feeding', feeding_type: 'BREAST' },
      { entry_type: 'feeding', feeding_type: 'BOTTLE', feeding_volume_ml: 120 },
    ]);

    expect(overview.detailItems.map((item) => item.key)).toEqual(['bottle', 'breast', 'solids']);
  });
});
