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
    expect(meals?.recordedDays).toBe(6);
    expect(meals?.previousRecordedDays).toBe(6);
    const insight = report.insights.find((item) => item.key === 'feeding')!;
    expect(insight.entries).toHaveLength(12);
    expect(insight.previousEntries).toHaveLength(6);
    expect(insight.pendingEntries).toHaveLength(2);
    expect(insight.observation).toContain('100 % mehr eingetragen');
    expect(insight.entries.every((entry) => entry.label === 'Stillen')).toBe(true);
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
    expect(report.summaries[0].value).toBe(60);
    expect(report.insights[0].entries).toHaveLength(1);
    expect(report.insights[0].entries[0].minutes).toBe(60);
    expect(report.insights[0].pendingEntries[0].minutes).toBe(120);
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

    expect(month.relationship.sampleDays).toBe(9);
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

  it('distinguishes missing categories, days without entries, and the ongoing day without claiming completeness', () => {
    const report = buildCareAnalyticsReport({
      period: 'week', now: new Date(2026, 6, 24, 18),
      careEntries: [feeding(2026, 7, 21), feeding(2026, 7, 22), diaper(2026, 7, 22), diaper(2026, 7, 24)],
      sleepEntries: [{ start_time: at(2026, 7, 22, 8), end_time: at(2026, 7, 22, 9) }],
    });
    const byDate = (date: string) => report.dayCoverage.find((day) => day.key === date)!;
    expect(byDate('2026-07-20')).toMatchObject({ status: 'missing', missingMetrics: ['sleep', 'feeding', 'diaper'] });
    expect(byDate('2026-07-21')).toMatchObject({ status: 'partial', missingMetrics: ['sleep', 'diaper'] });
    expect(byDate('2026-07-22')).toMatchObject({ status: 'present', missingMetrics: [], counts: { sleep: 1, feeding: 1, diaper: 1 } });
    expect(byDate('2026-07-24')).toMatchObject({ status: 'partial', isToday: true });
    expect(report.insights.find((item) => item.key === 'feeding')?.action).toContain('Prüfe zuerst');
  });

  it('keeps ongoing sleep visible but out of averages, evidence, and relationship calculations', () => {
    const report = buildCareAnalyticsReport({
      period: 'week', now: new Date(2026, 6, 24, 18), careEntries: [],
      sleepEntries: [
        { id: 'closed', start_time: at(2026, 7, 21, 8), end_time: at(2026, 7, 21, 9) },
        { id: 'open', start_time: at(2026, 7, 22, 23), end_time: null },
      ],
    });
    expect(report.summaries[0]).toMatchObject({ value: 60, recordedDays: 1, changePercent: null });
    expect(report.insights[0].entries.map((entry) => entry.key)).toEqual(['closed']);
    expect(report.insights[0].pendingEntries).toHaveLength(1);
    expect(report.insights[0].pendingEntries[0]).toMatchObject({ key: 'open', ongoing: true });
    expect(report.insights[0].action).toContain('tatsächliche Endzeit');
    expect(report.dayCoverage.filter((day) => day.openSleep).map((day) => day.key)).toEqual(['2026-07-22', '2026-07-23', '2026-07-24']);
    expect(report.currentTrend.find((point) => point.key === '2026-07-23')).toMatchObject({ partial: false, openSleep: true, sleep: 1440 });
  });

  it('does not turn missing days into zero values or compare a running day to a full day', () => {
    const report = buildCareAnalyticsReport({
      period: 'week', now: new Date(2026, 6, 24, 18), sleepEntries: [],
      careEntries: [feeding(2026, 7, 21), feeding(2026, 7, 21), feeding(2026, 7, 24)],
    });
    expect(report.summaries.find((item) => item.key === 'feeding')).toMatchObject({ value: 2, recordedDays: 1, changePercent: null });
    expect(report.currentTrend[0].feeding).toBeNull();
    expect(report.currentTrend[6]).toMatchObject({ feeding: 1, partial: true });
    expect(report.insights.find((item) => item.key === 'feeding')?.observation).toContain('mindestens 3');
  });

  it('only compares a metric with at least three finished recorded days in both periods', () => {
    const report = buildCareAnalyticsReport({
      period: 'week', now: new Date(2026, 6, 24, 18), sleepEntries: [],
      careEntries: [11, 12, 17, 18, 19, 20, 24].map((day) => feeding(2026, 7, day)),
    });
    // The final day of each period is a snapshot, so it does not count as a full day.
    expect(report.summaries.find((item) => item.key === 'feeding')).toMatchObject({ recordedDays: 3, previousRecordedDays: 2, changePercent: null });
  });

  it('deduplicates the source of a sleep session spanning several finished days and clips it to the period', () => {
    const report = buildCareAnalyticsReport({
      period: 'week', now: new Date(2026, 6, 24, 18), careEntries: [],
      sleepEntries: [{ id: 'long', start_time: at(2026, 7, 17, 23), end_time: at(2026, 7, 19, 1) }],
    });
    expect(report.insights[0].entries).toHaveLength(1);
    expect(report.insights[0].entries[0].minutes).toBe(1500);
    expect(report.insights[0].previousEntries).toHaveLength(0);
    expect(report.summaries[0]).toMatchObject({ value: 750, recordedDays: 2 });
  });

  it('offers an actionable empty report and ignores invalid and future timestamps', () => {
    const report = buildCareAnalyticsReport({
      period: 'week', now: new Date(2026, 6, 24, 18),
      careEntries: [{ ...feeding(2026, 7, 22), start_time: 'invalid' }, feeding(2026, 7, 25)],
      sleepEntries: [{ start_time: 'invalid' }, { start_time: at(2026, 7, 25, 1) }],
    });
    expect(report.hasData).toBe(false);
    expect(report.dayCoverage.every((day) => day.status === 'missing')).toBe(true);
    expect(report.insights.every((insight) => insight.entries.length === 0 && insight.action.includes('Erfasse'))).toBe(true);
  });

  it.each(['en', 'es'] as const)('localizes observations, evidence, entry types, and actions in %s', (locale) => {
    const report = buildCareAnalyticsReport({ period: 'week', now: new Date(2026, 6, 24, 18), careEntries: [feeding(2026, 7, 22)], sleepEntries: [], locale });
    const insight = report.insights.find((item) => item.key === 'feeding')!;
    expect(insight.observation).not.toMatch(/Protokoll|Tage|Eintr/);
    expect(insight.evidence).not.toContain('Einträge');
    expect(insight.entries[0].label).toBe(locale === 'en' ? 'Breastfeeding' : 'Lactancia');
    expect(insight.action).not.toContain('Prüfe');
  });

  it('explains unchanging values and selects the pair with the most observed days when no correlation is computable', () => {
    const report = buildCareAnalyticsReport({
      period: 'month', now: new Date(2026, 6, 24, 18), sleepEntries: [],
      careEntries: Array.from({ length: 10 }, (_, index) => [feeding(2026, 7, 13 + index), diaper(2026, 7, 13 + index)]).flat(),
    });
    expect(report.relationship).toMatchObject({ x: 'feeding', y: 'diaper', coefficient: null, sampleDays: 10 });
    expect(report.relationship.description).toContain('variieren zu wenig');
    expect(report.relationship.description).not.toContain('mindestens 8');
  });
});
