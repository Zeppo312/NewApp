import { buildCycleHistory, buildCyclePrediction } from '../cyclePredictions';
import type { CycleDailyLog, CyclePeriod, CycleSettings } from '../cycleData';

const baseSettings: CycleSettings = {
  user_id: 'user-1',
  average_cycle_length: 28,
  average_period_length: 5,
  luteal_phase_length: 14,
  last_period_start_date: '2026-03-26',
  last_period_end_date: '2026-03-30',
  tracking_goal: 'cycle_health',
  is_postpartum: false,
  is_breastfeeding: false,
  is_perimenopause: false,
  cycle_notes: null,
  created_at: '2026-03-30T00:00:00.000Z',
  updated_at: '2026-03-30T00:00:00.000Z',
};

const periods: CyclePeriod[] = [
  {
    id: 'p1',
    user_id: 'user-1',
    period_start_date: '2026-01-29',
    period_end_date: '2026-02-02',
    cycle_notes: null,
    created_at: '2026-02-02T00:00:00.000Z',
    updated_at: '2026-02-02T00:00:00.000Z',
  },
  {
    id: 'p2',
    user_id: 'user-1',
    period_start_date: '2026-02-26',
    period_end_date: '2026-03-02',
    cycle_notes: null,
    created_at: '2026-03-02T00:00:00.000Z',
    updated_at: '2026-03-02T00:00:00.000Z',
  },
  {
    id: 'p3',
    user_id: 'user-1',
    period_start_date: '2026-03-26',
    period_end_date: '2026-03-30',
    cycle_notes: null,
    created_at: '2026-03-30T00:00:00.000Z',
    updated_at: '2026-03-30T00:00:00.000Z',
  },
];

const buildDailyLog = (
  entryDate: string,
  overrides: Partial<CycleDailyLog> = {},
): CycleDailyLog => ({
  id: `log-${entryDate}`,
  user_id: 'user-1',
  entry_date: entryDate,
  bleeding_intensity: 'none',
  spotting: false,
  cervical_mucus: null,
  lh_test_result: null,
  bbt_celsius: null,
  had_sex: false,
  pain_score: null,
  pms_score: null,
  symptoms: [],
  cycle_notes: null,
  sleep_hours: null,
  stress_level: null,
  illness: false,
  travel: false,
  alcohol_units: null,
  created_at: `${entryDate}T00:00:00.000Z`,
  updated_at: `${entryDate}T00:00:00.000Z`,
  ...overrides,
});

describe('buildCyclePrediction', () => {
  it('keeps the fertile window from collapsing to low fertility on every calendar-only day', () => {
    const fiveDaysBeforeOvulation = buildCyclePrediction({
      settings: baseSettings,
      periods,
      dailyLogs: [],
      referenceDate: new Date('2026-04-04T12:00:00.000Z'),
    });

    const oneDayBeforeOvulation = buildCyclePrediction({
      settings: baseSettings,
      periods,
      dailyLogs: [],
      referenceDate: new Date('2026-04-08T12:00:00.000Z'),
    });

    expect(fiveDaysBeforeOvulation.fertilityLevel).toBe('medium');
    expect(fiveDaysBeforeOvulation.headline).toBe('Heute moderat fruchtbar');
    expect(oneDayBeforeOvulation.fertilityLevel).toBe('high');
  });

  it('lets clearly unfertile observations dampen the calendar-only floor', () => {
    const prediction = buildCyclePrediction({
      settings: baseSettings,
      periods,
      dailyLogs: [
        buildDailyLog('2026-04-04', {
          lh_test_result: 'negative',
          cervical_mucus: 'dry',
        }),
      ],
      referenceDate: new Date('2026-04-04T12:00:00.000Z'),
    });

    expect(prediction.fertilityLevel).toBe('low');
    expect(prediction.headline).toBe('Heute eher geringe Fruchtbarkeit');
  });

  it('widens uncertainty and lowers confidence in postpartum/breastfeeding mode', () => {
    const referenceDate = new Date('2026-04-04T12:00:00.000Z');
    const regular = buildCyclePrediction({
      settings: baseSettings,
      periods,
      dailyLogs: [],
      referenceDate,
    });
    const postpartum = buildCyclePrediction({
      settings: { ...baseSettings, is_postpartum: true, is_breastfeeding: true },
      periods,
      dailyLogs: [],
      referenceDate,
    });

    expect(regular.mode).toBe('default');
    expect(regular.modeNote).toBeNull();
    expect(postpartum.mode).toBe('postpartum');
    expect(postpartum.modeNote).toContain('Stillzeit');
    expect(postpartum.uncertaintyDays).toBeGreaterThan(regular.uncertaintyDays);
    expect(postpartum.confidence).toBeLessThan(regular.confidence);
  });

  it('localizes generated forecast copy without changing prediction logic', () => {
    const prediction = buildCyclePrediction({
      settings: baseSettings,
      periods,
      dailyLogs: [],
      referenceDate: new Date('2026-04-04T12:00:00.000Z'),
      locale: 'en',
    });

    expect(prediction.fertilityLevel).toBe('medium');
    expect(prediction.headline).toBe('Moderately fertile today');
    expect(prediction.factors[0].label).toBe('Calendar');
  });
});

describe('buildCycleHistory', () => {
  it('derives cycle lengths between consecutive periods and marks the current cycle', () => {
    const history = buildCycleHistory({
      settings: baseSettings,
      periods,
      dailyLogs: [],
    });

    expect(history.entries).toHaveLength(3);
    // Neueste zuerst: laufender Zyklus ohne Länge
    expect(history.entries[0].startDate).toBe('2026-03-26');
    expect(history.entries[0].cycleLength).toBeNull();
    expect(history.entries[0].isCurrent).toBe(true);
    expect(history.entries[1].cycleLength).toBe(28);
    expect(history.entries[2].cycleLength).toBe(28);
    expect(history.entries[1].periodLength).toBe(5);
    expect(history.averageCycleLength).toBe(28);
  });
});
