import { buildCareAnalyticsReport } from '../advisor/careAnalytics';
import type { SleepEntry } from '../sleepData';
import type { BabyCareEntry } from '../supabase';

const at = (year: number, month: number, day: number, hour = 12) =>
  new Date(year, month - 1, day, hour, 0, 0, 0).toISOString();

const feeding = (year: number, month: number, day: number): BabyCareEntry => ({
  entry_type: 'feeding',
  feeding_type: 'BREAST',
  start_time: at(year, month, day),
});

const diaper = (year: number, month: number, day: number): BabyCareEntry => ({
  entry_type: 'diaper',
  diaper_type: 'WET',
  start_time: at(year, month, day, 15),
});

describe('care analytics reports', () => {
  it('builds a seven-day report and compares recorded-day averages honestly', () => {
    const careEntries: BabyCareEntry[] = [];
    for (let day = 11; day <= 24; day += 1) {
      careEntries.push(feeding(2026, 7, day), diaper(2026, 7, day));
      if (day >= 18) careEntries.push(feeding(2026, 7, day));
    }
    careEntries.push(
      { entry_type: 'feeding', feeding_type: 'PUMP', start_time: at(2026, 7, 24, 14) },
      { entry_type: 'feeding', feeding_type: 'WATER', start_time: at(2026, 7, 24, 16) },
    );

    const report = buildCareAnalyticsReport({
      period: 'week',
      careEntries,
      sleepEntries: [],
      now: new Date(2026, 6, 24, 18, 0),
    });

    const meals = report.summaries.find((summary) => summary.key === 'feeding');
    expect(report.currentTrend).toHaveLength(7);
    expect(report.coverageDays).toBe(7);
    expect(meals?.value).toBe(2);
    expect(meals?.previousValue).toBe(1);
    expect(meals?.changePercent).toBe(100);
  });

  it('splits sleep that crosses midnight across the affected days', () => {
    const sleepEntries: SleepEntry[] = [{
      start_time: at(2026, 7, 23, 23),
      end_time: at(2026, 7, 24, 2),
    }];

    const report = buildCareAnalyticsReport({
      period: 'week',
      careEntries: [],
      sleepEntries,
      now: new Date(2026, 6, 24, 18, 0),
    });

    const sleepValues = report.currentTrend
      .map((point) => point.sleep)
      .filter((value): value is number => value !== null);
    expect(sleepValues).toEqual([60, 120]);
    expect(report.coverageDays).toBe(2);
  });

  it('only describes a relationship after at least eight common observed days', () => {
    const careEntries: BabyCareEntry[] = [];
    const sleepEntries: SleepEntry[] = [];
    for (let day = 15; day <= 24; day += 1) {
      const count = day - 14;
      for (let index = 0; index < count; index += 1) careEntries.push(feeding(2026, 7, day));
      sleepEntries.push({
        start_time: at(2026, 7, day, 1),
        end_time: new Date(new Date(at(2026, 7, day, 1)).getTime() + count * 30 * 60_000).toISOString(),
      });
    }

    const month = buildCareAnalyticsReport({
      period: 'month',
      careEntries,
      sleepEntries,
      now: new Date(2026, 6, 24, 18, 0),
    });
    const week = buildCareAnalyticsReport({
      period: 'week',
      careEntries,
      sleepEntries,
      now: new Date(2026, 6, 24, 18, 0),
    });

    expect(month.relationship.sampleDays).toBe(10);
    expect(month.relationship.coefficient).toBeCloseTo(1, 5);
    expect(month.relationship.description).toContain('keine Ursache');
    expect(week.relationship.coefficient).toBeNull();
    expect(week.relationship.description).toContain('mindestens 8 Tage');
  });

  it('groups a year report into twelve monthly trend points', () => {
    const report = buildCareAnalyticsReport({
      period: 'year',
      careEntries: [feeding(2026, 7, 24)],
      sleepEntries: [],
      now: new Date(2026, 6, 24, 18, 0),
    });

    expect(report.currentTrend).toHaveLength(12);
    expect(report.previousTrend).toHaveLength(12);
    expect(report.comparisonLabel).toBe('gleicher Zeitraum im Vorjahr');
  });
});
